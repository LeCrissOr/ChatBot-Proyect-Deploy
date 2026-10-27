import { socketService } from './socket.service';
import { store } from './store.service';
import { DynamicSlot } from '../types';
import { prisma } from './database.service';
import { HunApiService, HunAgendaSlotItem, HunEspecialidadItem } from './hunApi.service';
import { CONFIG } from '../config';

const BOGOTA_TIME_ZONE = 'America/Bogota';
const DAYS_OF_WEEK_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
const DAYS_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STATIC_SPECIALTIES = [
  { code: 'med_interna', name: 'Medicina Interna', fee: 160000, office: '201' },
  { code: 'dermatologia', name: 'Dermatología', fee: 160000, office: '101' },
  { code: 'cardiologia', name: 'Cardiología', fee: 160000, office: '202' },
  { code: 'ortopedia', name: 'Ortopedia y Traumatología', fee: 160000, office: '301' },
  { code: 'ginecologia', name: 'Ginecología y Obstetricia', fee: 160000, office: '401' },
  { code: 'pediatria', name: 'Pediatría', fee: 160000, office: '102' },
  { code: 'oftalmologia', name: 'Oftalmología', fee: 160000, office: '402' },
  { code: 'urologia', name: 'Urología', fee: 160000, office: '402' },
];

const STATIC_DOCTORS = [
  { name: 'Dr. Roberto Mendoza', license: 'RM-84920', specialty: 'Medicina Interna', specCode: 'med_interna', office: '201' },
  { name: 'Dra. Camila Torres', license: 'CT-73819', specialty: 'Medicina Interna', specCode: 'med_interna', office: '201' },
  { name: 'Dra. Marcela Rincón', license: 'MR-92014', specialty: 'Dermatología', specCode: 'dermatologia', office: '101' },
  { name: 'Dr. Julián Castro', license: 'JC-81934', specialty: 'Dermatología', specCode: 'dermatologia', office: '101' },
  { name: 'Dr. Fernando Pardo', license: 'FP-71932', specialty: 'Cardiología', specCode: 'cardiologia', office: '202' },
  { name: 'Dra. Andrea Morales', license: 'AM-64821', specialty: 'Cardiología', specCode: 'cardiologia', office: '202' },
  { name: 'Dr. Santiago Vargas', license: 'SV-59201', specialty: 'Ortopedia y Traumatología', specCode: 'ortopedia', office: '301' },
  { name: 'Dr. Luis Enrique Peña', license: 'LP-48291', specialty: 'Ortopedia y Traumatología', specCode: 'ortopedia', office: '301' },
  { name: 'Dra. Patricia Valenzuela', license: 'PV-38192', specialty: 'Ginecología y Obstetricia', specCode: 'ginecologia', office: '401' },
  { name: 'Dra. Sofia Nieto', license: 'SN-29481', specialty: 'Ginecología y Obstetricia', specCode: 'ginecologia', office: '401' },
  { name: 'Dr. Álvaro Beltrán', license: 'AB-91823', specialty: 'Pediatría', specCode: 'pediatria', office: '102' },
  { name: 'Dra. Elena Gómez', license: 'EG-82719', specialty: 'Pediatría', specCode: 'pediatria', office: '102' },
  { name: 'Dra. Lucía Restrepo', license: 'LR-73628', specialty: 'Oftalmología', specCode: 'oftalmologia', office: '402' },
  { name: 'Dr. Germán Osorio', license: 'GO-64539', specialty: 'Oftalmología', specCode: 'oftalmologia', office: '402' },
  { name: 'Dr. Gabriel Fonseca', license: 'GF-55443', specialty: 'Urología', specCode: 'urologia', office: '402' },
  { name: 'Dr. Mauricio Cárdenas', license: 'MC-44332', specialty: 'Urología', specCode: 'urologia', office: '402' },
];

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

function getActiveDatesForDayOfWeek(targetDayOfWeek: number, targetMonth?: number, targetYear?: number): string[] {
  const now = new Date();
  const year = targetYear || now.getFullYear();
  const baseMonth = targetMonth !== undefined ? targetMonth - 1 : now.getMonth();
  const dates: string[] = [];

  for (let offset = 0; offset <= 1; offset++) {
    const curY = baseMonth + offset > 11 ? year + 1 : year;
    const curM = (baseMonth + offset) % 12;
    const daysInMonth = new Date(curY, curM + 1, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(curY, curM, d, 12, 0, 0));
      if (dt.getUTCDay() === targetDayOfWeek) {
        const yStr = String(curY);
        const mStr = String(curM + 1).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        dates.push(`${yStr}-${mStr}-${dStr}`);
      }
    }
  }
  return dates.sort();
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

export interface StructuredScheduleItem {
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
  activeDates: string[];
  rawSlots: any[];
}

export class AgendaService {
  /**
   * Agrupa cupos devueltos por el endpoint de Hosvital en turnos estructurados
   */
  private static groupHosvitalSlots(slotArrays: HunAgendaSlotItem[][]): StructuredScheduleItem[] {
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
   * Genera los registros de turnos a partir de la base de datos PostgreSQL (prisma.doctorSchedule)
   */
  private static async fetchLocalDbSchedules(specialtyFilter?: string, targetMonth?: number, targetYear?: number): Promise<StructuredScheduleItem[]> {
    try {
      const dbSchedules = await prisma.doctorSchedule.findMany({
        where: { active: true },
        include: {
          doctor: {
            include: {
              specialties: {
                include: { specialty: true },
              },
            },
          },
          office: true,
        },
      });

      if (!dbSchedules || dbSchedules.length === 0) {
        return this.getStaticFallbackSchedules(specialtyFilter, targetMonth, targetYear);
      }

      const results: StructuredScheduleItem[] = [];
      const normFilter = specialtyFilter ? normalizeText(specialtyFilter) : '';

      for (const sch of dbSchedules) {
        const primarySpec = sch.doctor.specialties[0]?.specialty;
        const specName = primarySpec?.name || 'Consulta Externa';
        const specCode = primarySpec?.code || 'med_interna';

        if (normFilter) {
          const normSpec = normalizeText(specName);
          if (!normSpec.includes(normFilter) && !normFilter.includes(normSpec) && specCode !== specialtyFilter?.trim()) {
            continue;
          }
        }

        const dowNumber = sch.dayOfWeek % 7; // 1 = Lunes, ... 6 = Sábado, 0 = Domingo
        const dayOfWeekName = DAYS_OF_WEEK_ES[dowNumber] || 'LUNES';
        const activeDates = getActiveDatesForDayOfWeek(dowNumber, targetMonth, targetYear);

        const startH = sch.startTime.getUTCHours();
        const startM = sch.startTime.getUTCMinutes();
        const endH = sch.endTime.getUTCHours();
        const endM = sch.endTime.getUTCMinutes();
        const startStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
        const endStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        const officeName = sch.office?.name || 'Consultorio 200';
        const officeDigits = officeName.match(/\d+/)?.[0] || '200';

        results.push({
          id: `db-${sch.id}`,
          specialtyCode: specCode,
          specialtyName: specName,
          doctorCode: sch.doctor.medicalLicense || 'ME101',
          doctorName: sch.doctor.fullName,
          officeCode: officeDigits,
          dayOfWeek: dayOfWeekName,
          startTime: startStr,
          endTime: endStr,
          frequencyMinutes: sch.slotMinutes || 30,
          modality: 'PRESENCIAL',
          scheduleType: 'REGULAR',
          activity: `CONSULTA DE PRIMERA VEZ / CONTROL - ${specName.toUpperCase()}`,
          activeDates,
          rawSlots: [],
        });
      }

      return results;
    } catch (dbErr) {
      console.warn('⚠️ [AgendaService] Error consultando prisma.doctorSchedule, usando fallback estático:', dbErr);
      return this.getStaticFallbackSchedules(specialtyFilter, targetMonth, targetYear);
    }
  }

  /**
   * Catálogo de contingencia garantizado (16 médicos especialistas y 8 especialidades core)
   */
  private static getStaticFallbackSchedules(specialtyFilter?: string, targetMonth?: number, targetYear?: number): StructuredScheduleItem[] {
    const results: StructuredScheduleItem[] = [];
    const normFilter = specialtyFilter ? normalizeText(specialtyFilter) : '';

    STATIC_DOCTORS.forEach((doc, idx) => {
      if (normFilter) {
        const normSpec = normalizeText(doc.specialty);
        if (!normSpec.includes(normFilter) && !normFilter.includes(normSpec) && doc.specCode !== specialtyFilter?.trim()) {
          return;
        }
      }

      const days = idx % 2 === 0 ? [1, 3, 5] : [2, 4];
      days.forEach((dayNum) => {
        const dayOfWeekName = DAYS_OF_WEEK_ES[dayNum];
        const activeDates = getActiveDatesForDayOfWeek(dayNum, targetMonth, targetYear);
        results.push({
          id: `static-${doc.specCode}-${idx}-${dayNum}`,
          specialtyCode: doc.specCode,
          specialtyName: doc.specialty,
          doctorCode: doc.license,
          doctorName: doc.name,
          officeCode: doc.office,
          dayOfWeek: dayOfWeekName,
          startTime: '08:00',
          endTime: '17:00',
          frequencyMinutes: 30,
          modality: 'PRESENCIAL',
          scheduleType: 'REGULAR',
          activity: `CONSULTA DE PRIMERA VEZ / CONTROL - ${doc.specialty.toUpperCase()}`,
          activeDates,
          rawSlots: [],
        });
      });
    });

    return results;
  }

  /**
   * Consulta los turnos del HUN combinando Hosvital API con la contingencia de base de datos local
   */
  private static async fetchHosvitalSchedules(specialtyFilter?: string, forceRefresh = false, targetMonth?: number, targetYear?: number): Promise<StructuredScheduleItem[]> {
    if (CONFIG.HOSVITAL_ENABLED) {
      try {
        const specs = await HunApiService.getEspecialidades(forceRefresh);
        if (specs && specs.length > 0) {
          let targetSpecs: HunEspecialidadItem[] = [];
          if (specialtyFilter && specialtyFilter.trim()) {
            const normFilter = normalizeText(specialtyFilter);
            targetSpecs = specs.filter((s) => {
              const normDesc = normalizeText(s.descripcion);
              return normDesc.includes(normFilter) || normFilter.includes(normDesc) || String(s.codigo) === specialtyFilter.trim();
            });
          } else {
            // Consultar Infectología (código #782 en Hosvital) como especialidad activa principal sin saturar el endpoint (evita HTTP 429)
            targetSpecs = specs.filter((s) => {
              const normDesc = normalizeText(s.descripcion);
              return Number(s.codigo) === 782 || normDesc.includes('infectolog');
            });
            if (targetSpecs.length === 0) {
              targetSpecs = [{ codigo: '782', descripcion: 'INFECTOLOGIA' }];
            }
          }

          const slotArrays: HunAgendaSlotItem[][] = [];
          for (const sp of targetSpecs) {
            try {
              const slots = await HunApiService.consultarAgendaEspecialidad(sp.codigo, undefined, forceRefresh);
              if (slots && slots.length > 0) {
                slotArrays.push(slots);
              }
            } catch {
              // Ignorar error individual de especialidad
            }
          }

          // Si no hay filtro específico, incluir también cualquier otra especialidad que ya haya sido consultada y tenga cupos en caché
          if (!specialtyFilter || !specialtyFilter.trim()) {
            const cachedArrays = HunApiService.getCachedSlotArrays();
            for (const arr of cachedArrays) {
              if (arr.length > 0 && !slotArrays.includes(arr)) {
                slotArrays.push(arr);
              }
            }
          }

          // Acoplamiento estricto a la agenda disponible del endpoint: devolver únicamente los turnos reales activos
          return this.groupHosvitalSlots(slotArrays);
        }
        return [];
      } catch (err) {
        console.warn('⚠️ [AgendaService] Error conectando con Hosvital API:', (err as any)?.message || err);
        return [];
      }
    }

    return this.fetchLocalDbSchedules(specialtyFilter, targetMonth, targetYear);
  }

  /**
   * Sincroniza en caliente los datos de agenda desde el Endpoint de Hosvital
   */
  public static async syncFromEndpoint() {
    HunApiService.clearCache();
    const schedules = await this.fetchHosvitalSchedules(undefined, true);
    const filters = await this.getFilters();

    const stats = {
      totalSchedules: schedules.length,
      regularCount: schedules.length,
      adicionalCount: 0,
      totalAbsences: await prisma.medicalAbsence.count().catch(() => 0),
      totalDoctors: filters.doctors.length || new Set(schedules.map((s) => s.doctorName)).size,
      totalSpecialties: filters.specialties.length,
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
   * Obtiene la lista paginada y filtrada de turnos de agenda médica
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
   * Obtiene eventos para el calendario en un mes específico desde Hosvital/DB + Citas confirmadas
   */
  public static async getCalendarEvents(params: CalendarQueryParams) {
    const todayBogota = bogotaDateParts(new Date());
    const month = Number(params.month) || Number(todayBogota.month);
    const year = Number(params.year) || Number(todayBogota.year);
    const monthStr = String(month).padStart(2, '0');
    const monthPrefix = `${year}-${monthStr}`;

    let schedules = await this.fetchHosvitalSchedules(params.specialty, false, month, year);

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
   * Obtiene filtros consolidados (Especialidades, Médicos, Consultorios)
   */
  public static async getFilters() {
    const [hosvitalSpecs, schedules] = await Promise.all([
      HunApiService.getEspecialidades().catch(() => [] as HunEspecialidadItem[]),
      this.fetchHosvitalSchedules(),
    ]);

    let specialtiesList: Array<{ code?: string; name: string }> = [];
    if (hosvitalSpecs && hosvitalSpecs.length > 0) {
      specialtiesList = hosvitalSpecs.map((s) => ({ code: String(s.codigo), name: s.descripcion }));
    } else if (!CONFIG.HOSVITAL_ENABLED) {
      try {
        const dbSpecs = await prisma.specialty.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
        if (dbSpecs && dbSpecs.length > 0) {
          specialtiesList = dbSpecs.map((s) => ({ code: s.code, name: s.name }));
        }
      } catch {}
      if (specialtiesList.length === 0) {
        specialtiesList = STATIC_SPECIALTIES.map((s) => ({ code: s.code, name: s.name }));
      }
    }

    const doctorsMap = new Map<string, { code: string; name: string; specialty: string }>();
    const officesSet = new Set<string>();

    schedules.forEach((s) => {
      doctorsMap.set(s.doctorName, { code: s.doctorCode, name: s.doctorName, specialty: s.specialtyName });
      if (s.officeCode) officesSet.add(s.officeCode);
    });

    if (!CONFIG.HOSVITAL_ENABLED && doctorsMap.size === 0) {
      try {
        const dbDoctors = await prisma.doctor.findMany({
          where: { active: true },
          include: { specialties: { include: { specialty: true } } },
        });
        dbDoctors.forEach((d) => {
          const specName = d.specialties[0]?.specialty?.name || 'Consulta Externa';
          doctorsMap.set(d.fullName, { code: d.medicalLicense || 'ME', name: d.fullName, specialty: specName });
        });
      } catch {}
      if (doctorsMap.size === 0) {
        STATIC_DOCTORS.forEach((d) => {
          doctorsMap.set(d.name, { code: d.license, name: d.name, specialty: d.specialty });
        });
      }
    }

    if (!CONFIG.HOSVITAL_ENABLED && officesSet.size === 0) {
      ['101', '102', '201', '202', '301', '302', '401', '402'].forEach((o) => officesSet.add(o));
    }

    return {
      specialties: specialtiesList,
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
   * Estadísticas reales de la agenda médica y disponibilidad desde el endpoint de Agendamiento
   */
  public static async getStats() {
    const schedules = await this.fetchHosvitalSchedules();
    let totalAbsences = 0;
    try {
      totalAbsences = await prisma.medicalAbsence.count();
    } catch {}

    const activeDoctorsCount = new Set(schedules.map((s) => s.doctorName)).size;
    const activeSpecsCount = new Set(schedules.map((s) => s.specialtyName)).size;
    const totalCupos = schedules.reduce((acc, s) => acc + (s.rawSlots?.length || 1), 0);

    return {
      totalSchedules: totalCupos || schedules.length,
      regularCount: totalCupos || schedules.length,
      adicionalCount: 0,
      totalAbsences,
      totalDoctors: activeDoctorsCount,
      totalSpecialties: activeSpecsCount,
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
   * Genera cupos disponibles en contingencia desde Prisma / médicos locales cuando Hosvital no responde
   */
  private static async generateLocalAvailableSlots(
    specialtyQuery: string,
    fromDate: Date,
    limit: number = 3
  ): Promise<DynamicSlot[]> {
    const cleanQuery = normalizeText(specialtyQuery);
    const validSlots: DynamicSlot[] = [];

    let matchedDoctors: Array<{ fullName: string; medicalLicense: string; specialtyName: string; officeCode: string }> = [];

    try {
      const dbDoctors = await prisma.doctor.findMany({
        where: { active: true },
        include: {
          specialties: { include: { specialty: true } },
          schedules: { include: { office: true } },
        },
      });

      const filtered = dbDoctors.filter((d) =>
        d.specialties.some((ds) => {
          const norm = normalizeText(ds.specialty.name);
          return norm.includes(cleanQuery) || cleanQuery.includes(norm) || ds.specialty.code === cleanQuery;
        })
      );

      matchedDoctors = (filtered.length > 0 ? filtered : dbDoctors).map((d) => {
        const specName = d.specialties[0]?.specialty?.name || specialtyQuery;
        const offName = d.schedules[0]?.office?.name || 'Consultorio 201';
        const offCode = offName.match(/\d+/)?.[0] || '201';
        return {
          fullName: d.fullName,
          medicalLicense: d.medicalLicense || 'ME101',
          specialtyName: specName,
          officeCode: offCode,
        };
      });
    } catch {}

    if (matchedDoctors.length === 0) {
      const fallbackSpec = STATIC_SPECIALTIES.find((s) => {
        const n = normalizeText(s.name);
        return n.includes(cleanQuery) || cleanQuery.includes(n);
      }) || STATIC_SPECIALTIES[0];

      const matchingStatic = STATIC_DOCTORS.filter((d) => d.specCode === fallbackSpec.code);
      matchedDoctors = (matchingStatic.length > 0 ? matchingStatic : STATIC_DOCTORS.slice(0, 2)).map((d) => ({
        fullName: d.name,
        medicalLicense: d.license,
        specialtyName: d.specialty,
        officeCode: d.office,
      }));
    }

    const slotTimes = [
      { h: 8, m: 30, str: '08:30', formatted: '08:30 AM' },
      { h: 10, m: 30, str: '10:30', formatted: '10:30 AM' },
      { h: 14, m: 0, str: '14:00', formatted: '02:00 PM' },
      { h: 15, m: 30, str: '15:30', formatted: '03:30 PM' },
    ];

    const startDate = new Date(fromDate);
    startDate.setDate(startDate.getDate() + 1);

    let dayOffset = 0;
    while (validSlots.length < limit && dayOffset < 14) {
      const candidateDate = new Date(startDate);
      candidateDate.setDate(startDate.getDate() + dayOffset);
      dayOffset++;

      const dow = candidateDate.getDay();
      if (dow === 0) continue; // Domingo cerrado

      const dayName = DAYS_SHORT_ES[dow];
      const monthName = MONTHS_ES[candidateDate.getMonth()];
      const dayNum = candidateDate.getDate();
      const dateIsoStr = `${candidateDate.getFullYear()}-${String(candidateDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const timeSlot = slotTimes[(validSlots.length) % slotTimes.length];
      const assignedDoctor = matchedDoctors[(validSlots.length) % matchedDoctors.length];
      const formattedDoctor = AgendaService.formatDoctorName(assignedDoctor.fullName);

      validSlots.push({
        id: `local-${assignedDoctor.medicalLicense}-${dateIsoStr}-${timeSlot.str}`,
        doctorName: formattedDoctor,
        doctorCode: assignedDoctor.medicalLicense,
        officeCode: assignedDoctor.officeCode,
        specialtyName: assignedDoctor.specialtyName,
        dateTimeStr: `${dayName} ${dayNum} de ${monthName}, ${timeSlot.formatted} · ${formattedDoctor} (Cons. ${assignedDoctor.officeCode})`,
        isoDateTime: `${dateIsoStr}T${timeSlot.str}:00`,
        agendaDetalleId: 1000 + validSlots.length + Math.floor(Math.random() * 500),
        codigoMedico: assignedDoctor.medicalLicense,
        cups: '890202',
        consultorio: assignedDoctor.officeCode,
        tiempoAtencion: 30,
        codEspecialidadHosvital: 101,
      });
    }

    return validSlots;
  }

  /**
   * Obtiene los próximos cupos disponibles para agendamiento (Hosvital Endpoint + Fallback Dinámico HUN)
   */
  public static async getAvailableSlotsForSpecialty(
    specialtyQuery: string,
    fromDate?: Date,
    limit: number = 3
  ): Promise<DynamicSlot[]> {
    const cleanQuery = normalizeText(specialtyQuery);
    const now = fromDate || new Date();

    if (CONFIG.HOSVITAL_ENABLED) {
      try {
        const hosvitalSpecs = await HunApiService.getEspecialidades();
        const matchedSpec = hosvitalSpecs.find((s) => {
          const normSpec = normalizeText(s.descripcion);
          return normSpec.includes(cleanQuery) || cleanQuery.includes(normSpec) || String(s.codigo) === specialtyQuery.trim();
        });

        if (matchedSpec) {
          const hosvitalSlots = await HunApiService.consultarAgendaEspecialidad(matchedSpec.codigo);
          if (hosvitalSlots && hosvitalSlots.length > 0) {
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

              const realDetalleId = Number(s.id_agenda_detalle || s.idAgendaDetalle || (s as any).id || (s as any).Id || (s as any).id_detalle || 0);

              validSlots.push({
                id: `hosvital-${realDetalleId || idx}-${Date.now()}`,
                doctorName: formattedDoctor,
                doctorCode: s.codigo_medico?.trim() || 'ME445',
                officeCode: consultorioStr,
                specialtyName: specName,
                dateTimeStr: `${dayName} ${dayNum} de ${monthName}, ${timeFormatted} · ${formattedDoctor} (Cons. ${consultorioStr})`,
                isoDateTime: `${s.fecha_atencion}T${s.hora_inicial || '08:00:00'}`,
                agendaDetalleId: realDetalleId,
                codigoMedico: s.codigo_medico?.trim() || 'ME445',
                cups: cupsVal,
                consultorio: consultorioStr,
                tiempoAtencion: Number(s.tiempo_intervalo) || 20,
                codEspecialidadHosvital: Number(matchedSpec.codigo),
              });

              if (validSlots.length >= limit) return validSlots;
            }
            if (validSlots.length > 0) return validSlots;
          }
        }
        // Acoplamiento estricto: Si Hosvital está habilitado y no hay cupos reales abiertos, NO inventar cupos
        console.log(`ℹ️ [AgendaService] No hay cupos reales disponibles en Hosvital para ${specialtyQuery}.`);
        return [];
      } catch (err) {
        console.warn('⚠️ [AgendaService] Error consultando cupos Hosvital:', err);
        return [];
      }
    }

    return this.generateLocalAvailableSlots(specialtyQuery, now, limit);
  }

  /**
   * Obtiene la lista de médicos especialistas disponibles para una especialidad dada
   */
  public static async getDoctorsForSpecialty(
    specialtyQuery: string
  ): Promise<Array<{ name: string; code: string; specialtyName: string; officeCode: string }>> {
    const cleanQuery = normalizeText(specialtyQuery);
    const doctorsMap = new Map<string, { name: string; code: string; specialtyName: string; officeCode: string }>();

    // 1. Consultar desde Hosvital / Cupos disponibles de la especialidad si existen
    try {
      const slots = await this.getAvailableSlotsForSpecialty(specialtyQuery, undefined, 20);
      for (const s of slots) {
        if (s.doctorName) {
          const formatted = this.formatDoctorName(s.doctorName);
          const key = this.cleanDoctorNameForMatch(formatted);
          if (key && !doctorsMap.has(key)) {
            doctorsMap.set(key, {
              name: formatted,
              code: s.doctorCode || s.codigoMedico || 'ME101',
              specialtyName: s.specialtyName || specialtyQuery,
              officeCode: s.officeCode || String(s.consultorio || '201'),
            });
          }
        }
      }
    } catch {}

    if (CONFIG.HOSVITAL_ENABLED) {
      return Array.from(doctorsMap.values());
    }

    // 2. Consultar en PostgreSQL (prisma.doctor)
    try {
      const dbDoctors = await prisma.doctor.findMany({
        where: { active: true },
        include: {
          specialties: { include: { specialty: true } },
          schedules: { include: { office: true } },
        },
      });

      const filtered = dbDoctors.filter((d) =>
        d.specialties.some((ds) => {
          const norm = normalizeText(ds.specialty.name);
          return norm.includes(cleanQuery) || cleanQuery.includes(norm) || ds.specialty.code === cleanQuery;
        })
      );

      for (const d of filtered) {
        const formatted = this.formatDoctorName(d.fullName);
        const key = this.cleanDoctorNameForMatch(formatted);
        if (key && !doctorsMap.has(key)) {
          const specName = d.specialties[0]?.specialty?.name || specialtyQuery;
          const offName = d.schedules[0]?.office?.name || 'Consultorio 201';
          const offCode = offName.match(/\d+/)?.[0] || '201';
          doctorsMap.set(key, {
            name: formatted,
            code: d.medicalLicense || 'ME101',
            specialtyName: specName,
            officeCode: offCode,
          });
        }
      }
    } catch {}

    // 3. Catálogo estático de médicos por especialidad
    const matchingStatic = STATIC_DOCTORS.filter((d) => {
      const normSpec = normalizeText(d.specialty);
      return normSpec.includes(cleanQuery) || cleanQuery.includes(normSpec) || d.specCode === cleanQuery;
    });

    for (const d of matchingStatic) {
      const formatted = this.formatDoctorName(d.name);
      const key = this.cleanDoctorNameForMatch(formatted);
      if (key && !doctorsMap.has(key)) {
        doctorsMap.set(key, {
          name: formatted,
          code: d.license,
          specialtyName: d.specialty,
          officeCode: d.office,
        });
      }
    }

    // Si es una especialidad que no tenía médicos específicos en el seed, proveer los especialistas base asignados
    if (doctorsMap.size === 0) {
      for (const d of STATIC_DOCTORS.slice(0, 2)) {
        const formatted = this.formatDoctorName(d.name);
        const key = this.cleanDoctorNameForMatch(formatted);
        if (key && !doctorsMap.has(key)) {
          doctorsMap.set(key, {
            name: formatted,
            code: d.license,
            specialtyName: specialtyQuery,
            officeCode: d.office,
          });
        }
      }
    }

    return Array.from(doctorsMap.values());
  }

  /**
   * Obtiene cupos disponibles para agendar o reprogramar con un especialista específico o especialidad
   */
  public static async getAvailableSlotsForDoctor(
    specialtyName: string,
    doctorName?: string,
    fromDate?: Date,
    limit: number = 3,
    strictMatch: boolean = false
  ): Promise<DynamicSlot[]> {
    const allSlots = await AgendaService.getAvailableSlotsForSpecialty(specialtyName, fromDate, Math.max(limit * 6, 30));
    if (doctorName) {
      const cleanDoctor = AgendaService.cleanDoctorNameForMatch(doctorName);
      const matching = allSlots
        .filter((slot) => {
          const candidate = AgendaService.cleanDoctorNameForMatch(slot.doctorName);
          return candidate.includes(cleanDoctor) || cleanDoctor.includes(candidate);
        })
        .slice(0, limit);
      if (matching.length > 0) return matching;

      // Verificar si el médico pertenece al catálogo de especialistas de la especialidad
      const specialtyDoctors = await this.getDoctorsForSpecialty(specialtyName);
      const matchedDoc = specialtyDoctors.find((d) => {
        const candidate = AgendaService.cleanDoctorNameForMatch(d.name);
        return candidate.includes(cleanDoctor) || cleanDoctor.includes(candidate);
      });

      if (matchedDoc) {
        if (CONFIG.HOSVITAL_ENABLED) {
          console.log(`ℹ️ [AgendaService] Dr(a). ${doctorName} no tiene cupos abiertos en la agenda real de Hosvital.`);
          return [];
        }
        const now = fromDate || new Date();
        const generated: DynamicSlot[] = [];
        const slotTimes = [
          { h: 8, m: 30, str: '08:30', formatted: '08:30 AM' },
          { h: 10, m: 30, str: '10:30', formatted: '10:30 AM' },
          { h: 14, m: 0, str: '14:00', formatted: '02:00 PM' },
        ];
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() + 1);
        let dayOffset = 0;
        while (generated.length < limit && dayOffset < 14) {
          const candidateDate = new Date(startDate);
          candidateDate.setDate(startDate.getDate() + dayOffset);
          dayOffset++;
          const dow = candidateDate.getDay();
          if (dow === 0) continue;
          const dayName = DAYS_SHORT_ES[dow];
          const monthName = MONTHS_ES[candidateDate.getMonth()];
          const dayNum = candidateDate.getDate();
          const dateIsoStr = `${candidateDate.getFullYear()}-${String(candidateDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const timeSlot = slotTimes[generated.length % slotTimes.length];
          generated.push({
            id: `local-${matchedDoc.code}-${dateIsoStr}-${timeSlot.str}`,
            doctorName: matchedDoc.name,
            doctorCode: matchedDoc.code,
            officeCode: matchedDoc.officeCode,
            specialtyName: matchedDoc.specialtyName || specialtyName,
            dateTimeStr: `${dayName} ${dayNum} de ${monthName}, ${timeSlot.formatted} · ${matchedDoc.name} (Cons. ${matchedDoc.officeCode})`,
            isoDateTime: `${dateIsoStr}T${timeSlot.str}:00`,
            agendaDetalleId: 1200 + generated.length,
            codigoMedico: matchedDoc.code,
            cups: '890202',
            consultorio: matchedDoc.officeCode,
            tiempoAtencion: 30,
            codEspecialidadHosvital: 101,
          });
        }
        return generated;
      }

      if (strictMatch) {
        return [];
      }
    }
    return allSlots.slice(0, limit);
  }
}
