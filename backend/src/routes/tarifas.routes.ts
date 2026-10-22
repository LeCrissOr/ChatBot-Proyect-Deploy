import { Router } from 'express';
import { TarifasController } from '../controllers/tarifas.controller';

const router = Router();

router.get('/categorias', TarifasController.getCategories);
router.get('/stats', TarifasController.getStats);
router.get('/cups/:cups', TarifasController.getByCups);
router.get('/', TarifasController.getTariffs);

export default router;
