import { Request, Response } from 'express';
import { AgendaService } from '../services/agenda.service';

export class AgendaController {
  public static async getAgendaList(req: Request, res: Response) {
    try {
      const data = await AgendaService.getAgendaList(req.query);
      res.json(data);
    } catch (error: any) {
      console.error('Error obteniendo lista de agenda desde Endpoint:', error);
      res.status(500).json({ error: 'Error al consultar la agenda médica desde el Endpoint', details: error.message });
    }
  }

  public static async getCalendarEvents(req: Request, res: Response) {
    try {
      const data = await AgendaService.getCalendarEvents(req.query);
      res.json(data);
    } catch (error: any) {
      console.error('Error obteniendo eventos de calendario desde Endpoint:', error);
      res.status(500).json({ error: 'Error al consultar el calendario de agenda', details: error.message });
    }
  }

  public static async getFilters(req: Request, res: Response) {
    try {
      const data = await AgendaService.getFilters();
      res.json(data);
    } catch (error: any) {
      console.error('Error obteniendo filtros de agenda desde Endpoint:', error);
      res.status(500).json({ error: 'Error al consultar los filtros de agenda', details: error.message });
    }
  }

  public static async getAbsences(req: Request, res: Response) {
    try {
      const data = await AgendaService.getAbsences(req.query);
      res.json(data);
    } catch (error: any) {
      console.error('Error obteniendo ausencias y novedades:', error);
      res.status(500).json({ error: 'Error al consultar novedades de agenda', details: error.message });
    }
  }

  public static async getStats(req: Request, res: Response) {
    try {
      const data = await AgendaService.getStats();
      res.json(data);
    } catch (error: any) {
      console.error('Error obteniendo estadísticas de agenda desde Endpoint:', error);
      res.status(500).json({ error: 'Error al consultar estadísticas de agenda', details: error.message });
    }
  }

  public static async syncAgendaFromEndpoint(_req: Request, res: Response) {
    try {
      const result = await AgendaService.syncFromEndpoint();
      res.json({
        message: 'Agenda médica sincronizada en tiempo real con el Endpoint de Hosvital',
        stats: result.stats,
      });
    } catch (error: any) {
      console.error('Error sincronizando agenda con Endpoint:', error);
      res.status(500).json({ error: 'Error al sincronizar con el Endpoint de Hosvital', details: error.message });
    }
  }
}
