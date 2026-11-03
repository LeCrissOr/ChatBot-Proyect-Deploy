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
  agenda_detalle_id?: number;
  id_agenda_detalle?: number;
  autogestionable?: string;
  codigo: string;
  descripcion: string | null;
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
  agenda_detalle_id?: number;
  nombre_especialidad: string;
  nombre_medico: string;
  numero_consultorio: string | number;
  tiempo_intervalo?: string | number;
  occupied?: boolean;
  statusLabel?: 'DISPONIBLE' | 'OCUPADO';
  patientName?: string;
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
  motivoCancelacion?: string;
  consecutivoCancelacion?: string;
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
   * 6. Cancela una cita médica en Hosvital y recupera el consecutivo de cancelación (No.Canc.)
   */
  public static async cancelarCita(
    payload: HunCancelarCitaPayload
  ): Promise<{ success: boolean; message: string; numeroCancelacion?: number; soap?: any; data?: any }> {
    if (!CONFIG.HOSVITAL_ENABLED) {
      return { success: false, message: 'La API de agendamiento está deshabilitada. No se ha cancelado la cita en Hosvital.' };
    }

    const cleanTipo = normalizeHosvitalDocType(payload.tipo_documento);
    const cleanDoc = String(payload.documento || '').replace(/\D/g, '');
    const cleanCita = Number(payload.cita);
    const cleanPayload = {
      cita: cleanCita,
      tipo_documento: cleanTipo,
      documento: cleanDoc,
    };

    console.log(`\n======================================================`);
    console.log(`📡 [HunApi] CANCELANDO CITA #${cleanCita} EN HOSVITAL`);
    console.log(`📍 Endpoint: ${CONFIG.HUN_API_URL}${CONFIG.HUN_ENDPOINT_CANCELAR_CITA}`);
    console.log(`👤 Paciente: ${cleanTipo} ${cleanDoc}`);
    console.log(`======================================================`);

    try {
      const response = await this.getClient().post(
        CONFIG.HUN_ENDPOINT_CANCELAR_CITA,
        cleanPayload
      );

      // Invalidar caché de agenda tras liberar cupo
      this.agendaCache.clear();

      const resData = response.data || {};
      console.log(`📥 [HunApi] Respuesta Cancelar Cita #${cleanCita} (HTTP ${response.status}):`);
      console.dir(resData, { depth: null });

      const hasError =
        resData.success === false ||
        resData?.soap?.ok === false ||
        Boolean(resData?.error) ||
        (resData?.soap?.codigo !== undefined && String(resData.soap.codigo) !== '0');

      const isSuccess = !hasError;

      // Extraer consecutivo de cancelación (No.Canc. en Hosvital) si viene en la respuesta
      let numeroCancelacion: number | undefined;
      const extractCancelNum = (obj: any): number | undefined => {
        if (!obj || typeof obj !== 'object') return undefined;
        const candidate =
          obj.numero_cancelacion ??
          obj.numeroCancelacion ??
          obj.Numero_Cancelacion ??
          obj.NumeroCancelacion ??
          obj.consecutivo_cancelacion ??
          obj.consecutivoCancelacion ??
          obj.consecutivo ??
          obj.Consecutivo ??
          obj.no_canc ??
          obj.No_Canc ??
          obj.noCanc ??
          obj.CitNumCan ??
          obj.citnumcan ??
          obj.id_cancelacion ??
          obj.data?.numero_cancelacion ??
          obj.data?.numeroCancelacion ??
          obj.data?.consecutivo_cancelacion ??
          obj.data?.consecutivo ??
          obj.data?.no_canc ??
          obj.data?.CitNumCan;

        if (
          (typeof candidate === 'string' || typeof candidate === 'number') &&
          /^\d+$/.test(String(candidate).trim()) &&
          Number(candidate) > 0
        ) {
          return parseInt(String(candidate).trim(), 10);
        }

        const textDesc = String(obj?.soap?.descripcion || obj?.mensaje || obj?.message || obj?.respuesta || '');
        const match = textDesc.match(/(?:cancelaci[oó]n|consecutivo|no\.?\s*canc\.?)\s*(?:#|no\.?|num\.?|es|:)?\s*(\d{2,})/i);
        if (match && match[1] && Number(match[1]) !== cleanCita) {
          return parseInt(match[1], 10);
        }
        return undefined;
      };

      numeroCancelacion = extractCancelNum(resData);

      // Si no vino en el POST, consultar verificar_cancelacion/{cita} para capturar el No.Canc. generado en Hosvital
      if (isSuccess && !numeroCancelacion) {
        const verifData = await this.verificarCancelacion(cleanCita);
        if (verifData) {
          console.log(`🔍 [HunApi] Verificación de cancelación #${cleanCita}:`, verifData);
          numeroCancelacion = extractCancelNum(verifData);
        }
      }

      if (isSuccess) {
        console.log(
          `🎉 [HunApi] ¡CITA #${cleanCita} CANCELADA EN HOSVITAL!${numeroCancelacion ? ` No.Canc: #${numeroCancelacion}` : ''}`
        );
      } else {
        console.warn(
          `⚠️ [HunApi] Hosvital reportó novedad al cancelar cita #${cleanCita}:`,
          resData?.soap?.descripcion || resData?.mensaje || resData?.message || resData
        );
      }

      return {
        success: isSuccess,
        message:
          resData?.soap?.descripcion ||
          resData?.mensaje ||
          resData?.message ||
          (isSuccess ? 'Cita cancelada con éxito en Hosvital' : 'No se pudo cancelar la cita en Hosvital'),
        numeroCancelacion,
        soap: resData?.soap,
        data: resData,
      };
    } catch (error: any) {
      console.error(`❌ [HunApi] Error cancelando cita #${cleanCita}:`, error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.mensaje || error.response?.data?.message || error.message,
        soap: error.response?.data?.soap,
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

  /**
   * Normaliza el tipo de documento para la tabla CAPBAS de Hosvital (CHAR(2): CC, TI, CE, PA, RC, PT, PE)
   */
  public static normalizeCapbasDocType(docType?: string | null): string {
    const std = normalizeHosvitalDocType(docType);
    if (std === 'PPT') return 'PT';
    if (std === 'PEP') return 'PE';
    if (std === 'NUIP') return 'RC';
    return std.slice(0, 2);
  }

  /**
   * Extrae el valor de una etiqueta XML de la respuesta SOAP de WSCrePac
   */
  private static extractSoapTag(xml: string, tag: string): string {
    const regex = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
    const match = xml.match(regex);
    if (!match) return '';
    return match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Escapa caracteres especiales para XML SOAP
   */
  private static escapeXml(val: string | number | undefined | null): string {
    return String(val ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Divide un nombre completo en Mpnom1, Mpnom2, Mpape1, Mpape2 para CAPBAS de Hosvital
   */
  public static splitFullNameForCapbas(fullName: string): {
    mpnom1: string;
    mpnom2: string;
    mpape1: string;
    mpape2: string;
  } {
    const parts = String(fullName || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .split(' ')
      .filter(Boolean);

    if (parts.length === 0) {
      return { mpnom1: 'PACIENTE', mpnom2: '', mpape1: 'HUN', mpape2: '' };
    }
    if (parts.length === 1) {
      return { mpnom1: parts[0].slice(0, 20), mpnom2: '', mpape1: parts[0].slice(0, 20), mpape2: '' };
    }
    if (parts.length === 2) {
      return { mpnom1: parts[0].slice(0, 20), mpnom2: '', mpape1: parts[1].slice(0, 20), mpape2: '' };
    }
    if (parts.length === 3) {
      return {
        mpnom1: parts[0].slice(0, 20),
        mpnom2: '',
        mpape1: parts[1].slice(0, 20),
        mpape2: parts[2].slice(0, 30),
      };
    }
    return {
      mpnom1: parts[0].slice(0, 20),
      mpnom2: parts.slice(1, parts.length - 2).join(' ').slice(0, 30),
      mpape1: parts[parts.length - 2].slice(0, 20),
      mpape2: parts[parts.length - 1].slice(0, 30),
    };
  }

  /**
   * Normaliza una fecha de nacimiento (DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD) al formato ISO YYYY-MM-DD para WSCrePac
   */
  public static normalizeBirthDateToIso(raw?: string | Date | null): string | undefined {
    if (!raw) return undefined;
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.toISOString().split('T')[0];
    }
    const clean = String(raw).trim();
    const dmy = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
      return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd && ymd[1] !== '0000') {
      return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
    }
    return undefined;
  }

  /**
   * 10. Consulta un paciente en la tabla maestra CAPBAS de Hosvital mediante WSCrePac (Gx_mode = 'DSP')
   */
  public static async consultarPacienteHosvital(
    tipoDocumento: string,
    documento: string
  ): Promise<{
    exists: boolean;
    codRespuesta: number;
    respuesta: string;
    empcod: string;
    mpnhic: string;
    mptdoc: string;
    mpcedu: string;
    mpnom1: string;
    mpnom2: string;
    mpape1: string;
    mpape2: string;
    fullName: string;
    birthDateIso?: string;
    birthDateFormatted?: string;
    gender?: 'M' | 'F';
    maritalStatus?: string;
    occupationCode?: string;
    address?: string;
    cityCode?: string;
    neighborhoodCode?: string;
    phone?: string;
    mobile?: string;
    email?: string;
    zona?: string;
    mpusrprf?: string;
  } | null> {
    if (!CONFIG.HOSVITAL_ENABLED) return null;

    const cleanTipo = this.normalizeCapbasDocType(tipoDocumento);
    const cleanDoc = String(documento || '').replace(/[^0-9a-zA-Z]/g, '').trim();
    if (!cleanDoc) return null;

    const soapUrl = `${CONFIG.HOSVITAL_SOAP_BASE_URL}${CONFIG.HOSVITAL_SOAP_CREPAC_PATH || '/awscrepac'}`;
    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hos="Hosvital8W">
  <soapenv:Header/>
  <soapenv:Body>
    <hos:WSCrePac.Execute>
      <hos:Empcod>${this.escapeXml(CONFIG.HOSVITAL_EMPRESA || '1')}</hos:Empcod>
      <hos:Mpnhic>${this.escapeXml(cleanDoc)}</hos:Mpnhic>
      <hos:Mptdoc>${this.escapeXml(cleanTipo)}</hos:Mptdoc>
      <hos:Mpcedu>${this.escapeXml(cleanDoc)}</hos:Mpcedu>
      <hos:Mpnom1></hos:Mpnom1>
      <hos:Mpnom2></hos:Mpnom2>
      <hos:Mpape1></hos:Mpape1>
      <hos:Mpape2></hos:Mpape2>
      <hos:Mpfchn>1990-01-01T00:00:00</hos:Mpfchn>
      <hos:Mpsexo>M</hos:Mpsexo>
      <hos:Mpestc>S</hos:Mpestc>
      <hos:Mocodpri></hos:Mocodpri>
      <hos:Mpdire></hos:Mpdire>
      <hos:Ciudad></hos:Ciudad>
      <hos:Barrio></hos:Barrio>
      <hos:Mptele></hos:Mptele>
      <hos:Mptele2></hos:Mptele2>
      <hos:Mpmail></hos:Mpmail>
      <hos:Zona></hos:Zona>
      <hos:Tipoafiliacion></hos:Tipoafiliacion>
      <hos:Tipopaciente></hos:Tipopaciente>
      <hos:Mpusrprf></hos:Mpusrprf>
      <hos:Gx_mode>DSP</hos:Gx_mode>
    </hos:WSCrePac.Execute>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const response = await axios.post(soapUrl, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'Hosvital8Waction/AWSCREPAC.Execute',
        },
        timeout: 8000,
      });

      const rawXml = String(response.data || '');
      const codRespuesta = parseInt(this.extractSoapTag(rawXml, 'Codrespuesta') || '0', 10);
      const respuesta = this.extractSoapTag(rawXml, 'Respuesta');
      const mpnhic = this.extractSoapTag(rawXml, 'Mpnhic');
      const mptdoc = this.extractSoapTag(rawXml, 'Mptdoc') || cleanTipo;
      const mpcedu = this.extractSoapTag(rawXml, 'Mpcedu') || cleanDoc;
      const mpnom1 = this.extractSoapTag(rawXml, 'Mpnom1');
      const mpnom2 = this.extractSoapTag(rawXml, 'Mpnom2');
      const mpape1 = this.extractSoapTag(rawXml, 'Mpape1');
      const mpape2 = this.extractSoapTag(rawXml, 'Mpape2');
      const mpfchnRaw = this.extractSoapTag(rawXml, 'Mpfchn');
      const mpsexoRaw = this.extractSoapTag(rawXml, 'Mpsexo').toUpperCase();
      const mpestc = this.extractSoapTag(rawXml, 'Mpestc');
      const mocodpri = this.extractSoapTag(rawXml, 'Mocodpri');
      const mpdire = this.extractSoapTag(rawXml, 'Mpdire');
      const ciudad = this.extractSoapTag(rawXml, 'Ciudad');
      const barrio = this.extractSoapTag(rawXml, 'Barrio');
      const mptele = this.extractSoapTag(rawXml, 'Mptele');
      const mptele2 = this.extractSoapTag(rawXml, 'Mptele2');
      const mpmail = this.extractSoapTag(rawXml, 'Mpmail');
      const zona = this.extractSoapTag(rawXml, 'Zona');
      const mpusrprf = this.extractSoapTag(rawXml, 'Mpusrprf');

      const exists = Boolean(mpnhic && (mpnom1 || mpape1));
      const fullName = [mpnom1, mpnom2, mpape1, mpape2].filter(Boolean).join(' ').trim();

      let birthDateIso: string | undefined;
      let birthDateFormatted: string | undefined;
      if (mpfchnRaw && !mpfchnRaw.startsWith('0000-00-00')) {
        const datePart = mpfchnRaw.split('T')[0];
        const m = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          birthDateIso = datePart;
          birthDateFormatted = `${m[3]}/${m[2]}/${m[1]}`;
        }
      }

      const gender: 'M' | 'F' | undefined =
        mpsexoRaw === 'M' || mpsexoRaw === 'F' ? (mpsexoRaw as 'M' | 'F') : undefined;

      if (exists) {
        console.log(
          `✅ [HunApi:WSCrePac] Paciente encontrado en CAPBAS Hosvital: ${mptdoc} ${mpcedu} -> ${fullName} (Cod: ${codRespuesta})`
        );
      }

      return {
        exists,
        codRespuesta,
        respuesta,
        empcod: this.extractSoapTag(rawXml, 'Empcod') || '1',
        mpnhic,
        mptdoc,
        mpcedu,
        mpnom1,
        mpnom2,
        mpape1,
        mpape2,
        fullName,
        birthDateIso,
        birthDateFormatted,
        gender,
        maritalStatus: mpestc || undefined,
        occupationCode: mocodpri || undefined,
        address: mpdire || undefined,
        cityCode: ciudad || undefined,
        neighborhoodCode: barrio || undefined,
        phone: mptele || undefined,
        mobile: mptele2 || undefined,
        email: mpmail || undefined,
        zona: zona || undefined,
        mpusrprf: mpusrprf || undefined,
      };
    } catch (error: any) {
      console.warn(`⚠️ [HunApi:WSCrePac] Error consultando paciente ${cleanTipo} ${cleanDoc} en Hosvital: ${error.message}`);
      return null;
    }
  }

  /**
   * 11. Crea o actualiza un paciente en la tabla maestra CAPBAS de Hosvital mediante WSCrePac (Gx_mode = 'INS')
   * Según la documentación oficial de DigitalWare Hosvital-HIS:
   * - Gx_mode = 'INS' inserta al paciente (Codrespuesta = 4) y si ya existe lo actualiza automáticamente (Codrespuesta = 5).
   */
  public static async crearOActualizarPacienteHosvital(input: {
    tipoDocumento: string;
    documento: string;
    nombreCompleto: string;
    primerNombre?: string;
    segundoNombre?: string;
    primerApellido?: string;
    segundoApellido?: string;
    fechaNacimiento?: string | Date;
    sexo?: 'M' | 'F' | string;
    estadoCivil?: string;
    direccion?: string;
    telefono?: string;
    celular?: string;
    email?: string;
    modo?: 'INS' | 'UPD';
  }): Promise<{
    success: boolean;
    codRespuesta: number;
    respuesta: string;
    action?: 'CREATED' | 'UPDATED' | 'ERROR';
  }> {
    if (!CONFIG.HOSVITAL_ENABLED) {
      return {
        success: false,
        codRespuesta: 999,
        respuesta: 'Integración Hosvital deshabilitada en configuración.',
        action: 'ERROR',
      };
    }

    const cleanTipo = this.normalizeCapbasDocType(input.tipoDocumento);
    const cleanDoc = String(input.documento || '').replace(/[^0-9a-zA-Z]/g, '').trim();
    if (!cleanDoc) {
      return {
        success: false,
        codRespuesta: 1,
        respuesta: 'Documento del paciente vacío.',
        action: 'ERROR',
      };
    }

    // 1. Consultar primero en modo DSP por si el paciente ya existe en CAPBAS, para preservar sus códigos e información base
    const existing = await this.consultarPacienteHosvital(cleanTipo, cleanDoc);

    // 2. Separar nombres y apellidos
    const split = this.splitFullNameForCapbas(input.nombreCompleto || existing?.fullName || 'PACIENTE HUN');
    const sameNameAsExisting =
      existing?.exists &&
      existing.fullName &&
      input.nombreCompleto &&
      existing.fullName.toUpperCase().replace(/\s+/g, ' ') ===
        input.nombreCompleto.trim().toUpperCase().replace(/\s+/g, ' ');

    const mpnom1 = (input.primerNombre || (sameNameAsExisting ? existing?.mpnom1 : '') || split.mpnom1 || 'PACIENTE')
      .toUpperCase()
      .slice(0, 20);
    const mpnom2 = (
      input.segundoNombre !== undefined
        ? input.segundoNombre
        : sameNameAsExisting
        ? existing?.mpnom2 || ''
        : split.mpnom2
    )
      .toUpperCase()
      .slice(0, 30);
    const mpape1 = (input.primerApellido || (sameNameAsExisting ? existing?.mpape1 : '') || split.mpape1 || mpnom1)
      .toUpperCase()
      .slice(0, 20);
    const mpape2 = (
      input.segundoApellido !== undefined
        ? input.segundoApellido
        : sameNameAsExisting
        ? existing?.mpape2 || ''
        : split.mpape2
    )
      .toUpperCase()
      .slice(0, 30);

    // 3. Fecha de nacimiento YYYY-MM-DDT00:00:00 (xsd:dateTime requerido por GeneXus)
    const mpfchnDate =
      this.normalizeBirthDateToIso(input.fechaNacimiento) ||
      existing?.birthDateIso ||
      '1990-01-01';
    const mpfchn = mpfchnDate.includes('T') ? mpfchnDate : `${mpfchnDate}T00:00:00`;

    // 4. Sexo (M o F) - obligatorio en CAPBAS
    const rawSex = String(input.sexo || existing?.gender || '').trim().toUpperCase();
    let mpsexo: 'M' | 'F';
    if (rawSex.startsWith('F') || rawSex.includes('MUJER') || rawSex.includes('FEM')) {
      mpsexo = 'F';
    } else if (rawSex.startsWith('M') || rawSex.includes('HOMBRE') || rawSex.includes('MASC')) {
      mpsexo = 'M';
    } else {
      mpsexo = mpnom1.endsWith('A') ? 'F' : 'M';
    }

    // 5. Campos complementarios parametrizados para HUN en CAPBAS
    const mpestc = (input.estadoCivil || existing?.maritalStatus || 'S').slice(0, 1).toUpperCase();
    const mocodpri = existing?.occupationCode || '9999';
    const mpdire = (input.direccion || existing?.address || 'BOGOTA D.C.').trim().toUpperCase().slice(0, 50);
    const ciudad = (existing?.cityCode || '1').trim();
    const barrio = (existing?.neighborhoodCode || '9999').trim();
    const cleanPhone = String(input.telefono || input.celular || existing?.phone || existing?.mobile || '0000000')
      .replace(/[^\d+]/g, '')
      .slice(0, 30);
    const cleanMobile = String(input.celular || input.telefono || existing?.mobile || existing?.phone || cleanPhone)
      .replace(/[^\d+]/g, '')
      .slice(0, 30);
    const mpmail = (input.email || existing?.email || 'notiene@hun.edu.co').trim().slice(0, 45);
    const zona = existing?.zona || 'U';
    const mpusrprf = existing?.mpusrprf || 'N';
    const gxMode = input.modo || 'INS';

    const soapUrl = `${CONFIG.HOSVITAL_SOAP_BASE_URL}${CONFIG.HOSVITAL_SOAP_CREPAC_PATH || '/awscrepac'}`;
    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hos="Hosvital8W">
  <soapenv:Header/>
  <soapenv:Body>
    <hos:WSCrePac.Execute>
      <hos:Empcod>${this.escapeXml(CONFIG.HOSVITAL_EMPRESA || '1')}</hos:Empcod>
      <hos:Mpnhic>${this.escapeXml(cleanDoc)}</hos:Mpnhic>
      <hos:Mptdoc>${this.escapeXml(cleanTipo)}</hos:Mptdoc>
      <hos:Mpcedu>${this.escapeXml(cleanDoc)}</hos:Mpcedu>
      <hos:Mpnom1>${this.escapeXml(mpnom1)}</hos:Mpnom1>
      <hos:Mpnom2>${this.escapeXml(mpnom2)}</hos:Mpnom2>
      <hos:Mpape1>${this.escapeXml(mpape1)}</hos:Mpape1>
      <hos:Mpape2>${this.escapeXml(mpape2)}</hos:Mpape2>
      <hos:Mpfchn>${this.escapeXml(mpfchn)}</hos:Mpfchn>
      <hos:Mpsexo>${this.escapeXml(mpsexo)}</hos:Mpsexo>
      <hos:Mpestc>${this.escapeXml(mpestc)}</hos:Mpestc>
      <hos:Mocodpri>${this.escapeXml(mocodpri)}</hos:Mocodpri>
      <hos:Mpdire>${this.escapeXml(mpdire)}</hos:Mpdire>
      <hos:Ciudad>${this.escapeXml(ciudad)}</hos:Ciudad>
      <hos:Barrio>${this.escapeXml(barrio)}</hos:Barrio>
      <hos:Mptele>${this.escapeXml(cleanPhone)}</hos:Mptele>
      <hos:Mptele2>${this.escapeXml(cleanMobile)}</hos:Mptele2>
      <hos:Mpmail>${this.escapeXml(mpmail)}</hos:Mpmail>
      <hos:Zona>${this.escapeXml(zona)}</hos:Zona>
      <hos:Tipoafiliacion></hos:Tipoafiliacion>
      <hos:Tipopaciente></hos:Tipopaciente>
      <hos:Mpusrprf>${this.escapeXml(mpusrprf)}</hos:Mpusrprf>
      <hos:Gx_mode>${this.escapeXml(gxMode)}</hos:Gx_mode>
    </hos:WSCrePac.Execute>
  </soapenv:Body>
</soapenv:Envelope>`;

    console.log(`\n======================================================`);
    console.log(`📡 [HunApi:WSCrePac] SINCRONIZANDO PACIENTE EN CAPBAS HOSVITAL (${gxMode})`);
    console.log(`📍 Endpoint SOAP: ${soapUrl}`);
    console.log(`👤 Paciente: ${cleanTipo} ${cleanDoc} - ${mpnom1} ${mpnom2} ${mpape1} ${mpape2} (${mpsexo}, Nac: ${mpfchnDate})`);
    console.log(`======================================================`);

    try {
      const response = await axios.post(soapUrl, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'Hosvital8Waction/AWSCREPAC.Execute',
        },
        timeout: 10000,
      });

      const rawXml = String(response.data || '');
      const codRespuesta = parseInt(this.extractSoapTag(rawXml, 'Codrespuesta') || '0', 10);
      const respuesta = this.extractSoapTag(rawXml, 'Respuesta');

      const isSuccess = codRespuesta === 4 || codRespuesta === 5;
      const action: 'CREATED' | 'UPDATED' | 'ERROR' =
        codRespuesta === 4 ? 'CREATED' : codRespuesta === 5 ? 'UPDATED' : 'ERROR';

      if (isSuccess) {
        console.log(`🎉 [HunApi:WSCrePac] Éxito en CAPBAS Hosvital (Código ${codRespuesta} - ${action}): ${respuesta}`);
      } else {
        console.warn(`⚠️ [HunApi:WSCrePac] Novedad en CAPBAS Hosvital (Código ${codRespuesta}): ${respuesta}`);
      }

      return {
        success: isSuccess,
        codRespuesta,
        respuesta,
        action,
      };
    } catch (error: any) {
      console.error(`❌ [HunApi:WSCrePac] Error HTTP sincronizando paciente ${cleanTipo} ${cleanDoc}:`, error.message);
      return {
        success: false,
        codRespuesta: 999,
        respuesta: error.message || 'Error de conexión con WSCrePac en Hosvital',
        action: 'ERROR',
      };
    }
  }
}
