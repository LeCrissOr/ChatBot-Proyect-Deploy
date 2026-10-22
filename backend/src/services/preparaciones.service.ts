import { prisma } from './database.service';
import { HunApiService } from './hunApi.service';

export interface PreparationFilterParams {
  query?: string;
  area?: string;
  page?: number;
  limit?: number;
}

export class PreparacionesService {
  /**
   * Normaliza texto para búsqueda insensible a acentos, mayúsculas y caracteres especiales
   */
  public static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Obtiene la lista de áreas o servicios únicos de imágenes (priorizando Endpoint)
   */
  public static async getAreas(): Promise<string[]> {
    const endpointItems = await HunApiService.getPreparaciones();
    if (endpointItems.length > 0) {
      return Array.from(new Set(endpointItems.map((i) => i.area))).sort();
    }
    const areas = await prisma.diagnosticProcedure.findMany({
      distinct: ['area'],
      select: { area: true },
      orderBy: { area: 'asc' },
    });
    return areas.map((a) => a.area);
  }

  /**
   * Obtiene el catálogo consolidado de laboratorios
   */
  public static async getLaboratories() {
    return prisma.laboratoryCatalog.findMany({
      orderBy: [{ packageCount: 'desc' }, { description: 'asc' }],
    });
  }

  /**
   * Busca procedimientos diagnósticos según texto, código CUPS o área (priorizando Endpoint)
   */
  public static async searchProcedures(params: PreparationFilterParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const endpointItems = await HunApiService.getPreparaciones({
      query: params.query,
      area: params.area,
    });
    if (endpointItems.length > 0) {
      let filtered = endpointItems;
      if (params.area && params.area !== 'ALL') {
        filtered = filtered.filter((i) => i.area.toLowerCase() === params.area!.toLowerCase());
      }
      if (params.query && params.query.trim()) {
        const q = this.normalizeText(params.query);
        filtered = filtered.filter(
          (i) =>
            this.normalizeText(i.name).includes(q) ||
            this.normalizeText(i.packageId).includes(q) ||
            (i.mainCups && i.mainCups.includes(q)) ||
            this.normalizeText(i.area).includes(q)
        );
      }
      const total = filtered.length;
      return {
        items: filtered.slice(skip, skip + limit),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      };
    }

    const where: any = { isActive: true };

    if (params.area && params.area !== 'ALL') {
      where.area = { equals: params.area, mode: 'insensitive' };
    }

    if (params.query && params.query.trim()) {
      const q = params.query.trim();
      const isNumeric = /^\d+$/.test(q);

      if (isNumeric) {
        // Búsqueda por código CUPS exacto o parcial
        where.OR = [
          { mainCups: { contains: q } },
          { cupsList: { has: q } },
          { labCups: { has: q } },
          { name: { contains: q, mode: 'insensitive' } },
        ];
      } else {
        where.OR = [
          { packageId: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { mainCupsName: { contains: q, mode: 'insensitive' } },
          { patientPreparation: { contains: q, mode: 'insensitive' } },
          { requiredLabs: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.diagnosticProcedure.findMany({
        where,
        include: {
          codes: { orderBy: { order: 'asc' } },
          supplies: { orderBy: { itemNumber: 'asc' } },
        },
        orderBy: [{ area: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.diagnosticProcedure.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Obtiene un procedimiento por su ID de paquete (ej. "RI-001") (priorizando Endpoint)
   */
  public static async getByPackageId(packageId: string) {
    const endpointItems = await HunApiService.getPreparaciones({ packageId });
    const found = endpointItems.find((i) => i.packageId.toLowerCase() === packageId.toLowerCase());
    if (found) return found;

    return prisma.diagnosticProcedure.findUnique({
      where: { packageId },
      include: {
        codes: { orderBy: { order: 'asc' } },
        supplies: { orderBy: { itemNumber: 'asc' } },
      },
    });
  }

  /**
   * Búsqueda inteligente para el paciente desde WhatsApp o Web (priorizando Endpoint)
   */
  public static async findForPatient(userQuery: string) {
    const raw = userQuery.trim();
    if (!raw) return { matchType: 'NONE' as const, procedures: [] };

    const endpointItems = await HunApiService.getPreparaciones({ query: raw });
    if (endpointItems.length > 0) {
      const exactPkg = endpointItems.find((i) => i.packageId.toUpperCase() === raw.toUpperCase());
      if (exactPkg) return { matchType: 'EXACT' as const, procedures: [exactPkg] };

      const digitsOnly = raw.replace(/\D/g, '');
      if (digitsOnly.length >= 5) {
        const cupsMatches = endpointItems.filter(
          (i) => i.mainCups === digitsOnly || (i.cupsList && i.cupsList.includes(digitsOnly))
        );
        if (cupsMatches.length === 1) return { matchType: 'EXACT' as const, procedures: cupsMatches };
        if (cupsMatches.length > 1) return { matchType: 'MULTIPLE' as const, procedures: cupsMatches.slice(0, 5) };
      }

      const cleanTokens = this.normalizeText(raw)
        .split(' ')
        .filter((w) => w.length > 2 && !['para', 'como', 'debo', 'tener', 'hacer', 'examen', 'estudio', 'cita', 'que', 'los', 'las', 'por', 'del', 'con', 'una', 'uno'].includes(w));
      const matched = endpointItems.filter((item) => {
        const text = this.normalizeText(`${item.name} ${item.mainCupsName || ''} ${item.area}`);
        return cleanTokens.every((t) => text.includes(t));
      });
      if (matched.length === 1) return { matchType: 'EXACT' as const, procedures: matched };
      if (matched.length > 1) return { matchType: 'MULTIPLE' as const, procedures: matched.slice(0, 6) };
    }

    // Si es un ID de paquete exacto (ej. RI-001, TC-010)
    const exactPackage = await prisma.diagnosticProcedure.findFirst({
      where: { packageId: { equals: raw.toUpperCase(), mode: 'insensitive' } },
      include: { codes: true, supplies: true },
    });
    if (exactPackage) {
      return { matchType: 'EXACT' as const, procedures: [exactPackage] };
    }

    // Si es un código CUPS numérico (ej. 875101)
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length >= 5) {
      const cupsMatches = await prisma.diagnosticProcedure.findMany({
        where: {
          OR: [
            { mainCups: { equals: digitsOnly } },
            { cupsList: { has: digitsOnly } },
          ],
        },
        include: { codes: true, supplies: true },
        take: 5,
      });
      if (cupsMatches.length === 1) {
        return { matchType: 'EXACT' as const, procedures: cupsMatches };
      }
      if (cupsMatches.length > 1) {
        return { matchType: 'MULTIPLE' as const, procedures: cupsMatches };
      }
    }

    // Búsqueda por palabras clave clínicas del procedimiento
    const cleanTokens = this.normalizeText(raw)
      .split(' ')
      .filter((w) => w.length > 2 && !['para', 'como', 'debo', 'tener', 'hacer', 'examen', 'estudio', 'cita', 'que', 'los', 'las', 'por', 'del', 'con', 'una', 'uno'].includes(w));

    if (cleanTokens.length === 0) {
      return { matchType: 'NONE' as const, procedures: [] };
    }

    // Intentar buscar con todos los tokens principales en nombre del procedimiento
    const procedures = await prisma.diagnosticProcedure.findMany({
      where: {
        AND: cleanTokens.map((token) => ({
          OR: [
            { name: { contains: token, mode: 'insensitive' } },
            { mainCupsName: { contains: token, mode: 'insensitive' } },
            { area: { contains: token, mode: 'insensitive' } },
          ],
        })),
      },
      include: { codes: true, supplies: true },
      take: 6,
    });

    if (procedures.length === 1) {
      return { matchType: 'EXACT' as const, procedures };
    }
    if (procedures.length > 1) {
      return { matchType: 'MULTIPLE' as const, procedures };
    }

    // Si no hubo coincidencia estricta, relajar a OR entre los tokens más largos
    const longTokens = cleanTokens.filter((t) => t.length >= 4);
    if (longTokens.length > 0) {
      const relaxed = await prisma.diagnosticProcedure.findMany({
        where: {
          OR: longTokens.map((token) => ({
            name: { contains: token, mode: 'insensitive' },
          })),
        },
        include: { codes: true, supplies: true },
        take: 6,
      });

      if (relaxed.length === 1) {
        return { matchType: 'EXACT' as const, procedures: relaxed };
      }
      if (relaxed.length > 1) {
        return { matchType: 'MULTIPLE' as const, procedures: relaxed };
      }
    }

    return { matchType: 'NONE' as const, procedures: [] };
  }

  /**
   * Genera el mensaje formateado de preparación y laboratorios para el paciente (WhatsApp / Chat)
   */
  public static async formatPatientInstructions(procedure: any): Promise<string> {
    const lines: string[] = [];

    lines.push(`📋 *INDICACIONES Y PREPARACIÓN DE TU ESTUDIO*\n`);
    lines.push(`🏥 *Procedimiento:* ${procedure.name}`);
    lines.push(`📂 *Servicio:* ${procedure.area}`);
    if (procedure.mainCups) {
      lines.push(`🔢 *Código CUPS:* ${procedure.mainCups}`);
      try {
        const tariff = await prisma.cupsTariff.findFirst({
          where: { cups: procedure.mainCups },
        });
        if (tariff && tariff.particularFee) {
          const feeFormatted = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
          }).format(Number(tariff.particularFee));
          lines.push(`💵 *Tarifa Particular Autorizada:* ${feeFormatted}`);
        }
      } catch (err) {
        // Fallback sin romper si la tabla aún no estuviese lista
      }
    }
    if (procedure.durationMinutes && procedure.durationMinutes !== 'No registrado') {
      lines.push(`⏱️ *Tiempo estimado de la cita:* ${procedure.durationMinutes} minutos`);
    }

    lines.push(`\n───────────────`);
    lines.push(`*REQUISITOS PREVIOS OBLIGATORIOS:*`);

    // 1. Ayuno
    const fasting = procedure.fasting || 'No especificado';
    if (/s[ií]/i.test(fasting)) {
      lines.push(`🍽️ *Ayuno:* Sí, requiere ayuno estricto (generalmente 6 horas previas sin sólidos ni lácteos).`);
    } else if (/no/i.test(fasting)) {
      lines.push(`🍽️ *Ayuno:* No requiere ayuno.`);
    } else {
      lines.push(`🍽️ *Ayuno:* ${fasting}`);
    }

    // 2. Anticoagulantes
    const stopAnti = procedure.stopAnticoagulants || 'No';
    if (/s[ií]/i.test(stopAnti)) {
      lines.push(`💊 *Anticoagulantes:* Requiere suspensión de anticoagulantes o antiagregantes previo aval de tu médico tratante.`);
    } else {
      lines.push(`💊 *Anticoagulantes:* No requiere suspender anticoagulantes.`);
    }

    // 3. Laboratorios requeridos
    if (procedure.requiredLabs && procedure.requiredLabs !== 'No registrado' && procedure.requiredLabs !== '—') {
      lines.push(`\n🩸 *Laboratorios requeridos previos:*`);
      lines.push(`${procedure.requiredLabs}`);

      // Consultar si hay detalles en el catálogo de laboratorios
      if (procedure.labCups && procedure.labCups.length > 0) {
        const labCatalog = await prisma.laboratoryCatalog.findMany({
          where: { cups: { in: procedure.labCups } },
        });
        if (labCatalog.length > 0) {
          lines.push(`\n_Detalle de pruebas solicitadas (vigencia máx. 30 días):_`);
          labCatalog.forEach((lab) => {
            let cleanDesc = lab.description ? lab.description.trim() : '';
            cleanDesc = cleanDesc.replace(/\(HB,\s*HTO,[^)]*\)/i, '').replace(/\s+/g, ' ').trim();
            lines.push(`• ${lab.cups} - ${cleanDesc}`);
          });
        }
      }
    } else {
      lines.push(`🩸 *Laboratorios:* No requiere exámenes de laboratorio previos.`);
    }

    // 4. Acceso venoso / Contraste
    if (procedure.venousAccess && procedure.venousAccess !== '—') {
      lines.push(`💉 *Vía o acceso venoso:* ${procedure.venousAccess}`);
    }

    // 5. Anestesia o sedación
    if (procedure.requiresSedation && procedure.requiresSedation !== 'No' && procedure.requiresSedation !== '—') {
      lines.push(`⚠️ *Anestesia / Sedación:* ${procedure.requiresSedation}. Recuerda asistir con un acompañante adulto responsable.`);
    }

    // 6. Preparación completa del paciente
    if (procedure.patientPreparation && procedure.patientPreparation !== 'Sin preparación previa registrada') {
      lines.push(`\n📝 *Instrucciones para el paciente:*`);
      lines.push(`${procedure.patientPreparation}`);
    }

    // 7. Observaciones adicionales
    if (procedure.observations && procedure.observations !== '—') {
      lines.push(`\n💡 *Observaciones:* ${procedure.observations}`);
    }

    lines.push(`\n───────────────`);
    lines.push(`📌 *Recomendaciones generales del HUN:*`);
    lines.push(`• Llega con 30 minutos de anticipación al Servicio de Imágenes Diagnósticas.`);
    lines.push(`• Trae tu documento de identidad original, orden médica vigente y resultados de estudios previos si los tienes.`);
    lines.push(`• Viste ropa cómoda sin piezas metálicas (cremalleras, broches o joyas).`);

    return lines.join('\n');
  }

  /**
   * Genera la tarjeta con indicaciones y preparación específica para laboratorios clínicos del HUN
   */
  public static getLaboratoryPreparationCard(tariff: {
    cups?: string;
    description: string;
    displayName?: string;
    [key: string]: any;
  }): string {
    const cups = tariff.cups || '';
    const desc = tariff.description || '';
    const norm = this.normalizeText(`${desc} ${tariff.displayName || ''}`);

    const lines: string[] = [];
    lines.push(`📋 *INDICACIONES Y PREPARACIÓN DEL PROCEDIMIENTO*\n`);
    lines.push(`🔬 *Examen:* ${tariff.displayName || desc}`);
    if (cups) {
      lines.push(`🔢 *Código CUPS:* ${cups}`);
    }
    lines.push(`\n───────────────`);
    lines.push(`*REQUISITOS Y PREPARACIÓN:*`);

    if (
      norm.includes('hemograma') ||
      norm.includes('cuadro hematico') ||
      norm.includes('leucograma') ||
      norm.includes('plaquetas') ||
      norm.includes('eritrocitos') ||
      norm.includes('reticulocitos') ||
      norm.includes('frotis de sangre')
    ) {
      lines.push(`🍽️ *Ayuno:* Ayuno de 4 a 8 horas (se sugiere cena ligera libre de grasas la noche anterior).`);
      lines.push(`💧 *Consumo de agua:* Puedes beber agua pura en cantidades moderadas.`);
      lines.push(`💊 *Medicamentos:* No suspendas tus medicamentos habituales, a menos que tu médico tratante lo indique expresamente.`);
      lines.push(`🏃 *Actividad física y alcohol:* Evita ejercicio físico extenuante y bebidas alcohólicas 24 horas antes.`);
    } else if (
      norm.includes('glicemia') ||
      norm.includes('glucosa') ||
      norm.includes('insulina') ||
      norm.includes('curva') ||
      norm.includes('tolerancia')
    ) {
      lines.push(`🍽️ *Ayuno:* Ayuno estricto de 8 a 10 horas (no mayor a 12 horas).`);
      lines.push(`💧 *Consumo de agua:* Solo agua pura en cantidad moderada.`);
      lines.push(`🚭 *Restricciones:* No fumar, no mascar chicle ni consumir bebidas azucaradas durante el ayuno.`);
      lines.push(`💊 *Medicamentos:* Si tomas hipoglicemiantes o insulina, consulta con tu médico sobre la dosis matutina.`);
      if (norm.includes('curva') || norm.includes('tolerancia')) {
        lines.push(`⏱️ *Tiempo en sede:* Disponibilidad de 2 a 3 horas en reposo en el laboratorio para tomas seriadas.`);
      }
    } else if (
      norm.includes('lipidico') ||
      norm.includes('colesterol') ||
      norm.includes('trigliceridos') ||
      norm.includes('hdl') ||
      norm.includes('ldl')
    ) {
      lines.push(`🍽️ *Ayuno:* Ayuno estricto de 10 a 12 horas (no mayor a 14 horas).`);
      lines.push(`🥗 *Alimentación:* Mantén tu dieta habitual los días previos; la noche anterior cena liviano sin fritos.`);
      lines.push(`🍷 *Bebidas alcohólicas:* No consumir alcohol 72 horas antes de la toma.`);
      lines.push(`💧 *Agua:* Permitida agua pura.`);
    } else if (
      norm.includes('creatinina') ||
      norm.includes('bun') ||
      norm.includes('nitrogeno ureico') ||
      norm.includes('acido urico')
    ) {
      lines.push(`🍽️ *Ayuno:* Ayuno de 8 horas.`);
      lines.push(`💧 *Hidratación:* Buena hidratación con agua el día previo.`);
      lines.push(`🥩 *Dieta:* Evita el consumo excesivo de carnes rojas la noche anterior.`);
      if (norm.includes('depuracion') || norm.includes('24 horas')) {
        lines.push(`🧪 *Orina 24 horas:* Requiere recolectar toda la orina durante 24 horas continuas en botellón limpio.`);
      }
    } else if (
      norm.includes('tiroides') ||
      norm.includes('tsh') ||
      norm.includes('t3') ||
      norm.includes('t4') ||
      norm.includes('tiroglobulina')
    ) {
      lines.push(`🍽️ *Ayuno:* Ayuno de 6 a 8 horas.`);
      lines.push(`⏰ *Horario sugerido:* Toma de muestra preferiblemente antes de las 9:00 a.m.`);
      lines.push(`💊 *Medicamento tiroideo:* Si tomas levotiroxina, toma la muestra en ayunas ANTES de ingerir la pastilla.`);
    } else if (norm.includes('prolactina')) {
      lines.push(`🍽️ *Ayuno:* Ayuno de 8 horas.`);
      lines.push(`🛌 *Reposo:* Levantarse al menos 2 horas antes y reposar 20-30 minutos en el laboratorio antes de la venopunción.`);
      lines.push(`⚠️ *Evitar:* No tener relaciones sexuales ni estimulación mamaria la noche anterior.`);
    } else if (
      norm.includes('urocultivo') ||
      norm.includes('uroanalisis') ||
      norm.includes('orina') ||
      norm.includes('citoquimico')
    ) {
      lines.push(`🧪 *Muestra:* Primera orina de la mañana o retención vesical mínima de 4 horas.`);
      lines.push(`🧼 *Higiene:* Lavado genital riguroso con agua y jabón suave antes de recolectar la muestra.`);
      lines.push(`🧴 *Técnica:* Descartar el primer chorro de orina y recoger la porción media directamente en frasco estéril.`);
      lines.push(`⏱️ *Entrega:* Llevar la muestra al laboratorio antes de 2 horas tras la recolección.`);
    } else if (
      norm.includes('coprologico') ||
      norm.includes('coproscopico') ||
      norm.includes('heces') ||
      norm.includes('materia fecal') ||
      norm.includes('parasitos')
    ) {
      lines.push(`🧪 *Muestra:* Deposición espontánea recolectada con la espátula del frasco recolector limpio y seco.`);
      lines.push(`⚠️ *Precaución:* No contaminar la muestra con orina, agua del sanitario ni cremas tópicas.`);
      if (norm.includes('sangre oculta')) {
        lines.push(`🥩 *Dieta previa:* Evitar carnes rojas, embutidos, remolacha y suplementos de hierro 3 días antes.`);
      }
      lines.push(`⏱️ *Entrega:* Entregar en el laboratorio dentro de las primeras 2 horas de recolectada.`);
    } else if (
      norm.includes('coagulacion') ||
      norm.includes('pt ') ||
      norm.includes('tiempo de protrombina') ||
      norm.includes('ptt') ||
      norm.includes('inr') ||
      norm.includes('tromboplastina') ||
      norm.includes('fibrinogeno')
    ) {
      lines.push(`🍽️ *Ayuno:* Ayuno ligero de 4 horas.`);
      lines.push(`💊 *Anticoagulantes:* Informa al personal de laboratorio si consumes anticoagulantes y la hora de tu última toma.`);
    } else if (
      norm.includes('flujo') ||
      norm.includes('vaginal') ||
      norm.includes('frotis') ||
      norm.includes('secrecion') ||
      norm.includes('uretral')
    ) {
      lines.push(`🚫 *Abstinencia:* No tener relaciones sexuales en las 48 horas previas.`);
      lines.push(`🧴 *Tratamientos:* No aplicar cremas, óvulos, duchas ni tratamientos locales 48 horas antes.`);
      lines.push(`🩸 *Menstruación:* No acudir en periodo menstrual (asistir 3 días después de finalizado el sangrado).`);
    } else {
      lines.push(`🍽️ *Ayuno:* Ayuno de 8 a 10 horas (se sugiere no ingerir comidas pesadas o grasas la noche anterior).`);
      lines.push(`💧 *Consumo de agua:* Puedes beber agua pura en cantidades moderadas.`);
      lines.push(`💊 *Medicamentos:* No suspendas tus medicamentos de uso diario salvo indicación médica expresa.`);
      lines.push(`🏃 *Recomendación:* Evita actividad física extenuante y bebidas alcohólicas la víspera de la toma.`);
    }

    lines.push(`\n───────────────`);
    lines.push(`🏥 *Sede de Toma de Muestras HUN:*`);
    lines.push(`📍 Calle 44 # 59-75, Bogotá D.C. - Edificio HUN, Piso 1 (Laboratorio Clínico).`);
    lines.push(`⏰ Lunes a Sábado: 6:00 a.m. a 10:00 a.m. (toma de muestras en ayunas).`);
    lines.push(`📄 Recuerda presentar tu documento de identidad original y orden médica vigente.`);

    return lines.join('\n');
  }
}

