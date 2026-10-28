import express from 'express';
import http from 'http';
import cors from 'cors';
import { CONFIG } from './config';
import { socketService } from './services/socket.service';
import { baileysService } from './services/baileys.service';
import { inactivityService } from './services/inactivity.service';
import { WebhookController } from './controllers/webhook.controller';
import webhookRoutes from './routes/webhook.routes';
import chatRoutes from './routes/chat.routes';
import metricsRoutes from './routes/metrics.routes';
import authRoutes from './routes/auth.routes';
import agendaRoutes from './routes/agenda.routes';
import preparacionesRoutes from './routes/preparaciones.routes';
import tarifasRoutes from './routes/tarifas.routes';
import { requireAuth, requireRole } from './middleware/auth.middleware';
import { authService } from './services/auth.service';
import { store } from './services/store.service';
import { incomingMessageQueue } from './services/incomingMessageQueue.service';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { securityHeaders, rateLimit } from './middleware/security.middleware';

const app = express();
const server = http.createServer(app);

// Servir estáticos públicos (stickers, imágenes de mascotas, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = [CONFIG.FRONTEND_URL, CONFIG.BACKEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];
      if (
        !origin ||
        allowed.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
        /^https?:\/\/([a-zA-Z0-9.-]+\.)?hun\.edu\.co(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);
app.use(securityHeaders);
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buffer) => { (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer); },
}));
app.use(express.urlencoded({ extended: true }));

// Inicializar WebSockets
socketService.init(server);

// Rutas de API
const verifyMetaSignature: express.RequestHandler = (req, res, next) => {
  if (req.method !== 'POST') return next();
  if (req.path !== '/' && req.path !== '') return next();
  if (!CONFIG.WHATSAPP_APP_SECRET) {
    if (CONFIG.NODE_ENV !== 'production') return next();
    return res.status(503).json({ error: 'Webhook no configurado: falta WHATSAPP_APP_SECRET.' });
  }
  const signature = req.header('x-hub-signature-256') || '';
  const expected = `sha256=${crypto.createHmac('sha256', CONFIG.WHATSAPP_APP_SECRET).update((req as express.Request & { rawBody?: Buffer }).rawBody || Buffer.alloc(0)).digest('hex')}`;
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return res.status(401).json({ error: 'Firma de webhook inválida.' });
  }
  return next();
};
app.use('/api/webhook', verifyMetaSignature, rateLimit(120, 60_000), webhookRoutes);
app.use('/api/auth', rateLimit(20, 15 * 60_000), authRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'HUN Bot Paciente Particular Backend', version: '1.0.0', time: new Date().toISOString() });
});
app.use('/api', requireAuth);
app.get('/api/ops/health', async (_req, res) => {
  const db = store.getDatabaseClient();
  let database = 'disconnected';
  if (db) {
    try {
      await db.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'error';
    }
  }
  const queue = await incomingMessageQueue.getStats().catch(() => ({ persistent: false, pending: null, processing: null, failed: null }));
  const whatsapp = baileysService.isConnected()
    ? 'baileys'
    : CONFIG.WHATSAPP_TOKEN && CONFIG.WHATSAPP_PHONE_NUMBER_ID
      ? 'meta-configured'
      : 'simulated';
  const status = database === 'connected' && queue.persistent && queue.failed === 0 && Number(queue.pending || 0) < 100 ? 'ok' : 'degraded';
  res.json({ status, uptimeSeconds: Math.floor(process.uptime()), checkedAt: new Date().toISOString(), services: { database, whatsapp, queue } });
});
app.post('/api/webhook/simulate', WebhookController.simulateIncomingMessage);
app.use('/api/chat', chatRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/preparaciones', preparacionesRoutes);
app.use('/api/tarifas', tarifasRoutes);
app.use('/api', metricsRoutes);

// Estado de WhatsApp Web / Baileys (QR) y Meta Cloud API
app.get('/api/whatsapp/status', (req, res) => {
  res.json(baileysService.getStatus());
});

app.get('/api/whatsapp/config', (req, res) => {
  res.json({
    hasToken: Boolean(CONFIG.WHATSAPP_TOKEN && CONFIG.WHATSAPP_TOKEN !== 'EAAG...' && CONFIG.WHATSAPP_TOKEN.length > 20),
    phoneNumberId: CONFIG.WHATSAPP_PHONE_NUMBER_ID || null,
    verifyToken: CONFIG.WHATSAPP_VERIFY_TOKEN,
    apiVersion: CONFIG.WHATSAPP_API_VERSION,
    port: CONFIG.PORT,
    backendUrl: CONFIG.BACKEND_URL,
    isBaileysConnected: baileysService.isConnected(),
  });
});

app.post('/api/whatsapp/disconnect', requireRole('ADMIN', 'AUXILIAR'), async (req, res) => {
  await baileysService.disconnect();
  res.json({ success: true });
});

// Servir el Dashboard compilado (frontend/dist) desde el mismo puerto del servidor en despliegues
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const frontendIndexHtml = path.join(frontendDistPath, 'index.html');
if (fs.existsSync(frontendIndexHtml)) {
  app.use(express.static(frontendDistPath));
  app.get(/^(?!\/api|\/socket\.io).*/, (_req, res) => {
    res.sendFile(frontendIndexHtml);
  });
}

// Conectar mensajes de Baileys al motor del HUN (procesamiento reactivo en tiempo real sin doble encolamiento)
baileysService.setMessageHandler(async (phone, text, name, messageId) => {
  console.log(`⚡ [Baileys -> Motor HUN] Procesando mensaje en vivo de ${phone} (${name}): "${text}"`);
  return WebhookController.processMessage(phone, text, name, messageId, 'BAILEYS');
});

// Manejo global de excepciones no capturadas para mantener la alta disponibilidad del servidor
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('⚠️ [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('❌ [CRITICAL] Uncaught Exception:', err);
});

function getLocalLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

Promise.all([authService.initialize(), store.waitUntilReady()]).then(async () => {
  const queueReady = await incomingMessageQueue.initialize((job) =>
    WebhookController.processMessage(job.phone, job.text, job.senderName, job.waMessageId, job.sourceChannel)
  );
  if (!queueReady && CONFIG.NODE_ENV === 'production') {
    if (process.env.STRICT_PRODUCTION_DB === 'true') {
      throw new Error('PostgreSQL es obligatorio en producción para persistir la cola de mensajes entrantes.');
    }
    console.warn('⚠️ [PRODUCCIÓN] PostgreSQL no disponible. Operando en modo memoria/híbrido hasta conectar PostgreSQL.');
  }
  const lanIp = getLocalLanIp();
  server.listen(CONFIG.PORT, '0.0.0.0', () => {
    console.log(`===================================================`);
    console.log(`🏥 HUN Chatbot & Realtime Dashboard Server activo`);
    console.log(`💻 Acceso Local:   http://localhost:${CONFIG.PORT}`);
    console.log(`🌐 Acceso Red HUN: http://${lanIp}:${CONFIG.PORT}`);
    if (CONFIG.BACKEND_URL && !CONFIG.BACKEND_URL.includes('localhost')) {
      console.log(`🌍 Subdominio HUN: ${CONFIG.BACKEND_URL}`);
    }
    console.log(`🔗 Webhook Meta:   ${CONFIG.BACKEND_URL ? `${CONFIG.BACKEND_URL}/api/webhook` : `http://${lanIp}:${CONFIG.PORT}/api/webhook`}`);
    console.log(`⚡ WebSocket & Dashboard Unificados listos`);
    console.log(`===================================================`);

    // Iniciar cliente de WhatsApp Web (Baileys) para generar QR
    baileysService.init();

    // Iniciar monitoreo de inactividad de 10 minutos
    inactivityService.init();
  });
}).catch((error) => {
  console.error('No se pudo iniciar el servidor HUN de forma segura:', error);
  process.exitCode = 1;
});
