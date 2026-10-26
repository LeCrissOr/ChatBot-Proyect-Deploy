import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { CONFIG } from '../config';
import { HunAgendaSlotItem } from './hunApi.service';

export interface EvaluarAgendaContexto {
  cobertura?: 'particular' | 'eps';
  cups?: string;
}

export interface EvaluarAgendaResponse {
  ok: boolean;
  evaluado_en?: string;
  contexto?: EvaluarAgendaContexto;
  total?: number;
  disponibles?: HunAgendaSlotItem[];
  cerrados?: Array<{
    cupo: any;
    tipo: string;
    motivo: string;
  }>;
}

export class HunIntegracionService {
  private static clientInstance: AxiosInstance | null = null;

  private static getClient(): AxiosInstance {
    if (!this.clientInstance) {
      const agent = new https.Agent({
        rejectUnauthorized: process.env.HUN_INTEGRACION_REJECT_UNAUTHORIZED === 'true',
      });

      this.clientInstance = axios.create({
        baseURL: CONFIG.HUN_INTEGRACION_BASE_URL,
        headers: {
          'x-api-key': CONFIG.HUN_INTEGRACION_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: CONFIG.HUN_INTEGRACION_TIMEOUT_MS,
        httpsAgent: agent,
      });
    }
    return this.clientInstance;
  }

  /**
   * Evalúa y filtra cupos de Hosvital mediante la API de Parametrización del HUN
   * Aplica reglas de franjas, bloqueos, excepciones, vigencia y cobertura (particular vs eps).
   */
  public static async evaluarCupos(
    cupos: HunAgendaSlotItem[],
    contexto: EvaluarAgendaContexto = { cobertura: 'particular' }
  ): Promise<HunAgendaSlotItem[]> {
    if (!cupos || cupos.length === 0) return [];
    if (!CONFIG.HUN_INTEGRACION_ENABLED || !CONFIG.HUN_INTEGRACION_API_KEY) {
      return cupos;
    }

    try {
      // Formatear cupos según el esquema esperado por la API del HUN (preservando todas las propiedades del HIS)
      const cuposPayload = cupos.map((s) => ({
        ...s,
        codigo_medico: String(s.codigo_medico || ''),
        fecha_atencion: String(s.fecha_atencion || '').slice(0, 10),
        hora_inicial: String(s.hora_inicial || '').slice(0, 5),
        hora_final: s.hora_final ? String(s.hora_final).slice(0, 5) : undefined,
        tiempo_intervalo: s.tiempo_intervalo ? String(s.tiempo_intervalo) : '20',
      }));

      // Máximo 5000 cupos admitidos por llamada en la API
      const batch = cuposPayload.slice(0, 5000);
      const response = await this.getClient().post<EvaluarAgendaResponse>('/agenda/evaluar', {
        cupos: batch,
        contexto,
      });

      if (response.data && response.data.ok && Array.isArray(response.data.disponibles)) {
        const disponibles = response.data.disponibles;
        const cerradosCount = (response.data.cerrados || []).length;
        console.log(
          `✅ [HunIntegracion] Agenda evaluada con éxito: ${disponibles.length} cupos disponibles para ${contexto.cobertura || 'particular'} (${cerradosCount} descartados por bloqueos/EPS/horarios).`
        );
        return disponibles;
      }

      console.warn('⚠️ [HunIntegracion] Respuesta inesperada al evaluar agenda. Se devuelven cupos sin filtrar.');
      return cupos;
    } catch (error: any) {
      console.warn(
        `⚠️ [HunIntegracion] Error evaluando agenda en ${CONFIG.HUN_INTEGRACION_BASE_URL}/agenda/evaluar (${error.message}). Fallback activo: usando cupos de Hosvital sin filtrar.`
      );
      return cupos;
    }
  }

  /**
   * Consulta la parametrización de agenda (programación, horario semanal, bloqueos, excepciones y franjas)
   */
  public static async getParametrizacion(params?: {
    codigo_medico?: string;
    desde?: string;
    hasta?: string;
  }): Promise<any> {
    if (!CONFIG.HUN_INTEGRACION_ENABLED || !CONFIG.HUN_INTEGRACION_API_KEY) {
      return null;
    }

    try {
      const response = await this.getClient().get('/agenda/parametrizacion', { params });
      return response.data;
    } catch (error: any) {
      console.warn(`⚠️ [HunIntegracion] Error consultando parametrización: ${error.message}`);
      return null;
    }
  }
}
