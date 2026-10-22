import { Request, Response } from 'express';
import { PreparacionesService } from '../services/preparaciones.service';

export class PreparacionesController {
  public static async getProcedures(req: Request, res: Response) {
    try {
      const data = await PreparacionesService.searchProcedures(req.query);
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando procedimientos y preparaciones:', error);
      res.status(500).json({ error: 'Error al consultar procedimientos diagnósticos', details: error.message });
    }
  }

  public static async getAreas(req: Request, res: Response) {
    try {
      const data = await PreparacionesService.getAreas();
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando áreas de imágenes:', error);
      res.status(500).json({ error: 'Error al consultar áreas de imágenes', details: error.message });
    }
  }

  public static async getByPackageId(req: Request, res: Response) {
    try {
      const packageId = String(req.params.packageId);
      const data = await PreparacionesService.getByPackageId(packageId);
      if (!data) {
        return res.status(404).json({ error: 'Procedimiento no encontrado' });
      }
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando detalle de procedimiento:', error);
      res.status(500).json({ error: 'Error al consultar detalle del procedimiento', details: error.message });
    }
  }

  public static async getLaboratories(req: Request, res: Response) {
    try {
      const data = await PreparacionesService.getLaboratories();
      res.json(data);
    } catch (error: any) {
      console.error('Error consultando catálogo de laboratorios:', error);
      res.status(500).json({ error: 'Error al consultar catálogo de laboratorios', details: error.message });
    }
  }

  public static async getPatientInstruction(req: Request, res: Response) {
    try {
      const packageId = String(req.params.packageId);
      const procedure = await PreparacionesService.getByPackageId(packageId);
      if (!procedure) {
        return res.status(404).json({ error: 'Procedimiento no encontrado' });
      }
      const instruction = await PreparacionesService.formatPatientInstructions(procedure);
      res.json({ procedure, instruction });
    } catch (error: any) {
      console.error('Error generando instrucción para paciente:', error);
      res.status(500).json({ error: 'Error al generar instrucción para paciente', details: error.message });
    }
  }
}
