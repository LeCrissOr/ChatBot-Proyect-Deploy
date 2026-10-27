import { store, ConversationData } from './store.service';
import { socketService } from './socket.service';
import { WhatsAppService } from './whatsapp.service';
import { CONFIG } from '../config';

export class InactivityService {
  private timer: NodeJS.Timeout | null = null;
  private isChecking = false;

  // 10 minutos sin respuesta para preguntar si sigue en linea
  private get warningTimeoutMs(): number {
    return CONFIG.INACTIVITY_WARNING_MS || 600000;
  }

  // 2 minutos adicionales tras la advertencia antes de cerrar definitivamente
  private get closeTimeoutMs(): number {
    return CONFIG.INACTIVITY_CLOSE_MS || 120000;
  }

  public init() {
    if (this.timer) clearInterval(this.timer);
    // Revision periodica cada 10 segundos
    this.timer = setInterval(() => {
      this.checkAllConversations();
    }, 10000);
    console.log('⏱️ InactivityService iniciado: monitoreo de 10 minutos de inactividad activo.');
  }

  public async checkAllConversations() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const conversations = store.getAllConversations();
      const now = Date.now();

      for (const conv of conversations) {
        // 1. Solo monitorear conversaciones activas
        if (conv.status === 'CLOSED' || conv.status === 'AGENT_TAKEN') {
          continue;
        }

        // 2. Si la conversación está en IDLE, en menú principal o ya completó su proceso,
        // no hay ningún trámite en progreso que requiera respuesta del usuario. NO monitorear inactividad.
        if (
          !conv.currentFlow ||
          conv.currentFlow === 'IDLE' ||
          conv.currentStep === 'NPS_COMPLETED' ||
          conv.currentStep === 'SESSION_CLOSED' ||
          conv.currentStep === 'ROOT_MENU' ||
          conv.currentStep === 'CANCELLED_BY_USER' ||
          conv.currentStep === 'POST_CONFIRMATION_OPTIONS' ||
          conv.flowData?.sessionClosed
        ) {
          continue;
        }

        // 3. Si la conversación está en la encuesta de satisfacción (NPS_SURVEY):
        // La cita ya está confirmada. Si el paciente no califica en 10 min, cerramos la sesión en silencio sin cancelar su cita.
        if (conv.currentFlow === 'NPS_SURVEY') {
          const messages = store.getConversationMessages(conv.id);
          if (messages.length === 0) continue;
          const lastMsg = messages[messages.length - 1];
          if (lastMsg.sender !== 'BOT') continue;

          const timeSinceLastMsg = now - new Date(lastMsg.createdAt).getTime();
          if (timeSinceLastMsg >= this.warningTimeoutMs) {
            console.log(`🔒 [Inactividad NPS] Paciente no respondió encuesta NPS. Cerrando sesión silenciosamente (cita confirmada protegida).`);
            await store.updateConversation(conv.id, {
              status: 'CLOSED',
              currentFlow: 'IDLE',
              currentStep: 'SESSION_CLOSED',
              flowData: {
                ...conv.flowData,
                sessionClosed: true,
                inactivityWarningSent: false,
              },
            });
            const updated = store.getConversationById(conv.id);
            socketService.emitConversationUpdated(updated);
          }
          continue;
        }

        // 4. Si el paciente está en medio de un agendamiento / cotización / registro y no ha confirmado:
        const messages = store.getConversationMessages(conv.id);
        if (messages.length === 0) continue;

        const lastMsg = messages[messages.length - 1];

        // Solo aplica si el ultimo mensaje fue del BOT (esperando respuesta del paciente)
        if (lastMsg.sender !== 'BOT') continue;

        const timeSinceLastMsg = now - new Date(lastMsg.createdAt).getTime();

        // Fase 1: Advertencia por inactividad tras 10 minutos
        if (!conv.flowData?.inactivityWarningSent) {
          if (timeSinceLastMsg >= this.warningTimeoutMs) {
            await this.sendInactivityWarning(conv);
          }
        } else {
          // Fase 2: Cierre automatico si ya se envio advertencia y no responde en 2 minutos adicionales
          const warningSentAt = new Date(conv.flowData.inactivityWarningSentAt || lastMsg.createdAt).getTime();
          const timeSinceWarning = now - warningSentAt;

          if (timeSinceWarning >= this.closeTimeoutMs) {
            await this.closeDueToInactivity(conv, 'TIMEOUT');
          }
        }
      }
    } catch (err) {
      console.error('Error en InactivityService:', err);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Envia la advertencia de inactividad preguntando al paciente si sigue en linea
   */
  public async sendInactivityWarning(conv: ConversationData) {
    const contact = conv.contact || store.getContactById(conv.contactId);
    const targetPhone = contact?.phone || conv.flowData?.contactPhone || '';
    const warningMsg =
      'Hola, ¿sigues en línea? 🏥 Notamos que no has respondido. ¿Deseas continuar con tu solicitud en el Hospital Universitario Nacional (HUN)? Responde "sí" para continuar o "cancelar" para finalizar.';

    console.log(`⏱️ [Inactividad 10 min] Preguntando si sigue en línea a ${targetPhone || 'desconocido'} (${contact?.name || 'Paciente'})`);

    // Actualizar conversacion
    await store.updateConversation(conv.id, {
      flowData: {
        ...conv.flowData,
        inactivityWarningSent: true,
        inactivityWarningSentAt: new Date().toISOString(),
      },
    });

    const botMsg = await store.saveMessage(conv.id, 'BOT', warningMsg);
    socketService.emitNewMessage(botMsg);
    socketService.emitConversationUpdated(store.getConversationById(conv.id));

    if (targetPhone) {
      const result = await WhatsAppService.sendTextMessageWithResult(targetPhone, warningMsg);
      const updated = await store.updateMessageStatus(botMsg.id, result.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(result.success), result.waMessageId, result.error);
      if (updated) socketService.emitMessageUpdated(updated);
    } else {
      const updated = await store.updateMessageStatus(botMsg.id, 'failed');
      if (updated) socketService.emitMessageUpdated(updated);
    }
  }

  /**
   * Cierra la conversacion por inactividad.
   * IMPORTANTE: Si el paciente ya tiene una cita médica confirmada, la cita SE PROTEGE y NO se cancela.
   */
  public async closeDueToInactivity(
    conv: ConversationData,
    reason: 'TIMEOUT' | 'USER_CANCEL' = 'TIMEOUT'
  ) {
    const contact = conv.contact || store.getContactById(conv.contactId);
    const targetPhone = contact?.phone || conv.flowData?.contactPhone || '';

    // Verificar si el contacto tiene una cita médica confirmada
    const confirmedApts = store.getConfirmedAppointmentsByContact(conv.contactId);
    const hasConfirmedApt = confirmedApts.length > 0 || Boolean(conv.flowData?.appointmentConfirmed || conv.flowData?.hasConfirmedAppointment);

    let closeMsg: string;
    if (reason === 'USER_CANCEL') {
      closeMsg = 'Tu solicitud ha sido cancelada exitosamente a petición tuya. Si deseas realizar otra consulta o agendar una cita en el futuro, escribe "menu". ¡Hasta pronto!';
    } else if (hasConfirmedApt) {
      closeMsg = 'Por inactividad hemos finalizado esta sesión de chat. Tu cita médica confirmada en el Hospital Universitario Nacional (HUN) se mantiene programada sin ningún cambio. Si deseas realizar otra consulta, escribe "menu" en cualquier momento. ¡Hasta pronto!';
    } else {
      closeMsg = 'Por inactividad hemos cerrado esta sesión y cancelado la gestión de tu cita en el Hospital Universitario Nacional (HUN). Si deseas iniciar una nueva solicitud, escribe "menu" en cualquier momento. ¡Hasta pronto!';
    }

    console.log(`🔒 [Cierre por Inactividad] Cerrando conversacion ${conv.id} para ${targetPhone || 'desconocido'}. Motivo: ${reason}. Cita confirmada protegida: ${hasConfirmedApt}`);

    // 1. Guardar mensaje de cierre y enviar por WhatsApp
    const botMsg = await store.saveMessage(conv.id, 'BOT', closeMsg);
    socketService.emitNewMessage(botMsg);
    if (targetPhone) {
      const result = await WhatsAppService.sendTextMessageWithResult(targetPhone, closeMsg);
      const updated = await store.updateMessageStatus(botMsg.id, result.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(result.success), result.waMessageId, result.error);
      if (updated) socketService.emitMessageUpdated(updated);
    } else {
      const updated = await store.updateMessageStatus(botMsg.id, 'failed');
      if (updated) socketService.emitMessageUpdated(updated);
    }

    // 2. Cerrar conversación definitivamente. Importante: sessionClosed: true para que no vuelva a evaluarse en bucle.
    await store.updateConversation(conv.id, {
      status: 'CLOSED',
      currentFlow: 'IDLE',
      currentStep: hasConfirmedApt ? 'SESSION_CLOSED' : 'CANCELLED_BY_USER',
      flowData: {
        ...conv.flowData,
        inactivityWarningSent: false,
        sessionClosed: true,
        cancelledReason: reason,
      },
    });

    // 3. SOLO cancelar la cita si NO estaba confirmada previamente y fue por abandono/timeout
    if (!hasConfirmedApt && reason === 'TIMEOUT') {
      await store.cancelAppointmentForContact(conv.contactId, conv.flowData);
    }

    // 4. Emitir eventos a dashboard en tiempo real
    const updatedConv = store.getConversationById(conv.id);
    socketService.emitConversationUpdated(updatedConv);
    socketService.emitAppointmentsUpdated(store.getAllAppointments());
    socketService.emitMetricsUpdated(store.getMetrics());

    return { success: true, conversation: updatedConv };
  }
}

export const inactivityService = new InactivityService();
