import axios, { AxiosInstance } from 'axios';
import { CONFIG } from '../config';
import { HunIntegracionService } from './hunIntegracion.service';

export interface HunEspecialidadItem {
  codigo: string;
  descripcion: string;
}

export interface HunCitaDocumentoItem {
  Cita_Fecha: string;
  Cod_Eps: string;
  Cod_Pro: string;
  Doc_Paciente: string;
  EPS: string;
  ESTADO: string;
  Especialidad: string;
  Hora_Cita: string;
  Medico: string;
  Nombre_Paciente: string;
  Numero_Cita: string | number;
  Procedimiento: string;
  Tip_Doc_Paciente: string;
}

export interface HunCupsItem {
  codigo: string;
  descripcion: string;
}

export interface HunAgendaSlotItem {
  autogestionable?: string;
  codigo_especialidad: string | number;
  codigo_medico: string;
  cups: HunCupsItem[] | string;
  descripcion_cups?: string;
  documento_medico?: string;
  estado?: string;
  fecha_atencion: string; // YYYY-MM-DD
  hora_final: string; // HH:MM:SS
  hora_inicial: string; // HH:MM:SS
  id_agenda_detalle?: number;
  idAgendaDetalle?: number;
  nombre_especialidad: string;
  nombre_medico: string;
  numero_consultorio: string | number;
  tiempo_intervalo?: string | number;
}


/**
 * Normaliza cualquier tipo de documento al formato oficial corto de Hosvital (CC, TI, CE, PA, RC, PPT, PEP)
 */
export function normalizeHosvitalDocType(docType?: string | null): string {
  if (!docType) return 'CC';
  const clean = docType.trim().toUpperCase();
  if (['CC', 'TI', 'CE', 'PA', 'RC', 'PEP', 'PPT', 'NUIP'].includes(clean)) {
    return clean;
  }
  if (clean.includes('EXTRANJ') || clean.includes('CE')) return 'CE';
  if (clean.includes('TARJETA') || clean.includes('TI')) return 'TI';
  if (clean.includes('PASAPORTE') || clean.includes('PA')) return 'PA';
  if (clean.includes('CIVIL') || clean.includes('RC')) return 'RC';
  if (clean.includes('TEMPORAL') || clean.includes('PPT')) return 'PPT';
  if (clean.includes('ESPECIAL') || clean.includes('PEP')) return 'PEP';
  if (clean.includes('NUIP')) return 'NUIP';
  return 'CC';
}

export interface HunAsignarCitaPayload {
  paciente: {
    tipo: string;
    documento: string;
  };
  medico: {
    codigo_medico: string;
    especialidad: number | string;
  };
  agenda_detalle_id: number;
  consultorio: number | string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  procedimiento: string; // CUPS
  tiempo_atencion: number;
  eps: string; // e.g. "HUN25"
}

export interface HunAsignarCitaResponse {
  success: boolean;
  http_status?: number;
  message?: string;
  data?: {
    CodigoEspecialidad?: number;
    CodigoMedico?: string;
    FechaCita?: string;
    HoraInicial?: string;
    Id?: number;
    Mensaje?: string;
  };
  soap?: {
    codigo?: string;
    descripcion?: string;
    http_status?: number;
    ok?: boolean;
    raw?: string;
  };
  numeroCitaHosvital?: number;
}

export interface HunCancelarCitaPayload {
  cita: number;
  tipo_documento: string;
  documento: string;
}

export interface HunTarifaEndpointItem {
  id?: string;
  cups: string;
  description: string;
  category: string;
  categoryLabel: string;
  particularFee: number;
  hun2024Fee?: number | null;
  egresadosFee?: number | null;
}

export interface HunPreparacionEndpointItem {
  id?: string;
  packageId: string;
  name: string;
  area: string;
  mainCups?: string;
  mainCupsName?: string;
  cupsList?: string[];
  labCups?: string[];
  durationMinutes?: string;
  fasting?: string;
  stopAnticoagulants?: string;
  requiredLabs?: string;
  venousAccess?: string;
  requiresSedation?: string;
  patientPreparation?: string;
  observations?: string;
  codes?: any[];
  supplies?: any[];
}

export class HunApiService {
  private static clientInstance: AxiosInstance | null = null;
  private static especialidadesCache: HunEspecialidadItem[] | null = null;
  private static lastCacheTime: number = 0;
  private static agendaCache = new Map<string, { timestamp: number; items: HunAgendaSlotItem[] }>();
  private static pendingAgendaQueries = new Map<string, Promise<HunAgendaSlotItem[]>>();
  private static tarifasCache: { timestamp: number; items: HunTarifaEndpointItem[] } | null = null;
  private static preparacionesCache: { timestamp: number; items: HunPreparacionEndpointItem[] } | null = null;
  private static readonly CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutos de caché

  /**
   * Obtiene la instancia configurada de Axios con timeout y API Key
   */
  private static getClient(): AxiosInstance {
    if (!this.clientInstance) {
      this.clientInstance = axios.create({
        baseURL: CONFIG.HUN_API_URL,
        headers: {
          'x-api-key': CONFIG.HUN_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: CONFIG.HUN_API_TIMEOUT_MS,
      });
    }
    return this.clientInstance;
  }

  public static getCachedSlotArrays(): HunAgendaSlotItem[][] {
    const result: HunAgendaSlotItem[][] = [];
    for (const entry of this.agendaCache.values()) {
      if (entry.items && entry.items.length > 0) {
        result.push(entry.items);
      }
    }
    return result;
  }

  public static clearCache() {
    this.especialidadesCache = null;
    this.lastCacheTime = 0;
    this.agendaCache.clear();
    this.tarifasCache = null;
    this.preparacionesCache = null;
  }

  /**
   * 1. Consulta catálogo oficial de Especialidades disponibles en Hosvital
   */
  public static async getEspecialidades(forceRefresh = false): Promise<HunEspecialidadItem[]> {
    if (!CONFIG.HOSVITAL_ENABLED) {
      console.log('ℹ️ [HunApi] Hosvital deshabilitado en configuración. Omitiendo consulta.');
      return [];
    }

    const now = Date.now();
    if (!forceRefresh && this.especialidadesCache && now - this.lastCacheTime < this.CACHE_TTL_MS) {
      return this.especialidadesCache;
    }

    try {
      console.log(`📡 [HunApi] Consultando especialidades en ${CONFIG.HUN_API_URL}${CONFIG.HUN_ENDPOINT_ESPECIALIDADES}...`);
      const response = await this.getClient().get(CONFIG.HUN_ENDPOINT_ESPECIALIDADES);
      const data = response.data;

      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : [];
      if (list.length > 0) {
        this.especialidadesCache = list;
        this.lastCacheTime = now;
        console.log(`✅ [HunApi] ${this.especialidadesCache?.length} especialidades obtenidas del endpoint`);
        return this.especialidadesCache!;
      }
      return [];
    } catch (error: any) {
      console.warn(`⚠️ [HunApi] No se pudieron obtener especialidades del endpoint: ${error.message}`);
      return this.especialidadesCache || [];
    }
  }

  /**
   * 2. Consulta citas e historial de un paciente por Tipo y Número de Documento
   */
  public static async consultarCitasPaciente(
    tipoDoc: string,
    numDoc: string
  ): Promise<HunCitaDocumentoItem[]> {
    if (!CONFIG.HOSVITAL_ENABLED) return [];

    try {
      const cleanTipo = normalizeHosvitalDocType(tipoDoc);
      const cleanDoc = numDoc.replace(/\D/g, '');
      console.log(`📡 [HunApi] Consultando historial paciente ${cleanTipo} ${cleanDoc}...`);

      const response = await this.getClient().get(
        CONFIG.HUN_ENDPOINT_CITAS_DOC,
        {
          params: {
            tipo: cleanTipo,
            documento: cleanDoc,
          },
        }
      );

      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
      if (data && Array.isArray(data.data)) return data.data;
      return [];
    } catch (error: any) {
      console.warn(`⚠️ [HunApi] Error consultando citas de paciente ${numDoc}: ${error.message}`);
      return [];
    }
  }

  /**
   * 3. Consulta información de una cita específica por su ID
   */
  public static async consultarCitaPorNumero(numeroCita: number | string): Promise<HunCitaDocumentoItem | null> {
    if (!CONFIG.HOSVITAL_ENABLED) return null;

    try {
      const response = await this.getClient().get(
        CONFIG.HUN_ENDPOINT_CITA_NUM,
        {
          params: { numero_cita: numeroCita },
        }
      );

      const data = response.data;
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        return data.results[0];
      }
      if (data && Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0];
      }
      return null;
    } catch (error: any) {
      console.warn(`⚠️ [HunApi] Error consultando cita #${numeroCita}: ${error.message}`);
      return null;
    }
  }

  /**
   * 4. Consulta agenda disponible para una especialidad médica
   */
  public static async consultarAgendaEspecialidad(
    codEspecialidad: number | string,
    fechaFinal?: string,
    forceRefresh = false
  ): Promise<HunAgendaSlotItem[]> {
    if (!CONFIG.HOSVITAL_ENABLED) return [];

    try {
      let targetFechaFinal = fechaFinal;
      if (!targetFechaFinal) {
        const future = new Date();
        future.setDate(future.getDate() + 60);
        targetFechaFinal = future.toISOString().split('T')[0];
      }

      const cacheKey = `${codEspecialidad}:${targetFechaFinal}`;
      const cached = this.agendaCache.get(cacheKey);
      if (!forceRefresh && cached && Date.now() - cached.timestamp < 1000 * 60 * 5) {
        return cached.items;
      }

      // Si ya hay una consulta en curso para esta especialidad, reutilizar la misma promesa
      if (this.pendingAgendaQueries.has(cacheKey)) {
        return this.pendingAgendaQueries.get(cacheKey)!;
      }

      const fetchPromise = (async (): Promise<HunAgendaSlotItem[]> => {
        try {
          console.log(`📡 [HunApi] Consultando agenda en endpoint para especialidad #${codEspecialidad} hasta ${targetFechaFinal}...`);
          const response = await this.getClient().get(CONFIG.HUN_ENDPOINT_AGENDA, {
            params: {
              cod_especialidad: codEspecialidad,
              fecha_final: targetFechaFinal,
            },
          });

          const data = response.data;
          let items: HunAgendaSlotItem[] = [];
          if (Array.isArray(data)) {
            items = data;
          } else if (data && Array.isArray(data.results)) {
            items = data.results;
          } else if (data && Array.isArray(data.data)) {
            items = data.data;
          } else if (data && typeof data === 'object' && data.codigo_especialidad) {
            items = [data as HunAgendaSlotItem];
          }

          // Evaluar cupos con la API de Parametrización del HUN para filtrar bloqueos y validar cobertura particular
          if (items.length > 0 && CONFIG.HUN_INTEGRACION_ENABLED) {
            items = await HunIntegracionService.evaluarCupos(items, { cobertura: 'particular' });
          }

          this.agendaCache.set(cacheKey, { timestamp: Date.now(), items });
          return items;
        } finally {
          this.pendingAgendaQueries.delete(cacheKey);
        }
      })();

      this.pendingAgendaQueries.set(cacheKey, fetchPromise);
      return await fetchPromise;
    } catch (error: any) {
      console.warn(`⚠️ [HunApi] Error consultando agenda para especialidad #${codEspecialidad}: ${error.message}`);
      return [];
    }
  }

  /**
   * 5. Asigna / Confirma una cita médica en Hosvital
   */
  public static async asignarCita(payload: HunAsignarCitaPayload): Promise<HunAsignarCitaResponse> {
    if (!CONFIG.HOSVITAL_ENABLED) {
      console.warn('[HunApi] API de agendamiento deshabilitada; no se confirma la cita.');
      return {
        success: false,
        message: 'La API de agendamiento está deshabilitada. No se ha asignado una cita en Hosvital.',
      };
    }

    // Normalizar tipo y documento para Hosvital
    const cleanTipo = normalizeHosvitalDocType(payload.paciente?.tipo);
    const cleanDoc = String(payload.paciente?.documento || '').replace(/\D/g, '');
    const cleanPayload: any = {
      ...payload,
      paciente: {
        ...payload.paciente,
        tipo: cleanTipo,
        documento: cleanDoc,
        nombre: (payload.paciente as any)?.nombre,
        primer_nombre: (payload.paciente as any)?.primer_nombre,
        primer_apellido: (payload.paciente as any)?.primer_apellido,
        telefono: (payload.paciente as any)?.telefono || (payload.paciente as any)?.celular,
        celular: (payload.paciente as any)?.celular || (payload.paciente as any)?.telefono,
        correo: (payload.paciente as any)?.correo || (payload.paciente as any)?.email,
        email: (payload.paciente as any)?.email || (payload.paciente as any)?.correo,
        fecha_nacimiento: (payload.paciente as any)?.fecha_nacimiento,
        direccion: (payload.paciente as any)?.direccion,
        ciudad: (payload.paciente as any)?.ciudad,
      },
      usuario: CONFIG.HOSVITAL_MAEDIR_USER || 'agendamiento',
      clave: CONFIG.HOSVITAL_MAEDIR_PASSWORD || '4g3ndHU**N',
      contrasena: CONFIG.HOSVITAL_MAEDIR_PASSWORD || '4g3ndHU**N',
    };

    // Asignación exclusivamente mediante la API REST de agendamiento.
    console.log(`\n======================================================`);
    console.log(`📡 [HunApi] PUBLICANDO ASIGNACIÓN DE CITA EN HOSVITAL`);
    console.log(`📍 Endpoint: ${CONFIG.HUN_API_URL}${CONFIG.HUN_ENDPOINT_ASIGNAR_CITA}`);
    // No registrar el payload: contiene datos del paciente y credenciales.
    console.log(`======================================================`);

    try {
      const response = await this.getClient().post(
        CONFIG.HUN_ENDPOINT_ASIGNAR_CITA,
        cleanPayload
      );

      // Invalidar caché de agenda de esa especialidad tras asignar cita
      this.agendaCache.clear();

      const resData = response.data || {};
      console.log(`📥 [HunApi] Respuesta HTTP ${response.status} de Hosvital:`);
      console.dir(resData, { depth: null });

      let numeroCita: number | undefined;

      const hasError = resData.success === false || resData?.soap?.ok === false || Boolean(resData?.error) || (resData?.soap && String(resData?.soap?.codigo) !== '0');
      const isSuccess = !hasError && (resData.success === true || (resData?.soap?.ok === true && String(resData?.soap?.codigo) === '0'));

      if (isSuccess && !hasError) {
        // 1. Extraer consecutivo de soap.descripcion (ej: "Se ha asignado la cita 123456 con éxito")
        if (resData?.soap?.descripcion) {
          const match = resData.soap.descripcion.match(/cita\s*(?:#|no\.?|num\.?|consecutivo)?\s*(\d+)/i);
          if (match && match[1]) {
            numeroCita = parseInt(match[1], 10);
          }
        }

        // 2. Extraer de todos los campos directos posibles (PascalCase, camelCase y snake_case)
        if (!numeroCita) {
          const candidate =
            resData?.numero_cita ??
            resData?.numeroCita ??
            resData?.NumeroCita ??
            resData?.Numero_Cita ??
            resData?.Numero_cita ??
            resData?.id_cita ??
            resData?.idCita ??
            resData?.IdCita ??
            resData?.cita ??
            resData?.Cita ??
            resData?.CITNUM ??
            resData?.citnum ??
            resData?.consecutivo ??
            resData?.Consecutivo ??
            resData?.data?.NumeroCita ??
            resData?.data?.numero_cita ??
            resData?.data?.numeroCita ??
            resData?.data?.cita ??
            resData?.data?.consecutivo;
          if ((typeof candidate === 'string' || typeof candidate === 'number') && /^\d+$/.test(String(candidate)) && Number.isSafeInteger(Number(candidate)) && Number(candidate) > 0) {
            numeroCita = parseInt(String(candidate), 10);
          }
        }
      }

      if (numeroCita) {
        console.log(`🎉 [HunApi] ¡CITA ASENTADA EN HOSVITAL! Consecutivo Oficial: #${numeroCita}`);
      } else if (hasError) {
        console.error(`❌ [HunApi] HOSVITAL RECHAZÓ LA CITA:`, resData?.soap?.descripcion || resData?.message || 'Rechazo sin descripción');
      } else {
        console.warn(`⚠️ [HunApi] Endpoint respondió HTTP 200 pero no entregó número de cita explícito:`, resData);
      }

      const returnedMessage = resData?.soap?.descripcion || resData?.message || (hasError ? 'Error al asignar cita en Hosvital' : 'Proceso Exitoso');

      return {
        success: isSuccess && !hasError && Boolean(numeroCita),
        http_status: response.status,
        message: returnedMessage,
        data: resData.data,
        soap: resData.soap,
        numeroCitaHosvital: hasError ? undefined : numeroCita,
      };
    } catch (error: any) {
      console.error(`\n❌ [HunApi] ERROR EN ENDPOINT ASIGNAR CITA HOSVITAL:`);
      console.error(`Status HTTP:`, error.response?.status);
      console.error(`Cuerpo Respuesta:`, error.response?.data);
      console.error(`Mensaje Error:`, error.message);
      console.error(`======================================================\n`);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
        soap: error.response?.data?.soap,
      };
    }
  }

  /**
   * 6. Cancela una cita médica en Hosvital
   */
  public static async cancelarCita(payload: HunCancelarCitaPayload): Promise<{ success: boolean; message: string }> {
    if (!CONFIG.HOSVITAL_ENABLED) {
      return { success: false, message: 'La API de agendamiento está deshabilitada. No se ha cancelado la cita en Hosvital.' };
    }

    const cleanTipo = normalizeHosvitalDocType(payload.tipo_documento);
    const cleanDoc = String(payload.documento || '').replace(/\D/g, '');
    const cleanPayload = {
      ...payload,
      tipo_documento: cleanTipo,
      documento: cleanDoc,
    };

    try {
      console.log(`\n======================================================`);
      console.log(`📡 [HunApi] CANCELANDO CITA #${payload.cita} EN HOSVITAL`);
      console.log(`📍 Endpoint: ${CONFIG.HUN_API_URL}${CONFIG.HUN_ENDPOINT_CANCELAR_CITA}`);
      // No registrar el payload: contiene datos del paciente y credenciales.
      console.log(`======================================================`);

      const response = await this.getClient().post(
        CONFIG.HUN_ENDPOINT_CANCELAR_CITA,
        cleanPayload
      );

      this.agendaCache.clear();
      console.log(`📥 [HunApi] Respuesta HTTP ${response.status} de cancelación:`, response.data);
      return {
        success: response.data?.success !== false,
        message: response.data?.mensaje || response.data?.message || 'Cancelación procesada en Hosvital',
      };
    } catch (error: any) {
      console.error(`❌ [HunApi] Error cancelando cita #${payload.cita}:`, error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * 7. Verifica el estado de cancelación de una cita
   */
  public static async verificarCancelacion(numeroCita: number | string): Promise<any> {
    if (!CONFIG.HOSVITAL_ENABLED) return null;

    try {
      const response = await this.getClient().get(
        `${CONFIG.HUN_ENDPOINT_VERIFICAR_CANCELACION}/${numeroCita}`
      );
      return response.data;
    } catch (error: any) {
      console.warn(`⚠️ [HunApi] Error verificando cancelación #${numeroCita}: ${error.message}`);
      return null;
    }
  }

  /**
   * 8. Consulta catálogo de Tarifas CUPS desde Endpoint HUN
   */
  public static async getTarifas(params?: { query?: string; category?: string; cups?: string }, forceRefresh = false): Promise<HunTarifaEndpointItem[]> {
    if (!CONFIG.HOSVITAL_ENABLED) return [];

    try {
      if (!forceRefresh && !params?.query && !params?.cups && this.tarifasCache && Date.now() - this.tarifasCache.timestamp < this.CACHE_TTL_MS) {
        const items = this.tarifasCache.items;
        if (params?.category && params.category !== 'ALL') {
          return items.filter((i) => i.category === params.category);
        }
        return items;
      }

      const response = await this.getClient().get(CONFIG.HUN_ENDPOINT_TARIFAS, { params });
      const data = response.data;
      const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.items) ? data.items : [];

      const mapped: HunTarifaEndpointItem[] = list.map((item, idx) => ({
        id: String(item.id || item.cups || item.codigo || `tar-${idx}`),
        cups: String(item.cups || item.codigo || item.cod_cups || '').trim(),
        description: String(item.description || item.descripcion || item.nombre || '').trim(),
        category: String(item.category || item.categoria || 'CONSULTAS').trim().toUpperCase(),
        categoryLabel: String(item.categoryLabel || item.nombre_categoria || item.categoria || 'Consultas y Procedimientos').trim(),
        particularFee: Number(item.particularFee ?? item.tarifa_particular ?? item.valor ?? 0),
        hun2024Fee: item.hun2024Fee ?? item.tarifa_colaborador ?? null,
        egresadosFee: item.egresadosFee ?? item.tarifa_egresado ?? null,
      })).filter((i) => i.cups || i.description);

      if (!params?.query && !params?.cups && mapped.length > 0) {
        this.tarifasCache = { timestamp: Date.now(), items: mapped };
      }
      return mapped;
    } catch (error: any) {
      return this.tarifasCache?.items || [];
    }
  }

  /**
   * 9. Consulta catálogo de Preparaciones e Indicaciones desde Endpoint HUN
   */
  public static async getPreparaciones(params?: { query?: string; area?: string; packageId?: string }, forceRefresh = false): Promise<HunPreparacionEndpointItem[]> {
    if (!CONFIG.HOSVITAL_ENABLED) return [];

    try {
      if (!forceRefresh && !params?.query && !params?.packageId && this.preparacionesCache && Date.now() - this.preparacionesCache.timestamp < this.CACHE_TTL_MS) {
        const items = this.preparacionesCache.items;
        if (params?.area && params.area !== 'ALL') {
          return items.filter((i) => i.area.toLowerCase() === params.area!.toLowerCase());
        }
        return items;
      }

      const response = await this.getClient().get(CONFIG.HUN_ENDPOINT_PREPARACIONES, { params });
      const data = response.data;
      const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : Array.isArray(data?.items) ? data.items : [];

      const mapped: HunPreparacionEndpointItem[] = list.map((item, idx) => ({
        id: String(item.id || item.packageId || item.codigo || `prep-${idx}`),
        packageId: String(item.packageId || item.codigo_paquete || item.codigo || `PREP-${idx + 1}`),
        name: String(item.name || item.nombre || item.descripcion || '').trim(),
        area: String(item.area || item.servicio || 'IMAGENOLOGIA').trim(),
        mainCups: String(item.mainCups || item.cups || item.codigo_cups || '').trim(),
        mainCupsName: String(item.mainCupsName || item.nombre_cups || item.name || '').trim(),
        cupsList: Array.isArray(item.cupsList) ? item.cupsList : item.cups ? [String(item.cups)] : [],
        labCups: Array.isArray(item.labCups) ? item.labCups : [],
        durationMinutes: String(item.durationMinutes || item.tiempo_estimado || '30'),
        fasting: String(item.fasting || item.ayuno || 'No especificado'),
        stopAnticoagulants: String(item.stopAnticoagulants || item.suspender_anticoagulantes || 'No'),
        requiredLabs: String(item.requiredLabs || item.laboratorios_requeridos || '—'),
        venousAccess: String(item.venousAccess || item.acceso_venoso || '—'),
        requiresSedation: String(item.requiresSedation || item.sedacion || 'No'),
        patientPreparation: String(item.patientPreparation || item.preparacion || item.indicaciones || ''),
        observations: String(item.observations || item.observaciones || '—'),
        codes: Array.isArray(item.codes) ? item.codes : [],
        supplies: Array.isArray(item.supplies) ? item.supplies : [],
      })).filter((i) => i.name);

      if (!params?.query && !params?.packageId && mapped.length > 0) {
        this.preparacionesCache = { timestamp: Date.now(), items: mapped };
      }
      return mapped;
    } catch (error: any) {
      return this.preparacionesCache?.items || [];
    }
  }
}
