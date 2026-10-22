import { Router } from 'express';
import { MetricsController } from '../controllers/metrics.controller';
import { requireRole } from '../middleware/auth.middleware';

const router = Router();

router.get('/metrics', MetricsController.getMetrics);
router.get('/appointments', MetricsController.getAppointments);
router.get('/contacts', MetricsController.getContacts);
router.delete('/contacts', requireRole('ADMIN', 'AUXILIAR'), MetricsController.deleteContacts);
router.delete('/contacts/:id', requireRole('ADMIN', 'AUXILIAR'), MetricsController.deleteContact);
router.delete('/appointments', requireRole('ADMIN', 'AUXILIAR'), MetricsController.clearAppointments);
router.delete('/appointments/:id', requireRole('ADMIN', 'AUXILIAR'), MetricsController.deleteAppointment);

router.get('/quotes', MetricsController.getQuotes);
router.delete('/quotes', requireRole('ADMIN', 'AUXILIAR'), MetricsController.clearQuotes);
router.delete('/quotes/:id', requireRole('ADMIN', 'AUXILIAR'), MetricsController.deleteQuote);

router.get('/tickets', MetricsController.getTickets);
router.delete('/tickets', requireRole('ADMIN', 'AUXILIAR'), MetricsController.clearTickets);
router.delete('/tickets/:id', requireRole('ADMIN', 'AUXILIAR'), MetricsController.deleteTicket);

router.get('/specialties', MetricsController.getSpecialties);

export default router;
