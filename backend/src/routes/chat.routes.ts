import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();

router.get('/conversations', ChatController.getConversations);
router.get('/conversations/:id/messages', ChatController.getMessages);
router.post('/conversations/:id/reply', ChatController.sendAgentReply);
router.post('/conversations/:id/takeover', ChatController.takeoverChat);
router.post('/conversations/:id/return-to-bot', ChatController.returnToBot);
router.post('/conversations/:id/trigger-post-qx', ChatController.triggerPostQxAlarmCheck);
router.post('/conversations/:id/trigger-nps', ChatController.triggerNpsSurvey);
router.post('/conversations/:id/trigger-inactivity-warning', ChatController.triggerInactivityWarning);
router.post('/conversations/:id/trigger-inactivity-close', ChatController.triggerInactivityClose);
router.delete('/conversations', ChatController.clearConversations);
router.delete('/conversations/:id', ChatController.deleteConversation);

export default router;
