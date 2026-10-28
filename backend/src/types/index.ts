export type ConversationFlow =
  | 'IDLE'
  | 'PATIENT_REGISTRATION'
  | 'F01_CONSULTA'
  | 'F02_QUIRURGICO'
  | 'F03_REFERIDO'
  | 'F04_AUXILIAR'
  | 'REPROGRAMAR_CITA'
  | 'CANCELAR_CITA'
  | 'POST_CONSULTA'
  | 'POST_QX'
  | 'PREPARACIONES_INFO'
  | 'NPS_SURVEY';

export type ConversationStatus = 'BOT' | 'REQUIRES_AGENT' | 'AGENT_TAKEN' | 'CLOSED';

export type SenderType = 'USER' | 'BOT' | 'AGENT' | 'SYSTEM';

export interface DynamicSlot {
  id: string;
  doctorName: string;
  doctorCode?: string | null;
  officeCode?: string | null;
  specialtyName: string;
  dateTimeStr: string;
  isoDateTime: string;
  durationMinutes?: number;
  agendaDetalleId?: number;
  codigoMedico?: string;
  cups?: string;
  cupsOptions?: Array<{
    codigo: string;
    agenda_detalle_id: number;
    descripcion?: string | null;
  }>;
  consultorio?: number | string;
  tiempoAtencion?: number;
  codEspecialidadHosvital?: number;
}

export interface FlowStateData {
  specialty?: string;
  isFirstTime?: boolean;
  patientName?: string;
  patientDoc?: string;
  patientDocumentType?: string;
  patientBirthDate?: string;
  patientPhone?: string;
  patientEmail?: string;
  residenceCity?: string;
  residenceAddress?: string;
  patientFound?: boolean;
  requestForSelf?: boolean;
  registrationComplete?: boolean;
  selectedSlot?: {
    id?: string;
    dateTime: string;
    doctorName: string;
    doctorCode?: string | null;
    officeCode?: string | null;
    specialtyName?: string;
    isoDateTime?: string;
    durationMinutes?: number;
  };
  dynamicSlots?: DynamicSlot[];
  price?: number;
  paymentMethod?: string;
  procedureDesc?: string;
  hasMedicalOrder?: boolean;
  hasActiveEps?: boolean;
  orderFileUrl?: string;
  referralCode?: string;
  referralDoctor?: string;
  referralModel?: 'MODEL_A' | 'MODEL_B';
  fallbackCount?: number;
  npsScore?: number;
  numeroCitaHosvital?: number;
  hosvitalCitaInfo?: any;
  [key: string]: any;
}

export interface SpecialtyConfig {
  id: string;
  name: string;
  fee: number;
  slots: Array<{
    id: string;
    doctorName: string;
    dateTime: string;
  }>;
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

export interface BotReplyResult {
  replyMessages: string[];
  nextFlow: ConversationFlow;
  nextStep: string;
  updatedData: FlowStateData;
  status?: ConversationStatus;
  mediaUrl?: string;
  mediaType?: 'image' | 'sticker' | 'document';
  interactivePayload?: InteractivePayload;
  createTicket?: {
    type: string;
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
    description: string;
  };
  createAppointment?: {
    specialty: string;
    doctorId?: string;
    doctorName: string;
    officeId?: string;
    dateTime: Date;
    durationMinutes?: number;
    isFirstTime: boolean;
    price: number;
    paymentStatus: string;
    isReferral: boolean;
    referralCode?: string;
    referralModel?: string;
    numeroCitaHosvital?: number;
  };
  createQuote?: {
    procedureDescription: string;
    hasMedicalOrder: boolean;
    hasActiveEps: boolean;
    medicalOrderFileUrl?: string;
  };
  createNps?: {
    rating: number;
    comment?: string;
    hasPqrs: boolean;
  };
  cancelAppointmentId?: string;
  cancelAppointmentReason?: string;
  rescheduleAppointment?: {
    appointmentId: string;
    newDateTime: Date;
    newDoctorName?: string;
    reason?: string;
    newNumeroCitaHosvital?: number;
  };
}
