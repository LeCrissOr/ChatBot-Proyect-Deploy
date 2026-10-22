import { Request, Response } from 'express';
import { TarifasService } from '../services/tarifas.service';

export class TarifasController {
  public static async getTariffs(req: Request, res: Response) {
    try {
      const data = await TarifasService.searchTariffs(req.query);
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando tarifas CUPS:', error);
      res.status(500).json({ error: 'Error al consultar tarifas CUPS', details: error.message });
    }
  }

  public static async getCategories(req: Request, res: Response) {
    try {
      const data = await TarifasService.getCategories();
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando categorías de tarifas:', error);
      res.status(500).json({ error: 'Error al consultar categorías de tarifas', details: error.message });
    }
  }

  public static async getStats(req: Request, res: Response) {
    try {
      const data = await TarifasService.getStats();
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando estadísticas de tarifas:', error);
      res.status(500).json({ error: 'Error al consultar estadísticas de tarifas', details: error.message });
    }
  }

  public static async getByCups(req: Request, res: Response) {
    try {
      const cups = String(req.params.cups);
      const data = await TarifasService.getByCups(cups);
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'Tarifa no encontrada para el código CUPS especificado' });
      }
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando tarifa por CUPS:', error);
      res.status(500).json({ error: 'Error al consultar tarifa por CUPS', details: error.message });
    }
  }
}
