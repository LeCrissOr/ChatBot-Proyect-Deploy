import { Request, Response } from 'express';
import { store } from '../services/store.service';
import { socketService } from '../services/socket.service';
import { HUN_SPECIALTIES } from '../services/decisionTree.service';

export class MetricsController {
  public static async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = store.getMetrics();
      res.json(metrics);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getAppointments(req: Request, res: Response): Promise<void> {
    try {
      const appointments = store.getAllAppointments();
      res.json(appointments);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getContacts(req: Request, res: Response): Promise<void> {
    try { res.json(store.getAllContacts()); } catch (err: any) { res.status(500).json({ error: err.message }); }
  }

  public static async deleteContact(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      await store.deleteContact(id);
      socketService.emitContactsUpdated(store.getAllContacts());
      socketService.emitConversationsCleared();
      socketService.emitAppointmentsUpdated(store.getAllAppointments());
      socketService.emitQuotesUpdated(store.getAllQuotes());
      socketService.emitTicketsUpdated(store.getAllTickets());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({ success: true, message: 'Paciente eliminado exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteContacts(req: Request, res: Response): Promise<void> {
    try {
      const ids = (req.body?.ids as string[]) || (req.query?.ids ? String(req.query.ids).split(',') : []);
      const result = await store.deleteContacts(ids);
      socketService.emitContactsUpdated(store.getAllContacts());
      socketService.emitConversationsCleared();
      socketService.emitAppointmentsUpdated(store.getAllAppointments());
      socketService.emitQuotesUpdated(store.getAllQuotes());
      socketService.emitTicketsUpdated(store.getAllTickets());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({
        success: true,
        deletedCount: result.deletedCount,
        message: `${result.deletedCount} paciente(s) eliminado(s) exitosamente`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteAppointment(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deleted = store.deleteAppointment(id);
      if (!deleted) {
        res.status(404).json({ error: 'Cita no encontrada' });
        return;
      }
      socketService.emitAppointmentsUpdated(store.getAllAppointments());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({ success: true, message: 'Cita eliminada exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async clearAppointments(req: Request, res: Response): Promise<void> {
    try {
      const scope = (req.query.scope as 'ALL' | 'CANCELLED') || (req.body?.scope as 'ALL' | 'CANCELLED') || 'CANCELLED';
      const result = store.clearAppointments(scope);
      socketService.emitAppointmentsUpdated(store.getAllAppointments());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({
        success: true,
        ...result,
        message: `Citas eliminadas exitosamente (${result.deletedCount} registros)`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getQuotes(req: Request, res: Response): Promise<void> {
    try {
      const quotes = store.getAllQuotes();
      res.json(quotes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteQuote(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deleted = store.deleteQuote(id);
      if (!deleted) {
        res.status(404).json({ error: 'Cotización no encontrada' });
        return;
      }
      socketService.emitQuotesUpdated(store.getAllQuotes());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({ success: true, message: 'Cotización eliminada exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async clearQuotes(req: Request, res: Response): Promise<void> {
    try {
      const result = store.clearQuotes();
      socketService.emitQuotesUpdated(store.getAllQuotes());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({
        success: true,
        ...result,
        message: `Cotizaciones eliminadas exitosamente (${result.deletedCount} registros)`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getTickets(req: Request, res: Response): Promise<void> {
    try {
      const tickets = store.getAllTickets();
      res.json(tickets);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async deleteTicket(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const deleted = store.deleteTicket(id);
      if (!deleted) {
        res.status(404).json({ error: 'Ticket no encontrado' });
        return;
      }
      socketService.emitTicketsUpdated(store.getAllTickets());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({ success: true, message: 'Ticket eliminado exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async clearTickets(req: Request, res: Response): Promise<void> {
    try {
      const scope = (req.query.scope as 'ALL' | 'RESOLVED' | 'NON_CRITICAL') || 'ALL';
      const result = store.clearTickets(scope);
      socketService.emitTicketsUpdated(store.getAllTickets());
      socketService.emitMetricsUpdated(store.getMetrics());
      res.json({
        success: true,
        ...result,
        message: `Tickets eliminados exitosamente (${result.deletedCount} registros)`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  public static async getSpecialties(req: Request, res: Response): Promise<void> {
    try {
      res.json(Object.values(HUN_SPECIALTIES));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
