import React from 'react';
import {
  X,
  User,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  XCircle,
  RefreshCw,
  CheckCircle,
  Clock,
  GraduationCap,
  Building2,
  ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { Contact, Appointment, ModificationReasonRecord } from '../lib/api';
import { translatePaymentStatus } from '../lib/translations';
import { formatPhoneDisplay } from '../lib/utils';

interface PatientFichaModalProps {
  patient: Contact | null;
  appointments: Appointment[];
  onClose: () => void;
}

export const PatientFichaModal: React.FC<PatientFichaModalProps> = ({
  patient,
  appointments,
  onClose,
}) => {
  if (!patient) return null;

  const cleanPhone = (patient.phone || '').replace(/[^0-9]/g, '');
  const patientAppointments = appointments.filter(
    (a) =>
      a.contactId === patient.id ||
      (cleanPhone &&
        a.contactPhone &&
        a.contactPhone.replace(/[^0-9]/g, '').includes(cleanPhone))
  );

  // Construir lista consolidada de motivos de cancelación
  const cancellationList: ModificationReasonRecord[] =
    patient.cancellationReasons && patient.cancellationReasons.length > 0
      ? patient.cancellationReasons
      : patientAppointments
          .filter((a) => ['CANCELLED', 'CANCELLED_BY_USER'].includes((a.status || '').toUpperCase()))
          .map((a) => ({
            appointmentId: a.id,
            specialty: a.specialty,
            doctorName: a.doctorName,
            reason:
              a.cancellationReason ||
              (a.paymentStatus?.startsWith('Cancelado:')
                ? a.paymentStatus.replace(/^Cancelado:\s*/i, '').trim()
                : 'Cancelado por el paciente'),
            date: a.createdAt,
          }));

  // Construir lista consolidada de motivos de reprogramación
  const rescheduleList: ModificationReasonRecord[] =
    patient.rescheduleReasons && patient.rescheduleReasons.length > 0
      ? patient.rescheduleReasons
      : patientAppointments
          .filter(
            (a) =>
              a.wasRescheduled ||
              (a.status || '').toUpperCase() === 'RESCHEDULED' ||
              a.paymentStatus?.startsWith('Reprogramado:')
          )
          .map((a) => ({
            appointmentId: a.id,
            specialty: a.specialty,
            doctorName: a.doctorName,
            reason:
              a.rescheduleReason ||
              (a.paymentStatus?.startsWith('Reprogramado:')
                ? a.paymentStatus.replace(/^Reprogramado:\s*/i, '').trim()
                : 'Reprogramada por el paciente'),
            date: a.dateTime,
          }));

  const cancellationCount = patient.cancellationCount ?? cancellationList.length;
  const rescheduleCount = patient.rescheduleCount ?? rescheduleList.length;
  const wasRescheduled = Boolean(patient.wasRescheduled || rescheduleCount > 0);

  const activeAppointmentsCount = patientAppointments.filter((a) =>
    ['CONFIRMED', 'RESCHEDULED', 'PAID_VIRTUAL', 'PAY_AT_WINDOW', 'PENDING', 'HELD'].includes(
      (a.status || '').toUpperCase()
    )
  ).length;

  const formattedBirthDate = patient.birthDate
    ? new Date(patient.birthDate).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'No registrada';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in zoom-in-95 duration-150">
        {/* Cabecera Institucional HUN */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 px-6 py-5 text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-lg font-black shadow-inner shrink-0">
              {patient.name
                ? patient.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'PA'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest bg-blue-500/30 border border-blue-300/30 px-2.5 py-0.5 rounded-full text-blue-100">
                  📋 Ficha de Datos del Paciente · HUN
                </span>
                {patient.userTypeCode === 'EGRESADO_UNAL' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-100 border border-emerald-300/30">
                    <GraduationCap className="w-3.5 h-3.5" /> Egresado UNAL
                  </span>
                ) : patient.userTypeCode === 'COLABORADOR_HUN' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-400/20 text-indigo-100 border border-indigo-300/30">
                    <Building2 className="w-3.5 h-3.5" /> Colaborador HUN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/15 text-white border border-white/20">
                    Paciente Particular
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black mt-1 tracking-tight">
                {patient.name || 'Paciente Pendiente de Registro'}
              </h3>
              <p className="text-xs text-blue-200 mt-0.5 flex items-center gap-2">
                <span>
                  {patient.documentType || 'Documento'}:{' '}
                  <strong className="font-mono text-white">
                    {patient.documentId || 'No registrado'}
                  </strong>
                </span>
                <span>·</span>
                <span>WhatsApp: {formatPhoneDisplay(patient.phone)}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Cerrar ficha"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="p-6 max-h-[78vh] overflow-y-auto space-y-6">
          {/* KPIs de Citas, Reprogramaciones y Cancelaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Total / Activas */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Citas Registradas
                </p>
                <p className="text-2xl font-black text-slate-900 mt-1">
                  {patientAppointments.length}
                </p>
                <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                  {activeAppointmentsCount} activa(s) actualmente
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 text-blue-700">
                <Calendar className="w-5 h-5" />
              </div>
            </div>

            {/* ¿Se Reagendó la Cita Médica? */}
            <div
              className={`rounded-xl border p-4 flex items-center justify-between ${
                wasRescheduled
                  ? 'border-blue-200 bg-blue-50/70'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  ¿Reagendó Cita Médica?
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={`text-xl font-black ${
                      wasRescheduled ? 'text-blue-700' : 'text-slate-700'
                    }`}
                  >
                    {wasRescheduled ? 'Sí, Reagendada' : 'No'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  {rescheduleCount === 1
                    ? '1 reprogramación registrada'
                    : `${rescheduleCount} reprogramaciones registradas`}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  wasRescheduled
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <RefreshCw className="w-5 h-5" />
              </div>
            </div>

            {/* Cantidad de Cancelaciones */}
            <div
              className={`rounded-xl border p-4 flex items-center justify-between ${
                cancellationCount > 0
                  ? 'border-rose-200 bg-rose-50/70'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Cancelaciones
                </p>
                <p
                  className={`text-2xl font-black mt-1 ${
                    cancellationCount > 0 ? 'text-rose-700' : 'text-slate-900'
                  }`}
                >
                  {cancellationCount}
                </p>
                <p
                  className={`text-[11px] font-semibold mt-0.5 ${
                    cancellationCount > 0 ? 'text-rose-700' : 'text-slate-500'
                  }`}
                >
                  {cancellationCount === 0
                    ? 'Sin citas canceladas'
                    : cancellationCount === 1
                    ? '1 cita cancelada con motivo'
                    : `${cancellationCount} citas canceladas con motivo`}
                </p>
              </div>
              <div
                className={`p-3 rounded-xl ${
                  cancellationCount > 0
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Ficha de Datos Personales del Paciente */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Datos Registrados en Ficha del Paciente
              </h4>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex items-start gap-2.5">
                <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Nombre Completo</span>
                  <span className="font-bold text-slate-900">
                    {patient.name || 'No registrado'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Tipo y Número de Documento
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {patient.documentType || 'Cédula de Ciudadanía'} ·{' '}
                    {patient.documentId || 'No registrado'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Fecha de Nacimiento</span>
                  <span className="font-semibold text-slate-800">{formattedBirthDate}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Teléfono / Celular</span>
                  <span className="font-semibold text-slate-800">{formatPhoneDisplay(patient.phone)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">Correo Electrónico</span>
                  <span className="font-semibold text-slate-800">
                    {patient.email || 'No registrado'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-slate-400 block text-[11px]">
                    Ciudad y Dirección de Residencia
                  </span>
                  <span className="font-semibold text-slate-800">
                    {patient.residenceCity || 'Bogotá D.C.'}
                    {patient.residenceAddress ? ` · ${patient.residenceAddress}` : ''}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Motivos de Cancelación y Reprogramación Registrados */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Panel de Motivos de Cancelación */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 overflow-hidden">
              <div className="bg-rose-100/80 px-4 py-2.5 border-b border-rose-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-900">
                    Motivos de Cancelación ({cancellationCount})
                  </h4>
                </div>
              </div>
              <div className="p-3.5 space-y-2.5">
                {cancellationList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    El paciente no registra cancelaciones de citas médicas.
                  </p>
                ) : (
                  cancellationList.map((item, idx) => (
                    <div
                      key={`${item.appointmentId}-cancel-${idx}`}
                      className="rounded-lg bg-white border border-rose-200 p-3 shadow-2xs text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.specialty}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.date).toLocaleDateString('es-CO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{item.doctorName}</p>
                      <div className="pt-1 flex items-start gap-1.5 text-rose-700 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Motivo: {item.reason}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Panel de Motivos de Reprogramación / Reagendamiento */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 overflow-hidden">
              <div className="bg-blue-100/80 px-4 py-2.5 border-b border-blue-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Citas Reagendadas y Motivos ({rescheduleCount})
                  </h4>
                </div>
              </div>
              <div className="p-3.5 space-y-2.5">
                {rescheduleList.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">
                    El paciente no ha reagendado citas médicas.
                  </p>
                ) : (
                  rescheduleList.map((item, idx) => (
                    <div
                      key={`${item.appointmentId}-resched-${idx}`}
                      className="rounded-lg bg-white border border-blue-200 p-3 shadow-2xs text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.specialty}</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          🔄 Reagendada
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">{item.doctorName}</p>
                      <div className="pt-1 flex items-start gap-1.5 text-blue-800 font-semibold">
                        <ClipboardList className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Motivo: {item.reason}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Historial Completo de Citas del Paciente */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Historial Detallado de Citas del Paciente ({patientAppointments.length})
                </h4>
              </div>
            </div>

            {patientAppointments.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Este paciente aún no registra citas médicas en el sistema.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-100">
                      <th className="p-3 font-semibold">Especialidad / Médico</th>
                      <th className="p-3 font-semibold">Fecha y Hora</th>
                      <th className="p-3 font-semibold">Estado</th>
                      <th className="p-3 font-semibold">¿Reagendada?</th>
                      <th className="p-3 font-semibold">Motivo Registrado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patientAppointments.map((apt) => {
                      const isCancelled = ['CANCELLED', 'CANCELLED_BY_USER'].includes(
                        (apt.status || '').toUpperCase()
                      );
                      const isRescheduled =
                        Boolean(apt.wasRescheduled) ||
                        (apt.status || '').toUpperCase() === 'RESCHEDULED' ||
                        apt.paymentStatus?.startsWith('Reprogramado:');

                      const reasonText = isCancelled
                        ? apt.cancellationReason ||
                          (apt.paymentStatus?.startsWith('Cancelado:')
                            ? apt.paymentStatus.replace(/^Cancelado:\s*/i, '').trim()
                            : 'Cancelado por el paciente')
                        : isRescheduled
                        ? apt.rescheduleReason ||
                          (apt.paymentStatus?.startsWith('Reprogramado:')
                            ? apt.paymentStatus.replace(/^Reprogramado:\s*/i, '').trim()
                            : 'Reprogramada por el paciente')
                        : translatePaymentStatus(apt.paymentStatus);

                      return (
                        <tr key={apt.id} className="hover:bg-slate-50/70">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{apt.specialty}</div>
                            <div className="text-[11px] text-slate-500">{apt.doctorName}</div>
                          </td>
                          <td className="p-3 text-slate-700">
                            {new Date(apt.dateTime).toLocaleDateString('es-CO', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                <XCircle className="w-3 h-3" /> Cancelada
                              </span>
                            ) : (apt.status || '').toUpperCase() === 'RESCHEDULED' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                <RefreshCw className="w-3 h-3" /> Reagendada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3" /> Confirmada
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            {isRescheduled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Sí ({apt.rescheduleCount || 1})
                              </span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                          <td className="p-3">
                            {isCancelled ? (
                              <span className="font-semibold text-rose-700">{reasonText}</span>
                            ) : isRescheduled ? (
                              <span className="font-semibold text-blue-700">{reasonText}</span>
                            ) : (
                              <span className="text-slate-500">{reasonText}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Última actualización:{' '}
              {patient.updatedAt
                ? new Date(patient.updatedAt).toLocaleString('es-CO')
                : 'Reciente'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
