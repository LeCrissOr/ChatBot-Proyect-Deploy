import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  Clock,
  Phone,
  AlertCircle,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  SupportTicket,
  fetchTickets,
  deleteTicket,
  clearTickets,
  socket,
} from '../lib/api';
import { translateTicketStatus, translateTicketPriority, translateTicketType } from '../lib/translations';

export const TicketsTab: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SupportTicket | null>(null);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScope, setClearScope] = useState<'ALL' | 'NON_CRITICAL'>('ALL');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadTickets = () => {
    fetchTickets().then(setTickets).catch(console.error);
  };

  useEffect(() => {
    loadTickets();

    socket.on('tickets_updated', (updatedTickets: SupportTicket[]) => {
      setTickets(updatedTickets);
    });

    socket.on('critical_alarm', () => {
      loadTickets();
    });

    return () => {
      socket.off('tickets_updated');
      socket.off('critical_alarm');
    };
  }, []);

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      await deleteTicket(deleteTarget.id);
      setDeleteTarget(null);
      loadTickets();
    } catch (err) {
      console.error('Error al eliminar ticket:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearTickets = async () => {
    setIsProcessing(true);
    try {
      await clearTickets(clearScope);
      setShowClearModal(false);
      loadTickets();
    } catch (err) {
      console.error('Error al limpiar tickets:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Registro de Excepciones (E-001 a E-010) y Alarmas Clínicas
          </h2>
          <p className="text-xs text-slate-500">
            Tickets automáticos generados por el bot para intervención de Auxiliares de Enfermería, Agendamiento y Experiencia de Usuario.
          </p>
        </div>

        {tickets.length > 0 && (
          <button
            onClick={() => setShowClearModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition border border-red-200 shadow-xs cursor-pointer"
            title="Limpiar registro de tickets y alarmas"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Limpiar Registro</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        {tickets.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No hay tickets o excepciones registradas.
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="p-3 font-semibold">Prioridad</th>
                <th className="p-3 font-semibold">ID / Tipo de Excepción</th>
                <th className="p-3 font-semibold">Paciente</th>
                <th className="p-3 font-semibold">Descripción del Evento</th>
                <th className="p-3 font-semibold">SLA de Respuesta</th>
                <th className="p-3 font-semibold">Estado</th>
                <th className="p-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((tkt) => {
                const isCritical = tkt.priority === 'CRITICAL';
                const isHigh = tkt.priority === 'HIGH';

                return (
                  <tr
                    key={tkt.id}
                    className={`transition-colors ${
                      isCritical ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="p-3">
                      {isCritical ? (
                        <span className="px-2.5 py-1 rounded bg-red-600 text-white font-bold text-xs animate-pulse flex items-center w-fit">
                          <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Crítica
                        </span>
                      ) : isHigh ? (
                        <span className="px-2.5 py-1 rounded bg-amber-500 text-white font-bold text-xs">
                          Alta
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold text-xs">
                          Normal
                        </span>
                      )}
                    </td>

                    <td className="p-3 font-semibold text-slate-800 text-xs">
                      {translateTicketType(tkt.type)}
                    </td>

                    <td className="p-3">
                      <div className="font-semibold text-slate-900 text-xs">
                        {tkt.contactName || 'Paciente'}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center mt-0.5">
                        <Phone className="w-3 h-3 mr-1" /> +{tkt.contactPhone}
                      </div>
                    </td>

                    <td className="p-3 text-slate-700 max-w-md text-xs">{tkt.description}</td>

                    <td className="p-3 text-slate-600 text-xs">
                      {isCritical ? (
                        <span className="font-bold text-red-700 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" /> Inmediato (&lt; 15 min)
                        </span>
                      ) : tkt.type.includes('PQRS') ? (
                        <span>2 días hábiles (Exp. Usuario)</span>
                      ) : (
                        <span>≤ 30 minutos (Auxiliar)</span>
                      )}
                    </td>

                    <td className="p-3">
                      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                        {translateTicketStatus(tkt.status)}
                      </span>
                    </td>

                    <td className="p-3 text-right">
                      <button
                        onClick={() => setDeleteTarget(tkt)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Eliminar este ticket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Eliminar Ticket Individual */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center">
              <Trash2 className="w-4 h-4 mr-1.5 text-red-600" />
              ¿Eliminar este ticket?
            </h3>
            <p className="text-xs text-slate-500 mb-2 leading-relaxed">
              Se eliminará el ticket <strong className="text-slate-800 font-mono">{deleteTarget.type}</strong> de{' '}
              <strong className="text-slate-800">{deleteTarget.contactName || 'Paciente'}</strong>.
            </p>
            <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-4 truncate">
              {deleteTarget.description}
            </div>
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

      {/* Modal Limpiar Registro de Tickets */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-3">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Limpiar Registro de Excepciones</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Selecciona qué tickets deseas remover de la lista del panel:
            </p>

            <div className="space-y-2.5 mb-6">
              <label
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                  clearScope === 'ALL'
                    ? 'border-red-500 bg-red-50/50 text-red-900 ring-1 ring-red-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="clearScope"
                  checked={clearScope === 'ALL'}
                  onChange={() => setClearScope('ALL')}
                  className="mt-0.5 mr-3 text-red-600 focus:ring-red-500"
                />
                <div>
                  <div className="font-semibold text-xs text-red-900">
                    Vaciar todo el registro de tickets y alarmas (Reset total)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Elimina todos los tickets registrados (incluyendo alarmas de prueba) para dejar la bandeja limpia desde cero.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3 rounded-lg border cursor-pointer transition ${
                  clearScope === 'NON_CRITICAL'
                    ? 'border-blue-500 bg-blue-50/50 text-blue-900 ring-1 ring-blue-500'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="clearScope"
                  checked={clearScope === 'NON_CRITICAL'}
                  onChange={() => setClearScope('NON_CRITICAL')}
                  className="mt-0.5 mr-3 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="font-semibold text-xs text-slate-900">
                    Conservar alarmas críticas (Solo limpiar tickets no críticos)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Conserva las alertas médicas críticas activas y remueve únicamente los tickets ordinarios de soporte y cotización.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearTickets}
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

