/**
 * Diccionario y funciones de traducción y formateo al español para la interfaz clínica y operativa HUN
 */

/**
 * Traduce el estado de pago de citas al español
 * Ej: PAY_AT_WINDOW -> "Pago en Ventanilla", PAID_VIRTUAL -> "Pago Virtual (PSE)"
 */
export const translatePaymentStatus = (status?: string | null): string => {
  if (!status) return 'Pendiente de Pago';
  const s = status.toUpperCase().trim();
  switch (s) {
    case 'PAY_AT_WINDOW':
      return 'Pago en Ventanilla';
    case 'PAID_VIRTUAL':
      return 'Pago Virtual (PSE)';
    case 'CONFIRMED':
    case 'PAID':
      return 'Confirmado / Pagado';
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'HELD':
      return 'Pendiente de Pago';
    case 'FAILED':
      return 'Pago Fallido';
    case 'REFUNDED':
      return 'Reembolsado';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
};

/**
 * Traduce el estado general de la cita médica al español
 * Ej: CONFIRMED -> "Confirmada", RESCHEDULED -> "Reagendada"
 */
export const translateAppointmentStatus = (status?: string | null): string => {
  if (!status) return 'Confirmada';
  const s = status.toUpperCase().trim();
  switch (s) {
    case 'CONFIRMED':
    case 'CONFIRMADA':
      return 'Confirmada';
    case 'PENDING':
    case 'PENDING_PAYMENT':
    case 'HELD':
      return 'Pendiente de Pago';
    case 'RESCHEDULED':
      return 'Reagendada';
    case 'CANCELLED':
    case 'CANCELLED_BY_USER':
      return 'Cancelada por Usuario';
    case 'ATTENDED':
    case 'COMPLETED':
      return 'Atendida';
    default:
      return status;
  }
};

/**
 * Traduce el estado de los tickets de soporte / seguimiento asistencial
 * Ej: OPEN -> "Abierto", IN_PROGRESS -> "En Gestión", RESOLVED -> "Resuelto"
 */
export const translateTicketStatus = (status?: string | null): string => {
  if (!status) return 'Abierto';
  const s = status.toUpperCase().trim();
  switch (s) {
    case 'OPEN':
      return 'Abierto';
    case 'IN_PROGRESS':
      return 'En Gestión';
    case 'RESOLVED':
      return 'Resuelto';
    case 'CLOSED':
      return 'Cerrado';
    default:
      return status;
  }
};

/**
 * Traduce el nivel de prioridad de tickets
 * Ej: CRITICAL -> "Crítica", HIGH -> "Alta", NORMAL -> "Normal", LOW -> "Baja"
 */
export const translateTicketPriority = (priority?: string | null): string => {
  if (!priority) return 'Normal';
  const p = priority.toUpperCase().trim();
  switch (p) {
    case 'CRITICAL':
      return 'Crítica';
    case 'HIGH':
      return 'Alta';
    case 'NORMAL':
      return 'Normal';
    case 'LOW':
      return 'Baja';
    default:
      return priority;
  }
};

/**
 * Traduce el tipo de ticket asistencial
 */
export const translateTicketType = (type?: string | null): string => {
  if (!type) return 'General';
  const t = type.toUpperCase().trim();
  if (t === 'POST_OP_ALARM') return 'Alarma Postquirúrgica';
  if (t === 'E001_WAITING_LIST') return 'Lista de Espera (E-001)';
  if (t.includes('PQRS') || t.includes('SURVEY')) return 'Caso PQRS (NPS)';
  if (t === 'AGENT_REQUIRED') return 'Solicitud de Auxiliar';
  return type;
};

/**
 * Traduce el tipo de jornada o agenda médica
 */
export const translateScheduleType = (scheduleType?: string | null): string => {
  if (!scheduleType) return 'Agenda Regular';
  const s = scheduleType.toUpperCase().trim();
  switch (s) {
    case 'REGULAR':
      return 'Agenda Regular';
    case 'ADICIONAL':
    case 'ADDITIONAL':
      return 'Agenda Adicional';
    default:
      return scheduleType;
  }
};

/**
 * Traduce la modalidad de consulta
 */
export const translateModality = (modality?: string | null): string => {
  if (!modality) return 'Presencial';
  const m = modality.toUpperCase().trim();
  switch (m) {
    case 'PRESENCIAL':
      return 'Presencial';
    case 'TELEMEDICINA':
    case 'TELEMEDICINE':
      return 'Telemedicina';
    case 'VIRTUAL':
      return 'Virtual';
    default:
      return modality;
  }
};

/**
 * Traduce el estado de la conversación de chat
 */
export const translateConversationStatus = (status?: string | null): string => {
  if (!status) return 'Bot Autónomo';
  const s = status.toUpperCase().trim();
  switch (s) {
    case 'BOT':
      return 'Bot Autónomo';
    case 'REQUIRES_AGENT':
      return 'Requiere Auxiliar';
    case 'AGENT_TAKEN':
      return 'Auxiliar en Chat';
    case 'CLOSED':
      return 'Cerrada';
    default:
      return status;
  }
};

/**
 * Traduce el rol del usuario en la plataforma
 */
export const translateUserRole = (role?: string | null): string => {
  if (!role) return 'Usuario';
  const r = role.toUpperCase().trim();
  switch (r) {
    case 'ADMIN':
      return 'Administrador';
    case 'AUXILIAR':
      return 'Auxiliar Asistencial';
    default:
      return role;
  }
};
