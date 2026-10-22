import React, { useState, useEffect } from 'react';
import {
  Globe,
  Database,
  Copy,
  Check,
  Server,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Cpu,
  Layers,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Play,
  Send,
  HelpCircle,
  Sparkles,
  QrCode,
  Lock,
} from 'lucide-react';
import { fetchMetaConfig, MetaConfigStatus, api } from '../lib/api';

export const SettingsTab: React.FC = () => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedPrisma, setCopiedPrisma] = useState(false);
  const [copiedNgrok, setCopiedNgrok] = useState(false);

  // Estado de configuración real del backend
  const [metaConfig, setMetaConfig] = useState<MetaConfigStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [opsHealth, setOpsHealth] = useState<any>(null);

  // Prueba interactiva del Webhook
  const [testResult, setTestResult] = useState<{ status: 'idle' | 'loading' | 'success' | 'error'; message: string }>({
    status: 'idle',
    message: '',
  });

  // URL del Webhook sugerida
  const defaultHost = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
  const webhookUrl = `${defaultHost}/api/webhook`;
  const prismaCommand = 'npx prisma db push';
  const ngrokCommand = 'ngrok http 3001';

  const loadConfig = () => {
    setLoadingConfig(true);
    fetchMetaConfig()
      .then(setMetaConfig)
      .catch((err) => console.error('Error cargando configuración de WhatsApp:', err))
      .finally(() => setLoadingConfig(false));
  };

  useEffect(() => {
    loadConfig();
    const loadHealth = () => api.get('/api/ops/health').then(({ data }) => setOpsHealth(data)).catch(() => setOpsHealth(null));
    void loadHealth();
    const interval = window.setInterval(loadHealth, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const envContent = `PORT=3001
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hun_chatbot?schema=public"
DATABASE_CONNECTION_LIMIT=10
FRONTEND_URL="http://localhost:5173"

# Credenciales de Meta Developers:
WHATSAPP_TOKEN="${metaConfig?.hasToken ? '••••••••••••••••••••••••••••' : 'EAAG...tu_token_aqui...'}"
WHATSAPP_PHONE_NUMBER_ID="${metaConfig?.phoneNumberId || '1234567890'}"
WHATSAPP_VERIFY_TOKEN="${metaConfig?.verifyToken || 'dev-only-change-me'}"
WHATSAPP_APP_SECRET="secreto_de_app_Meta (no lo compartas)"
WHATSAPP_API_VERSION="${metaConfig?.apiVersion || 'v20.0'}"`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestWebhook = async () => {
    setTestResult({ status: 'loading', message: 'Enviando petición de verificación a /api/webhook...' });
    try {
      const verifyToken = metaConfig?.verifyToken || 'dev-only-change-me';
      const challengeCode = `hun_challenge_${Math.floor(Math.random() * 10000)}`;
      const response = await api.get('/api/webhook', {
        params: {
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challengeCode,
        },
      });

      if (response.status === 200 && String(response.data) === challengeCode) {
        setTestResult({
          status: 'success',
          message: `✅ Webhook respondiendo exitosamente (200 OK) con el challenge "${challengeCode}".`,
        });
      } else {
        setTestResult({
          status: 'error',
          message: `⚠️ El servidor respondió con estado ${response.status}, pero el challenge no coincidió.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `❌ Error al probar webhook: ${err.response?.data?.error || err.message}`,
      });
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Banner Superior de Infraestructura */}
      <div className="bg-gradient-to-r from-[#002B49] via-[#003865] to-[#00A3E0] rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-sky-950/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-0.5 rounded-full bg-white/15 text-cyan-200 text-xs font-bold tracking-wide backdrop-blur-xs border border-white/20">
              Arquitectura Enterprise · HUN
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-300 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Servicios en Línea
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Configuración & Conexión Meta WhatsApp Cloud API
          </h2>
          <p className="text-xs sm:text-sm text-cyan-100/90 max-w-2xl leading-relaxed">
            Parámetros del Webhook oficial, credenciales de Meta Developers, orquestación de la base de datos PostgreSQL 16 con Prisma ORM y estado de los servidores.
          </p>
        </div>

        <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/15">
          <Server className="w-5 h-5 text-cyan-300" strokeWidth={1.5} />
          <div className="text-xs">
            <div className="font-bold text-white">API Puerto :3001</div>
            <div className="text-cyan-200/80 text-[11px]">Backend Node.js + Express</div>
          </div>
        </div>
      </div>

      <section aria-label="Salud operativa" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Salud operativa</h3>
            <p className="mt-1 text-xs text-slate-500">Dependencias y cola de mensajes · actualización cada 30 s</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${opsHealth?.status === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
            {opsHealth?.status === 'ok' ? 'Operativo' : 'Revisar servicios'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['PostgreSQL', opsHealth?.services?.database || 'sin datos'],
            ['WhatsApp', opsHealth?.services?.whatsapp || 'sin datos'],
            ['Pendientes', opsHealth?.services?.queue?.pending ?? '—'],
            ['Fallidos en cola', opsHealth?.services?.queue?.failed ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
              <span className="mt-1 block truncate text-sm font-bold text-slate-800">{String(value)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Grid Principal de 2 Columnas Amplias */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
        {/* Columna Izquierda: WhatsApp Meta Cloud API y Guía Paso a Paso */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-7 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#00A884] flex items-center justify-center border border-emerald-100 shadow-2xs">
                <Globe className="w-6 h-6" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Conexión con WhatsApp Business Oficial
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Meta Cloud API Oficial · Webhook y Tokens de Seguridad
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#008069] border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              {metaConfig?.apiVersion || 'API v20.0'}
            </span>
          </div>

          {/* Tarjeta de Estado Actual del Backend */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Estado del Motor de WhatsApp
              </span>
              <button
                onClick={loadConfig}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingConfig ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400">Meta Access Token</div>
                <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                  {metaConfig?.hasToken ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Configurado
                    </span>
                  ) : (
                    <span className="text-amber-700 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Pendiente
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400">Phone Number ID</div>
                <div className="font-mono text-slate-800 text-[11px] mt-0.5 truncate font-semibold">
                  {metaConfig?.phoneNumberId || 'No asignado'}
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400">WhatsApp Web QR</div>
                <div className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                  {metaConfig?.isBaileysConnected ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Conectado
                    </span>
                  ) : (
                    <span className="text-slate-500 font-medium">Disponible (QR)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Guía Paso a Paso */}
          <div className="space-y-4">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#002B49] text-white flex items-center justify-center text-[10px] font-black">
                1
              </span>
              Paso 1: Configurar Webhook en Meta for Developers
            </h4>

            <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  URL de devolución de llamada (Callback URL):
                </label>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-blue-700 font-mono flex-1 text-xs shadow-2xs">
                    {webhookUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Copiar URL"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span className="text-emerald-700">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Identificador de verificación (Verify Token):
                </label>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-slate-800 font-mono flex-1 text-xs shadow-2xs">
                    {metaConfig?.verifyToken || 'dev-only-change-me'}
                  </code>
                  <button
                    onClick={() => copyToClipboard(metaConfig?.verifyToken || 'dev-only-change-me', setCopiedToken)}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Copiar Token"
                  >
                    {copiedToken ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                        <span className="text-emerald-700">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 flex items-start gap-2 text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" strokeWidth={1.5} />
                <p className="text-[11px] leading-relaxed">
                  En los campos a suscribir de WhatsApp en Meta, marca obligatoriamente la casilla <strong className="text-slate-800 font-semibold">messages</strong> para recibir mensajes entrantes en tiempo real.
                </p>
              </div>

              {/* Botón de Test de Webhook */}
              <div className="pt-2">
                <button
                  onClick={handleTestWebhook}
                  disabled={testResult.status === 'loading'}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-60"
                >
                  <Play className="w-3 h-3" />
                  <span>Probar verificación de Webhook (GET Ping)</span>
                </button>
                {testResult.message && (
                  <p className={`mt-2 text-xs p-2.5 rounded-lg border ${testResult.status === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                    {testResult.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Paso 2: Exposición con Ngrok para desarrollo */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-[#002B49] text-white flex items-center justify-center text-[10px] font-black">
                2
              </span>
              Paso 2: Túnel HTTPS para Desarrollo Local (Ngrok)
            </h4>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
              <p className="text-slate-600">
                Meta exige una URL pública con HTTPS. Para exponer tu backend local en puerto 3001, ejecuta en una terminal:
              </p>
              <div className="flex items-center gap-2">
                <code className="bg-[#001D33] text-cyan-200 px-3 py-2 rounded-xl font-mono flex-1 text-xs">
                  {ngrokCommand}
                </code>
                <button
                  onClick={() => copyToClipboard(ngrokCommand, setCopiedNgrok)}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl border border-slate-200 shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  {copiedNgrok ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>Copiar</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Luego copia la URL https que te entregue Ngrok y agrégale <code className="font-bold">/api/webhook</code> en Meta Developers.
              </p>
            </div>
          </div>

          {/* Paso 3: Variables de Entorno */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#002B49] text-white flex items-center justify-center text-[10px] font-black">
                  3
                </span>
                Variables en <code className="text-[#00A3E0] font-mono lowercase">backend/.env</code>
              </h4>
              <button
                onClick={() => copyToClipboard(envContent, setCopiedEnv)}
                className="text-xs font-semibold text-slate-600 hover:text-[#002B49] flex items-center gap-1 transition cursor-pointer"
              >
                {copiedEnv ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                    <span className="text-emerald-700">Copiado al portapapeles</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.5} />
                    <span>Copiar bloque</span>
                  </>
                )}
              </button>
            </div>

            <pre className="bg-[#001D33] text-cyan-100 p-4 rounded-2xl text-xs font-mono overflow-x-auto leading-relaxed border border-sky-900/40 shadow-inner">
              {envContent}
            </pre>
          </div>
        </div>

        {/* Columna Derecha: PostgreSQL & Reglas Clínicas */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tarjeta de PostgreSQL 16 */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#00A3E0] flex items-center justify-center border border-blue-100 shadow-2xs">
                  <Database className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Base de Datos PostgreSQL
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Prisma ORM · Puerto 5432 · hun_chatbot
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-blue-600" strokeWidth={1.5} />
                PG 16 Activo
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              El esquema clínico relacional contiene las <strong className="text-slate-800">17 tablas operativas</strong> para la persistencia íntegra de pacientes, citas médicas, médicos y tickets asistenciales.
            </p>

            {/* Badges de Tablas Principales */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="font-bold text-slate-800 text-xs">citas & horarios</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Exclusión GiST 30 min</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="font-bold text-slate-800 text-xs">doctores (16)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">8 Especialidades HUN</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="font-bold text-slate-800 text-xs">contactos & chats</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Historial WhatsApp</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="font-bold text-slate-800 text-xs">tickets_soporte</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Alarmas Qx & NPS</div>
              </div>
            </div>

            {/* Sincronización Prisma */}
            <div className="p-4 bg-sky-50/70 border border-sky-200/80 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-sky-950 flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-[#00A3E0]" strokeWidth={1.5} />
                  Sincronización de esquema:
                </span>
                <button
                  onClick={() => copyToClipboard(prismaCommand, setCopiedPrisma)}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-950 flex items-center gap-1 cursor-pointer"
                >
                  {copiedPrisma ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={1.5} />
                  ) : (
                    <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />
                  )}
                  <span>Copiar</span>
                </button>
              </div>
              <code className="block font-mono text-xs text-sky-900 bg-white p-2.5 rounded-xl border border-sky-200 font-bold shadow-2xs">
                {prismaCommand}
              </code>
            </div>
          </div>

          {/* Tarjeta de Directivas Clínicas Inviolables */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-900/5 p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2.5 text-[#002B49]">
              <ShieldCheck className="w-5 h-5 text-[#00A3E0]" strokeWidth={1.5} />
              <h3 className="font-bold text-sm text-slate-900">
                Reglas Clínicas Institucionales HUN
              </h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                <span className="font-black text-[#002B49] text-xs mt-0.5">F-01</span>
                <p className="leading-relaxed">
                  <strong className="text-slate-800">Sin solicitud de diagnóstico:</strong> En consulta general particular no se indaga sintomatología ni diagnóstico médico.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                <span className="font-black text-red-600 text-xs mt-0.5">QX</span>
                <p className="leading-relaxed">
                  <strong className="text-slate-800">Alarma prioritaria:</strong> Todo reporte de fiebre o sangrado postquirúrgico activa ticket <code className="font-bold text-red-700">CRITICAL</code> y alerta en tiempo real.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                <span className="font-black text-amber-600 text-xs mt-0.5">NPS</span>
                <p className="leading-relaxed">
                  <strong className="text-slate-800">PQRS automática (E-009):</strong> Calificaciones ≤ 3 estrellas abren automáticamente caso formal con compromiso de 2 días.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
