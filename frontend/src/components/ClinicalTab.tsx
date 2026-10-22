import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Scissors,
  CheckCircle,
  Clock,
  FileText,
  Phone,
  XCircle,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Download,
  Search,
  User,
  GraduationCap,
  Building2,
} from 'lucide-react';
import {
  Appointment,
  SurgicalQuote,
  fetchAppointments,
  fetchQuotes,
  deleteAppointment,
  clearAppointments,
  deleteQuote,
  clearQuotes,
  socket,
  downloadAppointmentsExcel,
} from '../lib/api';
import { translatePaymentStatus, translateAppointmentStatus } from '../lib/translations';

export const ClinicalTab: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [quotes, setQuotes] = useState<SurgicalQuote[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'APPOINTMENTS' | 'QUOTES'>('APPOINTMENTS');
  const [doctorFilter, setDoctorFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modales de eliminación
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'APPOINTMENT' | 'QUOTE';
    id: string;
    name: string;
    details?: string;
  } | null>(null);
  const [showClearAptsModal, setShowClearAptsModal] = useState(false);
  const [clearAptsScope, setClearAptsScope] = useState<'CANCELLED' | 'ALL'>('CANCELLED');
  const [showClearQuotesModal, setShowClearQuotesModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const matchesStatus = (status: string) => {
    if (statusFilter === 'ALL') return true;
    const s = (status || '').toUpperCase();
    if (statusFilter === 'CONFIRMED') {
      return s === 'CONFIRMED' || s === 'PAID_VIRTUAL' || s === 'PAY_AT_WINDOW' || s === 'CONFIRMADA';
    }
    if (statusFilter === 'PENDING') {
      return s === 'PENDING_PAYMENT' || s === 'PENDING' || s === 'HELD';
    }
    if (statusFilter === 'RESCHEDULED') {
      return s === 'RESCHEDULED';
    }
    if (statusFilter === 'CANCELLED') {
      return s === 'CANCELLED_BY_USER' || s === 'CANCELLED';
    }
    return true;
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch =
      !doctorFilter.trim() ||
      apt.doctorName.toLowerCase().includes(doctorFilter.toLowerCase().trim()) ||
      (apt.contactName && apt.contactName.toLowerCase().includes(doctorFilter.toLowerCase().trim())) ||
      apt.specialty.toLowerCase().includes(doctorFilter.toLowerCase().trim());

    return matchesSearch && matchesStatus(apt.status);
  });

  const loadData = () => {
    fetchAppointments().then(setAppointments).catch(console.error);
    fetchQuotes().then(setQuotes).catch(console.error);
  };

  useEffect(() => {
    loadData();

    socket.on('appointments_updated', (updatedApts: Appointment[]) => {
      setAppointments(updatedApts);
    });

    socket.on('quotes_updated', (updatedQuotes: SurgicalQuote[]) => {
      setQuotes(updatedQuotes);
    });

    socket.on('conversation_updated', () => {
      loadData();
    });

    return () => {
      socket.off('appointments_updated');
      socket.off('quotes_updated');
      socket.off('conversation_updated');
    };
  }, []);

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      if (deleteTarget.type === 'APPOINTMENT') {
        await deleteAppointment(deleteTarget.id);
      } else {
        await deleteQuote(deleteTarget.id);
      }
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Error al eliminar registro:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearAppointments = async () => {
    setIsProcessing(true);
    try {
      await clearAppointments(clearAptsScope);
      setShowClearAptsModal(false);
      loadData();
    } catch (err) {
      console.error('Error al limpiar citas:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearQuotes = async () => {
    setIsProcessing(true);
    try {
      await clearQuotes();
      setShowClearQuotesModal(false);
      loadData();
    } catch (err) {
      console.error('Error al limpiar cotizaciones:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Sub-tabs y Botones de Acción */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div className="flex space-x-3">
          <button
            onClick={() => setActiveSubTab('APPOINTMENTS')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'APPOINTMENTS'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Citas Confirmadas (F-01 / F-03) · {appointments.length}</span>
          </button>

          <button
            onClick={() => setActiveSubTab('QUOTES')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
              activeSubTab === 'QUOTES'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Scissors className="w-4 h-4" />
            <span>Cotizaciones Quirúrgicas (F-02) · {quotes.length}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSubTab === 'APPOINTMENTS' && (
            <>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-60">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Filtrar por médico o paciente..."
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Todos los estados</option>
                <option value="CONFIRMED">🟢 Confirmadas / Pagadas</option>
                <option value="PENDING">⏳ Pendientes de Pago</option>
                <option value="RESCHEDULED">🔄 Reagendadas</option>
                <option value="CANCELLED">❌ Canceladas por Usuario</option>
              </select>
            </>
          )}
          {activeSubTab === 'APPOINTMENTS' && appointments.length > 0 && (
            <button
              onClick={() => void downloadAppointmentsExcel(filteredAppointments).catch((error) => console.error('No se pudo exportar el Excel de citas:', error))}
              className="flex items-center space-x-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              title="Descargar datos y estados de las citas en Excel"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar Excel</span>
            </button>
          )}
          {activeSubTab === 'APPOINTMENTS' && appointments.length > 0 && (
            <button
              onClick={() => setShowClearAptsModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition border border-red-200 shadow-xs cursor-pointer"
              title="Limpiar citas médicas"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Limpiar Citas</span>
            </button>
          )}

          {activeSubTab === 'QUOTES' && quotes.length > 0 && (
            <button
              onClick={() => setShowClearQuotesModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition border border-red-200 shadow-xs cursor-pointer"
              title="Limpiar cotizaciones quirúrgicas"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Limpiar Cotizaciones</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Citas */}
      {activeSubTab === 'APPOINTMENTS' && (
        <div className="overflow-x-auto">
          {filteredAppointments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              {doctorFilter || statusFilter !== 'ALL'
                ? `No se encontraron citas para los filtros seleccionados.`
                : 'No hay citas agendadas aún. Puedes generar una desde el simulador de WhatsApp.'}
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-3 font-semibold">Paciente</th>
                  <th className="p-3 font-semibold">Tipo de Usuario</th>
                  <th className="p-3 font-semibold">Especialidad</th>
                  <th className="p-3 font-semibold">Médico Especialista</th>
                  <th className="p-3 font-semibold">Horario Agendado</th>
                  <th className="p-3 font-semibold">Tarifa / Pago</th>
                  <th className="p-3 font-semibold">Tipo de Ruta</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.map((apt) => (
                  <tr key={apt.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{apt.contactName || 'Paciente Particular'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center mt-0.5">
                        <Phone className="w-3 h-3 mr-1" /> +{apt.contactPhone}
                      </div>
                    </td>
                    <td className="p-3">
                      {apt.userTypeCode === 'EGRESADO_UNAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <GraduationCap className="w-3 h-3 text-emerald-600" /> Egresado UNAL
                        </span>
                      ) : apt.userTypeCode === 'COLABORADOR_HUN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Building2 className="w-3 h-3 text-indigo-600" /> Colaborador HUN
                        </span>
                      ) : apt.userTypeCode === 'OTRO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Otro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          Particular
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{apt.specialty}</td>
                    <td className="p-3 text-slate-600">{apt.doctorName}</td>
                    <td className="p-3 text-slate-600">
                      {new Date(apt.dateTime).toLocaleDateString([], {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">
                        ${Number(apt.price).toLocaleString('es-CO')} COP
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {translatePaymentStatus(apt.paymentStatus)}
                      </span>
                    </td>
                    <td className="p-3">
                      {apt.isReferral ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                          Referido F-03
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-xs">
                          Ambulatorio F-01
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {apt.status === 'CANCELLED_BY_USER' || apt.status === 'CANCELLED' ? (
                        <span className="inline-flex items-center text-red-700 bg-red-100 border border-red-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs">
                          <XCircle className="w-3.5 h-3.5 mr-1 text-red-600" /> Cancelado por Usuario
                        </span>
                      ) : apt.status === 'RESCHEDULED' ? (
                        <span className="inline-flex items-center text-blue-700 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs">
                          Reagendada
                        </span>
                      ) : apt.status === 'PENDING_PAYMENT' || apt.status === 'PENDING' ? (
                        <span className="inline-flex items-center text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs">
                          Pendiente de Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Confirmada
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'APPOINTMENT',
                            id: apt.id,
                            name: apt.contactName || 'Paciente Particular',
                            details: `${apt.specialty} · ${apt.doctorName}`,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Eliminar cita"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tabla de Cotizaciones Quirúrgicas */}
      {activeSubTab === 'QUOTES' && (
        <div className="overflow-x-auto">
          {quotes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No hay solicitudes de cotización quirúrgica pendientes.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="p-3 font-semibold">Paciente</th>
                  <th className="p-3 font-semibold">Tipo de Usuario</th>
                  <th className="p-3 font-semibold">Procedimiento Requerido</th>
                  <th className="p-3 font-semibold">Orden Médica</th>
                  <th className="p-3 font-semibold">EPS Activa</th>
                  <th className="p-3 font-semibold">SLA Auxiliar</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((qte) => (
                  <tr key={qte.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-semibold text-slate-900">
                      <div>{qte.contactName || 'Paciente'}</div>
                      <div className="text-[10px] text-slate-400 flex items-center mt-0.5">
                        <Phone className="w-3 h-3 mr-1" /> +{qte.contactPhone}
                      </div>
                    </td>
                    <td className="p-3">
                      {qte.userTypeCode === 'EGRESADO_UNAL' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <GraduationCap className="w-3 h-3 text-emerald-600" /> Egresado UNAL
                        </span>
                      ) : qte.userTypeCode === 'COLABORADOR_HUN' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                          <Building2 className="w-3 h-3 text-indigo-600" /> Colaborador HUN
                        </span>
                      ) : qte.userTypeCode === 'OTRO' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Otro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          Particular
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-medium text-purple-950 max-w-xs">
                      {qte.procedureDescription}
                    </td>
                    <td className="p-3">
                      {qte.hasMedicalOrder ? (
                        <span className="text-emerald-700 font-semibold flex items-center">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Con Orden
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Sin Orden (F-01 previo)</span>
                      )}
                    </td>
                    <td className="p-3">
                      {qte.hasActiveEps ? (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                          EPS Sí (Sub-ruta)
                        </span>
                      ) : (
                        <span className="text-slate-500">Particular 100%</span>
                      )}
                    </td>
                    <td className="p-3 text-slate-600">
                      <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>≤ 72h hábiles</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                        Pendiente Auxiliar
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'QUOTE',
                            id: qte.id,
                            name: qte.contactName || 'Paciente',
                            details: qte.procedureDescription,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Eliminar cotización"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal para Eliminar Registro Individual */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center">
              <Trash2 className="w-4 h-4 mr-1.5 text-red-600" />
              ¿Eliminar {deleteTarget.type === 'APPOINTMENT' ? 'cita médica' : 'cotización quirúrgica'}?
            </h3>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              Se eliminará el registro de{' '}
              <strong className="text-slate-800">{deleteTarget.name}</strong> de forma permanente.
            </p>
            {deleteTarget.details && (
              <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200 mb-4 truncate">
                {deleteTarget.details}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isProcessing}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSingle}
                disabled={isProcessing}
                className="px-3.5 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Eliminar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Limpiar Citas Médicas */}
      {showClearAptsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Limpiar Citas Médicas</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Selecciona qué registros de citas deseas remover de la lista del panel administrativo:
            </p>

            <div className="space-y-2.5 mb-6">
              <label
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                  clearAptsScope === 'CANCELLED'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="clearAptsScope"
                  checked={clearAptsScope === 'CANCELLED'}
                  onChange={() => setClearAptsScope('CANCELLED')}
                  className="mt-0.5 mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Solo citas canceladas por usuario (Recomendado)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Elimina las citas que quedaron marcadas como "Cancelado por Usuario", conservando las citas confirmadas.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                  clearAptsScope === 'ALL'
                    ? 'border-red-500 bg-red-50/50 text-red-900 ring-1 ring-red-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="clearAptsScope"
                  checked={clearAptsScope === 'ALL'}
                  onChange={() => setClearAptsScope('ALL')}
                  className="mt-0.5 mr-3 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="font-semibold text-xs text-red-900">
                    Eliminar todas las citas (Reset total)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Vacía completamente la lista de citas (tanto confirmadas como canceladas) para iniciar desde cero.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearAptsModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearAppointments}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition flex items-center"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Limpiando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Confirmar Limpieza
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Limpiar Cotizaciones */}
      {showClearQuotesModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Limpiar Cotizaciones Quirúrgicas</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              ¿Estás seguro de que deseas vaciar todas las solicitudes de cotizaciones quirúrgicas registradas? Esta acción no se puede deshacer.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearQuotesModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearQuotes}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition flex items-center"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Limpiando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Confirmar Limpieza
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
