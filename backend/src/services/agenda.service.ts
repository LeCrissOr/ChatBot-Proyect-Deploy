import { socketService } from './socket.service';
import { store } from './store.service';
import { DynamicSlot } from '../types';
import { prisma } from './database.service';
import { HunApiService, HunAgendaSlotItem } from './hunApi.service';

const BOGOTA_TIME_ZONE = 'America/Bogota';
const DAYS_OF_WEEK_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DAYS_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function bogotaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
}

function bogotaLocalToUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, (hour || 0) + 5, minute || 0));
}

function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export interface AgendaQueryParams {
  specialty?: string;
  doctor?: string;
  office?: string;
  dayOfWeek?: string;
  scheduleType?: string;
  date?: string; // YYYY-MM-DD
  search?: string;
  page?: number;
  limit?: number;
}

export interface CalendarQueryParams {
  month?: number; // 1 - 12
  year?: number;  // 2026
  specialty?: string;
  doctor?: string;
  search?: string;
}

export class AgendaService {
  /**
   * Convierte cupos del endpoint de Hosvital en registros de agenda estructurados para el Dashboard
   */
  private static async fetchHosvitalSchedules(specialtyFilter?: string, forceRefresh = false) {
    const specs = await HunApiService.getEspecialidades(forceRefresh);
    if (!specs.length) return [];

    let targetSpecs = specs;
    if (specialtyFilter && specialtyFilter.trim()) {
      const normFilter = normalizeText(specialtyFilter);
      const matched = specs.filter((s) => {
        const normDesc = normalizeText(s.descripcion);
        return normDesc.includes(normFilter) || normFilter.includes(normDesc) || String(s.codigo) === specialtyFilter.trim();
      });
      if (matched.length > 0) targetSpecs = matched;
    } else {
      // Consultar las principales especialidades activas para poblar la vista general sin saturar el endpoint
      targetSpecs = specs.slice(0, 12);
    }

    const slotArrays = await Promise.all(
      targetSpecs.map((sp) => HunApiService.consultarAgendaEspecialidad(sp.codigo, undefined, forceRefresh).catch(() => [] as HunAgendaSlotItem[]))
    );

    const grouped = new Map<string, {
      id: string;
      specialtyCode: string;
      specialtyName: string;
      doctorCode: string;
      doctorName: string;
      officeCode: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      frequencyMinutes: number;
      modality: string;
      scheduleType: string;
      activity: string;
      activeDates: Set<string>;
      rawSlots: HunAgendaSlotItem[];
    }>();

    for (const slots of slotArrays) {
      for (const s of slots) {
        if (!s.fecha_atencion) continue;
        const dateObj = new Date(`${s.fecha_atencion}T12:00:00Z`);
        const dayOfWeek = DAYS_OF_WEEK_ES[dateObj.getUTCDay()] || 'LUNES';
        const docCode = String(s.codigo_medico || 'MED').trim();
        const docName = (s.nombre_medico || 'Especialista HUN').trim();
        const specCode = String(s.codigo_especialidad || 'ESP').trim();
        const specName = (s.nombre_especialidad || 'Consulta Externa').trim();
        const office = String(s.numero_consultorio || '200').trim();
        const start = (s.hora_inicial || '08:00:00').substring(0, 5);
        const end = (s.hora_final || '12:00:00').substring(0, 5);
        const freq = Number(s.tiempo_intervalo) || 20;

        const key = `${specCode}-${docCode}-${office}-${dayOfWeek}`;
        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, {
            id: `hosv-${key}`,
            specialtyCode: specCode,
            specialtyName: specName,
            doctorCode: docCode,
            doctorName: docName,
            officeCode: office,
            dayOfWeek,
            startTime: start,
            endTime: end,
            frequencyMinutes: freq,
            modality: 'PRESENCIAL',
            scheduleType: 'REGULAR',
            activity: s.descripcion_cups || 'CONSULTA EXTERNA HOSVITAL',
            activeDates: new Set([s.fecha_atencion]),
            rawSlots: [s],
          });
        } else {
          existing.activeDates.add(s.fecha_atencion);
          if (start < existing.startTime) existing.startTime = start;
          if (end > existing.endTime) existing.endTime = end;
          existing.rawSlots.push(s);
        }
      }
    }

    return Array.from(grouped.values()).map((g) => ({
      ...g,
      activeDates: Array.from(g.activeDates).sort(),
    }));
  }

  /**
   * Sincroniza en caliente los datos de agenda desde el Endpoint de Hosvital
   */
  public static async syncFromEndpoint() {
    HunApiService.clearCache();
    const schedules = await this.fetchHosvitalSchedules(undefined, true);
    const specs = await HunApiService.getEspecialidades(false);

    const stats = {
      totalSchedules: schedules.length,
      regularCount: schedules.length,
      adicionalCount: 0,
      totalAbsences: 0,
      totalDoctors: new Set(schedules.map((s) => s.doctorName)).size,
      totalSpecialties: specs.length,
    };

    socketService.emitAgendaUpdated({
      timestamp: new Date().toISOString(),
      stats,
    });

    return {
      success: true,
      stats,
    };
  }

  /**
   * Obtiene la lista paginada y filtrada de turnos de agenda médica desde el Endpoint
   */
  public static async getAgendaList(params: AgendaQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    let schedules = await this.fetchHosvitalSchedules(params.specialty);

    if (params.doctor) {
      const normDoc = normalizeText(params.doctor);
      schedules = schedules.filter((s) => normalizeText(s.doctorName).includes(normDoc));
    }
    if (params.office) {
      const normOff = normalizeText(params.office);
      schedules = schedules.filter((s) => normalizeText(s.officeCode).includes(normOff));
    }
    if (params.dayOfWeek) {
      schedules = schedules.filter((s) => s.dayOfWeek === params.dayOfWeek!.toUpperCase());
    }
    if (params.date) {
      schedules = schedules.filter((s) => s.activeDates.includes(params.date!));
    }
    if (params.search) {
      const normSearch = normalizeText(params.search);
      schedules = schedules.filter(
        (s) =>
          normalizeText(s.specialtyName).includes(normSearch) ||
          normalizeText(s.doctorName).includes(normSearch) ||
          normalizeText(s.officeCode).includes(normSearch)
      );
    }

    const total = schedules.length;
    const items = schedules.slice(skip, skip + limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Obtiene eventos para el calendario en un mes específico desde el Endpoint + Citas confirmadas
   */
  public static async getCalendarEvents(params: CalendarQueryParams) {
    const todayBogota = bogotaDateParts(new Date());
    const month = Number(params.month) || Number(todayBogota.month);
    const year = Number(params.year) || Number(todayBogota.year);
    const monthStr = String(month).padStart(2, '0');
    const monthPrefix = `${year}-${monthStr}`;

    let schedules = await this.fetchHosvitalSchedules(params.specialty);

    if (params.doctor) {
      const normDoc = normalizeText(params.doctor);
      schedules = schedules.filter((s) => normalizeText(s.doctorName).includes(normDoc));
    }
    if (params.search) {
      const normSearch = normalizeText(params.search);
      schedules = schedules.filter(
        (s) =>
          normalizeText(s.specialtyName).includes(normSearch) ||
          normalizeText(s.doctorName).includes(normSearch) ||
          normalizeText(s.officeCode).includes(normSearch)
      );
    }

    const daysMap: Record<string, { events: any[]; absences: any[]; appointments: any[] }> = {};

    schedules.forEach((sch) => {
      sch.activeDates.forEach((date) => {
        if (date.startsWith(monthPrefix)) {
          if (!daysMap[date]) daysMap[date] = { events: [], absences: [], appointments: [] };
          daysMap[date].events.push({
            id: sch.id,
            specialtyName: sch.specialtyName,
            doctorName: sch.doctorName,
            officeCode: sch.officeCode,
            startTime: sch.startTime,
            endTime: sch.endTime,
            frequencyMinutes: sch.frequencyMinutes,
            scheduleType: sch.scheduleType,
            modality: sch.modality,
          });
        }
      });
    });

    const startOfMonth = bogotaLocalToUtc(`${year}-${monthStr}-01`, '00:00');
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endOfMonth = new Date(bogotaLocalToUtc(nextMonth, '00:00').getTime() - 1);

    let dbConfirmedApts: any[] = [];
    try {
      dbConfirmedApts = await prisma.appointment.findMany({
        where: {
          dateTime: { gte: startOfMonth, lte: endOfMonth },
          status: { in: ['CONFIRMED', 'HELD', 'PAID_VIRTUAL', 'PAY_AT_WINDOW', 'PENDING'] },
        },
        include: { contact: true },
        orderBy: { dateTime: 'asc' },
      });
    } catch {}

    const memoryConfirmedApts = store.getAllAppointments().filter((a) => {
      const dt = new Date(a.dateTime);
      const isConfirmed = a.status === 'CONFIRMED' || a.status === 'HELD' || a.status === 'PENDING' || a.status === 'PAID_VIRTUAL' || a.status === 'PAY_AT_WINDOW';
      return isConfirmed && dt >= startOfMonth && dt <= endOfMonth;
    });

    const rawConfirmedApts = [
      ...dbConfirmedApts.map((a) => ({
        id: a.id,
        patientName: a.contact?.name || a.contactName || 'Paciente Particular',
        patientPhone: a.contact?.phone || a.contactPhone,
        specialty: a.specialty,
        doctorName: a.doctorName,
        dateTime: new Date(a.dateTime),
        durationMinutes: a.durationMinutes || 30,
        price: Number(a.price || 180000),
        paymentStatus: a.paymentStatus,
        status: a.status,
        isReferral: a.isReferral,
      })),
      ...memoryConfirmedApts.map((a) => ({
        id: a.id,
        patientName: a.contactName || 'Paciente Particular',
        patientPhone: a.contactPhone,
        specialty: a.specialty,
        doctorName: a.doctorName,
        dateTime: new Date(a.dateTime),
        durationMinutes: a.durationMinutes || 30,
        price: Number(a.price || 180000),
        paymentStatus: a.paymentStatus,
        status: a.status,
        isReferral: a.isReferral,
      })),
    ];

    const confirmedAptsMap = new Map<string, any>();
    rawConfirmedApts.forEach((apt) => confirmedAptsMap.set(apt.id, apt));
    let confirmedAppointmentsList = Array.from(confirmedAptsMap.values());

    if (params.doctor) {
      const cleanDocParam = AgendaService.cleanDoctorNameForMatch(params.doctor);
      confirmedAppointmentsList = confirmedAppointmentsList.filter((a) => {
        const cleanAptDoc = AgendaService.cleanDoctorNameForMatch(a.doctorName);
        return cleanAptDoc.includes(cleanDocParam) || cleanDocParam.includes(cleanAptDoc);
      });
    }

    if (params.specialty) {
      const cleanSpec = normalizeText(params.specialty);
      confirmedAppointmentsList = confirmedAppointmentsList.filter((a) =>
        normalizeText(a.specialty).includes(cleanSpec)
      );
    }

    confirmedAppointmentsList.forEach((apt) => {
      const appointmentDate = bogotaDateParts(apt.dateTime);
      const dateKey = `${appointmentDate.year}-${appointmentDate.month}-${appointmentDate.day}`;

      if (!daysMap[dateKey]) daysMap[dateKey] = { events: [], absences: [], appointments: [] };
      daysMap[dateKey].appointments.push({
        id: apt.id,
        patientName: apt.patientName,
        patientPhone: apt.patientPhone,
        specialty: apt.specialty,
        doctorName: apt.doctorName,
        timeStr: new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA_TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(apt.dateTime),
        durationMinutes: apt.durationMinutes || 30,
        isoDateTime: apt.dateTime.toISOString(),
        price: apt.price,
        paymentStatus: apt.paymentStatus,
        status: apt.status,
        isReferral: apt.isReferral,
      });
    });

    return {
      month,
      year,
      monthPrefix,
      days: daysMap,
      totalEvents: Object.values(daysMap).reduce((acc, curr) => acc + curr.events.length, 0),
      totalAppointments: confirmedAppointmentsList.length,
    };
  }

  /**
   * Obtiene filtros directamente desde los Endpoints de Hosvital
   */
  public static async getFilters() {
    const [hosvitalSpecs, schedules] = await Promise.all([
      HunApiService.getEspecialidades(),
      this.fetchHosvitalSchedules(),
    ]);

    const doctorsMap = new Map<string, { code: string; name: string; specialty: string }>();
    const officesSet = new Set<string>();

    schedules.forEach((s) => {
      doctorsMap.set(s.doctorName, { code: s.doctorCode, name: s.doctorName, specialty: s.specialtyName });
      if (s.officeCode) officesSet.add(s.officeCode);
    });

    return {
      specialties: hosvitalSpecs.map((s) => ({ code: String(s.codigo), name: s.descripcion })),
      doctors: Array.from(doctorsMap.values()),
      offices: Array.from(officesSet).sort(),
      days: ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'],
    };
  }

  /**
   * Novedades y ausencias
   */
  public static async getAbsences(params: { specialty?: string; doctor?: string; type?: string; search?: string }) {
    try {
      const where: any = {};
      if (params.specialty) where.specialty = { contains: params.specialty, mode: 'insensitive' };
      if (params.doctor) where.doctorName = { contains: params.doctor, mode: 'insensitive' };
      if (params.type && params.type !== 'ALL') where.type = params.type;
      return await prisma.medicalAbsence.findMany({ where, orderBy: { startDate: 'desc' }, take: 200 });
    } catch {
      return [];
    }
  }

  /**
   * Estadísticas de la agenda conectada a los Endpoints de Hosvital
   */
  public static async getStats() {
    const [hosvitalSpecs, schedules] = await Promise.all([
      HunApiService.getEspecialidades(),
      this.fetchHosvitalSchedules(),
    ]);

    const distinctDoctors = new Set(schedules.map((s) => s.doctorName));

    return {
      totalSchedules: schedules.length,
      regularCount: schedules.length,
      adicionalCount: 0,
      totalAbsences: 0,
      totalDoctors: distinctDoctors.size,
      totalSpecialties: hosvitalSpecs.length,
    };
  }

  public static formatDoctorName(raw: string): string {
    if (!raw) return 'Médico Especialista HUN';
    const words = raw.trim().toLowerCase().split(/\s+/);
    const titleCase = words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    if (titleCase.startsWith('Dr.') || titleCase.startsWith('Dra.')) {
      return titleCase;
    }
    return `Dr(a). ${titleCase}`;
  }

  public static cleanDoctorNameForMatch(raw: string): string {
    if (!raw) return '';
    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^dr\(a\)\.\s*|^dr\.\s*|^dra\.\s*/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /**
   * Obtiene los próximos cupos disponibles directamente del Endpoint de Hosvital (/webServiceAgenda/agenda)
   */
  public static async getAvailableSlotsForSpecialty(
    specialtyQuery: string,
    fromDate?: Date,
    limit: number = 3
  ): Promise<DynamicSlot[]> {
    const cleanQuery = normalizeText(specialtyQuery);
    const now = fromDate || new Date();

    const hosvitalSpecs = await HunApiService.getEspecialidades();
    const matchedSpec = hosvitalSpecs.find((s) => {
      const normSpec = normalizeText(s.descripcion);
      return normSpec.includes(cleanQuery) || cleanQuery.includes(normSpec) || String(s.codigo) === specialtyQuery.trim();
    });

    if (!matchedSpec) return [];

    const hosvitalSlots = await HunApiService.consultarAgendaEspecialidad(matchedSpec.codigo);
    if (!hosvitalSlots || hosvitalSlots.length === 0) return [];

    const validSlots: DynamicSlot[] = [];

    for (let idx = 0; idx < hosvitalSlots.length; idx++) {
      const s = hosvitalSlots[idx];
      if (!s.fecha_atencion) continue;
      const timeRaw = (s.hora_inicial || '08:00:00').substring(0, 5);
      const slotUtc = bogotaLocalToUtc(s.fecha_atencion, timeRaw);
      if (slotUtc <= now) continue;

      const [h, m] = timeRaw.split(':').map(Number);
      const dateObj = new Date(`${s.fecha_atencion}T12:00:00Z`);
      const dayName = DAYS_SHORT_ES[dateObj.getUTCDay()];
      const monthName = MONTHS_ES[Number(s.fecha_atencion.slice(5, 7)) - 1];
      const dayNum = Number(s.fecha_atencion.slice(8, 10));
      const timeFormatted = `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;

      const consultorioStr = s.numero_consultorio ? String(s.numero_consultorio).trim() : '200';
      const formattedDoctor = AgendaService.formatDoctorName(s.nombre_medico || 'Especialista HUN');
      const specName = s.nombre_especialidad?.trim() || matchedSpec.descripcion;
      const cupsVal = Array.isArray(s.cups)
        ? (s.cups[0]?.codigo || '890202')
        : (typeof s.cups === 'string' ? s.cups : '890202');

      validSlots.push({
        id: `hosvital-${s.id_agenda_detalle || s.idAgendaDetalle || idx}-${Date.now()}`,
        doctorName: formattedDoctor,
        doctorCode: s.codigo_medico?.trim() || 'ME445',
        officeCode: consultorioStr,
        specialtyName: specName,
        dateTimeStr: `${dayName} ${dayNum} de ${monthName}, ${timeFormatted} · ${formattedDoctor} (Cons. ${consultorioStr})`,
        isoDateTime: `${s.fecha_atencion}T${s.hora_inicial || '08:00:00'}`,
        agendaDetalleId: Number(s.id_agenda_detalle || s.idAgendaDetalle) || 677,
        codigoMedico: s.codigo_medico?.trim() || 'ME445',
        cups: cupsVal,
        consultorio: consultorioStr,
        tiempoAtencion: Number(s.tiempo_intervalo) || 20,
        codEspecialidadHosvital: Number(matchedSpec.codigo),
      });

      if (validSlots.length >= limit) break;
    }

    return validSlots;
  }

  /**
   * Obtiene cupos disponibles para reprogramar con un especialista o especialidad desde el Endpoint
   */
  public static async getAvailableSlotsForDoctor(
    specialtyName: string,
    doctorName?: string,
    fromDate?: Date,
    limit: number = 3
  ): Promise<DynamicSlot[]> {
    const allSlots = await AgendaService.getAvailableSlotsForSpecialty(specialtyName, fromDate, Math.max(limit * 5, 25));
    if (doctorName) {
      const cleanDoctor = AgendaService.cleanDoctorNameForMatch(doctorName);
      const matching = allSlots
        .filter((slot) => {
          const candidate = AgendaService.cleanDoctorNameForMatch(slot.doctorName);
          return candidate.includes(cleanDoctor) || cleanDoctor.includes(candidate);
        })
        .slice(0, limit);
      if (matching.length > 0) return matching;
    }
    return allSlots.slice(0, limit);
  }
}
