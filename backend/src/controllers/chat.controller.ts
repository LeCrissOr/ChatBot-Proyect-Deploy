import { Request, Response } from 'express';
import { store } from '../services/store.service';
import { socketService } from '../services/socket.service';
import { WhatsAppService } from '../services/whatsapp.service';
import { inactivityService } from '../services/inactivity.service';

export class ChatController {
  public static async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const conversations = store.getAllConversations();
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const messages = store.getConversationMessages(id);
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async sendAgentReply(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { message } = req.body;

      if (typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'El mensaje no puede estar vacío' });
        return;
      }
      if (message.trim().length > 4000) {
        res.status(400).json({ error: 'El mensaje no puede superar 4000 caracteres.' });
        return;
      }

      const conv = store.getConversationById(id);
      if (!conv || !conv.contact) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      // Guardar mensaje como AGENT
      const agentMsg = await store.saveMessage(id, 'AGENT', message.trim());
      socketService.emitNewMessage(agentMsg);

      // Enviar por WhatsApp
      const sendResult = await WhatsAppService.sendTextMessageWithResult(conv.contact.phone, message.trim());
      const updatedMsg = await store.updateMessageStatus(agentMsg.id, sendResult.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(sendResult.success), sendResult.waMessageId, sendResult.error);
      if (updatedMsg) socketService.emitMessageUpdated(updatedMsg);

      res.status(sendResult.success ? 200 : 502).json({ success: sendResult.success, message: updatedMsg || agentMsg, error: sendResult.success ? undefined : 'WhatsApp no aceptó el envío.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async takeoverChat(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await store.updateConversation(id, { status: 'AGENT_TAKEN' });
      if (!updated) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      const fullConv = store.getConversationById(id);
      socketService.emitConversationUpdated(fullConv);
      res.json({ success: true, conversation: fullConv });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async returnToBot(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const updated = await store.updateConversation(id, { status: 'BOT' });
      if (!updated) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      const fullConv = store.getConversationById(id);
      socketService.emitConversationUpdated(fullConv);
      res.json({ success: true, conversation: fullConv });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async triggerPostQxAlarmCheck(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const conv = store.getConversationById(id);
      if (!conv || !conv.contact) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      const promptMsg =
        `Hola ${conv.contact.name || 'estimado paciente'} 👋\n\nDesde el Hospital Universitario Nacional (HUN) realizamos tu seguimiento postquirúrgico de 24h:\n\n¿Cómo te encuentras el día de hoy?\n¿Presentas alguno de estos signos de alarma: fiebre superior a 38°C, sangrado persistente, dolor agudo que no cede con medicamentos o supuración en herida quirúrgica?\n\n1️⃣ Sí, presento signos de alarma\n2️⃣ No, me encuentro bien y sin complicaciones`;

      await store.updateConversation(id, {
        currentFlow: 'POST_QX',
        currentStep: 'POST_QX_ALARM_CHECK',
      });

      const botMsg = await store.saveMessage(id, 'BOT', promptMsg);
      socketService.emitNewMessage(botMsg);
      const sendResult = await WhatsAppService.sendTextMessageWithResult(conv.contact.phone, promptMsg);
      const updatedMsg = await store.updateMessageStatus(botMsg.id, sendResult.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(sendResult.success), sendResult.waMessageId, sendResult.error);
      if (updatedMsg) socketService.emitMessageUpdated(updatedMsg);

      res.status(sendResult.success ? 200 : 502).json({ success: sendResult.success, message: sendResult.success ? 'Disparo de seguimiento post-quirúrgico enviado' : 'No fue posible enviar el seguimiento por WhatsApp.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async triggerNpsSurvey(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const conv = store.getConversationById(id);
      if (!conv || !conv.contact) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }

      const promptMsg =
        `Hola ${conv.contact.name || 'estimado paciente'} ⭐\n\nPara el Hospital Universitario Nacional tu opinión es fundamental:\n\n¿Cómo calificarías la atención recibida en tu consulta médica?\n\nPor favor califícanos del 1 al 5 respondiendo con un número:\n1 ⭐ (Muy insatisfecho)\n2 ⭐ (Insatisfecho)\n3 ⭐ (Regular)\n4 ⭐ (Bueno)\n5 ⭐ (Excelente)`;

      await store.updateConversation(id, {
        currentFlow: 'NPS_SURVEY',
        currentStep: 'NPS_SCORE',
      });

      const botMsg = await store.saveMessage(id, 'BOT', promptMsg);
      socketService.emitNewMessage(botMsg);
      const sendResult = await WhatsAppService.sendTextMessageWithResult(conv.contact.phone, promptMsg);
      const updatedMsg = await store.updateMessageStatus(botMsg.id, sendResult.simulated ? 'simulated' : WhatsAppService.getDeliveryStatus(sendResult.success), sendResult.waMessageId, sendResult.error);
      if (updatedMsg) socketService.emitMessageUpdated(updatedMsg);

      res.status(sendResult.success ? 200 : 502).json({ success: sendResult.success, message: sendResult.success ? 'Encuesta NPS disparada' : 'No fue posible enviar la encuesta por WhatsApp.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async triggerInactivityWarning(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const conv = store.getConversationById(id);
      if (!conv) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }
      await inactivityService.sendInactivityWarning(conv);
      res.json({ success: true, message: 'Advertencia de inactividad enviada al paciente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async triggerInactivityClose(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const conv = store.getConversationById(id);
      if (!conv) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }
      const result = await inactivityService.closeDueToInactivity(conv, 'TIMEOUT');
      res.json({ success: true, message: 'Conversación cerrada por inactividad y cita cancelada', result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async clearConversations(req: Request, res: Response): Promise<void> {
    try {
      const scope = (req.query.scope as 'ALL' | 'CLOSED') || (req.body?.scope as 'ALL' | 'CLOSED') || 'CLOSED';
      const result = store.clearConversations(scope);
      socketService.emitConversationsCleared();
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({
        success: true,
        ...result,
        message: `Bandeja limpiada exitosamente (${result.deletedCount} conversaciones eliminadas)`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deleted = store.deleteConversation(id);
      if (!deleted) {
        res.status(404).json({ error: 'Conversación no encontrada' });
        return;
      }
      socketService.emitConversationsCleared();
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({ success: true, message: 'Conversación eliminada exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
