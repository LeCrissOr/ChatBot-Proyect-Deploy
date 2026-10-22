import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';

const router = Router();

// Verificación inicial de Meta (GET)
router.get('/', WebhookController.verifyWebhook);

// Eventos entrantes de WhatsApp Business (POST)
router.post('/', WebhookController.handleWebhookEvent);

export default router;
