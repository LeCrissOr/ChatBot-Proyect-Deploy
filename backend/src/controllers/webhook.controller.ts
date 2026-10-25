import { Request, Response } from 'express';
import { CONFIG } from '../config';
import { store } from '../services/store.service';
import { socketService } from '../services/socket.service';
import { DecisionTreeService } from '../services/decisionTree.service';
import { WhatsAppService, WhatsAppChannel } from '../services/whatsapp.service';
import { inactivityService } from '../services/inactivity.service';
import { HunApiService } from '../services/hunApi.service';
import { incomingMessageQueue } from '../services/incomingMessageQueue.service';
import { AgendaService } from '../services/agenda.service';
import { normalizeColombianPhone } from '../utils/phone';

export class WebhookController {
  private static readonly processedMessageIds = new Map<string, number>();
  private static readonly phoneQueues = new Map<string, Promise<unknown>>();

  /**
   * Serializa únicamente los mensajes del mismo teléfono. Los usuarios
   * distintos se procesan en paralelo y no quedan bloqueados entre sí.
   */
  private static enqueueByPhone(phone: string, task: () => Promise<unknown>): Promise<unknown> {
    const key = phone.replace(/\D/g, '');
    const previous = this.phoneQueues.get(key) || Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    this.phoneQueues.set(key, next);
    void next.finally(() => {
      if (this.phoneQueues.get(key) === next) this.phoneQueues.delete(key);
    }).catch(() => undefined);
    return next;
  }

  /**
   * Verificación del Webhook requerida por Meta (GET /api/webhook)
   */
  public static verifyWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === CONFIG.WHATSAPP_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado correctamente por Meta WhatsApp Cloud API');
      res.status(200).send(challenge);
      return;
    }

    console.warn('⚠️ Intento de verificación de webhook fallido o token incorrecto');
    res.status(403).json({ error: 'Token de verificación inválido' });
  }

  /**
   * Recepción de eventos de WhatsApp Business de Meta (POST /api/webhook)
   */
  public static async handleWebhookEvent(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body;

      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            const changes = change.value;
            for (const delivery of changes?.statuses || []) {
              const status = ['sent', 'delivered', 'read', 'failed'].includes(delivery.status) ? delivery.status : undefined;
              if (!status || !delivery.id) continue;
              const failureDescription = delivery.errors?.map((entry: any) => entry.title || entry.message || entry.error_data?.details).filter(Boolean).join(' · ');
              const updated = await store.updateMessageStatusByWhatsAppId(delivery.id, status, failureDescription);
              if (updated) socketService.emitMessageUpdated(updated);
            }
            if (!changes?.messages?.length) continue;
            for (const messageObj of changes.messages) {
          const fromPhone = messageObj.from;
          const senderName = changes.contacts?.[0]?.profile?.name || 'Paciente';

          let textContent = '';
          if (messageObj.type === 'text') {
            textContent = messageObj.text.body;
          } else if (messageObj.type === 'interactive') {
            textContent = messageObj.interactive?.button_reply?.id || messageObj.interactive?.button_reply?.title || messageObj.interactive?.list_reply?.id || messageObj.interactive?.list_reply?.title || '';
          } else if (messageObj.type === 'button') {
            textContent = messageObj.button?.text || '';
          } else if (messageObj.type === 'document' || messageObj.type === 'image') {
            textContent = messageObj[messageObj.type]?.caption || 'Documento adjunto recibido';
          }

          if (textContent) {
            // Meta requiere un 200 rápido; la respuesta se procesa en segundo plano.
            // Esto evita reintentos del webhook y permite atender varios usuarios a la vez.
            const queued = await incomingMessageQueue.enqueue({ phone: fromPhone, text: textContent, senderName, waMessageId: messageObj.id, sourceChannel: 'META' });
            if (queued === 'UNAVAILABLE') {
              if (CONFIG.NODE_ENV === 'production') {
                res.status(503).json({ error: 'No fue posible persistir el mensaje; Meta puede reintentar el webhook.' });
                return;
              }
              void WebhookController.enqueueByPhone(fromPhone, () => WebhookController.processMessage(fromPhone, textContent, senderName, messageObj.id, 'META'))
                .catch((error) => console.error('❌ Error procesando mensaje en cola local:', error));
            }
          }
            }
          }
        }

        res.status(200).send('EVENT_RECEIVED');
        return;
      }

      res.sendStatus(404);
    } catch (err: any) {
      console.error('❌ Error procesando webhook de WhatsApp:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  /**
   * Endpoint de simulación para el simulador integrado en el Dashboard (POST /api/webhook/simulate)
   */
  public static async simulateIncomingMessage(req: Request, res: Response): Promise<void> {
    try {
      const { phone, text, name } = req.body;
      if (typeof phone !== 'string' || typeof text !== 'string' || !phone.trim() || !text.trim()) {
        res.status(400).json({ error: 'Se requieren campos "phone" y "text"' });
        return;
      }
      if (phone.replace(/\D/g, '').length < 7 || text.trim().length > 4000) {
        res.status(400).json({ error: 'Teléfono o texto con formato inválido.' });
        return;
      }

      const result = await WebhookController.processMessage(phone, text, name || 'Paciente', undefined, 'SIMULATOR');
      res.status(200).json({ success: true, result });
    } catch (err: any) {
      console.error('❌ Error en simulación de mensaje:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Procesamiento central de mensajes para WhatsApp real y simulador
   */
  public static async processMessage(
    phone: string,
    text: string,
    senderName?: string,
    waMessageId?: string,
    sourceChannel: WhatsAppChannel = 'META'
  ) {
    if (waMessageId) {
      const now = Date.now();
      if (this.processedMessageIds.has(waMessageId)) return { status: 'DUPLICATE_IGNORED' };
      this.processedMessageIds.set(waMessageId, now);
    }

    // 1. Obtener o crear contacto
    // El nombre visible de WhatsApp no es un dato validado del paciente.
    const contact = await store.getOrCreateContact(phone);

    // 2. Obtener conversación activa
    const conversation = await store.getOrCreateActiveConversation(contact.id);

    // 3. Guardar mensaje del usuario
    const userMsg = await store.saveMessage(conversation.id, 'USER', text, undefined, waMessageId);
    socketService.emitNewMessage(userMsg);

    // 4. Si la conversación está intervenida por un auxiliar humano, no responder con el bot
    if (conversation.status === 'AGENT_TAKEN') {
      console.log(`👤 Conversación ${conversation.id} en manos de asesor humano. Bot en pausa.`);
      socketService.emitConversationUpdated(await store.getConversationById(conversation.id));
      return { status: 'AGENT_TAKEN' };
    }

    // 4.5. Si el bot estaba esperando respuesta a la pregunta de inactividad ("¿Sigues en línea?")
    if (conversation.flowData?.inactivityWarningSent) {
      const lower = text.toLowerCase().trim();

      // Si el paciente decide cancelar
      if (
        lower === 'cancelar' ||
        lower === 'no' ||
        lower === 'cancel' ||
        lower === 'finalizar' ||
        lower === 'salir' ||
        lower.startsWith('cancelar') ||
        lower.includes('no deseo') ||
        lower.includes('deseo cancelar')
      ) {
        return inactivityService.closeDueToInactivity(conversation, 'USER_CANCEL');
      }

      // Si el paciente responde afirmativamente para continuar
      const isAffirmative =
        /\b(si|sí|continuar|sigo|acá|aca|aquí|aqui|estoy|hola|deseo continuar|claro|dale)\b/i.test(lower);

      if (isAffirmative) {
        // Limpiar bandera de advertencia
        conversation.flowData.inactivityWarningSent = false;
        delete conversation.flowData.inactivityWarningSentAt;
        await store.updateConversation(conversation.id, { flowData: conversation.flowData });

        const resumeGreeting = '¡Excelente! Continuamos con tu solicitud.';
        const stepPrompts = DecisionTreeService.getStepPrompt(
          conversation.currentFlow,
          conversation.currentStep,
          conversation.flowData,
          contact.name
        );

        const allReplies = [resumeGreeting, ...stepPrompts];

        const recipientPhone = phone || contact.phone;
        for (const reply of allReplies) {
          const botMsg = await store.saveMessage(conversation.id, 'BOT', reply);
          socketService.emitNewMessage(botMsg);
          const result = await WhatsAppService.sendTextMessageWithResult(recipientPhone, reply, sourceChannel);
          const updatedMessage = await store.updateMessageStatus(botMsg.id, result.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(result.success), result.waMessageId, result.error);
          if (updatedMessage) socketService.emitMessageUpdated(updatedMessage);
          if (allReplies.length > 1) {
            await new Promise((resolve) => setTimeout(resolve, 150));
          }
        }

        socketService.emitConversationUpdated(store.getConversationById(conversation.id));
        return { status: 'RESUMED' };
      }

      // Si respondió directamente la opción/pregunta pendiente (ej. "Dermatología" o "1"),
      // limpiamos la advertencia y dejamos que el árbol de decisiones procese su respuesta.
      conversation.flowData.inactivityWarningSent = false;
      delete conversation.flowData.inactivityWarningSentAt;
      await store.updateConversation(conversation.id, { flowData: conversation.flowData });
    }

    // 5. Evaluar árbol de decisiones
    const confirmedAppointments = store.getConfirmedAppointmentsByContact(contact.id);
    const cleanDocLookup = text.replace(/\D/g, '');
    const foundPatient =
      conversation.currentFlow === 'PATIENT_REGISTRATION' &&
      conversation.currentStep === 'LOOKUP_DOCUMENT' &&
      cleanDocLookup.length >= 5
        ? await store.findContactByDocument(cleanDocLookup)
        : undefined;
    const registrationData = {
      ...conversation.flowData,
      contactId: contact.id,
      contactPhone: contact.phone,
      confirmedAppointments,
      ...(foundPatient
        ? {
            patientFound: true,
            patientName: foundPatient.name,
            patientDoc: foundPatient.documentId || cleanDocLookup,
            lookupDocument: cleanDocLookup,
          }
        : conversation.currentFlow === 'PATIENT_REGISTRATION' && conversation.currentStep === 'LOOKUP_DOCUMENT'
        ? { patientFound: false, lookupDocument: cleanDocLookup }
        : {}),
    };
    const botResult = await DecisionTreeService.processMessage(
      text,
      conversation.currentFlow,
      conversation.currentStep,
      registrationData,
      contact.name || undefined
    );

    if (botResult.updatedData.requestForSelf === false) {
      // Si la cita es para alguien más, el contacto de WhatsApp es el solicitante
      if (
        botResult.updatedData.applicantName ||
        botResult.updatedData.applicantDoc ||
        botResult.updatedData.applicantDocType ||
        botResult.updatedData.applicantPhone
      ) {
        await store.updateContactProfile(contact.id, {
          name: botResult.updatedData.applicantName || contact.name,
          documentId: botResult.updatedData.applicantDoc || contact.documentId,
          documentType: botResult.updatedData.applicantDocType || contact.documentType,
        });
      }

      // Registrar o actualizar al paciente tercero en base de datos
      if (botResult.updatedData.patientDoc && botResult.updatedData.patientName) {
        await store.createOrUpdatePatientContact({
          documentId: botResult.updatedData.patientDoc,
          documentType: botResult.updatedData.patientDocumentType || 'Cédula de Ciudadanía',
          name: botResult.updatedData.patientName,
          phone: botResult.updatedData.patientPhone ? normalizeColombianPhone(botResult.updatedData.patientPhone) : undefined,
          email: botResult.updatedData.patientEmail,
          residenceCity: botResult.updatedData.residenceCity,
          residenceAddress: botResult.updatedData.residenceAddress,
        });
      }
      socketService.emitContactsUpdated(store.getAllContacts());
    } else if (
      botResult.updatedData.patientName ||
      botResult.updatedData.patientDoc ||
      botResult.updatedData.patientDocumentType ||
      botResult.updatedData.patientEmail ||
      botResult.updatedData.residenceCity ||
      botResult.updatedData.residenceAddress ||
      botResult.updatedData.patientPhone
    ) {
      let birthDateVal: Date | undefined = undefined;
      if (botResult.updatedData.patientBirthDate) {
        const parts = botResult.updatedData.patientBirthDate.split('/');
        if (parts.length === 3) {
          const [d, m, y] = parts.map(Number);
          if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
            birthDateVal = new Date(Date.UTC(y, m - 1, d));
          }
        } else {
          const parsed = new Date(botResult.updatedData.patientBirthDate);
          if (!isNaN(parsed.getTime())) birthDateVal = parsed;
        }
      }

      await store.updateContactProfile(contact.id, {
        name: botResult.updatedData.patientName,
        documentId: botResult.updatedData.patientDoc,
        documentType: botResult.updatedData.patientDocumentType,
        birthDate: birthDateVal,
        email: botResult.updatedData.patientEmail,
        residenceCity: botResult.updatedData.residenceCity,
        residenceAddress: botResult.updatedData.residenceAddress,
      });
      socketService.emitContactsUpdated(store.getAllContacts());
    }

    // 5.5. Si el bot capturó o actualizó el tipo de usuario (Particular, Egresado UNAL, Colaborador HUN, Otro)
    if (botResult.updatedData.userType && botResult.updatedData.userType !== contact.userTypeCode) {
      await store.updateContactUserType(contact.id, botResult.updatedData.userType);
      socketService.emitContactsUpdated(store.getAllContacts());
    }

    // 6. Actualizar estado de la conversación
    await store.updateConversation(conversation.id, {
      currentFlow: botResult.nextFlow,
      currentStep: botResult.nextStep,
      flowData: botResult.updatedData,
      status: botResult.status || conversation.status,
    });

    // 7. Si el bot generó acciones específicas (citas, cotizaciones, tickets, NPS)
    if (botResult.createAppointment) {
      const activeUserTypeCode = botResult.updatedData.userTypeCode || botResult.updatedData.userType || contact.userTypeCode;
      const activeUserTypeName = botResult.updatedData.userTypeName || contact.userTypeName;

      try {
        const apt = await store.createAppointment({
          contactId: contact.id,
          userTypeCode: activeUserTypeCode,
          userTypeName: activeUserTypeName,
          ...botResult.createAppointment,
          status: 'CONFIRMED',
        });
        console.log(`📅 Cita creada exitosamente en HUN: ${apt.id}`);
        socketService.emitAppointmentsUpdated(store.getAllAppointments());
      } catch (error: any) {
        const isSlotCollision = ['P2004', 'P2010'].includes(error?.code) || /citas_doctor_horario_excluyente|exclusion constraint|23P01/i.test(error?.message || '');
        if (!isSlotCollision) throw error;

        console.warn('⚠️ El cupo fue reservado simultáneamente por otra solicitud; ofreciendo alternativas.');
        const replacementSlots = botResult.updatedData.specialty
          ? await AgendaService.getAvailableSlotsForSpecialty(botResult.updatedData.specialty, undefined, 3)
          : [];
        const flowData = { ...botResult.updatedData, dynamicSlots: replacementSlots };
        delete (flowData as any).selectedDynamicSlot;
        delete flowData.selectedSlot;
        await store.updateConversation(conversation.id, {
          currentFlow: 'F01_CONSULTA',
          currentStep: 'F01_SELECT_SLOT',
          flowData,
        });
        botResult.nextFlow = 'F01_CONSULTA';
        botResult.nextStep = 'F01_SELECT_SLOT';
        botResult.updatedData = flowData;
        botResult.replyMessages = replacementSlots.length
          ? ['Ese horario acaba de ser reservado por otra persona. No se creó tu cita. Por favor elige uno de estos horarios disponibles:', 'Si ninguno te sirve, responde 4 para solicitar lista de espera.']
          : ['Ese horario acaba de ser reservado por otra persona. No se creó tu cita y en este momento no quedan cupos para mostrar. Escribe *menu* para intentar otra gestión o comunícate con un auxiliar.'];
        botResult.interactivePayload = replacementSlots.length ? {
          type: 'list',
          title: `Horarios para ${flowData.specialty || 'consulta'}`,
          buttonText: '🗓️ Ver horarios',
          options: replacementSlots.map((slot, index) => ({ id: String(index + 1), title: `${index + 1}. ${slot.dateTimeStr}`.slice(0, 24), description: slot.doctorName })),
        } : undefined;
      }
    }

    if (botResult.rescheduleAppointment) {
      const updated = await store.updateAppointmentSlot(
        botResult.rescheduleAppointment.appointmentId,
        botResult.rescheduleAppointment.newDateTime,
        botResult.rescheduleAppointment.newDoctorName,
        botResult.rescheduleAppointment.reason
      );
      if (updated) {
        console.log(`🔄 Cita reprogramada exitosamente en HUN: ${updated.id} (Motivo: ${botResult.rescheduleAppointment.reason || 'No especificado'})`);
        socketService.emitAppointmentsUpdated(store.getAllAppointments());
        socketService.emitContactsUpdated(store.getAllContacts());
      }
    }

    if (botResult.cancelAppointmentId) {
      const cancelled = await store.cancelAppointment(
        botResult.cancelAppointmentId,
        botResult.cancelAppointmentReason
      );
      if (cancelled) {
        console.log(`❌ Cita cancelada por usuario en HUN: ${cancelled.id} (Motivo: ${botResult.cancelAppointmentReason || 'No especificado'})`);
        socketService.emitAppointmentsUpdated(store.getAllAppointments());
        socketService.emitContactsUpdated(store.getAllContacts());

        // Si la cita tenía ID oficial de Hosvital, sincronizar cancelación con la API del hospital
        if (cancelled.referralCode && cancelled.referralCode.startsWith('HOSVITAL-')) {
          const numCita = parseInt(cancelled.referralCode.replace('HOSVITAL-', ''), 10);
          if (!isNaN(numCita)) {
            HunApiService.cancelarCita({
              cita: numCita,
              tipo_documento: contact.documentType || 'CC',
              documento: contact.documentId || '79810144',
            }).then((resp) => {
              console.log(`📡 [Hosvital] Solicitud de cancelación enviada para cita #${numCita}:`, resp.message);
            }).catch((err) => {
              console.warn(`⚠️ [Hosvital] Error enviando cancelación a Hosvital:`, err.message);
            });
          }
        }
      }
    }

    if (botResult.createQuote) {
      const activeUserTypeCode = botResult.updatedData.userTypeCode || botResult.updatedData.userType || contact.userTypeCode;
      const activeUserTypeName = botResult.updatedData.userTypeName || contact.userTypeName;

      const qte = await store.createSurgicalQuote({
        contactId: contact.id,
        userTypeCode: activeUserTypeCode,
        userTypeName: activeUserTypeName,
        ...botResult.createQuote,
        status: 'PENDING_AUXILIAR',
      });
      console.log(`🏥 Cotización quirúrgica registrada: ${qte.id}`);
    }

    if (botResult.createTicket) {
      const tkt = await store.createSupportTicket({
        contactId: contact.id,
        ...botResult.createTicket,
        status: 'OPEN',
      });
      console.log(`🎫 Ticket de atención generado: ${tkt.id} (${tkt.type})`);
      if (tkt.priority === 'CRITICAL') {
        socketService.emitCriticalAlarm(tkt);
      }
    }

    if (botResult.createNps) {
      const nps = await store.createNpsSurvey({
        contactId: contact.id,
        ...botResult.createNps,
      });
      console.log(`⭐ Encuesta NPS registrada: ${nps.rating}/5`);
    }

    // 8. Enviar respuestas del bot al paciente y guardar en el historial
    // La respuesta en vivo SIEMPRE debe retornar al remitente/canal de entrada activo
    const recipientPhone = phone || contact.phone;

    // Si la respuesta incluye un sticker/media (ej. Nicol al saludar), enviarlo físicamente por WhatsApp
    if (botResult.mediaUrl && sourceChannel !== 'SIMULATOR') {
      try {
        console.log(`📲 [WhatsApp Físico] Despachando sticker oficial a ${recipientPhone}`);
        await WhatsAppService.sendStickerMessage(recipientPhone, botResult.mediaUrl, sourceChannel);
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (stickerErr: any) {
        console.warn(`⚠️ [WhatsApp Físico] No se pudo enviar el sticker (${stickerErr?.message || stickerErr}), continuando con mensajes de texto...`);
      }
    }

    // Enviar respuestas de texto del bot al paciente y guardar en el historial
    for (let i = 0; i < botResult.replyMessages.length; i++) {
      const reply = botResult.replyMessages[i];
      // En la Opción A, el mediaUrl se asocia al primer mensaje en BD y Socket para la UI del Dashboard
      const media = i === 0 ? botResult.mediaUrl : undefined;
      // El payload interactivo se asocia al último mensaje de texto para adjuntar los botones o lista
      const isLast = i === botResult.replyMessages.length - 1;
      const interactive = isLast ? botResult.interactivePayload : undefined;

      const botMsg = await store.saveMessage(conversation.id, 'BOT', reply, media, undefined, interactive);
      socketService.emitNewMessage(botMsg);

      // Despacho por canal WhatsApp:
      let sendOutcome: { success: boolean; waMessageId?: string; simulated?: boolean; error?: string };
      if (interactive) {
        if (interactive.type === 'list') {
          sendOutcome = await WhatsAppService.sendInteractiveList(
            recipientPhone,
            reply,
            interactive.buttonText || 'Ver Opciones',
            interactive.title || 'Opciones',
            interactive.options,
            sourceChannel
          );
        } else if (interactive.type === 'button') {
          sendOutcome = await WhatsAppService.sendInteractiveButtons(
            recipientPhone,
            reply,
            interactive.options,
            sourceChannel
          );
        } else {
          sendOutcome = await WhatsAppService.sendTextMessageWithResult(recipientPhone, reply, sourceChannel);
        }
      } else {
        sendOutcome = await WhatsAppService.sendTextMessageWithResult(recipientPhone, reply, sourceChannel);
      }
      if (sendOutcome.success) {
        console.info(`[WhatsApp Outbound] Solicitud aceptada por el canal (${sendOutcome.simulated ? 'simulado' : 'proveedor'}); mensaje=${botMsg.id}; providerMessageId=${sendOutcome.waMessageId || 'no disponible'}`);
      } else {
        console.error(`[WhatsApp Outbound] Falló el envío; mensaje=${botMsg.id}; error=${sendOutcome.error || 'sin detalle del proveedor'}`);
      }
      const updatedMessage = await store.updateMessageStatus(botMsg.id, sendOutcome.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(sendOutcome.success), sendOutcome.waMessageId, sendOutcome.error);
      if (updatedMessage) socketService.emitMessageUpdated(updatedMessage);

      if (botResult.replyMessages.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    // 9. Emitir actualizaciones al dashboard
    const updatedConv = store.getConversationById(conversation.id);
    socketService.emitConversationUpdated(updatedConv);
    socketService.emitMetricsUpdated(store.getMetrics());

    return botResult;
  }
}
