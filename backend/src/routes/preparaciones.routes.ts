import { Router } from 'express';
import { PreparacionesController } from '../controllers/preparaciones.controller';

const router = Router();

router.get('/areas', PreparacionesController.getAreas);
router.get('/laboratorios', PreparacionesController.getLaboratories);
router.get('/:packageId/instruction', PreparacionesController.getPatientInstruction);
router.get('/:packageId', PreparacionesController.getByPackageId);
router.get('/', PreparacionesController.getProcedures);

export default router;
