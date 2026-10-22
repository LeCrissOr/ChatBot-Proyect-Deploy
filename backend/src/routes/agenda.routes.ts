import { Router } from 'express';
import { AgendaController } from '../controllers/agenda.controller';

const router = Router();

// Rutas de consulta conectadas a los Endpoints de Hosvital
router.get('/', AgendaController.getAgendaList);
router.get('/calendar', AgendaController.getCalendarEvents);
router.get('/filters', AgendaController.getFilters);
router.get('/absences', AgendaController.getAbsences);
router.get('/stats', AgendaController.getStats);

// Sincronización en tiempo real con el Endpoint de Hosvital (sin Excel)
router.post('/sync', AgendaController.syncAgendaFromEndpoint);
router.post('/upload', AgendaController.syncAgendaFromEndpoint);

export default router;
