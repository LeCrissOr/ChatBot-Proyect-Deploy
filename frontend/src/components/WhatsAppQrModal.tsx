import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, CheckCircle, X, RefreshCw, LogOut } from 'lucide-react';
import { WhatsAppStatus, fetchWhatsAppStatus, disconnectWhatsApp, socket } from '../lib/api';

interface WhatsAppQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WhatsAppQrModal: React.FC<WhatsAppQrModalProps> = ({ isOpen, onClose }) => {
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    status: 'DISCONNECTED',
    qrCode: null,
    qrDataUrl: null,
    connectedPhone: null,
  });
  const [loading, setLoading] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await fetchWhatsAppStatus();
      setWaStatus(data);
    } catch (err) {
      console.error('Error obteniendo estado de WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  // Navegación por teclado: Escape para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Autofoco para accesibilidad
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
      loadStatus();
    }

    const handleStatusUpdate = (status: WhatsAppStatus) => {
      setWaStatus(status);
    };

    socket.on('whatsapp_status', handleStatusUpdate);
    return () => {
      socket.off('whatsapp_status');
    };
  }, [isOpen]);

  const handleDisconnect = async () => {
    if (!window.confirm('¿Seguro que deseas desvincular esta sesión de WhatsApp Business?')) return;
    try {
      setLoading(true);
      await disconnectWhatsApp();
      await loadStatus();
    } catch (err) {
      console.error('Error desvinculando WhatsApp:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#051650] text-white p-5 flex justify-between items-center">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 flex items-center justify-center border border-white/20">
              <Smartphone className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h3 id="wa-modal-title" className="font-bold text-sm leading-tight">
                Vincular WhatsApp Business
              </h3>
              <p className="text-xs text-blue-200">Canal Institucional HUN</p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Cerrar modal de WhatsApp"
            className="text-white/70 hover:text-white rounded-lg p-1.5 hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 text-center space-y-4">
          {waStatus.status === 'CONNECTED' ? (
            <div className="py-6 space-y-3">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">¡WhatsApp Business Vinculado!</h4>
              <p className="text-xs text-slate-500">
                El bot del HUN se encuentra activo y respondiendo automáticamente desde el número:
              </p>
              <div className="inline-block bg-slate-100 px-4 py-1.5 rounded-full font-mono font-bold text-sm text-slate-800">
                +{waStatus.connectedPhone || 'Desconocido'}
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-xl transition inline-flex items-center cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Desvincular Dispositivo
                </button>
              </div>
            </div>
          ) : waStatus.qrDataUrl ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Escanea este código QR con la cámara de tu WhatsApp Business exactamente igual a como inicias sesión en <strong>WhatsApp Web</strong>:
              </p>

              {/* QR Image */}
              <div className="bg-white p-3 inline-block rounded-xl border-2 border-dashed border-[#00A3E0] shadow-md">
                <img
                  src={waStatus.qrDataUrl}
                  alt="Código QR WhatsApp"
                  className="w-56 h-56 mx-auto object-contain"
                />
              </div>

              {/* Steps */}
              <div className="bg-slate-50 p-4 rounded-xl text-left text-xs text-slate-700 space-y-2 border border-slate-200">
                <div className="font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Pasos en tu celular:
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-bold text-[#00A3E0]">1.</span>
                  <span>Abre <strong>WhatsApp Business</strong> en tu teléfono.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-bold text-[#00A3E0]">2.</span>
                  <span>Toca <strong>Ajustes</strong> (o ⋮) &gt; <strong>Dispositivos vinculados</strong>.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-bold text-[#00A3E0]">3.</span>
                  <span>Toca <strong>"Vincular un dispositivo"</strong> y apunta tu cámara al código QR.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-3">
              <RefreshCw className="w-8 h-8 text-[#00A3E0] animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                {waStatus.status === 'CONNECTING'
                  ? 'Estableciendo conexión con WhatsApp...'
                  : 'Generando nuevo código QR...'}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">Protocolo seguro multi-dispositivo</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
