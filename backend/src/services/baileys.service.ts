import type { WASocket } from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { socketService } from './socket.service';
import { normalizeColombianPhone } from '../utils/phone';

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';

class BaileysService {
  private sock: WASocket | null = null;
  private qrCode: string | null = null;
  private qrDataUrl: string | null = null;
  private status: WhatsAppConnectionStatus = 'DISCONNECTED';
  private connectedPhone: string | null = null;
  private messageHandler: ((phone: string, text: string, name?: string, messageId?: string) => Promise<any>) | null = null;
  private isInitializing: boolean = false;

  // Mapa para recordar el JID exacto (@lid o @s.whatsapp.net) de cada contacto
  private jidMap: Map<string, string> = new Map();

  public setMessageHandler(handler: (phone: string, text: string, name?: string, messageId?: string) => Promise<any>) {
    this.messageHandler = handler;
  }

  public getStatus() {
    return {
      status: this.status,
      qrCode: this.qrCode,
      qrDataUrl: this.qrDataUrl,
      connectedPhone: this.connectedPhone,
    };
  }

  public isConnected(): boolean {
    return this.status === 'CONNECTED' && this.sock !== null;
  }

  public async init() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    const authFolder = path.join(process.cwd(), 'auth_info_baileys');
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    try {
      // Baileys es ESM y algunas versiones de Node/tsx lo resuelven mal si se
      // importa al cargar el servidor CommonJS. Lo cargamos solo al activar QR.
      const baileys = await Function('specifier', 'return import(specifier)')('@whiskeysockets/baileys') as typeof import('@whiskeysockets/baileys');
      const {
        default: makeWASocket,
        DisconnectReason,
        useMultiFileAuthState,
        fetchLatestBaileysVersion,
      } = baileys;
      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      const { version } = await fetchLatestBaileysVersion();

      console.log(`📱 Iniciando conexión WhatsApp Web/Business (Baileys v${version.join('.')})...`);

      this.sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        browser: ['HUN ChatBot', 'Chrome', '1.0.0'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrCode = qr;
          this.status = 'SCAN_QR';

          try {
            this.qrDataUrl = await QRCode.toDataURL(qr);
          } catch (e) {
            this.qrDataUrl = null;
          }

          console.log('\n===============================================================');
          console.log('📲 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP BUSINESS:');
          console.log('   (WhatsApp > Ajustes > Dispositivos vinculados > Vincular)');
          console.log('===============================================================\n');
          qrcodeTerminal.generate(qr, { small: true });

          socketService.emitWhatsAppStatus(this.getStatus());
        }

        if (connection === 'connecting') {
          this.status = 'CONNECTING';
          socketService.emitWhatsAppStatus(this.getStatus());
        }

        if (connection === 'open') {
          this.status = 'CONNECTED';
          this.qrCode = null;
          this.qrDataUrl = null;

          const userJid = this.sock?.user?.id || '';
          this.connectedPhone = userJid.split(':')[0].split('@')[0];

          console.log('\n===============================================================');
          console.log(`✅ ¡WHATSAPP BUSINESS VINCULADO CON ÉXITO!`);
          console.log(`📞 Número conectado: +${this.connectedPhone}`);
          console.log(`🤖 El bot ahora responderá automáticamente a cualquier mensaje.`);
          console.log('===============================================================\n');

          socketService.emitWhatsAppStatus(this.getStatus());
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          console.log(`⚠️ Conexión de WhatsApp cerrada. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);
          this.status = 'DISCONNECTED';
          socketService.emitWhatsAppStatus(this.getStatus());

          if (shouldReconnect) {
            this.isInitializing = false;
            setTimeout(() => this.init(), 3000);
          } else {
            console.log('❌ Sesión cerrada por el usuario. Limpiando credenciales para nuevo QR...');
            try {
              fs.rmSync(authFolder, { recursive: true, force: true });
            } catch (err) {}
            this.isInitializing = false;
            setTimeout(() => this.init(), 2000);
          }
        }
      });

      // Escucha de mensajes entrantes
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message) continue;

          // Ignorar estados de WhatsApp y mensajes de grupos
          const remoteJid = msg.key.remoteJid || '';
          if (remoteJid.includes('@broadcast') || remoteJid.includes('@g.us')) continue;

          // Si el mensaje es enviado por nosotros mismos desde el celular, no responder en bucle
          if (msg.key.fromMe) continue;

          const senderPhone = remoteJid.split('@')[0];
          const senderName = msg.pushName || 'Paciente';

          // Guardar en el mapa de JIDs para enrutamiento exacto (@lid o @s.whatsapp.net)
          this.jidMap.set(senderPhone, remoteJid);
          this.jidMap.set(remoteJid, remoteJid);
          const normalizedSender = normalizeColombianPhone(senderPhone);
          if (normalizedSender) {
            this.jidMap.set(normalizedSender, remoteJid);
            if (normalizedSender.startsWith('57') && normalizedSender.length === 12) {
              this.jidMap.set(normalizedSender.slice(2), remoteJid);
            }
          }

          // Extraer texto según el tipo de mensaje
          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.buttonsResponseMessage?.selectedDisplayText ||
            msg.message.listResponseMessage?.title ||
            '';

          if (text.trim() && this.messageHandler) {
            console.log(`📥 [WhatsApp Recibido] De ${remoteJid} (${senderName}): "${text}"`);
            try {
              await this.messageHandler(senderPhone, text.trim(), senderName, msg.key.id || undefined);
            } catch (msgErr: any) {
              console.error(`❌ [Baileys] Error procesando mensaje de ${senderPhone}:`, msgErr.message || msgErr);
            }
          }
        }
      });
    } catch (err: any) {
      console.error('Error inicializando Baileys:', err);
      this.isInitializing = false;
    }
  }

  public async sendMessage(phoneOrJid: string, text: string): Promise<boolean> {
    if (!phoneOrJid || typeof phoneOrJid !== 'string') {
      console.warn(`⚠️ Baileys sendMessage llamado sin destinatario válido:`, phoneOrJid);
      return false;
    }

    if (!this.sock || this.status !== 'CONNECTED') {
      console.warn(`⚠️ Baileys no conectado: sock=${!!this.sock}, status=${this.status}`);
      return false;
    }

    try {
      const cleanPhone = phoneOrJid.replace(/[^0-9]/g, '');
      const normalizedPhone = normalizeColombianPhone(phoneOrJid) || cleanPhone;

      // Determinar JID de destino (dar prioridad al JID exacto registrado, ej. @lid)
      let targetJid = this.jidMap.get(phoneOrJid) || this.jidMap.get(cleanPhone) || this.jidMap.get(normalizedPhone);
      if (!targetJid) {
        targetJid = phoneOrJid.includes('@') ? phoneOrJid : `${normalizedPhone}@s.whatsapp.net`;
      }

      const cleanText = (text || '').replace(/\*\*/g, '');
      console.log(`📤 [WhatsApp Enviando a ${targetJid}]: "${cleanText.substring(0, 60)}..."`);
      await this.sock.sendMessage(targetJid, { text: cleanText });
      console.log(`✅ [WhatsApp Entregado a ${targetJid}]`);
      return true;
    } catch (err: any) {
      console.error(`❌ Error enviando mensaje por Baileys a ${phoneOrJid}:`, err.message || err);
      return false;
    }
  }

  public async sendImage(phoneOrJid: string, imagePathOrUrl: string, caption?: string): Promise<boolean> {
    if (!phoneOrJid || typeof phoneOrJid !== 'string') {
      console.warn(`⚠️ Baileys sendImage llamado sin destinatario válido:`, phoneOrJid);
      return false;
    }

    if (!this.sock || this.status !== 'CONNECTED') {
      console.warn(`⚠️ Baileys no conectado para imagen: sock=${!!this.sock}, status=${this.status}`);
      return false;
    }

    try {
      const cleanPhone = phoneOrJid.replace(/[^0-9]/g, '');
      const normalizedPhone = normalizeColombianPhone(phoneOrJid) || cleanPhone;
      let targetJid = this.jidMap.get(phoneOrJid) || this.jidMap.get(cleanPhone) || this.jidMap.get(normalizedPhone);
      if (!targetJid) {
        targetJid = phoneOrJid.includes('@') ? phoneOrJid : `${normalizedPhone}@s.whatsapp.net`;
      }

      let imagePayload: any;
      if (imagePathOrUrl.startsWith('http://') || imagePathOrUrl.startsWith('https://')) {
        imagePayload = { url: imagePathOrUrl };
      } else {
        let localPath = imagePathOrUrl;
        if (imagePathOrUrl.startsWith('/')) {
          const tryPublic = path.join(process.cwd(), 'public', imagePathOrUrl.substring(1));
          const tryFrontend = path.join(process.cwd(), '../frontend/public', imagePathOrUrl.substring(1));
          if (fs.existsSync(tryPublic)) {
            localPath = tryPublic;
          } else if (fs.existsSync(tryFrontend)) {
            localPath = tryFrontend;
          }
        }
        if (fs.existsSync(localPath)) {
          imagePayload = fs.readFileSync(localPath);
        } else {
          imagePayload = { url: imagePathOrUrl };
        }
      }

      console.log(`📤 [WhatsApp Enviando imagen/sticker a ${targetJid}]`);
      await this.sock.sendMessage(targetJid, { image: imagePayload, caption });
      console.log(`✅ [WhatsApp Imagen/Sticker Entregado a ${targetJid}]`);
      return true;
    } catch (err: any) {
      console.error(`❌ Error enviando imagen por Baileys a ${phoneOrJid}:`, err.message || err);
      return false;
    }
  }

  public async sendSticker(phoneOrJid: string, stickerPathOrUrl?: string): Promise<boolean> {
    if (!phoneOrJid || typeof phoneOrJid !== 'string') {
      console.warn(`⚠️ Baileys sendSticker llamado sin destinatario válido:`, phoneOrJid);
      return false;
    }

    if (!this.sock || this.status !== 'CONNECTED') {
      console.warn(`⚠️ Baileys no conectado para sticker: sock=${!!this.sock}, status=${this.status}`);
      return false;
    }

    try {
      const cleanPhone = phoneOrJid.replace(/[^0-9]/g, '');
      const normalizedPhone = normalizeColombianPhone(phoneOrJid) || cleanPhone;
      let targetJid = this.jidMap.get(phoneOrJid) || this.jidMap.get(cleanPhone) || this.jidMap.get(normalizedPhone);
      if (!targetJid) {
        targetJid = phoneOrJid.includes('@') ? phoneOrJid : `${normalizedPhone}@s.whatsapp.net`;
      }

      // Priorizar el archivo WebP nativo preparado para WhatsApp (512x512 transparente)
      const possibleWebpPaths = [
        path.join(process.cwd(), 'public/nicol-sticker.webp'),
        path.join(process.cwd(), '../frontend/public/nicol-sticker.webp'),
        path.join(process.cwd(), 'dist/public/nicol-sticker.webp'),
      ];

      let webpBuffer: Buffer | null = null;
      for (const p of possibleWebpPaths) {
        if (fs.existsSync(p)) {
          webpBuffer = fs.readFileSync(p);
          break;
        }
      }

      if (webpBuffer) {
        console.log(`📤 [WhatsApp Enviando Sticker Nativo WebP a ${targetJid}]`);
        await this.sock.sendMessage(targetJid, { sticker: webpBuffer });
        console.log(`✅ [WhatsApp Sticker Nativo Entregado a ${targetJid}]`);
        return true;
      }

      // Fallback a imagen transparente si no se encuentra el webp
      console.log(`ℹ️ WebP no encontrado, enviando como imagen a ${targetJid}`);
      return this.sendImage(phoneOrJid, stickerPathOrUrl || '/nicol-sticker-clean.png');
    } catch (err: any) {
      console.error(`❌ Error enviando sticker por Baileys a ${phoneOrJid}:`, err.message || err);
      try {
        return await this.sendImage(phoneOrJid, stickerPathOrUrl || '/nicol-sticker-clean.png');
      } catch {
        return false;
      }
    }
  }

  public async disconnect() {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.status = 'DISCONNECTED';
      socketService.emitWhatsAppStatus(this.getStatus());
    }
  }
}

export const baileysService = new BaileysService();
