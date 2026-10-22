import { prisma } from './database.service';
import { HunApiService } from './hunApi.service';

export interface TarifasFilterParams {
  query?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export class TarifasService {
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
   * Formatea un valor monetario en pesos colombianos (COP)
   */
  public static formatCurrency(val: number | null | undefined): string {
    if (val === null || val === undefined) return 'Por cotizar';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(val));
  }

  /**
   * Obtiene la lista de categorías con sus conteos (priorizando Endpoint)
   */
  public static async getCategories() {
    const endpointItems = await HunApiService.getTarifas();
    if (endpointItems.length > 0) {
      const map = new Map<string, { category: string; label: string; count: number }>();
      for (const item of endpointItems) {
        const entry = map.get(item.category) || { category: item.category, label: item.categoryLabel, count: 0 };
        entry.count += 1;
        map.set(item.category, entry);
      }
      return Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category));
    }

    const grouped = await prisma.cupsTariff.groupBy({
      by: ['category', 'categoryLabel'],
      _count: { cups: true },
      orderBy: { category: 'asc' },
    });

    return grouped.map((g) => ({
      category: g.category,
      label: g.categoryLabel,
      count: g._count.cups,
    }));
  }

  /**
   * Obtiene estadísticas agregadas del portafolio tarifario (priorizando Endpoint)
   */
  public static async getStats() {
    const endpointItems = await HunApiService.getTarifas();
    if (endpointItems.length > 0) {
      const categories = await this.getCategories();
      return {
        totalTariffs: endpointItems.length,
        categories,
      };
    }

    const [total, categories] = await Promise.all([
      prisma.cupsTariff.count(),
      this.getCategories(),
    ]);

    return {
      totalTariffs: total,
      categories,
    };
  }

  /**
   * Consulta paginada y filtrada de tarifas CUPS (priorizando Endpoint)
   */
  public static async searchTariffs(params: TarifasFilterParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const skip = (page - 1) * limit;

    const endpointItems = await HunApiService.getTarifas({
      query: params.query,
      category: params.category,
    });
    if (endpointItems.length > 0) {
      let filtered = endpointItems;
      if (params.category && params.category !== 'ALL') {
        filtered = filtered.filter((i) => i.category === params.category);
      }
      if (params.query && params.query.trim()) {
        const q = this.normalizeText(params.query);
        filtered = filtered.filter(
          (i) => i.cups.toLowerCase().includes(q) || this.normalizeText(i.description).includes(q)
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

    if (params.category && params.category !== 'ALL') {
      where.category = { equals: params.category };
    }

    if (params.query && params.query.trim()) {
      const q = params.query.trim();

      try {
        const catCondition = params.category && params.category !== 'ALL' ? `AND category = '${params.category}'` : '';
        const [rawItems, countResult] = await Promise.all([
          prisma.$queryRawUnsafe<any[]>(
            `SELECT id, cups, description, category, "categoryLabel", "particularFee", "hun2024Fee", "egresadosFee", "sourceFile", "sourceSheet"
             FROM tarifas_cups
             WHERE "isActive" = true ${catCondition} AND (cups ILIKE $1 OR unaccent(description) ILIKE unaccent($1))
             ORDER BY category ASC, cups ASC
             OFFSET $2 LIMIT $3`,
            `%${q}%`,
            skip,
            limit
          ),
          prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
            `SELECT COUNT(*)::bigint as count
             FROM tarifas_cups
             WHERE "isActive" = true ${catCondition} AND (cups ILIKE $1 OR unaccent(description) ILIKE unaccent($1))`,
            `%${q}%`
          ),
        ]);

        const total = Number(countResult[0]?.count || 0);
        return {
          items: rawItems,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      } catch (err) {
        where.OR = [
          { cups: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    const [items, total] = await Promise.all([
      prisma.cupsTariff.findMany({
        where,
        orderBy: [{ category: 'asc' }, { cups: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.cupsTariff.count({ where }),
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
   * Busca tarifa por código CUPS exacto (priorizando Endpoint)
   */
  public static async getByCups(cups: string) {
    const endpointItems = await HunApiService.getTarifas({ cups: cups.trim() });
    if (endpointItems.length > 0) {
      return endpointItems.filter((i) => i.cups.toLowerCase() === cups.trim().toLowerCase());
    }
    return prisma.cupsTariff.findMany({
      where: { cups: { equals: cups.trim(), mode: 'insensitive' } },
    });
  }

  /**
   * Busca tarifa por ID único
   */
  public static async getById(id: string) {
    const endpointItems = await HunApiService.getTarifas();
    const found = endpointItems.find((i) => i.id === id || i.cups === id);
    if (found) return found;
    return prisma.cupsTariff.findUnique({
      where: { id },
    });
  }

  /**
   * Búsqueda inteligente para el bot cuando el paciente consulta precios o tarifas (priorizando Endpoint)
   */
  public static async findForPatient(userQuery: string) {
    const raw = userQuery.trim();
    if (!raw) return { matchType: 'NONE' as const, tariffs: [] };

    const endpointItems = await HunApiService.getTarifas({ query: raw });
    if (endpointItems.length > 0) {
      const cupsOnly = raw.replace(/[^0-9A-Za-z-]/g, '');
      const exactCups = endpointItems.filter((i) => i.cups.toLowerCase() === cupsOnly.toLowerCase());
      if (exactCups.length === 1) return { matchType: 'EXACT' as const, tariffs: exactCups };
      if (exactCups.length > 1) return { matchType: 'MULTIPLE' as const, tariffs: exactCups.slice(0, 6) };

      const tokens = this.normalizeText(raw)
        .split(' ')
        .filter((w) => w.length > 2 && !['cuanto', 'cuesta', 'precio', 'tarifa', 'valor', 'para', 'examen', 'cita'].includes(w));
      const matched = endpointItems.filter((item) => {
        const desc = this.normalizeText(item.description);
        return tokens.every((t) => desc.includes(t));
      });
      if (matched.length === 1) return { matchType: 'EXACT' as const, tariffs: matched };
      if (matched.length > 1) return { matchType: 'MULTIPLE' as const, tariffs: matched.slice(0, 6) };
    }

    // Si es código CUPS directo
    const cupsOnly = raw.replace(/[^0-9A-Za-z-]/g, '');
    if (cupsOnly.length >= 4) {
      const exactCups = await prisma.cupsTariff.findMany({
        where: { cups: { equals: cupsOnly, mode: 'insensitive' } },
        take: 5,
      });
      if (exactCups.length === 1) return { matchType: 'EXACT' as const, tariffs: exactCups };
      if (exactCups.length > 1) return { matchType: 'MULTIPLE' as const, tariffs: exactCups };
    }

    // Búsqueda por palabras clave
    const tokens = this.normalizeText(raw)
      .split(' ')
      .filter((w) => w.length > 2 && !['cuanto', 'cuesta', 'precio', 'tarifa', 'valor', 'para', 'examen', 'cita'].includes(w));

    if (tokens.length === 0) return { matchType: 'NONE' as const, tariffs: [] };

    let tariffs: any[] = [];
    try {
      const whereConditions = tokens.map((_, idx) => `unaccent(description) ILIKE unaccent($${idx + 1})`).join(' AND ');
      const sqlParams = tokens.map((t) => `%${t}%`);
      tariffs = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, cups, description, category, "categoryLabel", "particularFee", "hun2024Fee", "egresadosFee" 
         FROM tarifas_cups 
         WHERE "isActive" = true AND ${whereConditions} 
         ORDER BY category ASC, cups ASC 
         LIMIT 6`,
        ...sqlParams
      );
    } catch (err) {
      tariffs = await prisma.cupsTariff.findMany({
        where: {
          AND: tokens.map((token) => ({
            description: { contains: token, mode: 'insensitive' },
          })),
        },
        take: 6,
      });
    }

    if (tariffs.length === 1) return { matchType: 'EXACT' as const, tariffs };
    if (tariffs.length > 1) return { matchType: 'MULTIPLE' as const, tariffs };

    return { matchType: 'NONE' as const, tariffs: [] };
  }

  /**
   * Formatea un mensaje de tarifa oficial según el tipo de usuario (Particular, Egresado UNAL, Colaborador HUN)
   */
  public static formatPatientTariffMessage(tariff: any, userType?: string): string {
    let feeToHighlight = Number(tariff.particularFee);
    let feeLabel = 'Tarifa Particular Estándar';

    if (userType === 'EGRESADO_UNAL' && tariff.egresadosFee) {
      feeToHighlight = Number(tariff.egresadosFee);
      feeLabel = 'Tarifa Preferencial Egresado UNAL 🎓';
    } else if (userType === 'COLABORADOR_HUN' && tariff.hun2024Fee) {
      feeToHighlight = Number(tariff.hun2024Fee);
      feeLabel = 'Tarifa Preferencial Colaborador HUN 🏥';
    }

    const feeStr = this.formatCurrency(feeToHighlight);
    const lines: string[] = [
      `💰 *INFORMACIÓN DE TARIFA OFICIAL HUN*\n`,
      `🏥 *Servicio:* ${tariff.description}`,
      `📂 *Categoría:* ${tariff.categoryLabel}`,
      `🔢 *Código CUPS:* ${tariff.cups}`,
      `💵 *${feeLabel}:* ${feeStr}`,
    ];

    if (userType === 'EGRESADO_UNAL') {
      if (tariff.particularFee && Number(tariff.particularFee) !== feeToHighlight) {
        lines.push(`ℹ️ _Tarifa Particular de referencia:_ ${this.formatCurrency(Number(tariff.particularFee))}`);
      }
    } else if (userType === 'COLABORADOR_HUN') {
      if (tariff.particularFee && Number(tariff.particularFee) !== feeToHighlight) {
        lines.push(`ℹ️ _Tarifa Particular de referencia:_ ${this.formatCurrency(Number(tariff.particularFee))}`);
      }
    } else {
      if (tariff.hun2024Fee) {
        lines.push(`🏷️ _Tarifa Colaborador HUN:_ ${this.formatCurrency(Number(tariff.hun2024Fee))}`);
      }
      if (tariff.egresadosFee) {
        lines.push(`🎓 _Tarifa Egresados UNAL:_ ${this.formatCurrency(Number(tariff.egresadosFee))}`);
      }
    }

    lines.push(`\n📌 *Nota:* Tarifa oficial autorizada por el Hospital Universitario Nacional de Colombia.`);
    return lines.join('\n');
  }

  /**
   * Búsqueda especializada de exámenes de laboratorio para el flujo interactivo
   */
  public static async findLabProcedure(userQuery: string): Promise<{ tariff: any; displayName: string } | null> {
    const raw = userQuery.trim();
    if (!raw) return null;
    const norm = this.normalizeText(raw);

    // 1. Mapeo directo de pruebas frecuentes a CUPS oficial de laboratorio HUN
    const directMaps: Array<{ keys: string[]; cups: string; displayName: string }> = [
      {
        keys: ['hemograma', 'cuadro hematico', 'leucograma', 'hemograma iv', 'hemograma 4', 'hemograma automatizado'],
        cups: '902210',
        displayName: 'Hemograma tipo IV (Cuadro Hemático Completo)',
      },
      {
        keys: ['glicemia', 'glucosa', 'glicemia en ayunas', 'glucosa en suero'],
        cups: '903841',
        displayName: 'Glucosa en suero (Glicemia en ayunas)',
      },
      {
        keys: ['perfil lipidico', 'perfil lípido', 'lipidos', 'lipidograma'],
        cups: '903895',
        displayName: 'Perfil lipídico completo',
      },
      {
        keys: ['creatinina', 'creatinina en suero'],
        cups: '903825',
        displayName: 'Creatinina en suero',
      },
      {
        keys: ['urocultivo', 'cultivo de orina'],
        cups: '901236',
        displayName: 'Urocultivo con antibiograma',
      },
      {
        keys: ['parcial de orina', 'uroanalisis', 'citoquimico de orina'],
        cups: '907106',
        displayName: 'Uroanálisis / Parcial de orina',
      },
      {
        keys: ['coprologico', 'materia fecal', 'coproscopico'],
        cups: '907002',
        displayName: 'Examen coprológico',
      },
      {
        keys: ['tsh', 'tiroides', 'hormona estimulante del tiroides'],
        cups: '904508',
        displayName: 'Hormona Estimulante del Tiroides (TSH)',
      },
      {
        keys: ['acido urico'],
        cups: '903801',
        displayName: 'Ácido úrico en suero',
      },
      {
        keys: ['ferritina'],
        cups: '903835',
        displayName: 'Ferritina en suero',
      },
      {
        keys: ['vitamina d'],
        cups: '903883',
        displayName: 'Vitamina D (25-Hidroxi)',
      },
      {
        keys: ['colesterol total'],
        cups: '903818',
        displayName: 'Colesterol total',
      },
      {
        keys: ['trigliceridos'],
        cups: '903867',
        displayName: 'Triglicéridos en suero',
      },
    ];

    for (const map of directMaps) {
      if (map.keys.some((k) => norm.includes(k) || k.includes(norm))) {
        const tariff = await prisma.cupsTariff.findFirst({
          where: { cups: map.cups },
        });
        if (tariff) {
          return {
            tariff: { ...tariff, displayName: map.displayName },
            displayName: map.displayName,
          };
        }
      }
    }

    // 2. Si el usuario ingresó un código CUPS numérico directo
    const digitsOnly = raw.replace(/\D/g, '');
    if (digitsOnly.length >= 4) {
      const byCups = await prisma.cupsTariff.findFirst({
        where: { cups: digitsOnly },
      });
      if (byCups) {
        const cleanTitle = this.toClinicalTitle(byCups.description);
        return {
          tariff: { ...byCups, displayName: cleanTitle },
          displayName: cleanTitle,
        };
      }
    }

    // 3. Búsqueda por palabras clave en tarifas de categoría LABORATORIO
    const tokens = norm
      .split(' ')
      .filter((w) => w.length > 2 && !['para', 'como', 'debo', 'tener', 'examen', 'cita', 'valor', 'precio', 'costo'].includes(w));

    if (tokens.length > 0) {
      const labTariffs = await prisma.cupsTariff.findMany({
        where: {
          category: 'LABORATORIO',
          isActive: true,
          AND: tokens.map((token) => ({
            description: { contains: token, mode: 'insensitive' },
          })),
        },
        take: 3,
      });

      if (labTariffs.length > 0) {
        const top = labTariffs[0];
        const cleanTitle = this.toClinicalTitle(top.description);
        return {
          tariff: { ...top, displayName: cleanTitle },
          displayName: cleanTitle,
        };
      }

      const relaxed = await prisma.cupsTariff.findMany({
        where: {
          category: 'LABORATORIO',
          isActive: true,
          OR: tokens.map((token) => ({
            description: { contains: token, mode: 'insensitive' },
          })),
        },
        take: 3,
      });

      if (relaxed.length > 0) {
        const top = relaxed[0];
        const cleanTitle = this.toClinicalTitle(top.description);
        return {
          tariff: { ...top, displayName: cleanTitle },
          displayName: cleanTitle,
        };
      }
    }

    // 4. Búsqueda general en todas las tarifas
    const genResult = await this.findForPatient(raw);
    if (genResult.tariffs.length > 0) {
      const top = genResult.tariffs[0];
      const cleanTitle = this.toClinicalTitle(top.description);
      return {
        tariff: { ...top, displayName: cleanTitle },
        displayName: cleanTitle,
      };
    }

    return null;
  }

  /**
   * Da formato legible y profesional a descripciones técnicas de laboratorio
   */
  public static toClinicalTitle(str: string): string {
    if (!str) return '';
    const words = str.toLowerCase().split(' ');
    return words
      .map((w, idx) => {
        if (['iv', 'iii', 'ii', 'i', 'tsh', 'hdl', 'ldl', 'bun', 'psa', 'vsg', 'pcr', 'pt', 'ptt', 'inr', 'hb', 'hto'].includes(w)) {
          return w.toUpperCase();
        }
        if (idx > 0 && ['en', 'de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'o', 'por', 'a', 'e', 'u'].includes(w)) {
          return w;
        }
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }
}

