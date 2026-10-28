import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD && typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:3001');

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const socket: Socket = io(API_BASE_URL, {
  autoConnect: true,
  reconnection: true,
  withCredentials: true,
});

export type UserRole = 'ADMIN' | 'AUXILIAR';
export interface AuthUser { id: string; email: string; name: string; role: UserRole; }
export const login = async (email: string, password: string): Promise<AuthUser> => {
  const { data } = await api.post('/api/auth/login', { email, password });
  return data.user;
};
export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const { data } = await api.get('/api/auth/me');
  return data.user;
};
export const logout = async () => { await api.post('/api/auth/logout'); };

export interface AppointmentHistoryEntry {
  id: string;
  appointmentId: string;
  previousStatus?: string | null;
  newStatus: string;
  changedBy?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface ModificationReasonRecord {
  appointmentId: string;
  specialty: string;
  doctorName: string;
  reason: string;
  date: string;
}

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  documentId?: string;
  documentType?: string;
  birthDate?: string;
  email?: string;
  residenceCity?: string;
  residenceAddress?: string;
  createdAt?: string;
  updatedAt?: string;
  hasActiveEps?: boolean;
  isInternational?: boolean;
  userTypeId?: string;
  userTypeCode?: string;
  userTypeName?: string;
  cancellationCount?: number;
  cancellationReasons?: ModificationReasonRecord[];
  rescheduleCount?: number;
  wasRescheduled?: boolean;
  rescheduleReasons?: ModificationReasonRecord[];
}

export interface Conversation {
  id: string;
  contactId: string;
  contact?: Contact;
  status: 'BOT' | 'REQUIRES_AGENT' | 'AGENT_TAKEN' | 'CLOSED';
  currentFlow: string;
  currentStep: string;
  flowData: any;
  updatedAt: string;
  lastMessage?: Message;
}

export interface InteractiveOption {
  id: string;
  title: string;
  description?: string;
}

export interface InteractivePayload {
  type: 'list' | 'button';
  title?: string;
  buttonText?: string;
  options: InteractiveOption[];
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'USER' | 'BOT' | 'AGENT' | 'SYSTEM';
  content: string;
  mediaUrl?: string;
  interactivePayload?: InteractivePayload;
  status: string;
  waMessageId?: string;
  deliveryError?: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  contactId?: string;
  contactName?: string;
  contactPhone?: string;
  userTypeId?: string;
  userTypeCode?: string;
  userTypeName?: string;
  specialty: string;
  doctorName: string;
  dateTime: string;
  durationMinutes?: number;
  isFirstTime: boolean;
  price: number;
  paymentStatus: string;
  isReferral: boolean;
  referralCode?: string;
  status: string;
  wasRescheduled?: boolean;
  rescheduleCount?: number;
  rescheduleReason?: string;
  cancellationReason?: string;
  statusHistory?: AppointmentHistoryEntry[];
  createdAt: string;
}

import { translatePaymentStatus, translateAppointmentStatus } from './translations';

export const downloadAppointmentsExcel = async (appointments: Appointment[]) => {
  const XLSX = await import('xlsx');
  const rows = appointments.map((appointment) => ({
    ID: appointment.id,
    Paciente: appointment.contactName || 'Paciente Particular',
    'Tipo de Usuario': appointment.userTypeName || 'Paciente Particular',
    Teléfono: appointment.contactPhone ? `+${appointment.contactPhone}` : '',
    Especialidad: appointment.specialty,
    Médico: appointment.doctorName,
    'Fecha y hora': new Date(appointment.dateTime),
    'Primera vez': appointment.isFirstTime ? 'Sí' : 'No',
    'Tarifa COP': Number(appointment.price),
    'Estado de pago': translatePaymentStatus(appointment.paymentStatus),
    'Tipo de ruta': appointment.isReferral ? 'Referido F-03' : 'Ambulatorio F-01',
    Estado: translateAppointmentStatus(appointment.status),
    '¿Reagendada?': appointment.wasRescheduled || appointment.status === 'RESCHEDULED' ? 'Sí' : 'No',
    'Motivo Reprogramación': appointment.rescheduleReason || '—',
    'Motivo Cancelación': appointment.cancellationReason || '—',
    'Fecha de registro': new Date(appointment.createdAt),
  }));
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 26 }, { wch: 28 }, { wch: 28 }, { wch: 17 }, { wch: 22 }, { wch: 28 }, { wch: 21 },
    { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 30 }, { wch: 30 }, { wch: 21 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Citas');
  XLSX.writeFile(workbook, `citas-hun-${new Date().toISOString().slice(0, 10)}.xlsx`);
};

export interface SurgicalQuote {
  id: string;
  contactName?: string;
  contactPhone?: string;
  userTypeId?: string;
  userTypeCode?: string;
  userTypeName?: string;
  procedureDescription: string;
  hasMedicalOrder: boolean;
  hasActiveEps: boolean;
  medicalOrderFileUrl?: string;
  status: string;
  cupsCode?: string;
  quotedAmount?: number;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  contactName?: string;
  contactPhone?: string;
  type: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  description: string;
  createdAt: string;
}

export interface DashboardMetrics {
  totalConversations: number;
  requiresAgent: number;
  totalAppointments: number;
  totalQuotes: number;
  criticalAlarms: number;
  openTickets: number;
  avgNps: string;
  botAutomationRate: number;
  isDatabaseConnected: boolean;
  isDatabaseAvailable?: boolean;
}

export const fetchMetrics = async (): Promise<DashboardMetrics> => {
  const { data } = await api.get('/api/metrics');
  return data;
};

export const fetchConversations = async (): Promise<Conversation[]> => {
  const { data } = await api.get('/api/chat/conversations');
  return data;
};

export const fetchMessages = async (convId: string): Promise<Message[]> => {
  const { data } = await api.get(`/api/chat/conversations/${convId}/messages`);
  return data;
};

export const sendAgentMessage = async (convId: string, message: string): Promise<Message> => {
  const { data } = await api.post(`/api/chat/conversations/${convId}/reply`, { message });
  return data.message;
};

export const takeoverChat = async (convId: string) => {
  const { data } = await api.post(`/api/chat/conversations/${convId}/takeover`);
  return data.conversation;
};

export const returnToBot = async (convId: string) => {
  const { data } = await api.post(`/api/chat/conversations/${convId}/return-to-bot`);
  return data.conversation;
};

export const triggerPostQxAlarm = async (convId: string) => {
  const { data } = await api.post(`/api/chat/conversations/${convId}/trigger-post-qx`);
  return data;
};

export const triggerNpsSurvey = async (convId: string) => {
  const { data } = await api.post(`/api/chat/conversations/${convId}/trigger-nps`);
  return data;
};

export const simulateMessage = async (phone: string, text: string, name?: string) => {
  const { data } = await api.post('/api/webhook/simulate', { phone, text, name });
  return data;
};

export const fetchAppointments = async (): Promise<Appointment[]> => {
  const { data } = await api.get('/api/appointments');
  return data;
};

export const fetchContacts = async (): Promise<Contact[]> => {
  const { data } = await api.get('/api/contacts');
  return data;
};

export const deleteContact = async (id: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.delete(`/api/contacts/${id}`);
  return data;
};

export const deleteContacts = async (
  ids: string[] = []
): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  const { data } = await api.delete('/api/contacts', { data: { ids } });
  return data;
};

export const fetchQuotes = async (): Promise<SurgicalQuote[]> => {
  const { data } = await api.get('/api/quotes');
  return data;
};

export const fetchTickets = async (): Promise<SupportTicket[]> => {
  const { data } = await api.get('/api/tickets');
  return data;
};

export interface SpecialtyItem {
  id: string;
  name: string;
  fee: number;
  slots?: any[];
}

export const fetchSpecialties = async (): Promise<SpecialtyItem[]> => {
  const { data } = await api.get('/api/specialties');
  return data;
};

export interface WhatsAppStatus {
  status: 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';
  qrCode: string | null;
  qrDataUrl: string | null;
  connectedPhone: string | null;
}

export const fetchWhatsAppStatus = async (): Promise<WhatsAppStatus> => {
  const { data } = await api.get('/api/whatsapp/status');
  return data;
};

export interface MetaConfigStatus {
  hasToken: boolean;
  phoneNumberId: string | null;
  verifyToken: string;
  apiVersion: string;
  port: number;
  backendUrl: string;
  isBaileysConnected: boolean;
}

export const fetchMetaConfig = async (): Promise<MetaConfigStatus> => {
  const { data } = await api.get('/api/whatsapp/config');
  return data;
};

export const disconnectWhatsApp = async () => {
  const { data } = await api.post('/api/whatsapp/disconnect');
  return data;
};

export const triggerInactivityWarning = async (conversationId: string) => {
  const { data } = await api.post(`/api/chat/conversations/${conversationId}/trigger-inactivity-warning`);
  return data;
};

export const triggerInactivityClose = async (conversationId: string) => {
  const { data } = await api.post(`/api/chat/conversations/${conversationId}/trigger-inactivity-close`);
  return data;
};

export const clearConversations = async (
  scope: 'ALL' | 'CLOSED' = 'CLOSED'
): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  const { data } = await api.delete('/api/chat/conversations', { params: { scope } });
  return data;
};

export const deleteConversation = async (
  conversationId: string
): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.delete(`/api/chat/conversations/${conversationId}`);
  return data;
};

export const deleteAppointment = async (id: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.delete(`/api/appointments/${id}`);
  return data;
};

export const clearAppointments = async (
  scope: 'ALL' | 'CANCELLED' = 'CANCELLED'
): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  const { data } = await api.delete('/api/appointments', { params: { scope } });
  return data;
};

export const deleteQuote = async (id: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.delete(`/api/quotes/${id}`);
  return data;
};

export const clearQuotes = async (): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  const { data } = await api.delete('/api/quotes');
  return data;
};

export const deleteTicket = async (id: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await api.delete(`/api/tickets/${id}`);
  return data;
};

export const clearTickets = async (
  scope: 'ALL' | 'RESOLVED' | 'NON_CRITICAL' = 'ALL'
): Promise<{ success: boolean; deletedCount: number; message: string }> => {
  const { data } = await api.delete('/api/tickets', { params: { scope } });
  return data;
};

// ==========================================
// AGENDA MÉDICA INSTITUCIONAL HUN (2026)
// ==========================================

export interface MedicalAgendaSlotItem {
  fecha_atencion: string;
  hora_inicial: string;
  hora_final: string;
  numero_consultorio?: string | number;
  agenda_detalle_id?: number;
  id_agenda_detalle?: number;
  occupied?: boolean;
  statusLabel?: 'DISPONIBLE' | 'OCUPADO';
  patientName?: string;
  cups?: any;
}

export interface MedicalAgendaItem {
  id: string;
  specialtyCode?: string;
  specialtyName: string;
  doctorCode?: string;
  doctorName: string;
  officeCode?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  frequencyMinutes: number;
  modality?: string;
  specifications?: string;
  activity?: string;
  observations?: string;
  scheduleType: 'REGULAR' | 'ADICIONAL';
  activeDates: string[];
  rawSlots?: MedicalAgendaSlotItem[];
  daySlots?: MedicalAgendaSlotItem[];
  availableCount?: number;
  occupiedCount?: number;
  totalSlotsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicalAbsenceItem {
  id: string;
  specialty?: string;
  doctorName: string;
  startDate: string;
  endDate: string;
  reason: string;
  type: string;
  observations?: string;
}

export interface AgendaStats {
  totalSchedules: number;
  regularCount: number;
  adicionalCount: number;
  totalAbsences: number;
  totalDoctors: number;
  totalSpecialties: number;
}

export interface AgendaFilters {
  specialties: Array<{ code?: string; name: string }>;
  doctors: Array<{ code?: string; name: string; specialty?: string }>;
  offices: string[];
  days: string[];
}

export interface CalendarEventDay {
  id: string;
  specialtyCode?: string;
  specialtyName: string;
  doctorCode?: string;
  doctorName: string;
  officeCode?: string;
  dayOfWeek?: string;
  startTime: string;
  endTime: string;
  frequencyMinutes: number;
  scheduleType: string;
  modality?: string;
  activity?: string;
  activeDates?: string[];
  rawSlots?: MedicalAgendaSlotItem[];
  daySlots?: MedicalAgendaSlotItem[];
  availableCount?: number;
  occupiedCount?: number;
  totalSlotsCount?: number;
}

export interface CalendarConfirmedAppointment {
  id: string;
  patientName: string;
  patientPhone?: string;
  specialty: string;
  doctorName: string;
  timeStr: string;
  isoDateTime: string;
  price: number;
  paymentStatus: string;
  status: string;
  isReferral?: boolean;
}

export interface CalendarMonthData {
  month: number;
  year: number;
  monthPrefix: string;
  days: Record<
    string,
    {
      events: CalendarEventDay[];
      absences: any[];
      appointments?: CalendarConfirmedAppointment[];
    }
  >;
  totalEvents: number;
  totalAppointments?: number;
}

export const fetchAgendaList = async (params: any = {}) => {
  const { data } = await api.get('/api/agenda', { params });
  return data as { items: MedicalAgendaItem[]; total: number; page: number; limit: number; totalPages: number };
};

export const fetchAgendaCalendar = async (params: { month?: number; year?: number; specialty?: string; doctor?: string; search?: string } = {}) => {
  const { data } = await api.get('/api/agenda/calendar', { params });
  return data as CalendarMonthData;
};

export const fetchAgendaFilters = async (): Promise<AgendaFilters> => {
  const { data } = await api.get('/api/agenda/filters');
  return data;
};

export const fetchAgendaAbsences = async (params: any = {}): Promise<MedicalAbsenceItem[]> => {
  const { data } = await api.get('/api/agenda/absences', { params });
  return data;
};

export const fetchAgendaStats = async (): Promise<AgendaStats> => {
  const { data } = await api.get('/api/agenda/stats');
  return data;
};

export const uploadAgendaExcel = async (file: File): Promise<{ message: string; stats: any }> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/agenda/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const previewAgendaExcel = async (file: File): Promise<any> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/api/agenda/upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const syncAgendaEndpoint = async () => {
  const { data } = await api.post('/api/agenda/sync');
  return data;
};

export interface DiagnosticProcedureItem {
  id: string;
  packageId: string;
  area: string;
  name: string;
  mainCups?: string | null;
  mainCupsName?: string | null;
  cupsCount: number;
  cupsList: string[];
  cupsDetails?: string | null;
  durationMinutes?: string | null;
  fasting?: string | null;
  stopAnticoagulants?: string | null;
  venousAccess?: string | null;
  patientPreparation: string;
  requiredSupplies?: string | null;
  requiredLabs?: string | null;
  labCups: string[];
  pathologyCups?: string | null;
  requiresSedation?: string | null;
  observations?: string | null;
  sheetOrigin?: string | null;
  codes?: Array<{ id: string; cups: string; name: string; suggestedRole?: string }>;
  supplies?: Array<{ id: string; itemNumber?: number; supplyName: string; quantity?: string; condition?: string }>;
}

export interface LaboratoryCatalogItem {
  id: string;
  cups: string;
  description: string;
  group?: string | null;
  usageNotes?: string | null;
  packageCount: number;
}

export const fetchDiagnosticProcedures = async (params: { query?: string; area?: string; page?: number; limit?: number } = {}) => {
  const { data } = await api.get('/api/preparaciones', { params });
  return data as { items: DiagnosticProcedureItem[]; total: number; page: number; limit: number; totalPages: number };
};

export const fetchDiagnosticAreas = async (): Promise<string[]> => {
  const { data } = await api.get('/api/preparaciones/areas');
  return data;
};

export const fetchDiagnosticProcedureDetail = async (packageId: string): Promise<DiagnosticProcedureItem> => {
  const { data } = await api.get(`/api/preparaciones/${packageId}`);
  return data;
};

export const fetchLaboratoryCatalog = async (): Promise<LaboratoryCatalogItem[]> => {
  const { data } = await api.get('/api/preparaciones/laboratorios');
  return data;
};

export const fetchPatientInstruction = async (packageId: string): Promise<{ procedure: DiagnosticProcedureItem; instruction: string }> => {
  const { data } = await api.get(`/api/preparaciones/${packageId}/instruction`);
  return data;
};

export interface CupsTariffItem {
  id: string;
  cups: string;
  description: string;
  category: 'CONSULTA' | 'TELEMEDICINA' | 'REHABILITACION' | 'IMAGENES_DX' | 'LABORATORIO' | string;
  categoryLabel: string;
  particularFee: number;
  hun2024Fee?: number | null;
  egresadosFee?: number | null;
  sourceFile?: string | null;
  sourceSheet?: string | null;
}

export interface TariffCategoryStats {
  category: string;
  label: string;
  count: number;
}

export const fetchTariffs = async (params: { query?: string; category?: string; page?: number; limit?: number } = {}) => {
  const { data } = await api.get('/api/tarifas', { params });
  return data as { items: CupsTariffItem[]; total: number; page: number; limit: number; totalPages: number };
};

export const fetchTariffCategories = async (): Promise<TariffCategoryStats[]> => {
  const { data } = await api.get('/api/tarifas/categorias');
  return data;
};

export const fetchTariffStats = async () => {
  const { data } = await api.get('/api/tarifas/stats');
  return data as { totalTariffs: number; categories: TariffCategoryStats[] };
};

export const fetchTariffByCups = async (cups: string): Promise<CupsTariffItem[]> => {
  const { data } = await api.get(`/api/tarifas/cups/${cups}`);
  return data;
};


