import dotenv from 'dotenv';
dotenv.config();

if (!process.env.WHATSAPP_VERIFY_TOKEN) {
  process.env.WHATSAPP_VERIFY_TOKEN = 'hun-production-verify-token-2026';
}

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hun_chatbot?schema=public',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
  AUTH_SESSION_HOURS: parseInt(process.env.AUTH_SESSION_HOURS || '8', 10),
  AUTH_ADMIN_EMAIL: process.env.AUTH_ADMIN_EMAIL || 'admin@hun.local',
  AUTH_ADMIN_PASSWORD: process.env.AUTH_ADMIN_PASSWORD || 'Admin123!',
  AUTH_AUXILIAR_EMAIL: process.env.AUTH_AUXILIAR_EMAIL || 'auxiliar@hun.local',
  AUTH_AUXILIAR_PASSWORD: process.env.AUTH_AUXILIAR_PASSWORD || 'Auxiliar123!',

  // Meta WhatsApp Cloud API Config
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN || '',
  WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'dev-only-change-me',
  WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',
  WHATSAPP_API_VERSION: process.env.WHATSAPP_API_VERSION || 'v20.0',

  // Configuración de tiempos de inactividad
  INACTIVITY_WARNING_MS: parseInt(process.env.INACTIVITY_WARNING_MS || '600000', 10), // 10 minutos
  INACTIVITY_CLOSE_MS: parseInt(process.env.INACTIVITY_CLOSE_MS || '120000', 10),     // 2 minutos adicionales tras advertencia

  // Hosvital / HUN API Endpoints Config (Sin Excel - 100% Endpoints)
  HUN_API_URL: process.env.HUN_API_URL || 'http://190.109.10.204',
  HUN_API_KEY: process.env.HUN_API_KEY || 'HospitalUniversitarioNacionaldeColombia',
  HUN_API_TIMEOUT_MS: parseInt(process.env.HUN_API_TIMEOUT_MS || '3500', 10),
  HUN_DEFAULT_EPS: process.env.HUN_DEFAULT_EPS || 'HUN25',
  HOSVITAL_ENABLED: process.env.HOSVITAL_ENABLED !== 'false',

  // Rutas de Endpoints HUN / Hosvital
  HUN_ENDPOINT_ESPECIALIDADES: process.env.HUN_ENDPOINT_ESPECIALIDADES || '/webServiceEspecialidad/especialidades',
  HUN_ENDPOINT_AGENDA: process.env.HUN_ENDPOINT_AGENDA || '/webServiceAgenda/agenda',
  HUN_ENDPOINT_CITAS_DOC: process.env.HUN_ENDPOINT_CITAS_DOC || '/webServiceCitaDocumento/consultar_citas_documento',
  HUN_ENDPOINT_CITA_NUM: process.env.HUN_ENDPOINT_CITA_NUM || '/webServiceCitaNumero/consultar_citas_numero',
  HUN_ENDPOINT_ASIGNAR_CITA: process.env.HUN_ENDPOINT_ASIGNAR_CITA || '/webServiceCita/api/asignar_cita',
  HUN_ENDPOINT_CANCELAR_CITA: process.env.HUN_ENDPOINT_CANCELAR_CITA || '/webServiceCancelarCitaH/cancelar_cita',
  HUN_ENDPOINT_VERIFICAR_CANCELACION: process.env.HUN_ENDPOINT_VERIFICAR_CANCELACION || '/webServiceCancelarCitaH/verificar_cancelacion',
  HUN_ENDPOINT_TARIFAS: process.env.HUN_ENDPOINT_TARIFAS || '/webServiceTarifas/tarifas',
  HUN_ENDPOINT_PREPARACIONES: process.env.HUN_ENDPOINT_PREPARACIONES || '/webServicePreparaciones/preparaciones',

  // Integración Externa: Parametrización y Evaluación de Agenda HUN (Filtro Particulares vs EPS / Bloqueos)
  HUN_INTEGRACION_ENABLED: process.env.HUN_INTEGRACION_ENABLED !== 'false',
  HUN_INTEGRACION_BASE_URL: process.env.HUN_INTEGRACION_BASE_URL || 'https://huncontigo.hun.edu.co/api/v1/integracion',
  HUN_INTEGRACION_API_KEY: process.env.HUN_INTEGRACION_API_KEY || 'zegaqdHboAHMNl6T337pwGmy7sqFLXbFtrd3Agp3LWQ',
  HUN_INTEGRACION_TIMEOUT_MS: parseInt(process.env.HUN_INTEGRACION_TIMEOUT_MS || '6000', 10),

  // Configuración SOAP Hosvital Directa (DigitalWare WSAsicitcon y WSCancita)
  HOSVITAL_SOAP_ENABLED: process.env.HOSVITAL_SOAP_ENABLED === 'true',
  HOSVITAL_SOAP_BASE_URL: process.env.HOSVITAL_SOAP_BASE_URL || 'http://190.109.10.204/servlet',
  HOSVITAL_SOAP_ASICITCON_PATH: process.env.HOSVITAL_SOAP_ASICITCON_PATH || '/awsasicitcon',
  HOSVITAL_SOAP_CANCITA_PATH: process.env.HOSVITAL_SOAP_CANCITA_PATH || '/awscancita',
  HOSVITAL_EMPRESA: process.env.HOSVITAL_EMPRESA || '1',
  HOSVITAL_SEDE: process.env.HOSVITAL_SEDE || '001',
  HOSVITAL_MAEDIR_USER: process.env.HOSVITAL_MAEDIR_USER || '',
  HOSVITAL_MAEDIR_PASSWORD: process.env.HOSVITAL_MAEDIR_PASSWORD || '',
};
