import axios from 'axios';
import { CONFIG } from '../config';
import { baileysService } from './baileys.service';
import { normalizeColombianPhone } from '../utils/phone';

export interface WhatsAppSendOutcome { success: boolean; waMessageId?: string; simulated?: boolean; error?: string }
export type WhatsAppChannel = 'META' | 'BAILEYS' | 'AUTO' | 'SIMULATOR';

export class WhatsAppService {
  public static getDeliveryStatus(success: boolean): string {
    if (!success) return 'failed';
    return !baileysService.isConnected() && (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID) ? 'simulated' : 'sent';
  }
  /**
   * Envía un mensaje de texto a un número de WhatsApp usando Baileys (QR) o Meta Cloud API
   */
  public static async sendTextMessage(toPhone: string, text: string): Promise<boolean> {
    return (await this.sendTextMessageWithResult(toPhone, text)).success;
  }

  public static async sendTextMessageWithResult(toPhone: string, text: string, channel: WhatsAppChannel = 'AUTO'): Promise<WhatsAppSendOutcome> {
    try {
      if (!toPhone || typeof toPhone !== 'string') {
        console.warn(`⚠️ [WhatsAppService] sendTextMessage llamado con número inválido:`, toPhone);
        return { success: false };
      }

      const cleanPhone = normalizeColombianPhone(toPhone);
      if (!cleanPhone) {
        console.warn(`⚠️ [WhatsAppService] sendTextMessage cleanPhone vacío para:`, toPhone);
        return { success: false };
      }

      const cleanText = (text || '').replace(/\*\*/g, '');

      if (channel === 'SIMULATOR') return { success: true, simulated: true };
      if (channel === 'META' && (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID)) {
        return { success: false, error: 'El canal de entrada fue Meta, pero Meta Cloud API no está configurada para responder.' };
      }
      if (channel === 'BAILEYS' && !baileysService.isConnected()) {
        return { success: false, error: 'El mensaje entró por Baileys, pero la sesión de WhatsApp Web ya no está conectada.' };
      }

      // 1. Si está conectado mediante WhatsApp Web (Baileys / QR)
      if (channel !== 'META' && baileysService.isConnected()) {
        return { success: await baileysService.sendMessage(toPhone || cleanPhone, cleanText) };
      }

      // 2. Si no hay Baileys, verificar si hay Meta Cloud API
      if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`💬 [WhatsApp Simulado] Enviando a ${cleanPhone}: "${cleanText.substring(0, 80)}..."`);
        return { success: true, simulated: true };
      }

      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: true, body: cleanText },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${CONFIG.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });

      return { success: response.status === 200 || response.status === 201, waMessageId: response.data?.messages?.[0]?.id };
    } catch (err: any) {
      console.error(`❌ Error enviando mensaje por WhatsApp a ${toPhone}:`, err.response?.data || err.message || err);
      return { success: false, error: String(err.response?.data?.error?.message || err.message || 'Error de transporte WhatsApp').slice(0, 1000) };
    }
  }

  /**
   * Envía botones interactivos rápidos (Quick Replies, máx 3) a WhatsApp
   */
  public static async sendInteractiveButtons(
    toPhone: string,
    bodyText: string,
    buttons: Array<{ id: string; title: string }>,
    channel: WhatsAppChannel = 'AUTO'
  ): Promise<WhatsAppSendOutcome> {
    try {
      if (!toPhone || typeof toPhone !== 'string') {
        console.warn(`⚠️ [WhatsAppService] sendInteractiveButtons llamado con número inválido:`, toPhone);
        return { success: false };
      }

      const cleanPhone = normalizeColombianPhone(toPhone);
      if (!cleanPhone) return { success: false };

      const cleanText = (bodyText || '').replace(/\*\*/g, '');
      if (channel === 'SIMULATOR') return { success: true, simulated: true };
      if (channel === 'META' && (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID)) return { success: false, error: 'Meta Cloud API no está configurada.' };
      if (channel === 'BAILEYS' && !baileysService.isConnected()) return { success: false, error: 'La sesión de Baileys no está conectada.' };

      // 1. Si está conectado mediante WhatsApp Web (Baileys / QR)
      if (channel !== 'META' && baileysService.isConnected()) {
        return { success: await baileysService.sendMessage(toPhone || cleanPhone, cleanText) };
      }

      // 2. Si no hay token de Meta, modo simulado
      if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`💬 [WhatsApp Botones Simulado] Para ${cleanPhone}: ${(buttons || []).map((b) => b.title).join(', ')}`);
        return { success: true, simulated: true };
      }

      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: cleanText },
          action: {
            buttons: (buttons || []).slice(0, 3).map((b) => ({
              type: 'reply',
              reply: { id: b.id, title: (b.title || '').substring(0, 20) },
            })),
          },
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${CONFIG.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });

      return { success: response.status === 200 || response.status === 201, waMessageId: response.data?.messages?.[0]?.id };
    } catch (err: any) {
      console.error(`❌ Error enviando botones interactivos a ${toPhone}:`, err.response?.data || err.message || err);
      return this.sendTextMessageWithResult(toPhone, bodyText, channel);
    }
  }

  /**
   * Envía un menú de lista interactivo (List Message / Bottom Sheet desplegable, hasta 10 opciones)
   */
  public static async sendInteractiveList(
    toPhone: string,
    bodyText: string,
    buttonText: string,
    title: string,
    rows: Array<{ id: string; title: string; description?: string }>,
    channel: WhatsAppChannel = 'AUTO'
  ): Promise<WhatsAppSendOutcome> {
    try {
      if (!toPhone || typeof toPhone !== 'string') {
        console.warn(`⚠️ [WhatsAppService] sendInteractiveList llamado con número inválido:`, toPhone);
        return { success: false };
      }

      const cleanPhone = normalizeColombianPhone(toPhone);
      if (!cleanPhone) return { success: false };

      const cleanText = (bodyText || '').replace(/\*\*/g, '');
      if (channel === 'SIMULATOR') return { success: true, simulated: true };
      if (channel === 'META' && (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID)) return { success: false, error: 'Meta Cloud API no está configurada.' };
      if (channel === 'BAILEYS' && !baileysService.isConnected()) return { success: false, error: 'La sesión de Baileys no está conectada.' };

      // 1. Si está conectado mediante WhatsApp Web (Baileys / QR)
      if (channel !== 'META' && baileysService.isConnected()) {
        return { success: await baileysService.sendMessage(toPhone || cleanPhone, cleanText) };
      }

      // 2. Si no hay token de Meta, modo simulado
      if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`💬 [WhatsApp Menú Lista Simulado] Para ${cleanPhone} (${buttonText}): ${(rows || []).map((r) => r.title).join(', ')}`);
        return { success: true, simulated: true };
      }

      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: {
            type: 'text',
            text: (title || 'Opciones').substring(0, 60),
          },
          body: { text: cleanText },
          footer: { text: 'Hospital Universitario Nacional de Colombia' },
          action: {
            button: (buttonText || 'Ver Opciones').substring(0, 20),
            sections: [
              {
                title: 'Opciones disponibles',
                rows: (rows || []).slice(0, 10).map((r) => ({
                  id: r.id,
                  title: (r.title || '').substring(0, 24),
                  description: r.description ? r.description.substring(0, 72) : undefined,
                })),
              },
            ],
          },
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${CONFIG.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });

      return { success: response.status === 200 || response.status === 201, waMessageId: response.data?.messages?.[0]?.id };
    } catch (err: any) {
      console.error(`❌ Error enviando menú de lista interactivo a ${toPhone}:`, err.response?.data || err.message || err);
      return this.sendTextMessageWithResult(toPhone, bodyText, channel);
    }
  }

  /**
   * Envía un archivo multimedia o sticker a un número de WhatsApp
   */
  public static async sendMediaMessage(
    toPhone: string,
    mediaUrl: string,
    caption?: string,
    channel: WhatsAppChannel = 'AUTO'
  ): Promise<boolean> {
    try {
      if (!toPhone || typeof toPhone !== 'string' || !mediaUrl) {
        console.warn(`⚠️ [WhatsAppService] sendMediaMessage parámetros inválidos: toPhone=${toPhone}, mediaUrl=${mediaUrl}`);
        return false;
      }

      const cleanPhone = normalizeColombianPhone(toPhone);
      if (!cleanPhone) return false;
      if (channel === 'SIMULATOR') return true;
      if (channel === 'META' && (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID)) return false;
      if (channel === 'BAILEYS' && !baileysService.isConnected()) return false;

      // 1. Si está conectado mediante WhatsApp Web (Baileys / QR)
      if (channel !== 'META' && baileysService.isConnected()) {
        return baileysService.sendImage(cleanPhone, mediaUrl, caption);
      }

      // 2. Si no hay Baileys, simulación o Meta Cloud API
      if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`💬 [WhatsApp Media Simulado] Enviando a ${cleanPhone}: "${mediaUrl}"`);
        return true;
      }

      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${CONFIG.BACKEND_URL || 'http://localhost:3001'}${mediaUrl}`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'image',
        image: { link: fullUrl, caption: caption || undefined },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${CONFIG.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });

      return response.status === 200 || response.status === 201;
    } catch (err: any) {
      console.error(`❌ Error enviando media por WhatsApp Cloud API a ${toPhone}:`, err.response?.data || err.message || err);
      return false;
    }
  }

  /**
   * Envía un Sticker nativo oficial a un número de WhatsApp
   */
  public static async sendStickerMessage(toPhone: string, mediaUrl?: string, channel: WhatsAppChannel = 'AUTO'): Promise<boolean> {
    try {
      if (!toPhone || typeof toPhone !== 'string') {
        console.warn(`⚠️ [WhatsAppService] sendStickerMessage llamado con número inválido:`, toPhone);
        return false;
      }

      const cleanPhone = normalizeColombianPhone(toPhone);
      if (!cleanPhone) return false;
      if (channel === 'SIMULATOR') return true;
      if (channel === 'META' && (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID)) return false;
      if (channel === 'BAILEYS' && !baileysService.isConnected()) return false;

      // 1. Si está conectado mediante WhatsApp Web (Baileys / QR)
      if (channel !== 'META' && baileysService.isConnected()) {
        return baileysService.sendSticker(cleanPhone, mediaUrl);
      }

      // 2. Si no hay Baileys, verificar Meta Cloud API
      if (!CONFIG.WHATSAPP_TOKEN || !CONFIG.WHATSAPP_PHONE_NUMBER_ID) {
        console.log(`💬 [WhatsApp Sticker Simulado] Enviando sticker a ${cleanPhone}: "${mediaUrl || 'nicol-sticker.webp'}"`);
        return true;
      }

      const url = `https://graph.facebook.com/${CONFIG.WHATSAPP_API_VERSION}/${CONFIG.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      const fullUrl = (mediaUrl && mediaUrl.startsWith('http')) ? mediaUrl : `${CONFIG.BACKEND_URL || 'http://localhost:3001'}${mediaUrl || '/nicol-sticker.webp'}`;
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'sticker',
        sticker: { link: fullUrl.replace('.png', '.webp') },
      };

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${CONFIG.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 8000,
      });

      return response.status === 200 || response.status === 201;
    } catch (err: any) {
      console.error(`❌ Error enviando sticker por WhatsApp Cloud API a ${toPhone}:`, err.response?.data || err.message || err);
      // Fallback a imagen normal
      return this.sendMediaMessage(toPhone, mediaUrl || '/nicol-sticker-clean.png', undefined, channel);
    }
  }
}
