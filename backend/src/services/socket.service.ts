import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { CONFIG } from '../config';
import { authService } from './auth.service';

class SocketService {
  private io: SocketIOServer | null = null;

  public init(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          const allowed = [CONFIG.FRONTEND_URL, CONFIG.BACKEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3001', 'http://127.0.0.1:3001'];
          if (
            !origin ||
            allowed.includes(origin) ||
            /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
            /^https?:\/\/([a-zA-Z0-9.-]+\.)?hun\.edu\.co(:\d+)?$/.test(origin)
          ) {
            callback(null, true);
          } else {
            callback(null, false);
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.io.use(async (socket, next) => {
      const cookie = socket.handshake.headers.cookie;
      const token = cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('hun_session='))?.slice('hun_session='.length);
      const user = await authService.validateSession(token);
      if (!user) return next(new Error('UNAUTHORIZED'));
      socket.data.user = user;
      return next();
    });

    this.io.on('connection', (socket) => {
      console.log(`🔌 Cliente conectado al Dashboard WebSocket: ${socket.id}`);

      socket.on('join_conversation', (conversationId: string) => {
        socket.join(`conv_${conversationId}`);
      });

      socket.on('leave_conversation', (conversationId: string) => {
        socket.leave(`conv_${conversationId}`);
      });

      socket.on('disconnect', () => {
        // Disconnect
      });
    });
  }

  public emitNewMessage(message: any) {
    if (!this.io) return;
    this.io.emit('new_message', message);
    this.io.to(`conv_${message.conversationId}`).emit('conversation_message', message);
  }

  public emitMessageUpdated(message: any) {
    if (!this.io) return;
    this.io.emit('message_updated', message);
    this.io.to(`conv_${message.conversationId}`).emit('conversation_message_updated', message);
  }

  public emitConversationUpdated(conversation: any) {
    if (!this.io) return;
    this.io.emit('conversation_updated', conversation);
  }

  public emitCriticalAlarm(ticket: any) {
    if (!this.io) return;
    this.io.emit('critical_alarm', ticket);
  }

  public emitMetricsUpdated(metrics: any) {
    if (!this.io) return;
    this.io.emit('metrics_updated', metrics);
  }

  public emitAgendaUpdated(data: any) {
    if (!this.io) return;
    this.io.emit('agenda_updated', data);
  }

  public emitWhatsAppStatus(status: any) {
    if (!this.io) return;
    this.io.emit('whatsapp_status', status);
  }

  public emitAppointmentsUpdated(appointments: any) {
    if (!this.io) return;
    this.io.emit('appointments_updated', appointments);
  }

  public emitQuotesUpdated(quotes: any) {
    if (!this.io) return;
    this.io.emit('quotes_updated', quotes);
  }

  public emitConversationsCleared() {
    if (!this.io) return;
    this.io.emit('conversations_cleared');
  }

  public emitTicketsUpdated(tickets: any) {
    if (!this.io) return;
    this.io.emit('tickets_updated', tickets);
  }

  public emitContactsUpdated(contacts: any) {
    if (!this.io) return;
    this.io.emit('contacts_updated', contacts);
  }
}

export const socketService = new SocketService();
