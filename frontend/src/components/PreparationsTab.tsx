import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Clock,
  Utensils,
  Pill,
  Syringe,
  AlertTriangle,
  Beaker,
  ChevronRight,
  X,
  Eye,
  Layers,
  Sparkles,
  BookOpen,
  DollarSign,
  Tag,
  CreditCard,
} from 'lucide-react';
import {
  DiagnosticProcedureItem,
  LaboratoryCatalogItem,
  CupsTariffItem,
  TariffCategoryStats,
  fetchDiagnosticProcedures,
  fetchDiagnosticAreas,
  fetchLaboratoryCatalog,
  fetchPatientInstruction,
  fetchTariffs,
  fetchTariffCategories,
  fetchTariffStats,
} from '../lib/api';

export const PreparationsTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'procedures' | 'labs' | 'tariffs'>('procedures');
  const [procedures, setProcedures] = useState<DiagnosticProcedureItem[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratoryCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Tarifas CUPS (2.333 items)
  const [tariffs, setTariffs] = useState<CupsTariffItem[]>([]);
  const [tariffCategories, setTariffCategories] = useState<TariffCategoryStats[]>([]);
  const [tariffTotal, setTariffTotal] = useState(0);
  const [tariffPage, setTariffPage] = useState(1);
  const [tariffTotalPages, setTariffTotalPages] = useState(1);
  const [tariffLoading, setTariffLoading] = useState(false);
  const [tariffQuery, setTariffQuery] = useState('');
  const [tariffSelectedCategory, setTariffSelectedCategory] = useState('ALL');
  const [copiedTariffId, setCopiedTariffId] = useState<string | null>(null);

  // Filtros procedimientos
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [filterFastingOnly, setFilterFastingOnly] = useState(false);
  const [filterLabsOnly, setFilterLabsOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal / Drawer de detalle
  const [selectedProcedure, setSelectedProcedure] = useState<DiagnosticProcedureItem | null>(null);
  const [procedureInstruction, setProcedureInstruction] = useState<string>('');
  const [copiedInstruction, setCopiedInstruction] = useState(false);
  const [loadingInstruction, setLoadingInstruction] = useState(false);

  // Cargar áreas, laboratorios y categorías de tarifas al inicio
  useEffect(() => {
    Promise.all([fetchDiagnosticAreas(), fetchLaboratoryCatalog(), fetchTariffCategories()])
      .then(([areasData, labsData, tariffCats]) => {
        setAreas(areasData);
        setLaboratories(labsData);
        setTariffCategories(tariffCats);
      })
      .catch(console.error);
  }, []);

  // Cargar procedimientos según búsqueda y área
  const loadProcedures = async () => {
    try {
      setLoading(true);
      const res = await fetchDiagnosticProcedures({
        query: searchQuery.trim() || undefined,
        area: selectedArea !== 'ALL' ? selectedArea : undefined,
        page: currentPage,
        limit: 24,
      });
      setProcedures(res.items);
      setTotalPages(res.totalPages);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Error cargando procedimientos diagnósticos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProcedures();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedArea, currentPage]);

  // Cargar tarifas CUPS
  const loadTariffs = async () => {
    try {
      setTariffLoading(true);
      const res = await fetchTariffs({
        query: tariffQuery.trim() || undefined,
        category: tariffSelectedCategory !== 'ALL' ? tariffSelectedCategory : undefined,
        page: tariffPage,
        limit: 25,
      });
      setTariffs(res.items);
      setTariffTotal(res.total);
      setTariffTotalPages(res.totalPages);
    } catch (err) {
      console.error('Error cargando tarifas CUPS:', err);
    } finally {
      setTariffLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTariffs();
    }, 250);
    return () => clearTimeout(timer);
  }, [tariffQuery, tariffSelectedCategory, tariffPage]);

  // Formateador COP
  const formatCOP = (val?: number | null) => {
    if (val === undefined || val === null) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleCopyTariff = (t: CupsTariffItem) => {
    const text = `Código CUPS: ${t.cups}\nProcedimiento: ${t.description}\nCategoría: ${t.categoryLabel}\nTarifa Particular: ${formatCOP(t.particularFee)}${t.hun2024Fee ? `\nTarifa Particular HUN 2024: ${formatCOP(t.hun2024Fee)}` : ''}${t.egresadosFee ? `\nTarifa Egresados: ${formatCOP(t.egresadosFee)}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedTariffId(t.id);
    setTimeout(() => setCopiedTariffId(null), 2500);
  };

  // Filtrado rápido cliente
  const filteredProcedures = useMemo(() => {
    return procedures.filter((p) => {
      if (filterFastingOnly) {
        const fasting = (p.fasting || '').toLowerCase();
        if (!fasting.includes('s') && !fasting.includes('horas') && !fasting.includes('ayuno')) return false;
      }
      if (filterLabsOnly) {
        if (!p.requiredLabs || p.requiredLabs === 'No registrado' || p.requiredLabs === '—') return false;
      }
      return true;
    });
  }, [procedures, filterFastingOnly, filterLabsOnly]);

  const handleOpenDetail = async (proc: DiagnosticProcedureItem) => {
    setSelectedProcedure(proc);
    setCopiedInstruction(false);
    try {
      setLoadingInstruction(true);
      const res = await fetchPatientInstruction(proc.packageId);
      setProcedureInstruction(res.instruction);
    } catch (e) {
      setProcedureInstruction(proc.patientPreparation);
    } finally {
      setLoadingInstruction(false);
    }
  };

  const handleCopyInstruction = () => {
    if (!procedureInstruction) return;
    navigator.clipboard.writeText(procedureInstruction);
    setCopiedInstruction(true);
    setTimeout(() => setCopiedInstruction(false), 3000);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* 1. Header con Resumen Institucional */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00A3E0]/10 text-[#00A3E0] uppercase tracking-wide">
              Catálogo Clínico HUN
            </span>
            <span className="text-xs text-slate-400">· Paciente Ambulatorio</span>
          </div>
          <h2 className="text-xl font-black text-[#051650] tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#00A3E0]" />
            Preparaciones y Laboratorios de Imágenes
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Portafolio oficial de 362 procedimientos de imágenes diagnósticas, indicaciones de ayuno, anticoagulantes y catálogo de pruebas.
          </p>
        </div>

        {/* Pestañas de Navegación */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start md:self-auto text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('procedures')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'procedures'
                ? 'bg-white text-[#051650] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Procedimientos ({totalCount})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('labs')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'labs'
                ? 'bg-white text-[#051650] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Beaker className="w-3.5 h-3.5" />
            <span>Laboratorios ({laboratories.length})</span>
          </button>
          <button
            onClick={() => setActiveSubTab('tariffs')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              activeSubTab === 'tariffs'
                ? 'bg-white text-[#051650] shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tarifario CUPS ({tariffTotal || '2.333'})</span>
          </button>
        </div>
      </div>

      {/* 2. SUBTAB: PROCEDIMIENTOS Y PREPARACIONES */}
      {activeSubTab === 'procedures' && (
        <>
          {/* Barra de Filtros y Búsqueda */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Buscador de texto */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por procedimiento, código CUPS (ej. 875101), o palabra clave..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00A3E0] focus:bg-white transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Selector de Área */}
              <div className="w-full md:w-64">
                <select
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00A3E0]"
                >
                  <option value="ALL">Todas las Áreas ({areas.length})</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filtros rápidos en pastillas */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-semibold text-[11px] mr-1">Filtros rápidos:</span>
              <button
                onClick={() => setFilterFastingOnly(!filterFastingOnly)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  filterFastingOnly
                    ? 'bg-amber-500 text-white border-amber-600 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Requiere Ayuno</span>
              </button>
              <button
                onClick={() => setFilterLabsOnly(!filterLabsOnly)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  filterLabsOnly
                    ? 'bg-rose-500 text-white border-rose-600 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Beaker className="w-3.5 h-3.5" />
                <span>Requiere Laboratorios</span>
              </button>

              {(filterFastingOnly || filterLabsOnly || selectedArea !== 'ALL' || searchQuery) && (
                <button
                  onClick={() => {
                    setFilterFastingOnly(false);
                    setFilterLabsOnly(false);
                    setSelectedArea('ALL');
                    setSearchQuery('');
                  }}
                  className="text-xs text-rose-600 hover:underline font-semibold ml-auto"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Grilla de Procedimientos */}
          {loading ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
              <div className="w-8 h-8 border-3 border-[#00A3E0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">Consultando catálogo de procedimientos...</p>
            </div>
          ) : filteredProcedures.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No se encontraron procedimientos</p>
              <p className="text-xs text-slate-400 mt-1">Intenta ajustando el texto de búsqueda o el área seleccionada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredProcedures.map((proc) => {
                const requiresFasting = /s[ií]/i.test(proc.fasting || '');
                const hasLabs = Boolean(proc.requiredLabs && proc.requiredLabs !== 'No registrado' && proc.requiredLabs !== '—');
                const stopsAnti = /s[ií]/i.test(proc.stopAnticoagulants || '');

                return (
                  <div
                    key={proc.packageId}
                    className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-[#00A3E0]/60 hover:shadow-md transition flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#051650] text-white">
                          {proc.packageId}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500 text-right truncate">
                          {proc.area}
                        </span>
                      </div>

                      {/* Nombre del procedimiento */}
                      <h3 className="text-xs font-extrabold text-slate-900 group-hover:text-[#00A3E0] transition leading-snug line-clamp-2 mb-2">
                        {proc.name}
                      </h3>

                      {/* CUPS Principal */}
                      {proc.mainCups && (
                        <div className="text-[11px] text-slate-500 font-mono mb-3">
                          CUPS: <span className="font-bold text-slate-800">{proc.mainCups}</span>
                          {proc.mainCupsName && <span className="text-slate-400"> ({proc.mainCupsName})</span>}
                        </div>
                      )}

                      {/* Badges de Requisitos */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
                        {requiresFasting ? (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Utensils className="w-2.5 h-2.5" /> Ayuno
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            Sin ayuno
                          </span>
                        )}

                        {hasLabs ? (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                            <Beaker className="w-2.5 h-2.5" /> Pide laboratorios
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md font-medium bg-slate-50 text-slate-500 border border-slate-200">
                            Sin laboratorios
                          </span>
                        )}

                        {stopsAnti && (
                          <span className="px-2 py-0.5 rounded-md font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <Pill className="w-2.5 h-2.5" /> Susp. anticoagulante
                          </span>
                        )}

                        {proc.durationMinutes && proc.durationMinutes !== 'No registrado' && (
                          <span className="px-2 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {proc.durationMinutes} min
                          </span>
                        )}
                      </div>

                      {/* Extracto de preparación */}
                      <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50/80 p-2 rounded-xl border border-slate-100 mb-3">
                        {proc.patientPreparation}
                      </p>
                    </div>

                    {/* Botón ver detalles */}
                    <button
                      onClick={() => handleOpenDetail(proc)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-[#051650] text-slate-700 hover:text-white border border-slate-200 hover:border-[#051650] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Ficha para Paciente</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between text-xs text-slate-500">
              <span>
                Página {currentPage} de {totalPages} ({totalCount} procedimientos en catálogo)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition font-semibold"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 transition font-semibold"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 3. SUBTAB: CATÁLOGO DE LABORATORIOS Y PATOLOGÍA */}
      {activeSubTab === 'labs' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-[#051650]">Catálogo Oficial de Laboratorios y Patología Requeridos</h3>
              <p className="text-xs text-slate-500">
                Consolidado de pruebas prequirúrgicas y preimagenológicas obligatorias (vigencia estándar ≤ 30 días).
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {laboratories.length} pruebas consolidadas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#051650] text-white uppercase text-[10px] tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-4">CUPS</th>
                  <th className="py-3 px-4">Descripción del Examen</th>
                  <th className="py-3 px-4">Grupo Clínico</th>
                  <th className="py-3 px-4">Indicación / Uso en Imágenes</th>
                  <th className="py-3 px-4 text-center">Procedimientos que lo exigen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {laboratories.map((lab) => (
                  <tr key={lab.cups} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-[#00A3E0]">{lab.cups}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{lab.description}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {lab.group || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-[300px]">{lab.usageNotes || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                        {lab.packageCount} paquetes
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUBTAB: TARIFARIO OFICIAL CUPS HUN */}
      {activeSubTab === 'tariffs' && (
        <div className="space-y-4">
          {/* Barra de Filtros y Búsqueda de Tarifas */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Buscador de CUPS o nombre */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar por código CUPS (ej. 890202, 903841) o nombre del procedimiento..."
                  value={tariffQuery}
                  onChange={(e) => {
                    setTariffQuery(e.target.value);
                    setTariffPage(1);
                  }}
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00A3E0] focus:bg-white transition"
                />
                {tariffQuery && (
                  <button
                    onClick={() => {
                      setTariffQuery('');
                      setTariffPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Selector de Categoría */}
              <div className="w-full md:w-72">
                <select
                  value={tariffSelectedCategory}
                  onChange={(e) => {
                    setTariffSelectedCategory(e.target.value);
                    setTariffPage(1);
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00A3E0]"
                >
                  <option value="ALL">Todas las Categorías ({tariffCategories.reduce((acc, c) => acc + c.count, 0) || '2.333'})</option>
                  {tariffCategories.map((c) => (
                    <option key={c.category} value={c.category}>
                      {c.label} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Categorías en pastillas rápidas */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-semibold text-[11px] mr-1">Filtrar por tipo:</span>
              <button
                onClick={() => {
                  setTariffSelectedCategory('ALL');
                  setTariffPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  tariffSelectedCategory === 'ALL'
                    ? 'bg-[#051650] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Todas
              </button>
              {tariffCategories.map((cat) => (
                <button
                  key={cat.category}
                  onClick={() => {
                    setTariffSelectedCategory(cat.category);
                    setTariffPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                    tariffSelectedCategory === cat.category
                      ? 'bg-[#00A3E0] text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className="text-[10px] opacity-75 font-mono">({cat.count})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Tarifas */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-[#051650] flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Tarifario Oficial de Procedimientos y Exámenes HUN
                </h3>
                <p className="text-xs text-slate-500">
                  Precios autorizados en pesos colombianos (COP) para consultas, imágenes diagnósticas, rehabilitación y laboratorios.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start sm:self-auto font-mono">
                {tariffTotal.toLocaleString('es-CO')} tarifas encontradas
              </span>
            </div>

            {tariffLoading ? (
              <div className="p-12 text-center">
                <div className="w-8 h-8 border-3 border-[#00A3E0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 font-medium">Buscando tarifas en la base de datos PostgreSQL...</p>
              </div>
            ) : tariffs.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No se encontraron tarifas con los criterios indicados</p>
                <p className="text-xs text-slate-400 mt-1">Prueba con otro código CUPS o limpia el texto de búsqueda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#051650] text-white uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-3 px-4 w-28">Código CUPS</th>
                      <th className="py-3 px-4">Descripción del Procedimiento</th>
                      <th className="py-3 px-4">Categoría</th>
                      <th className="py-3 px-4 text-right">Tarifa Particular</th>
                      <th className="py-3 px-4 text-right">Tarifa HUN 2024</th>
                      <th className="py-3 px-4 text-right">Tarifa Egresados</th>
                      <th className="py-3 px-4 text-center w-24">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {tariffs.map((item) => {
                      const isCopied = copiedTariffId === item.id;
                      let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
                      if (item.category === 'CONSULTA') badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
                      else if (item.category === 'TELEMEDICINA') badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
                      else if (item.category === 'REHABILITACION') badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      else if (item.category === 'IMAGENES_DX') badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
                      else if (item.category === 'LABORATORIO') badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';

                      return (
                        <tr key={item.id} className="hover:bg-blue-50/40 transition group">
                          <td className="py-3 px-4 font-mono font-bold text-[#00A3E0] whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200">
                              {item.cups}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 max-w-md">
                            {item.description}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeColor}`}>
                              {item.categoryLabel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-700 font-mono text-sm whitespace-nowrap">
                            {formatCOP(item.particularFee)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600 font-mono whitespace-nowrap">
                            {formatCOP(item.hun2024Fee)}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-600 font-mono whitespace-nowrap">
                            {formatCOP(item.egresadosFee)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleCopyTariff(item)}
                              title="Copiar información de la tarifa"
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 hover:bg-[#051650] text-slate-700 hover:text-white'
                              }`}
                            >
                              {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{isCopied ? '¡Listo!' : 'Copiar'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación de Tarifas */}
            {tariffTotalPages > 1 && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Página {tariffPage} de {tariffTotalPages} ({tariffTotal.toLocaleString('es-CO')} tarifas en total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTariffPage((p) => Math.max(1, p - 1))}
                    disabled={tariffPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 transition font-semibold cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setTariffPage((p) => Math.min(tariffTotalPages, p + 1))}
                    disabled={tariffPage === tariffTotalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-50 transition font-semibold cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL / DRAWER DE FICHA PARA EL PACIENTE */}
      {selectedProcedure && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Cabecera del modal */}
            <div className="p-5 bg-[#051650] text-white flex items-start justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#00A3E0] text-white inline-block mb-1.5">
                  {selectedProcedure.packageId} · {selectedProcedure.area}
                </span>
                <h3 className="text-base font-black leading-snug">{selectedProcedure.name}</h3>
                {selectedProcedure.mainCups && (
                  <p className="text-xs text-sky-200 font-mono mt-1">CUPS Principal: {selectedProcedure.mainCups}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedProcedure(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Tarjetas de parámetros rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Ayuno</span>
                  <p className="font-extrabold text-slate-800">{selectedProcedure.fasting || 'No especificado'}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Anticoagulantes</span>
                  <p className="font-extrabold text-slate-800">
                    {selectedProcedure.stopAnticoagulants === 'Sí' ? '⚠️ Suspender' : 'Continuar'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Vía / Acceso</span>
                  <p className="font-extrabold text-slate-800 truncate" title={selectedProcedure.venousAccess || '—'}>
                    {selectedProcedure.venousAccess || '—'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Tiempo Estimado</span>
                  <p className="font-extrabold text-slate-800">
                    {selectedProcedure.durationMinutes ? `${selectedProcedure.durationMinutes} min` : 'Estándar'}
                  </p>
                </div>
              </div>

              {/* Laboratorios Requeridos */}
              {selectedProcedure.requiredLabs && selectedProcedure.requiredLabs !== 'No registrado' && selectedProcedure.requiredLabs !== '—' && (
                <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-950">
                  <h4 className="font-bold flex items-center gap-1.5 mb-1 text-rose-900">
                    <Beaker className="w-4 h-4 text-rose-600" />
                    Laboratorios Clínicos Obligatorios Previos
                  </h4>
                  <p className="font-semibold text-rose-800">{selectedProcedure.requiredLabs}</p>
                  {selectedProcedure.labCups && selectedProcedure.labCups.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-rose-200/60 flex flex-wrap gap-1">
                      {selectedProcedure.labCups.map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-white text-rose-900 font-mono text-[10px] font-bold rounded border border-rose-200">
                          CUPS {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Texto de WhatsApp preparado para el paciente */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#00A3E0]" />
                    Texto Formateado para WhatsApp / Paciente:
                  </label>
                  <button
                    onClick={handleCopyInstruction}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedInstruction ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedInstruction ? '¡Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={8}
                  value={loadingInstruction ? 'Generando mensaje institucional...' : procedureInstruction}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-[11px] text-slate-800 leading-relaxed focus:outline-none"
                />
              </div>

              {/* Códigos CUPS Desglosados */}
              {selectedProcedure.codes && selectedProcedure.codes.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">Desglose de Códigos CUPS Vinculados:</h4>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {selectedProcedure.codes.map((c) => (
                      <div key={c.id} className="p-2.5 bg-white flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-blue-700">{c.cups}</span>
                          <span className="text-slate-700 ml-2 font-medium">{c.name}</span>
                        </div>
                        {c.suggestedRole && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {c.suggestedRole}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pie del modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setSelectedProcedure(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={handleCopyInstruction}
                className="px-4 py-2 rounded-xl bg-[#00A3E0] hover:bg-[#008cc2] text-white font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                {copiedInstruction ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedInstruction ? 'Copiado al portapapeles' : 'Copiar para el Paciente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
