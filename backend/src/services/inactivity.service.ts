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
        // Solo monitorear conversaciones activas
        if (conv.status === 'CLOSED' || conv.status === 'AGENT_TAKEN') {
          continue;
        }

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
          // Fase 2: Cierre automatico si ya se envio advertencia y no responde
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
   * Cierra la conversacion por inactividad y cancela la cita poniendo el estado en "Cancelado por Usuario"
   */
  public async closeDueToInactivity(
    conv: ConversationData,
    reason: 'TIMEOUT' | 'USER_CANCEL' = 'TIMEOUT'
  ) {
    const contact = conv.contact || store.getContactById(conv.contactId);
    const targetPhone = contact?.phone || conv.flowData?.contactPhone || '';

    const closeMsg =
      reason === 'USER_CANCEL'
        ? 'Tu solicitud ha sido cancelada exitosamente a petición tuya. Si deseas realizar otra consulta o agendar una cita en el futuro, escribe "menu". ¡Hasta pronto!'
        : 'Por inactividad hemos cerrado esta sesión y cancelado la gestión de tu cita en el Hospital Universitario Nacional (HUN). Si deseas iniciar una nueva solicitud, escribe "menu" en cualquier momento. ¡Hasta pronto!';

    console.log(`🔒 [Cierre por Inactividad] Cerrando conversacion ${conv.id} para ${targetPhone || 'desconocido'}. Motivo: ${reason}`);

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

    // 2. Cerrar conversacion
    await store.updateConversation(conv.id, {
      status: 'CLOSED',
      currentFlow: 'IDLE',
      currentStep: 'CANCELLED_BY_USER',
      flowData: {
        ...conv.flowData,
        inactivityWarningSent: false,
        cancelledReason: reason,
      },
    });

    // 3. Registrar o actualizar la cita en estado "CANCELLED_BY_USER"
    await store.cancelAppointmentForContact(conv.contactId, conv.flowData);

    // 4. Emitir eventos a dashboard en tiempo real
    const updatedConv = store.getConversationById(conv.id);
    socketService.emitConversationUpdated(updatedConv);
    socketService.emitAppointmentsUpdated(store.getAllAppointments());
    socketService.emitMetricsUpdated(store.getMetrics());

    return { success: true, conversation: updatedConv };
  }
}

export const inactivityService = new InactivityService();
