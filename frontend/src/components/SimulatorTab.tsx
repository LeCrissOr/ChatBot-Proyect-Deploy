import React, { useState, useEffect, useRef } from 'react';
import { Send, Smartphone, Sparkles, RefreshCw, CheckCheck, Clock, XCircle, X, ChevronRight, Menu } from 'lucide-react';
import {
  simulateMessage,
  fetchMessages,
  fetchConversations,
  triggerInactivityWarning,
  triggerInactivityClose,
  Message,
  socket,
} from '../lib/api';

export const SimulatorTab: React.FC = () => {
  const [phone, setPhone] = useState('573109998877');
  const [patientName, setPatientName] = useState('Andrés Felipe Morales');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSheet, setActiveSheet] = useState<{
    title: string;
    options: Array<{ id: string; title: string; description?: string }>;
  } | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const loadChat = async () => {
    try {
      setLoading(true);
      setError('');
      await simulateMessage(phone, 'hola', patientName);
      await refreshMessages(phone);
    } catch (err) {
      console.error('Error iniciando simulador:', err);
      setError('No se pudo iniciar el simulador. Verifica que el backend esté activo y que la sesión siga vigente.');
    } finally {
      setLoading(false);
    }
  };

  const refreshMessages = async (phoneToFind = phone) => {
    const convs = await fetchConversations();
    const match = convs.find((c) => c.contact?.phone === phoneToFind.replace(/\D/g, ''));
    if (match) setMessages(await fetchMessages(match.id));
  };

  useEffect(() => {
    // Escuchar mensajes entrantes del socket
    const handleNewMessage = (msg: Message) => {
      setMessages((prev) => {
        if (!prev.some((m) => m.id === msg.id)) {
          return [...prev, msg];
        }
        return prev;
      });
    };

    socket.on('new_message', handleNewMessage);
    const handleMessageUpdated = (msg: Message) => {
      setMessages((current) => current.map((item) => item.id === msg.id ? { ...item, ...msg } : item));
    };
    socket.on('message_updated', handleMessageUpdated);
    return () => {
      socket.off('new_message');
      socket.off('message_updated', handleMessageUpdated);
    };
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    setInputText('');
    setLoading(true);
    setError('');

    try {
      await simulateMessage(phone, text.trim(), patientName);
      await refreshMessages();
    } catch (err) {
      console.error('Error enviando mensaje en simulador:', err);
      setError('No se pudo enviar el mensaje. Revisa la conexión con el backend.');
    } finally {
      setLoading(false);
    }
  };

  const resetSimulation = async () => {
    const newPhone = `57310${Math.floor(1000000 + Math.random() * 9000000)}`;
    setPhone(newPhone);
    setMessages([]);
    setLoading(true);
    setError('');
    try {
      await simulateMessage(newPhone, 'hola', patientName);
      await refreshMessages(newPhone);
    } catch (err) {
      console.error('Error reiniciando simulador:', err);
      setError('No se pudo reiniciar la simulación.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateInactivityWarning = async () => {
    try {
      setLoading(true);
      const convs = await fetchConversations();
      const match = convs.find((c) => c.contact?.phone === phone);
      if (match) {
        await triggerInactivityWarning(match.id);
      }
    } catch (err) {
      console.error('Error simulando advertencia de inactividad:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateInactivityClose = async () => {
    try {
      setLoading(true);
      const convs = await fetchConversations();
      const match = convs.find((c) => c.contact?.phone === phone);
      if (match) {
        await triggerInactivityClose(match.id);
      }
    } catch (err) {
      console.error('Error simulando cierre por inactividad:', err);
    } finally {
      setLoading(false);
    }
  };

  // Botones de acceso rápido para probar flujos del HUN
  const quickActions = [
    { label: '🏥 Inicio / Saludo', text: 'hola' },
    { label: '👤 1️⃣ Paciente Particular', text: '1' },
    { label: '🪪 1️⃣ Cédula de Ciudadanía', text: '1' },
    { label: '📄 Cédula Registrada HUN', text: '1020304050' },
    { label: '✅ 1️⃣ Sí (Datos Correctos)', text: '1' },
    { label: '✏️ 2️⃣ No (Corregir Datos)', text: '2' },
    { label: '🔢 1️⃣ Corregir Documento', text: '1' },
    { label: '📝 Nuevo Doc: 123456', text: '123456' },
    { label: '✅ 1️⃣ Sí (Confirmar Corrección)', text: '1' },
    { label: '❌ 2️⃣ No (Finalizar Correcciones)', text: '2' },
    { label: '🙋‍♂️ 1️⃣ Cita es para mí', text: '1' },
    { label: '👥 2️⃣ Cita para alguien más', text: '2' },
    { label: '🪪 1️⃣ TI Paciente Tercero', text: '2' },
    { label: '📄 Doc Paciente: 1098765432', text: '1098765432' },
    { label: '👤 Nombre: Juan David Ortiz', text: 'Juan David Ortiz' },
    { label: '📱 Tel: 3209876543', text: '3209876543' },
    { label: '🏙️ Ciudad: Bogotá', text: 'Bogotá' },
    { label: '🏥 Menú Principal', text: 'menu' },
    { label: '1️⃣ Cita Médica', text: '1' },
    { label: '   ↳ 1️⃣ Agendar Cita Médica', text: '1' },
    { label: '   ↳ 2️⃣ Reprogramar Cita', text: '2' },
    { label: '   ↳ 3️⃣ Cancelar Cita', text: '3' },
    { label: '   ↳ 4️⃣ Contactar Asesor', text: '4' },
    { label: '   ↳ 5️⃣ Volver al Menú', text: '5' },
    { label: '2️⃣ Laboratorios Clínicos', text: '2' },
    { label: '3️⃣ Radiología e Imágenes', text: '3' },
    { label: '4️⃣ Cotizar Cirugías (F-02)', text: '4' },
    { label: '5️⃣ Contactar con Asesor', text: '5' },
    { label: '🚨 Signo de Alarma Post-Qx', text: 'Sí, tengo fiebre 38.5 y dolor agudo en la herida' },
    { label: '⭐ NPS 2 Estrellas (PQRS E-009)', text: '2' },
    { label: '🇬🇧 Paciente Extranjero (E-008)', text: 'Hello, I want to book an appointment with a doctor' },
    { label: '⏱️ Responder "Sí, continuar"', text: 'Sí, deseo continuar con mi solicitud' },
    { label: '❌ Responder "Cancelar cita"', text: 'cancelar' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Columna Izquierda: Panel de Control del Simulador */}
      <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 text-blue-700">
          <Smartphone className="w-5 h-5" />
          <h3 className="font-bold text-sm text-slate-900">Simulador WhatsApp HUN</h3>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Prueba el árbol de decisiones completo del Hospital Universitario Nacional (HUN) sin necesidad de configurar números de Meta ni túneles ngrok.
        </p>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Número de WhatsApp simulado:
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nombre del Paciente:
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={resetSimulation}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center justify-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Reiniciar con nuevo paciente
          </button>
        </div>

        {/* Simulación de Inactividad */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <label className="block text-xs font-semibold text-slate-700">
            Simulación de Inactividad (Regla 10 minutos):
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSimulateInactivityWarning}
              className="px-2 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded text-xs font-medium transition flex items-center justify-center"
              title="Preguntar ¿Sigues en línea? como si hubieran pasado 10 minutos"
            >
              <Clock className="w-3.5 h-3.5 mr-1 text-orange-500" />
              ¿Sigue en línea?
            </button>
            <button
              onClick={handleSimulateInactivityClose}
              className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium transition flex items-center justify-center"
              title="Cerrar conversación y marcar Cancelado por Usuario"
            >
              <XCircle className="w-3.5 h-3.5 mr-1 text-red-500" />
              Cerrar Inactivo
            </button>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="pt-3 border-t border-slate-100">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Pruebas rápidas de los flujos HUN:
          </label>
          <div className="flex flex-col gap-1.5">
            {quickActions.map((qa, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qa.text)}
                className="w-full text-left px-3 py-1.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded text-xs font-medium transition flex items-center justify-between"
              >
                <span>{qa.label}</span>
                <Sparkles className="w-3 h-3 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Columna Derecha: Mockup de Celular WhatsApp */}
      <div className="lg:col-span-8 flex justify-center">
        <div className="w-full max-w-md bg-[#efeae2] rounded-3xl shadow-xl border-8 border-slate-800 overflow-hidden flex flex-col h-[700px] relative">
          {/* Barra Superior WhatsApp */}
          <div className="bg-[#075e54] text-white px-4 py-3 flex items-center space-x-3 shadow-md">
            <div className="w-9 h-9 rounded-full bg-white overflow-hidden p-0.5 shadow flex-shrink-0 flex items-center justify-center border border-white/40">
              <img src="/nicol-sticker-clean.png" alt="Nicol Asistente HUN" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm leading-tight truncate flex items-center gap-1.5">
                <span>Hospital Universitario Nal</span>
                <span className="text-[10px] bg-emerald-700/80 px-1.5 py-0.2 rounded-full font-medium text-emerald-100">Nicol</span>
              </h4>
              <p className="text-[11px] text-emerald-200 flex items-center">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mr-1"></span>
                en línea (Cuenta de Empresa Oficial)
              </p>
            </div>
          </div>

          {/* Área de Conversación */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5">
            {messages.length === 0 ? (
              <div className="bg-[#fff3cd] text-amber-900 text-xs p-3 rounded-lg text-center shadow-sm">
                Pulsa <strong>"Menú Principal"</strong> en el panel izquierdo o escribe <strong>"hola"</strong> abajo para iniciar la conversación con el bot.
              </div>
            ) : (
              messages.map((m) => {
                const isUser = m.sender === 'USER';
                const isAgent = m.sender === 'AGENT';
                const hasNicolFused = Boolean(!isUser && m.mediaUrl && (m.mediaUrl.includes('nicol') || m.mediaUrl.includes('Nicol')));
                const isStandaloneSticker = Boolean(m.mediaUrl && !m.content && !hasNicolFused);

                // OPCIÓN A: Mascota Nicol Fusionada en la Esquina Superior Derecha (Pop-Out 3D)
                if (hasNicolFused) {
                  return (
                    <div
                      key={m.id}
                      className="relative pt-7 flex justify-start my-2.5"
                    >
                      {/* Nicol asomándose en 3D por la esquina superior derecha */}
                      <div className="absolute -top-7 right-2 z-10 w-22 sm:w-26 pointer-events-none transition-transform duration-200 hover:scale-105 filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.22)]">
                        <img
                          src={m.mediaUrl}
                          alt="Nicol Saludo HUN"
                          className="w-full h-auto object-contain"
                        />
                      </div>

                      {/* Burbuja con Padding Derecho para el texto */}
                      <div className="bg-white text-slate-900 rounded-2xl rounded-tl-none p-3 pr-14 text-xs leading-relaxed shadow-sm max-w-[88%] relative z-0 border border-slate-200/70">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#075e54] mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00a884]"></span>
                          <span>Hospital Universitario Nacional - HUN</span>
                        </div>

                        <div className="whitespace-pre-wrap text-slate-800 leading-relaxed font-normal">
                          {m.content?.replace(/\*\*/g, '')}
                        </div>

                        <div className="text-[9px] text-slate-400 mt-1.5 flex items-center justify-end space-x-1">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Renderizado de Sticker Independiente
                if (isStandaloneSticker && m.mediaUrl) {
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'} my-1`}
                    >
                      <div className="relative group max-w-[170px] flex flex-col items-start">
                        <div className="relative hover:scale-105 transition-transform duration-200">
                          <img
                            src={m.mediaUrl}
                            alt="Sticker"
                            className="w-full h-auto max-h-44 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)]"
                          />
                        </div>
                        <div className="text-[9px] text-slate-500 bg-white/80 backdrop-blur-xs px-1.5 py-0.5 rounded-full mt-0.5 flex items-center gap-1 shadow-2xs">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isUser && <CheckCheck className="w-3 h-3 text-blue-500" />}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-lg p-2.5 text-xs leading-relaxed shadow-sm relative ${
                        isUser
                          ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none'
                          : isAgent
                          ? 'bg-indigo-100 text-indigo-950 rounded-tl-none border border-indigo-200'
                          : 'bg-white text-slate-900 rounded-tl-none'
                      }`}
                    >
                      {isAgent && (
                        <div className="text-[10px] font-bold text-indigo-700 mb-1">
                          👤 Auxiliar de Atención HUN:
                        </div>
                      )}

                      {/* Imagen si existe y no es sticker */}
                      {m.mediaUrl && (
                        <div className="mb-1.5 rounded overflow-hidden border border-slate-100">
                          <img src={m.mediaUrl} alt="Adjunto" className="w-full max-h-40 object-cover" />
                        </div>
                      )}

                      {m.content && (
                        <div className="whitespace-pre-wrap">{m.content?.replace(/\*\*/g, '')}</div>
                      )}

                      {/* Botones Interactivos / Quick Replies en la burbuja */}
                      {!isUser && m.interactivePayload?.type === 'button' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                          {m.interactivePayload.options.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleSendMessage(opt.title.replace(/^[^\w\s]+\s*/, '').trim() || opt.id)}
                              disabled={loading}
                              className="px-2.5 py-1.5 bg-[#f0f9f6] hover:bg-[#00a884] text-[#00a884] hover:text-white border border-[#00a884]/40 rounded-lg text-[11px] font-semibold transition flex items-center justify-center shadow-xs active:scale-95 disabled:opacity-50"
                            >
                              {opt.title}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Botón Disparador de Hoja de Opciones (List Message Bottom Sheet) */}
                      {!isUser && m.interactivePayload?.type === 'list' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveSheet({
                                title: m.interactivePayload?.title || 'Opciones',
                                options: m.interactivePayload?.options || [],
                              })
                            }
                            className="w-full py-2 px-3 bg-[#e7f7f2] hover:bg-[#d1f2e6] text-[#075e54] font-bold text-xs rounded-xl border border-[#00a884]/30 flex items-center justify-between shadow-xs transition active:scale-[0.98]"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Menu className="w-3.5 h-3.5 text-[#00a884]" />
                              <span>{m.interactivePayload.buttonText || '📋 Ver Menú de Opciones'}</span>
                            </span>
                            <ChevronRight className="w-4 h-4 text-[#00a884]" />
                          </button>
                        </div>
                      )}

                      <div className="text-[9px] text-slate-400 mt-1.5 flex items-center justify-end space-x-1">
                        <span>
                          {new Date(m.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isUser && <CheckCheck className="w-3 h-3 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input de Mensaje estilo WhatsApp */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-[#f0f2f5] flex items-center space-x-2 border-t border-slate-200 relative z-10"
          >
            <input
              type="text"
              placeholder="Escribe un mensaje aquí..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-white px-3.5 py-2 text-xs rounded-full border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-50 text-white flex items-center justify-center shadow transition"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>

          {/* Menú Desplegable Nativo (Bottom Sheet Modal - Idéntico a WhatsApp) */}
          {activeSheet && (
            <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-[2px] transition-all animate-in fade-in duration-150">
              <div
                className="bg-white rounded-t-3xl shadow-2xl max-h-[85%] flex flex-col border-t border-slate-200 animate-in slide-in-from-bottom duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Cabecera del Bottom Sheet */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#00a884]" />
                    <h5 className="font-bold text-slate-900 text-sm">{activeSheet.title}</h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Subtítulo institucional */}
                <div className="px-5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 font-medium flex items-center justify-between">
                  <span>Opciones oficiales del HUN</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
                    Toca para seleccionar
                  </span>
                </div>

                {/* Lista de Filas del Menú */}
                <div className="overflow-y-auto p-2 space-y-1 divide-y divide-slate-100">
                  {activeSheet.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        const valToSend = opt.title.replace(/^[^\w\s]+\s*/, '').trim() || opt.id;
                        setActiveSheet(null);
                        handleSendMessage(valToSend);
                      }}
                      className="w-full text-left p-3 hover:bg-emerald-50/60 rounded-xl transition flex items-start gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-emerald-100/70 text-emerald-800 font-bold text-xs flex items-center justify-center flex-shrink-0 group-hover:bg-[#00a884] group-hover:text-white transition shadow-xs">
                        {opt.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 text-xs group-hover:text-emerald-800 transition">
                          {opt.title}
                        </div>
                        {opt.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-snug">
                            {opt.description}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 mt-1 flex-shrink-0 transition" />
                    </button>
                  ))}
                </div>

                {/* Pie del modal */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveSheet(null)}
                    className="w-full py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
                  >
                    Cerrar ventana
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
