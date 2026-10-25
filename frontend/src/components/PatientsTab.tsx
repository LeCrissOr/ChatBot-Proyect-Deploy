import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Users,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckSquare,
  Square,
  MinusSquare,
  X,
  Phone,
  Mail,
  MapPin,
  Calendar,
  FileText,
  GraduationCap,
  Building2,
  ClipboardList,
  XCircle,
} from 'lucide-react';
import { Contact, Appointment, fetchContacts, fetchAppointments, deleteContact, deleteContacts, socket } from '../lib/api';
import { PatientFichaModal } from './PatientFichaModal';

export const PatientsTab: React.FC = () => {
  const [patients, setPatients] = useState<Contact[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [query, setQuery] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<string>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<Contact | null>(null);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [selectedFichaPatient, setSelectedFichaPatient] = useState<Contact | null>(null);

  const loadData = () => {
    Promise.all([fetchContacts(), fetchAppointments()])
      .then(([contactsData, aptsData]) => {
        setPatients(contactsData);
        setAppointments(aptsData);
        // Filtrar IDs seleccionados que ya no existan
        setSelectedIds((prev) => {
          const currentIds = new Set(contactsData.map((p) => p.id));
          const next = new Set<string>();
          prev.forEach((id) => {
            if (currentIds.has(id)) next.add(id);
          });
          return next;
        });
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadData();

    socket.on('contacts_updated', (updated: Contact[]) => {
      setPatients(updated);
    });

    socket.on('appointments_updated', (updatedApts: Appointment[]) => {
      setAppointments(updatedApts);
    });

    socket.on('conversation_updated', () => {
      loadData();
    });

    return () => {
      socket.off('contacts_updated');
      socket.off('appointments_updated');
      socket.off('conversation_updated');
    };
  }, []);

  const getPatientAppointmentCategory = (patient: Contact) => {
    const patientApts = appointments.filter(
      (a) =>
        a.contactId === patient.id ||
        (a.contactPhone && patient.phone && a.contactPhone.replace(/[^0-9]/g, '').includes(patient.phone.replace(/[^0-9]/g, '')))
    );

    if (patientApts.length === 0) return 'NO_APPOINTMENT';

    const hasConfirmed = patientApts.some((a) =>
      ['CONFIRMED', 'PAID_VIRTUAL', 'PAY_AT_WINDOW', 'CONFIRMADA'].includes((a.status || '').toUpperCase())
    );
    if (hasConfirmed) return 'CONFIRMED';

    const hasPending = patientApts.some((a) =>
      ['PENDING', 'PENDING_PAYMENT', 'HELD'].includes((a.status || '').toUpperCase())
    );
    if (hasPending) return 'PENDING';

    const hasRescheduled = patientApts.some((a) => (a.status || '').toUpperCase() === 'RESCHEDULED');
    if (hasRescheduled) return 'RESCHEDULED';

    const hasCancelled = patientApts.some((a) =>
      ['CANCELLED', 'CANCELLED_BY_USER'].includes((a.status || '').toUpperCase())
    );
    if (hasCancelled) return 'CANCELLED';

    return 'OTHER';
  };

  const filtered = useMemo(() => {
    return patients.filter((patient) => {
      const matchesSearch = [
        patient.name,
        patient.documentId,
        patient.phone,
        patient.email,
        patient.residenceCity,
        patient.residenceAddress,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase());

      if (!matchesSearch) return false;

      if (appointmentStatusFilter === 'ALL') return true;

      const category = getPatientAppointmentCategory(patient);
      return category === appointmentStatusFilter;
    });
  }, [patients, appointments, query, appointmentStatusFilter]);

  // Selección
  const isAllFilteredSelected = useMemo(() => {
    if (filtered.length === 0) return false;
    return filtered.every((p) => selectedIds.has(p.id));
  }, [filtered, selectedIds]);

  const isSomeFilteredSelected = useMemo(() => {
    return filtered.some((p) => selectedIds.has(p.id)) && !isAllFilteredSelected;
  }, [filtered, selectedIds, isAllFilteredSelected]);

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Deseleccionar todos los filtrados
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Seleccionar todos los filtrados
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Eliminación individual
  const handleDeleteSingle = async () => {
    if (!singleDeleteTarget) return;
    setIsProcessing(true);
    try {
      await deleteContact(singleDeleteTarget.id);
      setSingleDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(singleDeleteTarget.id);
        return next;
      });
      loadData();
    } catch (err) {
      console.error('Error al eliminar paciente:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Eliminación masiva de seleccionados
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      await deleteContacts(Array.from(selectedIds));
      setSelectedIds(new Set());
      setShowBatchDeleteModal(false);
      loadData();
    } catch (err) {
      console.error('Error al eliminar pacientes seleccionados:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="space-y-5">
      {/* Cabecera y Barra de Búsqueda */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Registro clínico institucional
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">Directorio de Pacientes</h2>
          <p className="mt-1 text-sm text-slate-500">
            Información capturada, perfilada y persistida desde el WhatsApp Bot HUN.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente, documento o teléfono..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <select
            value={appointmentStatusFilter}
            onChange={(e) => setAppointmentStatusFilter(e.target.value)}
            className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="ALL">Todos los estados de cita</option>
            <option value="CONFIRMED">🟢 Con Cita Confirmada</option>
            <option value="PENDING">⏳ Con Cita Pendiente de Pago</option>
            <option value="RESCHEDULED">🔄 Con Cita Reagendada</option>
            <option value="CANCELLED">❌ Con Cita Cancelada</option>
            <option value="NO_APPOINTMENT">⚪ Sin Cita Registrada</option>
          </select>
        </div>
      </div>

      {/* Barra de Acciones de Selección Múltiple */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/80 px-5 py-3 text-red-950 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-xs font-bold text-white shadow-xs">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold text-red-900 sm:text-sm">
              {selectedIds.size === 1
                ? '1 paciente seleccionado para eliminación'
                : `${selectedIds.size} pacientes seleccionados para eliminación`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              Deseleccionar
            </button>
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-700 active:scale-95 transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Eliminar {selectedIds.size} seleccionados</span>
            </button>
          </div>
        </div>
      )}

      {/* Contenedor Principal de la Tabla */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Cabecera de la lista */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Users className="h-4 w-4 text-blue-600" />
            <span>{filtered.length} pacientes registrados</span>
            {(query || appointmentStatusFilter !== 'ALL') && (
              <span className="text-xs font-normal text-slate-400">
                (filtrados de {patients.length} totales)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <button
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title={isAllFilteredSelected ? 'Deseleccionar todos' : 'Marcar todos los pacientes'}
              >
                {isAllFilteredSelected ? (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-blue-600" />
                    <span>Deseleccionar todos</span>
                  </>
                ) : isSomeFilteredSelected ? (
                  <>
                    <MinusSquare className="h-3.5 w-3.5 text-blue-600" />
                    <span>Marcar todos ({filtered.length})</span>
                  </>
                ) : (
                  <>
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                    <span>Marcar todos ({filtered.length})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Tabla de Pacientes */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left text-sm border-collapse">
            <thead className="bg-slate-50/90 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <span className="sr-only">Selección</span>
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isSomeFilteredSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    title="Seleccionar / Deseleccionar todos"
                  />
                </th>
                <th className="px-5 py-3 font-bold text-slate-700">Paciente</th>
                <th className="px-5 py-3 font-bold text-slate-700">Documento</th>
                <th className="px-5 py-3 font-bold text-slate-700">Tipo de Usuario</th>
                <th className="px-5 py-3 font-bold text-slate-700">Contacto</th>
                <th className="px-5 py-3 font-bold text-slate-700">Estado de Cita</th>
                <th className="px-5 py-3 font-bold text-slate-700">Residencia</th>
                <th className="px-5 py-3 font-bold text-slate-700">Actualizado</th>
                <th className="px-5 py-3 font-bold text-slate-700 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((patient) => {
                const isSelected = selectedIds.has(patient.id);
                return (
                  <tr
                    key={patient.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/60 hover:bg-blue-50/80'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Checkbox de Fila */}
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(patient.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Seleccionar paciente ${patient.name || patient.phone}`}
                      />
                    </td>

                    {/* Nombre y Estado */}
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedFichaPatient(patient)}
                          className="text-left hover:text-blue-600 hover:underline transition cursor-pointer font-bold"
                          title="Ver Ficha Completa del Paciente"
                        >
                          {patient.name || 'Pendiente de registro'}
                        </button>
                        {patient.isInternational && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                            Internacional
                          </span>
                        )}
                        {patient.hasActiveEps && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            EPS Activa
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Documento */}
                    <td className="px-5 py-4 text-slate-700">
                      {patient.documentId ? (
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-xs">
                            {patient.documentType ? `${patient.documentType} · ` : ''}
                            {patient.documentId}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Tipo de Usuario */}
                    <td className="px-5 py-4 text-slate-700">
                      {patient.userTypeCode === 'EGRESADO_UNAL' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" /> Egresado UNAL
                        </span>
                      ) : patient.userTypeCode === 'COLABORADOR_HUN' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-xs">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" /> Colaborador HUN
                        </span>
                      ) : patient.userTypeCode === 'OTRO' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-xs">
                          Otro (Asesor)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-xs">
                          Particular
                        </span>
                      )}
                    </td>

                    {/* Contacto (Teléfono y Correo) */}
                    <td className="px-5 py-4 text-slate-700">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>+{patient.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]">
                          {patient.email || 'Correo pendiente'}
                        </span>
                      </div>
                    </td>

                    {/* Estado de Cita Médica, Cancelaciones y Reagendamiento */}
                    <td className="px-5 py-4 text-slate-700">
                      {(() => {
                        const cat = getPatientAppointmentCategory(patient);
                        const cancelCount = patient.cancellationCount || 0;
                        const lastCancelReason =
                          patient.cancellationReasons && patient.cancellationReasons.length > 0
                            ? patient.cancellationReasons[0].reason
                            : undefined;
                        const wasRescheduled = Boolean(patient.wasRescheduled || (patient.rescheduleCount && patient.rescheduleCount > 0));
                        const lastRescheduleReason =
                          patient.rescheduleReasons && patient.rescheduleReasons.length > 0
                            ? patient.rescheduleReasons[0].reason
                            : undefined;

                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {cat === 'CONFIRMED' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  🟢 Cita Confirmada
                                </span>
                              ) : cat === 'PENDING' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  ⏳ Pendiente de Pago
                                </span>
                              ) : cat === 'RESCHEDULED' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                  🔄 Cita Reagendada
                                </span>
                              ) : cat === 'CANCELLED' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  ❌ Cita Cancelada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  ⚪ Sin Cita
                                </span>
                              )}

                              {wasRescheduled && cat !== 'RESCHEDULED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  <RefreshCw className="w-2.5 h-2.5" /> Reagendó ({patient.rescheduleCount || 1})
                                </span>
                              )}

                              {cancelCount > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  <XCircle className="w-2.5 h-2.5" /> {cancelCount} {cancelCount === 1 ? 'Cancelación' : 'Cancelaciones'}
                                </span>
                              )}
                            </div>

                            {lastRescheduleReason && (
                              <div className="text-[11px] text-blue-700 font-medium truncate max-w-[230px]" title={`Motivo reprogramación: ${lastRescheduleReason}`}>
                                🔄 Motivo: {lastRescheduleReason}
                              </div>
                            )}
                            {lastCancelReason && (
                              <div className="text-[11px] text-rose-700 font-medium truncate max-w-[230px]" title={`Motivo cancelación: ${lastCancelReason}`}>
                                ❌ Motivo: {lastCancelReason}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Residencia */}
                    <td className="px-5 py-4 text-slate-700">
                      {patient.residenceCity || patient.residenceAddress ? (
                        <div>
                          <div className="flex items-center gap-1 text-xs font-medium text-slate-800">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{patient.residenceCity || '—'}</span>
                          </div>
                          {patient.residenceAddress && (
                            <div className="text-xs text-slate-400 truncate max-w-[160px] pl-4">
                              {patient.residenceAddress}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Fecha de Actualización */}
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {patient.updatedAt ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{new Date(patient.updatedAt).toLocaleString('es-CO')}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Acciones Individuales */}
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedFichaPatient(patient)}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                          title="Ver Ficha de Datos del Paciente, cancelaciones y motivos"
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          <span>Ver Ficha</span>
                        </button>
                        <button
                          onClick={() => setSingleDeleteTarget(patient)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                          title="Eliminar este paciente"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-xs">
                    No hay pacientes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmación para Eliminación Individual */}
      {singleDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-base text-slate-900">¿Eliminar paciente?</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Se eliminará de forma permanente el registro de{' '}
              <strong className="text-slate-800">
                {singleDeleteTarget.name || `Tel: +${singleDeleteTarget.phone}`}
              </strong>
              , junto con sus citas, mensajes e historial asociados en el sistema.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSingleDeleteTarget(null)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSingle}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar Eliminación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Eliminación Masiva */}
      {showBatchDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-base text-slate-900">
                Eliminar {selectedIds.size} pacientes seleccionados
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              ¿Estás seguro de que deseas eliminar permanentemente los{' '}
              <strong className="text-slate-800">{selectedIds.size} pacientes marcados</strong>?
              Esta acción eliminará sus registros, citas, cotizaciones e historial de chat en PostgreSQL.
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBatchDeleteModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar {selectedIds.size} Pacientes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ficha Completa del Paciente */}
      <PatientFichaModal
        patient={
          selectedFichaPatient
            ? patients.find((p) => p.id === selectedFichaPatient.id) || selectedFichaPatient
            : null
        }
        appointments={appointments}
        onClose={() => setSelectedFichaPatient(null)}
      />
    </section>
  );
};
