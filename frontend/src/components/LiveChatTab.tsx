import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Bot,
  UserCheck,
  Send,
  ShieldAlert,
  Star,
  RefreshCw,
  Phone,
  Clock,
  XCircle,
  Trash2,
  ChevronDown,
  Search,
  SlidersHorizontal,
  CheckCheck,
  Check,
  Smile,
  Paperclip,
  AlertCircle,
} from 'lucide-react';
import {
  Conversation,
  Message,
  fetchConversations,
  fetchMessages,
  sendAgentMessage,
  takeoverChat,
  returnToBot,
  triggerPostQxAlarm,
  triggerNpsSurvey,
  triggerInactivityWarning,
  triggerInactivityClose,
  clearConversations,
  deleteConversation,
  socket,
} from '../lib/api';

const DeliveryStatus: React.FC<{ status: string; error?: string }> = ({ status, error }) => {
  if (status === 'pending') return <span title="Enviando"><Clock className="w-3.5 h-3.5 text-slate-400" /></span>;
  if (status === 'failed') return <span title={error || 'Falló el envío'}><AlertCircle className="w-3.5 h-3.5 text-red-500" /></span>;
  if (status === 'simulated') return <span title="Simulado: no hay una cuenta de WhatsApp conectada"><AlertCircle className="w-3.5 h-3.5 text-amber-500" /></span>;
  if (status === 'sent') return <span title="WhatsApp aceptó el envío; aún no hay confirmación de entrega"><Check className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} /></span>;
  const label = status === 'read' ? 'Leído' : 'Entregado';
  return <span title={label}><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={1.75} /></span>;
};

export const LiveChatTab: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'AGENT' | 'BOT' | 'ALARM'>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearScope, setClearScope] = useState<'CLOSED' | 'ALL'>('CLOSED');
  const [isClearing, setIsClearing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Cerrar menú de acciones al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carga inicial
  const loadConversations = async () => {
    try {
      const data = await fetchConversations();
      setConversations(data);
      if (!selectedConvId && data.length > 0) {
        setSelectedConvId(data[0].id);
      }
    } catch (err) {
      console.error('Error cargando conversaciones:', err);
    }
  };

  useEffect(() => {
    loadConversations();

    // Escucha en tiempo real de nuevos mensajes
    socket.on('new_message', (msg: Message) => {
      setMessages((prev) => {
        if (msg.conversationId === selectedConvId && !prev.some((m) => m.id === msg.id)) {
          return [...prev, msg];
        }
        return prev;
      });
      loadConversations();
    });
    socket.on('message_updated', (msg: Message) => {
      setMessages((current) => current.map((item) => item.id === msg.id ? { ...item, ...msg } : item));
    });

    socket.on('conversation_updated', (updated: Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
      );
    });

    socket.on('conversations_cleared', () => {
      loadConversations();
    });

    return () => {
      socket.off('new_message');
      socket.off('message_updated');
      socket.off('conversation_updated');
      socket.off('conversations_cleared');
    };
  }, [selectedConvId]);

  // Carga de mensajes de la conversación seleccionada
  useEffect(() => {
    if (!selectedConvId) return;
    setLoading(true);
    fetchMessages(selectedConvId)
      .then((msgs) => setMessages(msgs))
      .finally(() => setLoading(false));
  }, [selectedConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedConv = conversations.find((c) => c.id === selectedConvId);

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyText.trim()) return;

    try {
      const sentMsg = await sendAgentMessage(selectedConvId, replyText);
      setMessages((prev) => [...prev, sentMsg]);
      setReplyText('');
    } catch (err) {
      console.error('Error al responder:', err);
    }
  };

  const handleTakeover = async () => {
    if (!selectedConvId) return;
    const updated = await takeoverChat(selectedConvId);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleReturnToBot = async () => {
    if (!selectedConvId) return;
    const updated = await returnToBot(selectedConvId);
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleTriggerPostQx = async () => {
    if (!selectedConvId) return;
    await triggerPostQxAlarm(selectedConvId);
    setShowActionsMenu(false);
  };

  const handleTriggerNps = async () => {
    if (!selectedConvId) return;
    await triggerNpsSurvey(selectedConvId);
    setShowActionsMenu(false);
  };

  const handleTriggerInactivityWarning = async () => {
    if (!selectedConvId) return;
    await triggerInactivityWarning(selectedConvId);
    setShowActionsMenu(false);
  };

  const handleTriggerInactivityClose = async () => {
    if (!selectedConvId) return;
    await triggerInactivityClose(selectedConvId);
    setShowActionsMenu(false);
  };

  const handleClearInbox = async () => {
    setIsClearing(true);
    try {
      await clearConversations(clearScope);
      await loadConversations();
      setSelectedConvId(null);
      setMessages([]);
      setShowClearModal(false);
    } catch (err) {
      console.error('Error al limpiar la bandeja:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDeleteCurrentConversation = async () => {
    if (!selectedConvId) return;
    try {
      await deleteConversation(selectedConvId);
      setShowDeleteConfirm(false);
      setSelectedConvId(null);
      setMessages([]);
      await loadConversations();
    } catch (err) {
      console.error('Error al eliminar conversación:', err);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [c.contact?.name, c.contact?.phone, c.lastMessage?.content]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term));
    if (!matchesSearch) return false;
    if (filter === 'AGENT') return c.status === 'REQUIRES_AGENT' || c.status === 'AGENT_TAKEN';
    if (filter === 'BOT') return c.status === 'BOT';
    if (filter === 'ALARM') return c.flowData?.hasPostQxAlarm || c.currentStep === 'CRITICAL_ALARM';
    return true;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/5 overflow-hidden h-[calc(100vh-175px)] min-h-[700px] flex flex-col md:flex-row">
      {/* Columna Izquierda: Lista de Chats estilo WhatsApp Web */}
      <div className="w-full md:w-96 border-r border-[#E9EDEF] flex flex-col bg-white">
        {/* Cabecera de la Bandeja */}
        <div className="p-3.5 bg-[#F0F2F5] border-b border-[#E9EDEF] space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00A884] animate-pulse"></span>
              <h2 className="text-xs font-bold text-[#111B21] tracking-wide">
                Chats WhatsApp HUN
              </h2>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setShowClearModal(true)}
                className="text-[#54656F] hover:text-red-600 transition px-2.5 py-1 rounded-full hover:bg-red-50 flex items-center gap-1 text-xs font-medium border border-transparent hover:border-red-100 cursor-pointer"
                title="Limpiar bandeja de pacientes"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" strokeWidth={1.5} />
                <span className="text-[11px]">Limpiar</span>
              </button>
              <button
                onClick={loadConversations}
                className="text-[#54656F] hover:text-[#111B21] transition p-1.5 rounded-full hover:bg-slate-200/60 cursor-pointer"
                title="Actualizar lista de chats"
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Filtros Segmentados Suaves */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'ALL'
                  ? 'bg-[#E7FCE3] text-[#008069] font-semibold'
                  : 'bg-white text-[#54656F] hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Todos ({conversations.length})
            </button>
            <button
              onClick={() => setFilter('AGENT')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'AGENT'
                  ? 'bg-amber-100 text-amber-900 font-semibold'
                  : 'bg-white text-[#54656F] hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Auxiliar
            </button>
            <button
              onClick={() => setFilter('ALARM')}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'ALARM'
                  ? 'bg-red-100 text-red-800 font-semibold animate-pulse'
                  : 'bg-white text-[#54656F] hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Alarmas 🚨
            </button>
          </div>

          {/* Buscador WhatsApp */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8696A0]" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar paciente o mensaje..."
              aria-label="Buscar en conversaciones"
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-white border border-transparent outline-none transition focus:border-[#00A884] focus:ring-1 focus:ring-[#00A884]/30 placeholder:text-[#8696A0] text-[#111B21]"
            />
          </div>
        </div>

        {/* Lista de Conversaciones */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#F0F2F5]">
          {filteredConversations.length === 0 ? (
            <div className="p-10 text-center text-[#8696A0] text-xs">
              <Bot className="w-8 h-8 mx-auto mb-2 text-slate-300" strokeWidth={1.5} />
              No hay conversaciones en este filtro.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const hasAlarm = conv.flowData?.hasPostQxAlarm || conv.currentStep === 'CRITICAL_ALARM';
              const isAgent = conv.status === 'REQUIRES_AGENT' || conv.status === 'AGENT_TAKEN';
              const initials = conv.contact?.name
                ? conv.contact.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                : 'PA';

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`px-4 py-3.5 cursor-pointer transition-colors duration-150 flex items-start gap-3 ${
                    isSelected
                      ? 'bg-[#F0F2F5] border-l-4 border-[#00A884]'
                      : 'hover:bg-[#F5F6F6]'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs text-white shadow-xs ${
                    hasAlarm
                      ? 'bg-rose-500 animate-pulse'
                      : isSelected
                      ? 'bg-[#008069]'
                      : 'bg-slate-400'
                  }`}>
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="font-semibold text-sm text-[#111B21] truncate">
                        {conv.contact?.name || `+${conv.contact?.phone || 'Paciente'}`}
                      </h4>
                      <span className="text-[11px] text-[#8696A0] flex-shrink-0 ml-1 font-normal">
                        {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-xs text-[#667781] truncate leading-relaxed mb-1.5 font-normal">
                      {conv.lastMessage?.content?.replace(/\*\*/g, '') || 'Sin mensajes'}
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {hasAlarm && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 animate-pulse">
                          🚨 Alarma Qx
                        </span>
                      )}
                      {isAgent ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          {conv.status === 'AGENT_TAKEN' ? 'Auxiliar en chat' : 'Requiere Auxiliar'}
                        </span>
                      ) : conv.currentStep === 'CANCELLED_BY_USER' || (conv.flowData as any)?.cancelledReason ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Cancelado
                        </span>
                      ) : conv.status === 'CLOSED' || conv.currentStep === 'SESSION_CLOSED' ? (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Finalizada
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                          Bot Activo
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Columna Derecha: Vista del Chat en Vivo estilo WhatsApp Web */}
      <div className="flex-1 flex flex-col bg-[#EFEAE2] overflow-hidden">
        {selectedConv ? (
          <>
            {/* Header del Chat WhatsApp Web */}
            <div className="px-5 py-3 bg-[#F0F2F5] border-b border-[#E9EDEF] flex items-center justify-between shadow-2xs gap-4 z-10">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[#008069] text-white flex items-center justify-center font-bold text-sm shadow-xs">
                    {selectedConv.contact?.name ? selectedConv.contact.name.substring(0, 2).toUpperCase() : 'PA'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#00A884] border-2 border-[#F0F2F5]"></span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm sm:text-base text-[#111B21] truncate">
                      {selectedConv.contact?.name || 'Paciente Particular HUN'}
                    </h3>
                  </div>
                  <div className="text-xs text-[#667781] flex items-center gap-1.5 flex-wrap">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Phone className="w-3 h-3 text-[#00A884]" strokeWidth={1.5} /> +{selectedConv.contact?.phone}
                    </span>
                    <span>·</span>
                    <span>Flujo: <strong className="text-slate-700 font-medium">{selectedConv.currentFlow}</strong></span>
                    {selectedConv.contact?.documentId && (
                      <>
                        <span>·</span>
                        <span>Doc: <strong className="text-slate-700 font-medium font-mono">{selectedConv.contact.documentId}</strong></span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Barra de Control Estilizada */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Botón de Intervención */}
                {selectedConv.status === 'AGENT_TAKEN' ? (
                  <button
                    onClick={handleReturnToBot}
                    className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-medium rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bot className="w-3.5 h-3.5 text-emerald-300" strokeWidth={1.5} />
                    <span>Devolver a Bot</span>
                  </button>
                ) : (
                  <button
                    onClick={handleTakeover}
                    className="px-3.5 py-1.5 bg-[#00A884] hover:bg-[#008F6F] text-white text-xs font-semibold rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-md"
                  >
                    <UserCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span>Intervenir Chat</span>
                  </button>
                )}

                {/* Menú Desplegable de Opciones Clínicas */}
                <div className="relative" ref={actionsMenuRef}>
                  <button
                    onClick={() => setShowActionsMenu(!showActionsMenu)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#54656F] hover:text-[#111B21] text-xs font-medium rounded-full border border-slate-200/80 transition-all flex items-center gap-1 cursor-pointer"
                    title="Opciones clínicas y acciones automáticas del bot"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#54656F]" strokeWidth={1.5} />
                    <span className="hidden sm:inline">Acciones</span>
                    <ChevronDown className="w-3 h-3 text-[#54656F]" strokeWidth={1.5} />
                  </button>

                  {showActionsMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-30 space-y-1">
                      <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8696A0] border-b border-slate-100">
                        Disparadores del Asistente
                      </div>

                      <button
                        onClick={handleTriggerInactivityWarning}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-orange-600 flex items-center gap-2.5 transition cursor-pointer"
                        title="Preguntar ¿Sigues en línea? como si hubieran transcurrido 10 minutos de inactividad"
                      >
                        <Clock className="w-4 h-4 text-orange-500" strokeWidth={1.5} />
                        <span>¿Sigue en línea? (Aviso Inactividad)</span>
                      </button>

                      <button
                        onClick={handleTriggerInactivityClose}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <XCircle className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                        <span>Cerrar Sesión por Inactividad</span>
                      </button>

                      <button
                        onClick={handleTriggerPostQx}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-rose-600 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
                        <span>Disparar Alarma Post-Qx (24h)</span>
                      </button>

                      <button
                        onClick={handleTriggerNps}
                        className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-amber-600 flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Star className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
                        <span>Enviar Encuesta de Satisfacción NPS</span>
                      </button>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          onClick={() => {
                            setShowActionsMenu(false);
                            setShowDeleteConfirm(true);
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" strokeWidth={1.5} />
                          <span>Eliminar esta Conversación</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Aviso de Alarma o Cancelación */}
            {selectedConv.currentStep === 'CANCELLED_BY_USER' && (
              <div className="px-5 py-2 bg-amber-50/90 border-b border-amber-200 text-xs text-amber-900 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" strokeWidth={1.5} />
                <span>Esta sesión fue cancelada por inactividad. El bot responderá cuando el paciente escriba de nuevo.</span>
              </div>
            )}

            {/* Área de Mensajes con Fondo y Burbujas Auténticas WhatsApp */}
            <div
              className="flex-1 p-5 overflow-y-auto space-y-3 relative"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage: `radial-gradient(#0000000a 1px, transparent 1px)`,
                backgroundSize: '20px 20px',
              }}
            >
              {loading ? (
                <div className="text-center text-[#8696A0] text-xs py-12 flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#00A884]" strokeWidth={1.5} />
                  <span>Cargando mensajes...</span>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-[#8696A0] text-xs py-12">
                  No hay mensajes registrados aún en esta conversación.
                </div>
              ) : (
              messages.map((m) => {
                const isUser = m.sender === 'USER';
                const isAgent = m.sender === 'AGENT';
                const isBot = m.sender === 'BOT';
                const hasNicolFused = Boolean(!isUser && m.mediaUrl && (m.mediaUrl.includes('nicol') || m.mediaUrl.includes('Nicol')));
                const isStandaloneSticker = Boolean(m.mediaUrl && !m.content && !hasNicolFused);

                // OPCIÓN A: Mascota Nicol Fusionada en la Esquina Superior Derecha (Pop-Out 3D)
                if (hasNicolFused) {
                  return (
                    <div
                      key={m.id}
                      className="relative pt-8 flex justify-start my-3"
                    >
                      {/* Nicol asomándose en 3D por la esquina superior derecha */}
                      <div className="absolute -top-8 right-4 z-10 w-24 sm:w-28 pointer-events-none transition-transform duration-200 hover:scale-105 filter drop-shadow-[0_6px_12px_rgba(0,0,0,0.24)]">
                        <img
                          src={m.mediaUrl}
                          alt="Nicol Saludo HUN"
                          className="w-full h-auto object-contain"
                          loading="lazy"
                        />
                      </div>

                      {/* Burbuja WhatsApp Web con Padding Derecho Protegido para el Texto */}
                      <div className="bg-white text-[#111B21] rounded-2xl rounded-tl-xs p-4 pr-16 text-[13.5px] leading-relaxed shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] max-w-[80%] sm:max-w-[72%] relative z-0 border border-slate-200/70">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#008069] mb-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00A884]"></span>
                          <span>Hospital Universitario Nacional - HUN</span>
                        </div>

                        <div className="whitespace-pre-wrap font-normal text-[#111B21] leading-relaxed">
                          {m.content?.replace(/\*\*/g, '')}
                        </div>

                        <div className="text-[10px] text-[#667781] flex items-center justify-end gap-1 mt-1.5 font-normal select-none">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isUser && <DeliveryStatus status={m.status} error={m.deliveryError} />}
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
                      className={`flex ${isUser ? 'justify-start' : 'justify-end'} my-1.5`}
                    >
                      <div className="relative group max-w-[190px] sm:max-w-[210px] flex flex-col items-end">
                        <div className="relative transition-transform duration-200 hover:scale-105 cursor-pointer">
                          <img
                            src={m.mediaUrl}
                            alt="Sticker"
                            className="w-full h-auto max-h-52 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
                            loading="lazy"
                          />
                        </div>
                        <div className="text-[10px] text-[#667781] flex items-center justify-end gap-1 mt-0.5 px-1.5 py-0.5 bg-white/80 backdrop-blur-xs rounded-full shadow-2xs">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isUser && <DeliveryStatus status={m.status} error={m.deliveryError} />}
                        </div>
                      </div>
                    </div>
                  );
                }

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[78%] sm:max-w-[70%] p-3.5 text-[13.5px] leading-relaxed shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-all relative ${
                          isUser
                            ? 'bg-white text-[#111B21] rounded-2xl rounded-tl-xs'
                            : isAgent
                            ? 'bg-[#dcf8c6] text-[#111B21] rounded-2xl rounded-tr-xs border border-[#c4e8ab]/60'
                            : 'bg-[#d9fdd3] text-[#111B21] rounded-2xl rounded-tr-xs'
                        }`}
                      >
                        {/* Cabecera del remitente */}
                        <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-semibold">
                          {isUser && (
                            <span className="text-[#008069] flex items-center gap-1">
                              <User className="w-3 h-3" strokeWidth={1.5} />
                              {selectedConv.contact?.name || 'Paciente Particular'}
                            </span>
                          )}
                          {isBot && (
                            <span className="text-[#008069] flex items-center gap-1.5">
                              <img
                                src="/nicol-sticker-clean.png"
                                alt="Nicol"
                                className="w-4 h-4 rounded-full object-contain bg-white border border-[#00A884]/40 shadow-2xs"
                              />
                              <span>Hospital Universitario Nacional - HUN</span>
                            </span>
                          )}
                          {isAgent && (
                            <span className="text-[#005c4b] flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-[#008069]" strokeWidth={1.5} />
                              Auxiliar HUN (Tú)
                            </span>
                          )}
                        </div>

                        {/* Imagen adjunta en caso de existir y no ser sticker puro */}
                        {m.mediaUrl && (
                          <div className="mb-2 rounded-lg overflow-hidden border border-slate-200/80">
                            <img src={m.mediaUrl} alt="Adjunto" className="w-full max-h-56 object-cover" />
                          </div>
                        )}

                        {/* Contenido del Mensaje */}
                        {m.content && (
                          <div className="whitespace-pre-wrap font-normal text-[#111B21]">
                            {m.content?.replace(/\*\*/g, '')}
                          </div>
                        )}

                        {/* Timestamp y Visto WhatsApp */}
                        <div className="text-[10px] text-[#667781] flex items-center justify-end gap-1 mt-1 font-normal select-none">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                            {!isUser && <DeliveryStatus status={m.status} error={m.deliveryError} />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Inferior Auténtico WhatsApp Web */}
            <form
              onSubmit={handleSendReply}
              className="px-4 py-3 bg-[#F0F2F5] border-t border-[#E9EDEF] flex items-center gap-2.5 z-10"
            >
              <button
                type="button"
                className="text-[#54656F] hover:text-[#111B21] transition p-1.5 rounded-full hover:bg-slate-200/60 cursor-pointer"
                title="Emojis"
              >
                <Smile className="w-5 h-5" strokeWidth={1.5} />
              </button>

              <button
                type="button"
                className="text-[#54656F] hover:text-[#111B21] transition p-1.5 rounded-full hover:bg-slate-200/60 cursor-pointer"
                title="Adjuntar archivo"
              >
                <Paperclip className="w-5 h-5" strokeWidth={1.5} />
              </button>

              <input
                type="text"
                placeholder={
                  selectedConv.status === 'AGENT_TAKEN'
                    ? 'Escribe un mensaje como Auxiliar HUN...'
                    : 'Para responder manualmente, escribe aquí tu mensaje...'
                }
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm bg-white rounded-xl border border-transparent focus:outline-none focus:border-slate-300 transition placeholder:text-[#8696A0] text-[#111B21] shadow-2xs"
              />

              <button
                type="submit"
                disabled={!replyText.trim()}
                className="w-10 h-10 rounded-full bg-[#00A884] hover:bg-[#008F6F] disabled:opacity-40 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95 flex-shrink-0"
                title="Enviar mensaje"
              >
                <Send className="w-4 h-4 ml-0.5 text-white" strokeWidth={1.75} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8696A0] p-8 text-center bg-[#F0F2F5]">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-3 text-slate-400 shadow-sm border border-slate-200/60">
              <Bot className="w-8 h-8 text-[#00A884]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-semibold text-[#111B21]">WhatsApp Web · Hospital Universitario Nacional</h3>
            <p className="text-xs text-[#667781] mt-1 max-w-sm">
              Selecciona un paciente del panel izquierdo para visualizar la conversación en vivo o intervenir como auxiliar asistencial.
            </p>
          </div>
        )}
      </div>

      {/* Modal para Limpiar Bandeja de Pacientes */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center space-x-3 text-red-600 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                <Trash2 className="w-6 h-6 text-red-600" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Limpiar Bandeja de Pacientes</h3>
                <p className="text-xs text-slate-500">Panel de Control del Administrador HUN</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Selecciona el alcance de la limpieza. Esta acción actualizará la lista de chats y las métricas en tiempo real:
            </p>

            <div className="space-y-2.5 mb-6">
              <label
                className={`flex items-start p-3.5 rounded-2xl border cursor-pointer transition ${
                  clearScope === 'CLOSED'
                    ? 'border-[#00A884] bg-emerald-50/50 text-emerald-950 ring-2 ring-[#00A884]/30'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="clearScope"
                  checked={clearScope === 'CLOSED'}
                  onChange={() => setClearScope('CLOSED')}
                  className="mt-0.5 mr-3 text-[#00A884] focus:ring-[#00A884]"
                />
                <div>
                  <div className="font-bold text-xs text-slate-900">
                    Solo conversaciones cerradas o canceladas (Recomendado)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Elimina de la bandeja las sesiones finalizadas y las canceladas por inactividad, preservando los chats activos.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start p-3.5 rounded-2xl border cursor-pointer transition ${
                  clearScope === 'ALL'
                    ? 'border-red-500 bg-red-50/50 text-red-900 ring-2 ring-red-500/30'
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
                  <div className="font-bold text-xs text-red-900">
                    Vaciar toda la bandeja (Reset Total)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Elimina todos los chats y mensajes de prueba para dejar la bandeja completamente en blanco para pacientes reales.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleClearInbox}
                disabled={isClearing}
                className="px-5 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition flex items-center cursor-pointer"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" strokeWidth={1.5} />
                    Limpiando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                    Confirmar Limpieza
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Eliminar Conversación Individual */}
      {showDeleteConfirm && selectedConv && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center">
              <Trash2 className="w-4 h-4 mr-2 text-red-600" strokeWidth={1.5} />
              ¿Eliminar esta conversación?
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              Se eliminará el historial del chat con <strong className="text-slate-800">{selectedConv.contact?.name || 'este paciente'}</strong> (+{selectedConv.contact?.phone}) de forma permanente.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCurrentConversation}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition flex items-center shadow-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                Eliminar Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
