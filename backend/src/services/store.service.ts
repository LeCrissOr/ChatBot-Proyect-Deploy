import { PrismaClient } from '@prisma/client';
import { ConversationFlow, ConversationStatus, FlowStateData, SenderType } from '../types';
import { prisma } from './database.service';
import { normalizeColombianPhone, isLidPhone } from '../utils/phone';
import { socketService } from './socket.service';

export interface UserTypeData {
  id: string;
  code: string;
  name: string;
  description?: string;
  active?: boolean;
}

export interface AppointmentHistoryEntry {
  id: string;
  appointmentId: string;
  previousStatus?: string | null;
  newStatus: string;
  changedBy?: string | null;
  note?: string | null;
  createdAt: Date;
}

export interface ContactData {
  id: string;
  phone: string;
  name?: string;
  documentId?: string;
  documentType?: string;
  birthDate?: Date;
  email?: string;
  residenceCity?: string;
  residenceAddress?: string;
  hasActiveEps?: boolean;
  isInternational?: boolean;
  userTypeId?: string;
  userType?: UserTypeData;
  userTypeCode?: string;
  userTypeName?: string;
  cancellationCount?: number;
  cancellationReasons?: Array<{
    appointmentId: string;
    specialty: string;
    doctorName: string;
    reason: string;
    date: Date;
  }>;
  rescheduleCount?: number;
  wasRescheduled?: boolean;
  rescheduleReasons?: Array<{
    appointmentId: string;
    specialty: string;
    doctorName: string;
    reason: string;
    date: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationData {
  id: string;
  contactId: string;
  contact?: ContactData;
  status: ConversationStatus;
  currentFlow: ConversationFlow;
  currentStep: string;
  flowData: FlowStateData;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: MessageData;
}

export interface MessageData {
  id: string;
  conversationId: string;
  sender: SenderType;
  content: string;
  mediaUrl?: string;
  interactivePayload?: import('../types').InteractivePayload;
  waMessageId?: string;
  status: string;
  deliveryError?: string;
  createdAt: Date;
}

export interface AppointmentData {
  id: string;
  contactId: string;
  contactPhone?: string;
  contactName?: string;
  userTypeId?: string;
  userType?: UserTypeData;
  userTypeCode?: string;
  userTypeName?: string;
  doctorId?: string;
  officeId?: string;
  specialty: string;
  doctorName: string;
  dateTime: Date;
  durationMinutes?: number;
  isFirstTime: boolean;
  price: number;
  paymentStatus: string;
  paymentLink?: string;
  numeroCitaHosvital?: number;
  isReferral: boolean;
  referralCode?: string;
  referralModel?: string;
  status: string;
  wasRescheduled?: boolean;
  rescheduleCount?: number;
  rescheduleReason?: string;
  cancellationReason?: string;
  statusHistory?: AppointmentHistoryEntry[];
  createdAt: Date;
}

export interface SurgicalQuoteData {
  id: string;
  contactId: string;
  contactPhone?: string;
  contactName?: string;
  userTypeId?: string;
  userType?: UserTypeData;
  userTypeCode?: string;
  userTypeName?: string;
  procedureDescription: string;
  hasMedicalOrder: boolean;
  hasActiveEps: boolean;
  medicalOrderFileUrl?: string;
  status: string;
  cupsCode?: string;
  quotedAmount?: number;
  createdAt: Date;
}

export interface SupportTicketData {
  id: string;
  contactId: string;
  contactPhone?: string;
  contactName?: string;
  type: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  description: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface NpsSurveyData {
  id: string;
  contactId: string;
  contactPhone?: string;
  contactName?: string;
  rating: number;
  comment?: string;
  hasPqrs: boolean;
  createdAt: Date;
}

// In-Memory fallback store
class DataStore {
  private prisma: PrismaClient | null = null;
  private isPrismaConnected: boolean = false;
  private ready: Promise<void>;

  private contacts: Map<string, ContactData> = new Map();
  private conversations: Map<string, ConversationData> = new Map();
  private messages: MessageData[] = [];
  private appointments: AppointmentData[] = [];
  private statusHistory: AppointmentHistoryEntry[] = [];
  private quotes: SurgicalQuoteData[] = [];
  private tickets: SupportTicketData[] = [];
  private npsSurveys: NpsSurveyData[] = [];

  constructor() {
    this.seedInitialData();
    this.ready = this.initPrisma();
  }

  private async initPrisma() {
    try {
      this.prisma = prisma;
      await this.prisma.$connect();
      this.isPrismaConnected = true;
      await this.hydrateFromDatabase();
      console.log('✅ Conexión exitosa con base de datos PostgreSQL via Prisma.');
    } catch (err: any) {
      this.isPrismaConnected = false;
      console.log('ℹ️ Base de datos PostgreSQL no detectada en localhost:5432 o en inicio. Operando con Store de memoria sincronizado para desarrollo.');
    }
  }

  public async waitUntilReady() { await this.ready; }

  public getDatabaseClient() { return this.isPrismaConnected ? this.prisma : null; }

  private async ensureUserTypes() {
    if (!this.prisma) return;
    const types = [
      { code: 'PARTICULAR', name: 'Paciente Particular', description: 'Atención particular estándar HUN' },
      { code: 'EGRESADO_UNAL', name: 'Egresado Universidad Nacional de Colombia', description: 'Tarifa preferencial para egresados UNAL' },
      { code: 'COLABORADOR_HUN', name: 'Colaborador HUN', description: 'Tarifa preferencial para colaboradores y personal HUN' },
      { code: 'OTRO', name: 'Otro (Contactar con un asesor)', description: 'Canalización directa con auxiliar de atención' },
    ];
    for (const t of types) {
      await this.prisma.userType.upsert({
        where: { code: t.code },
        update: { name: t.name, description: t.description },
        create: t,
      }).catch((err) => console.error('Error seeding userType:', err));
    }
  }

  private async hydrateFromDatabase() {
    if (!this.prisma) return;
    await this.ensureUserTypes();

    const contacts = await this.prisma.contact.findMany({ include: { userType: true } });
    if (contacts.length === 0) {
      await this.persistSeedData();
      return;
    }
    this.contacts.clear();
    this.conversations.clear();
    this.messages = [];
    this.appointments = [];
    this.quotes = [];
    this.tickets = [];
    this.npsSurveys = [];
    contacts.forEach((contact) =>
      this.contacts.set(contact.id, {
        ...contact,
        userTypeCode: contact.userType?.code || 'PARTICULAR',
        userTypeName: contact.userType?.name || 'Paciente Particular',
      } as ContactData)
    );

    // Consolidar cualquier conversación duplicada existente por contacto
    const rawConversations = await this.prisma.conversation.findMany({
      include: { contact: { include: { userType: true } }, messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });

    const convsByContact = new Map<string, typeof rawConversations>();
    rawConversations.forEach((conv) => {
      const list = convsByContact.get(conv.contactId) || [];
      list.push(conv);
      convsByContact.set(conv.contactId, list);
    });

    for (const [contactId, list] of convsByContact.entries()) {
      if (list.length > 1) {
        // Ordenar por fecha más reciente
        list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        const primary = list[0];
        const duplicates = list.slice(1);
        const dupIds = duplicates.map((d) => d.id);

        console.log(`🧹 Consolidando ${duplicates.length} conversaciones duplicadas del contacto ${contactId} hacia ${primary.id}...`);

        // Reasignar todos los mensajes de las conversaciones duplicadas hacia la conversación principal
        await this.prisma.message.updateMany({
          where: { conversationId: { in: dupIds } },
          data: { conversationId: primary.id },
        }).catch((e) => console.error('Error migrando mensajes duplicados:', e));

        // Eliminar las conversaciones duplicadas sobrantes
        await this.prisma.conversation.deleteMany({
          where: { id: { in: dupIds } },
        }).catch((e) => console.error('Error eliminando conversaciones duplicadas:', e));
      }
    }

    const conversations = await this.prisma.conversation.findMany({
      include: { contact: { include: { userType: true } }, messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });

    conversations.forEach((conversation) => {
      const mappedMessages = conversation.messages.map((message) => ({ ...message }));
      this.messages.push(...mappedMessages as MessageData[]);
      const lastMessage = mappedMessages[mappedMessages.length - 1] as MessageData | undefined;
      this.conversations.set(conversation.id, {
        ...conversation,
        contact: conversation.contact ? {
          ...conversation.contact,
          userTypeCode: conversation.contact.userType?.code || 'PARTICULAR',
          userTypeName: conversation.contact.userType?.name || 'Paciente Particular',
        } as ContactData : undefined,
        flowData: conversation.flowData as FlowStateData,
        lastMessage,
      } as ConversationData);
    });

    const appointments = await this.prisma.appointment.findMany({
      include: { contact: { include: { userType: true } }, userType: true },
      orderBy: { createdAt: 'desc' },
    });
    this.appointments = appointments.map((item) => ({
      ...item,
      price: Number(item.price),
      contactName: item.contact.name || undefined,
      contactPhone: item.contact.phone,
      userTypeId: item.userTypeId || item.contact.userTypeId || undefined,
      userTypeCode: item.userType?.code || item.contact?.userType?.code || 'PARTICULAR',
      userTypeName: item.userType?.name || item.contact?.userType?.name || 'Paciente Particular',
    })) as AppointmentData[];

    const quotes = await this.prisma.surgicalQuote.findMany({
      include: { contact: { include: { userType: true } }, userType: true },
      orderBy: { createdAt: 'desc' },
    });
    this.quotes = quotes.map((item) => ({
      ...item,
      quotedAmount: item.quotedAmount == null ? undefined : Number(item.quotedAmount),
      contactName: item.contact.name || undefined,
      contactPhone: item.contact.phone,
      userTypeId: item.userTypeId || item.contact.userTypeId || undefined,
      userTypeCode: item.userType?.code || item.contact?.userType?.code || 'PARTICULAR',
      userTypeName: item.userType?.name || item.contact?.userType?.name || 'Paciente Particular',
    })) as SurgicalQuoteData[];
    const tickets = await this.prisma.supportTicket.findMany({ include: { contact: true }, orderBy: { createdAt: 'desc' } });
    this.tickets = tickets.map((item) => ({ ...item, contactName: item.contact.name || undefined, contactPhone: item.contact.phone })) as SupportTicketData[];
    const surveys = await this.prisma.npsSurvey.findMany({ orderBy: { createdAt: 'desc' } });
    this.npsSurveys = surveys as NpsSurveyData[];
    const history = await this.prisma.appointmentStatusHistory.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []);
    this.statusHistory = history as AppointmentHistoryEntry[];
  }

  private async persistSeedData() {
    if (!this.prisma) return;
    for (const contact of this.contacts.values()) {
      await this.prisma.contact.create({
        data: {
          id: contact.id,
          phone: contact.phone,
          name: contact.name || null,
          documentId: contact.documentId || null,
          documentType: contact.documentType || null,
          birthDate: contact.birthDate || null,
          email: contact.email || null,
          residenceCity: contact.residenceCity || null,
          residenceAddress: contact.residenceAddress || null,
          hasActiveEps: contact.hasActiveEps ?? false,
          isInternational: contact.isInternational ?? false,
          userTypeId: contact.userTypeId || null,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt,
        },
      });
    }
    for (const conversation of this.conversations.values()) await this.prisma.conversation.create({ data: { id: conversation.id, contactId: conversation.contactId, status: conversation.status, currentFlow: conversation.currentFlow, currentStep: conversation.currentStep, flowData: conversation.flowData as any, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt } });
    for (const message of this.messages) await this.prisma.message.create({ data: { id: message.id, conversationId: message.conversationId, sender: message.sender, content: message.content, mediaUrl: message.mediaUrl || null, waMessageId: message.waMessageId || null, status: message.status, createdAt: message.createdAt } });
    for (const appointment of this.appointments) await this.prisma.appointment.create({ data: { id: appointment.id, contactId: appointment.contactId, specialty: appointment.specialty, doctorName: appointment.doctorName, dateTime: appointment.dateTime, isFirstTime: appointment.isFirstTime, price: appointment.price, paymentStatus: appointment.paymentStatus, paymentLink: appointment.paymentLink || null, isReferral: appointment.isReferral, referralCode: appointment.referralCode || null, referralModel: appointment.referralModel || null, status: appointment.status, createdAt: appointment.createdAt } });
    for (const quote of this.quotes) await this.prisma.surgicalQuote.create({ data: { id: quote.id, contactId: quote.contactId, procedureDescription: quote.procedureDescription, hasMedicalOrder: quote.hasMedicalOrder, hasActiveEps: quote.hasActiveEps, medicalOrderFileUrl: quote.medicalOrderFileUrl || null, status: quote.status, cupsCode: quote.cupsCode || null, quotedAmount: quote.quotedAmount ?? null, createdAt: quote.createdAt } });
    for (const ticket of this.tickets) await this.prisma.supportTicket.create({ data: { id: ticket.id, contactId: ticket.contactId, type: ticket.type, priority: ticket.priority, status: ticket.status, description: ticket.description, resolvedAt: ticket.resolvedAt || null, createdAt: ticket.createdAt } });
  }

  private seedInitialData() {
    // Semilla para visualización de métricas en dashboard
    const contact1: ContactData = {
      id: 'cnt-1',
      phone: '573101234567',
      name: 'María Alejandra Gómez',
      documentId: '1020304050',
      hasActiveEps: true,
      isInternational: false,
      createdAt: new Date(Date.now() - 3600000 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 2),
    };

    const conv1: ConversationData = {
      id: 'conv-1',
      contactId: contact1.id,
      status: 'BOT',
      currentFlow: 'F01_CONSULTA',
      currentStep: 'CONFIRMED',
      flowData: {
        specialty: 'Dermatología',
        patientName: 'María Alejandra Gómez',
        patientDoc: '1020304050',
        price: 210000,
        isFirstTime: true,
      },
      createdAt: new Date(Date.now() - 3600000 * 2),
      updatedAt: new Date(Date.now() - 3600000 * 1),
    };

    this.contacts.set(contact1.id, contact1);
    this.conversations.set(conv1.id, conv1);

    this.messages.push(
      {
        id: 'msg-1',
        conversationId: conv1.id,
        sender: 'USER',
        content: 'Hola, necesito agendar una cita con dermatología',
        status: 'read',
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        id: 'msg-2',
        conversationId: conv1.id,
        sender: 'BOT',
        content: '¡Hola! Te damos la bienvenida al servicio de Paciente Particular del Hospital Universitario Nacional (HUN) 🏥...',
        status: 'delivered',
        createdAt: new Date(Date.now() - 3600000 * 2 + 1000),
      }
    );

    this.appointments.push({
      id: 'apt-1',
      contactId: contact1.id,
      contactName: contact1.name,
      contactPhone: contact1.phone,
      specialty: 'Dermatología',
      doctorName: 'Dra. Marcela Rincón',
      dateTime: new Date(Date.now() + 86400000),
      isFirstTime: true,
      price: 210000,
      paymentStatus: 'PAID_VIRTUAL',
      isReferral: false,
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 3600000 * 1.5),
    });

    // Contacto 2: Cotización quirúrgica
    const contact2: ContactData = {
      id: 'cnt-2',
      phone: '573009876543',
      name: 'Carlos Eduardo Ramírez',
      documentId: '79845612',
      hasActiveEps: true,
      createdAt: new Date(Date.now() - 3600000 * 5),
      updatedAt: new Date(Date.now() - 3600000 * 5),
    };

    const conv2: ConversationData = {
      id: 'conv-2',
      contactId: contact2.id,
      status: 'REQUIRES_AGENT',
      currentFlow: 'F02_QUIRURGICO',
      currentStep: 'QUOTATION_PENDING',
      flowData: {
        procedureDesc: 'Artroscopia de rodilla derecha',
        hasMedicalOrder: true,
        hasActiveEps: true,
        patientName: 'Carlos Eduardo Ramírez',
      },
      createdAt: new Date(Date.now() - 3600000 * 5),
      updatedAt: new Date(Date.now() - 3600000 * 4),
    };

    this.contacts.set(contact2.id, contact2);
    this.conversations.set(conv2.id, conv2);

    this.quotes.push({
      id: 'qte-1',
      contactId: contact2.id,
      contactName: contact2.name,
      contactPhone: contact2.phone,
      procedureDescription: 'Artroscopia de rodilla derecha',
      hasMedicalOrder: true,
      hasActiveEps: true,
      status: 'PENDING_AUXILIAR',
      createdAt: new Date(Date.now() - 3600000 * 4),
    });

    this.tickets.push({
      id: 'tkt-1',
      contactId: contact2.id,
      contactName: contact2.name,
      contactPhone: contact2.phone,
      type: 'SURGICAL_QUOTE_REQUEST',
      priority: 'HIGH',
      status: 'OPEN',
      description: 'Cotización quirúrgica para Carlos Eduardo Ramírez: Artroscopia de rodilla derecha. EPS: Sí',
      createdAt: new Date(Date.now() - 3600000 * 4),
    });

    // Contacto 3: Alerta post-quirúrgica (🚨 Crítica)
    const contact3: ContactData = {
      id: 'cnt-3',
      phone: '573155554433',
      name: 'Javier Restrepo',
      documentId: '80123456',
      hasActiveEps: true,
      createdAt: new Date(Date.now() - 3600000 * 1),
      updatedAt: new Date(Date.now() - 3600000 * 1),
    };

    const conv3: ConversationData = {
      id: 'conv-3',
      contactId: contact3.id,
      status: 'REQUIRES_AGENT',
      currentFlow: 'POST_QX',
      currentStep: 'CRITICAL_ALARM',
      flowData: {
        patientName: 'Javier Restrepo',
        hasPostQxAlarm: true,
      },
      createdAt: new Date(Date.now() - 3600000 * 1),
      updatedAt: new Date(),
    };

    this.contacts.set(contact3.id, contact3);
    this.conversations.set(conv3.id, conv3);

    this.tickets.push({
      id: 'tkt-2',
      contactId: contact3.id,
      contactName: contact3.name,
      contactPhone: contact3.phone,
      type: 'POST_QX_ALARM',
      priority: 'CRITICAL',
      status: 'OPEN',
      description: '🚨 SIGNO DE ALARMA POST-QX: Paciente reporta fiebre 38.5 y dolor agudo en herida quirúrgica',
      createdAt: new Date(Date.now() - 3600000 * 0.5),
    });
  }

  // --- MÉTODOS PÚBLICOS ---

  public async getOrCreateContact(phone: string, name?: string): Promise<ContactData> {
    await this.ready;
    const cleanPhone = normalizeColombianPhone(phone);

    if (this.isPrismaConnected && this.prisma) {
      const existing = await this.prisma.contact.findFirst({
        where: {
          OR: [
            { phone: cleanPhone },
            ...(cleanPhone.startsWith('57') && cleanPhone.length === 12
              ? [{ phone: cleanPhone.slice(2) }]
              : []),
          ],
        },
      });
      if (existing) {
        if (cleanPhone.startsWith('57') && existing.phone !== cleanPhone) {
          await this.prisma.contact.update({ where: { id: existing.id }, data: { phone: cleanPhone } }).catch(() => null);
          existing.phone = cleanPhone;
        }
        if (name && !existing.name) await this.prisma.contact.update({ where: { id: existing.id }, data: { name } });
        const contact = { ...existing, name: name || existing.name || undefined } as ContactData;
        this.contacts.set(contact.id, contact);
        return contact;
      }
      const created = await this.prisma.contact.create({ data: { phone: cleanPhone, name: name || null } });
      const contact = created as ContactData;
      this.contacts.set(contact.id, contact);
      return contact;
    }

    for (const c of this.contacts.values()) {
      if (c.phone === cleanPhone || (cleanPhone.startsWith('57') && c.phone === cleanPhone.slice(2))) {
        c.phone = cleanPhone;
        if (name && !c.name) {
          c.name = name;
          c.updatedAt = new Date();
        }
        return c;
      }
    }

    const newContact: ContactData = {
      id: `cnt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      phone: cleanPhone,
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(newContact.id, newContact);
    return newContact;
  }

  public async findContactByDocument(documentId: string): Promise<ContactData | undefined> {
    await this.ready;
    const cleanDocument = documentId.trim();
    if (this.isPrismaConnected && this.prisma) {
      const contact = await this.prisma.contact.findFirst({ where: { documentId: cleanDocument } });
      if (!contact) return undefined;
      const mapped = contact as ContactData;
      this.contacts.set(mapped.id, mapped);
      return mapped;
    }
    return Array.from(this.contacts.values()).find((contact) => contact.documentId === cleanDocument);
  }

  public getContactById(id: string): ContactData | undefined {
    return this.contacts.get(id);
  }

  public async createOrUpdatePatientContact(patientData: {
    documentId: string;
    documentType: string;
    name: string;
    phone?: string;
    email?: string;
    residenceCity?: string;
    residenceAddress?: string;
    birthDate?: Date;
    userTypeId?: string;
  }): Promise<ContactData> {
    await this.ready;
    const cleanDoc = patientData.documentId.trim();

    // 1. Buscar si ya existe por documentId
    let existing = await this.findContactByDocument(cleanDoc);

    // 2. Si no existe por documento pero nos dieron teléfono, buscar por teléfono
    if (!existing && patientData.phone) {
      const cleanPhone = patientData.phone.replace(/[^0-9]/g, '');
      if (cleanPhone) {
        if (this.isPrismaConnected && this.prisma) {
          const byPhone = await this.prisma.contact.findUnique({ where: { phone: cleanPhone } });
          if (byPhone) existing = byPhone as ContactData;
        } else {
          existing = Array.from(this.contacts.values()).find((c) => c.phone === cleanPhone);
        }
      }
    }

    if (existing) {
      const updated = await this.updateContactProfile(existing.id, {
        name: patientData.name,
        documentId: cleanDoc,
        documentType: patientData.documentType,
        birthDate: patientData.birthDate,
        email: patientData.email,
        residenceCity: patientData.residenceCity,
        residenceAddress: patientData.residenceAddress,
        phone: patientData.phone,
      });
      return updated || existing;
    }

    // 3. Crear nuevo contacto para el paciente en base de datos
    const targetPhone = (patientData.phone && patientData.phone.replace(/[^0-9]/g, '').length >= 7)
      ? patientData.phone.replace(/[^0-9]/g, '')
      : `paciente-${cleanDoc}-${Date.now().toString().slice(-4)}`;

    const newContactId = `cnt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (this.isPrismaConnected && this.prisma) {
      const created = await this.prisma.contact.create({
        data: {
          id: newContactId,
          phone: targetPhone,
          name: patientData.name,
          documentId: cleanDoc,
          documentType: patientData.documentType,
          birthDate: patientData.birthDate || null,
          email: patientData.email || null,
          residenceCity: patientData.residenceCity || null,
          residenceAddress: patientData.residenceAddress || null,
          userTypeId: patientData.userTypeId || null,
        },
      });
      const mapped = created as ContactData;
      this.contacts.set(mapped.id, mapped);
      return mapped;
    }

    const newContact: ContactData = {
      id: newContactId,
      phone: targetPhone,
      name: patientData.name,
      documentId: cleanDoc,
      documentType: patientData.documentType,
      birthDate: patientData.birthDate,
      email: patientData.email,
      residenceCity: patientData.residenceCity,
      residenceAddress: patientData.residenceAddress,
      userTypeId: patientData.userTypeId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(newContact.id, newContact);
    return newContact;
  }

  public async updateContactProfile(id: string, data: Partial<Pick<ContactData, 'name' | 'documentId' | 'documentType' | 'birthDate' | 'email' | 'residenceCity' | 'residenceAddress'>> & { phone?: string }): Promise<ContactData | undefined> {
    await this.ready;
    const current = this.contacts.get(id);
    if (!current) return undefined;

    // Filtrar únicamente los campos con valores definidos y no vacíos
    const safeData: Partial<ContactData> = {};
    if (data.name !== undefined && data.name !== null && typeof data.name === 'string' && data.name.trim() !== '') {
      safeData.name = data.name.trim();
    }
    if (data.documentId !== undefined && data.documentId !== null && typeof data.documentId === 'string' && data.documentId.trim() !== '') {
      safeData.documentId = data.documentId.trim();
    }
    if (data.documentType !== undefined && data.documentType !== null && typeof data.documentType === 'string' && data.documentType.trim() !== '') {
      safeData.documentType = data.documentType.trim();
    }
    if (data.birthDate !== undefined && data.birthDate !== null) {
      safeData.birthDate = data.birthDate;
    }
    if (data.email !== undefined && data.email !== null && typeof data.email === 'string' && data.email.trim() !== '') {
      safeData.email = data.email.trim();
    }
    if (data.residenceCity !== undefined && data.residenceCity !== null && typeof data.residenceCity === 'string' && data.residenceCity.trim() !== '') {
      safeData.residenceCity = data.residenceCity.trim();
    }
    if (data.residenceAddress !== undefined && data.residenceAddress !== null && typeof data.residenceAddress === 'string' && data.residenceAddress.trim() !== '') {
      safeData.residenceAddress = data.residenceAddress.trim();
    }

    // Actualizar teléfono si no tenía, o si tenía un identificador temporal/LID y ahora se cuenta con un número real
    if (data.phone && typeof data.phone === 'string') {
      const normalizedPhone = normalizeColombianPhone(data.phone);
      if (normalizedPhone && normalizedPhone.length >= 7) {
        const isCurrentLid = !current.phone || current.phone.startsWith('paciente-') || isLidPhone(current.phone);
        if (isCurrentLid || !isLidPhone(normalizedPhone)) {
          safeData.phone = normalizedPhone;
        }
      }
    }

    Object.assign(current, safeData, { updatedAt: new Date() });

    if (this.isPrismaConnected && this.prisma) {
      const updateData: any = {};
      if (safeData.name !== undefined) updateData.name = safeData.name;
      if (safeData.documentId !== undefined) updateData.documentId = safeData.documentId;
      if (safeData.documentType !== undefined) updateData.documentType = safeData.documentType;
      if (safeData.birthDate !== undefined) updateData.birthDate = safeData.birthDate;
      if (safeData.email !== undefined) updateData.email = safeData.email;
      if (safeData.residenceCity !== undefined) updateData.residenceCity = safeData.residenceCity;
      if (safeData.residenceAddress !== undefined) updateData.residenceAddress = safeData.residenceAddress;

      if (safeData.phone && safeData.phone !== current.phone) {
        const existing = await this.prisma.contact.findUnique({ where: { phone: safeData.phone } });
        if (!existing) {
          updateData.phone = safeData.phone;
          current.phone = safeData.phone;
        }
      }

      try {
        const updated = await this.prisma.contact.update({ where: { id }, data: updateData });
        const merged = { ...current, ...updated } as ContactData;
        this.contacts.set(id, merged);
        return merged;
      } catch (err: any) {
        console.error(`⚠️ Error actualizando contacto ${id} en Prisma:`, err.message || err);
        return current;
      }
    }
    return current;
  }

  /**
   * Migra un contacto registrado inicialmente con un identificador temporal de WhatsApp (LID)
   * hacia su número telefónico real (ej: 57310xxxxxxx), consolidando conversaciones y citas.
   */
  public async migrateLidContactToRealPhone(lidPhone: string, realPhone: string): Promise<ContactData | undefined> {
    await this.ready;
    const cleanLid = lidPhone.replace(/\D/g, '');
    const cleanReal = normalizeColombianPhone(realPhone) || realPhone.replace(/\D/g, '');
    if (!cleanLid || !cleanReal || cleanLid === cleanReal) return undefined;

    // 1. Buscar contacto existente con el LID
    let lidContact: ContactData | undefined;
    for (const c of this.contacts.values()) {
      if (c.phone === cleanLid || c.phone === lidPhone) {
        lidContact = c;
        break;
      }
    }

    if (!lidContact && this.isPrismaConnected && this.prisma) {
      const found = await this.prisma.contact.findFirst({
        where: { OR: [{ phone: cleanLid }, { phone: lidPhone }] },
        include: { userType: true },
      });
      if (found) {
        lidContact = {
          ...found,
          userTypeCode: found.userType?.code || 'PARTICULAR',
          userTypeName: found.userType?.name || 'Paciente Particular',
        } as ContactData;
        this.contacts.set(lidContact.id, lidContact);
      }
    }

    if (!lidContact) return undefined;

    console.log(`🔄 [Store] Migrando contacto ${lidContact.id} de LID (${lidContact.phone}) a Teléfono Real: ${cleanReal}`);

    // 2. Buscar si ya existe otro contacto con el teléfono real
    let realContact: ContactData | undefined;
    for (const c of this.contacts.values()) {
      if ((c.phone === cleanReal || (cleanReal.startsWith('57') && c.phone === cleanReal.slice(2))) && c.id !== lidContact.id) {
        realContact = c;
        break;
      }
    }

    if (!realContact && this.isPrismaConnected && this.prisma) {
      const found = await this.prisma.contact.findFirst({
        where: {
          OR: [
            { phone: cleanReal },
            ...(cleanReal.startsWith('57') && cleanReal.length === 12 ? [{ phone: cleanReal.slice(2) }] : []),
          ],
        },
        include: { userType: true },
      });
      if (found && found.id !== lidContact.id) {
        realContact = {
          ...found,
          userTypeCode: found.userType?.code || 'PARTICULAR',
          userTypeName: found.userType?.name || 'Paciente Particular',
        } as ContactData;
        this.contacts.set(realContact.id, realContact);
      }
    }

    if (realContact) {
      // Reasignar conversaciones del contacto LID al contacto con teléfono real
      for (const conv of this.conversations.values()) {
        if (conv.contactId === lidContact.id) {
          conv.contactId = realContact.id;
          conv.contact = realContact;
          if (this.isPrismaConnected && this.prisma) {
            await this.prisma.conversation.update({
              where: { id: conv.id },
              data: { contactId: realContact.id },
            }).catch(() => null);
          }
        }
      }

      // Reasignar citas del contacto LID al contacto con teléfono real
      for (const apt of this.appointments) {
        if (apt.contactId === lidContact.id || apt.contactPhone === cleanLid) {
          apt.contactId = realContact.id;
          apt.contactPhone = cleanReal;
          if (this.isPrismaConnected && this.prisma) {
            await this.prisma.appointment.update({
              where: { id: apt.id },
              data: { contactId: realContact.id },
            }).catch(() => null);
          }
        }
      }

      // Copiar información del paciente si no estaba en realContact
      const toUpdate: any = {};
      if (!realContact.name && lidContact.name) toUpdate.name = lidContact.name;
      if (!realContact.documentId && lidContact.documentId) {
        toUpdate.documentId = lidContact.documentId;
        toUpdate.documentType = lidContact.documentType;
      }
      if (!realContact.email && lidContact.email) toUpdate.email = lidContact.email;
      if (!realContact.birthDate && lidContact.birthDate) toUpdate.birthDate = lidContact.birthDate;
      if (!realContact.residenceCity && lidContact.residenceCity) toUpdate.residenceCity = lidContact.residenceCity;
      if (!realContact.residenceAddress && lidContact.residenceAddress) toUpdate.residenceAddress = lidContact.residenceAddress;

      if (Object.keys(toUpdate).length > 0) {
        Object.assign(realContact, toUpdate);
        if (this.isPrismaConnected && this.prisma) {
          await this.prisma.contact.update({
            where: { id: realContact.id },
            data: toUpdate,
          }).catch(() => null);
        }
      }

      // Eliminar el contacto huérfano con el LID
      this.contacts.delete(lidContact.id);
      if (this.isPrismaConnected && this.prisma) {
        await this.prisma.contact.delete({ where: { id: lidContact.id } }).catch(() => null);
      }

      socketService.emitContactsUpdated(this.getAllContacts());
      return realContact;
    } else {
      // No existe contacto duplicado: simplemente actualizar el teléfono en este contacto
      const oldPhone = lidContact.phone;
      lidContact.phone = cleanReal;
      lidContact.updatedAt = new Date();

      if (this.isPrismaConnected && this.prisma) {
        await this.prisma.contact.update({
          where: { id: lidContact.id },
          data: { phone: cleanReal },
        }).catch(() => null);
      }

      for (const apt of this.appointments) {
        if (apt.contactId === lidContact.id || apt.contactPhone === oldPhone) {
          apt.contactPhone = cleanReal;
        }
      }

      socketService.emitContactsUpdated(this.getAllContacts());
      return lidContact;
    }
  }

  public async updateContactUserType(id: string, userTypeCode: string): Promise<ContactData | undefined> {
    await this.ready;
    const current = this.contacts.get(id);
    if (!current) return undefined;

    let userTypeId: string | undefined;
    let userTypeName = 'Paciente Particular';

    if (this.isPrismaConnected && this.prisma) {
      const uType = await this.prisma.userType.findUnique({ where: { code: userTypeCode } });
      if (uType) {
        userTypeId = uType.id;
        userTypeName = uType.name;
        await this.prisma.contact.update({
          where: { id },
          data: { userTypeId: uType.id },
        }).catch((err) => console.error('Error actualizando userTypeId en contacto:', err));
      }
    }

    current.userTypeId = userTypeId;
    current.userTypeCode = userTypeCode;
    current.userTypeName = userTypeName;
    current.updatedAt = new Date();
    return current;
  }

  public async deleteContact(id: string): Promise<boolean> {
    await this.ready;
    const res = await this.deleteContacts([id]);
    return res.deletedCount > 0;
  }

  public async deleteContacts(ids: string[]): Promise<{ deletedCount: number }> {
    await this.ready;
    const toDeleteIds = ids.length === 0 ? Array.from(this.contacts.keys()) : ids;
    if (toDeleteIds.length === 0) return { deletedCount: 0 };
    const targetSet = new Set(toDeleteIds);

    // 1. Encontrar conversaciones asociadas a estos contactos
    const convIdsToDelete = new Set<string>();
    for (const [convId, conv] of this.conversations.entries()) {
      if (targetSet.has(conv.contactId)) {
        convIdsToDelete.add(convId);
      }
    }

    // 2. Eliminar mensajes de estas conversaciones
    this.messages = this.messages.filter((m) => !convIdsToDelete.has(m.conversationId));

    // 3. Eliminar conversaciones
    for (const convId of convIdsToDelete) {
      this.conversations.delete(convId);
    }

    // 4. Eliminar citas, cotizaciones y tickets de los contactos
    this.appointments = this.appointments.filter((a) => !targetSet.has(a.contactId));
    this.quotes = this.quotes.filter((q) => !targetSet.has(q.contactId));
    this.tickets = this.tickets.filter((t) => !targetSet.has(t.contactId));
    this.npsSurveys = this.npsSurveys.filter((n) => !targetSet.has(n.contactId));

    // 5. Eliminar de la memoria y recolectar teléfonos para limpiar la cola de mensajes
    const deletedPhones: string[] = [];
    let deletedCount = 0;
    for (const id of toDeleteIds) {
      const c = this.contacts.get(id);
      if (c?.phone) {
        deletedPhones.push(c.phone);
        if (c.phone.startsWith('57') && c.phone.length === 12) {
          deletedPhones.push(c.phone.slice(2));
        }
      }
      if (this.contacts.delete(id)) {
        deletedCount++;
      }
    }

    // 6. Eliminar de PostgreSQL (Cascade eliminará conversaciones, mensajes, citas, etc.) y limpiar cola de mensajes entrantes
    if (this.isPrismaConnected && this.prisma) {
      try {
        if (ids.length === 0) {
          await this.prisma.incomingMessageJob.deleteMany().catch(() => null);
          await this.prisma.message.deleteMany().catch(() => null);
          await this.prisma.conversation.deleteMany().catch(() => null);
          await this.prisma.contact.deleteMany();
        } else {
          if (deletedPhones.length > 0) {
            await this.prisma.incomingMessageJob.deleteMany({
              where: { phone: { in: deletedPhones } },
            }).catch(() => null);
          }
          await this.prisma.message.deleteMany({
            where: { conversationId: { in: Array.from(convIdsToDelete) } },
          }).catch(() => null);
          await this.prisma.conversation.deleteMany({
            where: { contactId: { in: toDeleteIds } },
          }).catch(() => null);
          await this.prisma.contact.deleteMany({ where: { id: { in: toDeleteIds } } });
        }
      } catch (error) {
        console.error('Error eliminando contactos en PostgreSQL:', error);
      }
    }

    return { deletedCount };
  }

  public async getOrCreateActiveConversation(contactId: string): Promise<ConversationData> {
    await this.ready;
    if (this.isPrismaConnected && this.prisma) {
      // 1. Buscar si ya existe una conversación para este contacto (sin importar estado)
      let existing = await this.prisma.conversation.findFirst({
        where: { contactId },
        include: { contact: true, messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { updatedAt: 'desc' },
      });

      if (existing) {
        let isReactivated = false;
        let newStatus = existing.status as ConversationStatus;
        let newFlow = existing.currentFlow as ConversationFlow;
        let newStep = existing.currentStep;
        let newFlowData = (existing.flowData || {}) as FlowStateData;

        // Si la conversación estaba cerrada/finalizada o cancelada, se reactiva el bot manteniendo todo el historial previo
        if (existing.status === 'CLOSED' || existing.currentStep === 'CANCELLED_BY_USER' || existing.currentStep === 'SESSION_CLOSED') {
          newStatus = 'BOT';
          newFlow = 'IDLE';
          newStep = 'ROOT_MENU';
          newFlowData = {
            ...newFlowData,
            sessionClosed: false,
            inactivityWarningSent: false,
            sessionClosedAt: undefined,
            cancelledReason: undefined,
            fallbackCount: 0,
          };
          isReactivated = true;
          await this.prisma.conversation.update({
            where: { id: existing.id },
            data: {
              status: newStatus,
              currentFlow: newFlow,
              currentStep: newStep,
              flowData: newFlowData as any,
              updatedAt: new Date(),
            },
          }).catch(() => null);
        }

        const mappedMessages = existing.messages.map((m) => ({ ...m })) as MessageData[];
        mappedMessages.forEach((m) => {
          const idx = this.messages.findIndex((msg) => msg.id === m.id);
          if (idx >= 0) {
            this.messages[idx] = m;
          } else {
            this.messages.push(m);
          }
        });
        const lastMessage = mappedMessages.length > 0 ? mappedMessages[mappedMessages.length - 1] : undefined;

        const conv: ConversationData = {
          ...existing,
          status: newStatus,
          currentFlow: newFlow,
          currentStep: newStep,
          flowData: newFlowData,
          contact: existing.contact as ContactData,
          lastMessage,
          updatedAt: isReactivated ? new Date() : existing.updatedAt,
        };
        this.conversations.set(conv.id, conv);
        return conv;
      }

      // 2. Si no existe, crear una nueva conversación para este contacto
      const created = await this.prisma.conversation.create({
        data: { contactId },
        include: { contact: true },
      });
      const conv: ConversationData = {
        ...created,
        status: created.status as ConversationStatus,
        currentFlow: created.currentFlow as ConversationFlow,
        contact: created.contact as ContactData,
        flowData: created.flowData as FlowStateData,
      };
      this.conversations.set(conv.id, conv);
      return conv;
    }

    // Modo In-Memory Fallback: Buscar por contactId
    for (const conv of this.conversations.values()) {
      if (conv.contactId === contactId) {
        if (conv.status === 'CLOSED' || conv.currentStep === 'CANCELLED_BY_USER' || conv.currentStep === 'SESSION_CLOSED') {
          conv.status = 'BOT';
          conv.currentFlow = 'IDLE';
          conv.currentStep = 'ROOT_MENU';
          conv.flowData = {
            ...conv.flowData,
            sessionClosed: false,
            inactivityWarningSent: false,
            sessionClosedAt: undefined,
            cancelledReason: undefined,
            fallbackCount: 0,
          };
          conv.updatedAt = new Date();
        }
        return conv;
      }
    }

    const newConv: ConversationData = {
      id: `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      contactId,
      status: 'BOT',
      currentFlow: 'IDLE',
      currentStep: 'ROOT',
      flowData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.conversations.set(newConv.id, newConv);
    return newConv;
  }

  public async updateConversation(
    id: string,
    updates: Partial<ConversationData>
  ): Promise<ConversationData | undefined> {
    const conv = this.conversations.get(id);
    if (!conv) return undefined;

    if (updates.status) conv.status = updates.status;
    if (updates.currentFlow) conv.currentFlow = updates.currentFlow;
    if (updates.currentStep) conv.currentStep = updates.currentStep;
    if (updates.flowData) conv.flowData = { ...conv.flowData, ...updates.flowData };
    conv.updatedAt = new Date();

    if (this.isPrismaConnected && this.prisma) {
      await this.prisma.conversation.update({ where: { id }, data: { status: updates.status, currentFlow: updates.currentFlow, currentStep: updates.currentStep, flowData: updates.flowData as any } });
    }

    return conv;
  }

  public deleteConversation(id: string): boolean {
    const existed = this.conversations.delete(id);
    if (existed) {
      this.messages = this.messages.filter((m) => m.conversationId !== id);
      if (this.isPrismaConnected && this.prisma) void this.prisma.conversation.delete({ where: { id } }).catch((error) => console.error('Error eliminando conversación en PostgreSQL:', error));
    }
    return existed;
  }

  public clearConversations(scope: 'ALL' | 'CLOSED' = 'CLOSED'): { deletedCount: number } {
    let deletedCount = 0;
    if (scope === 'ALL') {
      deletedCount = this.conversations.size;
      this.conversations.clear();
      this.messages = [];
      if (this.isPrismaConnected && this.prisma) {
        void this.prisma.incomingMessageJob.deleteMany().catch(() => null);
        void this.prisma.message.deleteMany().catch(() => null);
        void this.prisma.conversation.deleteMany().catch((error) => console.error('Error limpiando conversaciones en PostgreSQL:', error));
      }
    } else {
      const closedIds = new Set<string>();
      for (const [id, conv] of this.conversations.entries()) {
        if (conv.status === 'CLOSED' || conv.currentStep === 'CANCELLED_BY_USER') {
          closedIds.add(id);
          this.conversations.delete(id);
          deletedCount++;
        }
      }
      this.messages = this.messages.filter((m) => !closedIds.has(m.conversationId));
      if (this.isPrismaConnected && this.prisma && closedIds.size > 0) void this.prisma.conversation.deleteMany({ where: { id: { in: [...closedIds] } } }).catch((error) => console.error('Error limpiando conversaciones en PostgreSQL:', error));
    }
    return { deletedCount };
  }

  public async saveMessage(
    conversationId: string,
    sender: SenderType,
    content: string,
    mediaUrl?: string,
    waMessageId?: string,
    interactivePayload?: import('../types').InteractivePayload
  ): Promise<MessageData> {
    await this.ready;
    const msg: MessageData = {
      id: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      conversationId,
      sender,
      content: content.replace(/\*\*/g, ''),
      mediaUrl,
      interactivePayload,
      waMessageId,
      status: sender === 'USER' ? 'delivered' : 'pending',
      createdAt: new Date(),
    };

    if (this.isPrismaConnected && this.prisma) {
      const saved = await this.prisma.message.create({ data: { id: msg.id, conversationId, sender, content: msg.content, mediaUrl: mediaUrl || null, waMessageId: waMessageId || null, status: msg.status, createdAt: msg.createdAt } });
      Object.assign(msg, saved);
      msg.interactivePayload = interactivePayload;
    }

    this.messages.push(msg);

    const conv = this.conversations.get(conversationId);
    if (conv) {
      conv.updatedAt = new Date();
      conv.lastMessage = msg;
    }

    return msg;
  }

  public async updateMessageStatus(id: string, status: string, waMessageId?: string, deliveryError?: string): Promise<MessageData | undefined> {
    await this.ready;
    const message = this.messages.find((item) => item.id === id);
    if (this.isPrismaConnected && this.prisma) {
      await this.prisma.message.update({ where: { id }, data: { status, ...(waMessageId ? { waMessageId } : {}), deliveryError: deliveryError || null } });
    }
    if (message) {
      message.status = status;
      if (waMessageId) message.waMessageId = waMessageId;
      message.deliveryError = deliveryError;
    }
    return message;
  }

  public async updateMessageStatusByWhatsAppId(waMessageId: string, status: string, deliveryError?: string): Promise<MessageData | undefined> {
    await this.ready;
    if (this.isPrismaConnected && this.prisma) {
      await this.prisma.message.updateMany({ where: { waMessageId }, data: { status, deliveryError: deliveryError || null } });
    }
    const message = this.messages.find((item) => item.waMessageId === waMessageId);
    if (message) message.status = status;
    if (message) message.deliveryError = deliveryError;
    return message;
  }

  public async createAppointment(data: Omit<AppointmentData, 'id' | 'createdAt'>): Promise<AppointmentData> {
    await this.ready;
    const contact = this.contacts.get(data.contactId);
    const userTypeId = data.userTypeId || contact?.userTypeId;
    const userTypeCode = data.userTypeCode || contact?.userTypeCode || 'PARTICULAR';
    const userTypeName = data.userTypeName || contact?.userTypeName || 'Paciente Particular';

    const apt: AppointmentData = {
      id: `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...data,
      userTypeId,
      userTypeCode,
      userTypeName,
      contactName: contact?.name || data.contactName,
      contactPhone: contact?.phone || data.contactPhone,
      createdAt: new Date(),
    };
    if (this.isPrismaConnected && this.prisma) {
      let resolvedDoctorId: string | null = null;
      if (apt.doctorId) {
        const d = await this.prisma.doctor.findUnique({ where: { id: apt.doctorId } }).catch(() => null);
        if (d) resolvedDoctorId = d.id;
      }
      if (!resolvedDoctorId && apt.doctorName) {
        const rawName = apt.doctorName.replace(/^Dr\(a\)\.\s*|^Dr\.\s*|^Dra\.\s*/i, '').trim();
        const d = await this.prisma.doctor.findFirst({
          where: { fullName: { contains: rawName, mode: 'insensitive' } },
        }).catch(() => null);
        if (d) resolvedDoctorId = d.id;
      }

      await this.prisma.appointment.create({
        data: {
          id: apt.id,
          contactId: apt.contactId,
          userTypeId: apt.userTypeId || null,
          doctorId: resolvedDoctorId,
          specialty: apt.specialty,
          doctorName: apt.doctorName,
          dateTime: apt.dateTime,
          durationMinutes: apt.durationMinutes || 30,
          isFirstTime: apt.isFirstTime,
          price: apt.price,
          paymentStatus: apt.paymentStatus,
          paymentLink: apt.paymentLink || null,
          isReferral: apt.isReferral,
          referralCode: apt.referralCode || null,
          referralModel: apt.referralModel || null,
          status: apt.status,
          createdAt: apt.createdAt,
        },
      });
    }
    this.appointments.unshift(apt);
    return apt;
  }

  public async cancelAppointmentForContact(
    contactId: string,
    flowData?: FlowStateData
  ): Promise<AppointmentData | undefined> {
    // 1. Verificar si el contacto ya tiene una cita médica confirmada: ¡NUNCA CANCELARLA POR INACTIVIDAD!
    const confirmedStatuses = ['CONFIRMED', 'RESCHEDULED', 'PAID_VIRTUAL', 'PAY_AT_WINDOW', 'CONFIRMED_REFERRAL', 'ATTENDED'];
    const confirmed = this.appointments.find(
      (a) =>
        a.contactId === contactId &&
        confirmedStatuses.includes((a.status || '').toUpperCase())
    );
    if (confirmed) {
      console.log(`🛡️ [Protección Cita] La cita ${confirmed.id} ya se encuentra confirmada (${confirmed.status}). NO se cancela por inactividad.`);
      return confirmed;
    }

    if (this.isPrismaConnected && this.prisma) {
      const dbConfirmed = await this.prisma.appointment.findFirst({
        where: {
          contactId,
          status: { in: confirmedStatuses },
        },
      }).catch(() => null);
      if (dbConfirmed) {
        console.log(`🛡️ [Protección Cita DB] La cita ${dbConfirmed.id} ya se encuentra confirmada (${dbConfirmed.status}) en PostgreSQL. NO se cancela por inactividad.`);
        return {
          ...dbConfirmed,
          paymentStatus: dbConfirmed.paymentStatus || '',
          userTypeCode: '',
          userTypeName: '',
        } as unknown as AppointmentData;
      }
    }

    // 2. Buscar si existe una cita en borrador o pendiente no confirmada
    let apt = this.appointments.find((a) => a.contactId === contactId && a.status !== 'CANCELLED_BY_USER');
    if (apt) {
      apt.status = 'CANCELLED_BY_USER';
      apt.paymentStatus = 'Cancelado por Usuario';
      if (this.isPrismaConnected && this.prisma) await this.prisma.appointment.update({ where: { id: apt.id }, data: { status: apt.status, paymentStatus: apt.paymentStatus } });
      return apt;
    }

    // 3. Si no existía una cita formal pero estaba en proceso de agendamiento sin confirmar, registrar el intento cancelado
    if (flowData?.specialty || flowData?.selectedSlot) {
      const contact = this.contacts.get(contactId);
      const cancelledApt: AppointmentData = {
        id: `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        contactId,
        contactName: contact?.name || flowData?.patientName || 'Paciente Particular',
        contactPhone: contact?.phone,
        specialty: flowData?.specialty || 'Consulta Médica Ambulatoria',
        doctorName: flowData?.selectedSlot?.doctorName || 'Médico HUN (No asignado)',
        dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isFirstTime: flowData?.isFirstTime ?? true,
        price: flowData?.price || 180000,
        paymentStatus: 'Cancelado por Usuario',
        isReferral: !!flowData?.referralCode,
        status: 'CANCELLED_BY_USER',
        createdAt: new Date(),
      };
      this.appointments.unshift(cancelledApt);
      if (this.isPrismaConnected && this.prisma) await this.prisma.appointment.create({ data: { id: cancelledApt.id, contactId: cancelledApt.contactId, specialty: cancelledApt.specialty, doctorName: cancelledApt.doctorName, dateTime: cancelledApt.dateTime, isFirstTime: cancelledApt.isFirstTime, price: cancelledApt.price, paymentStatus: cancelledApt.paymentStatus, isReferral: cancelledApt.isReferral, status: cancelledApt.status, createdAt: cancelledApt.createdAt } });
      return cancelledApt;
    }

    return undefined;
  }

  public getConfirmedAppointmentsByContact(contactId: string): AppointmentData[] {
    const confirmedStatuses = ['CONFIRMED', 'RESCHEDULED', 'PAID_VIRTUAL', 'PAY_AT_WINDOW', 'CONFIRMED_REFERRAL', 'HELD', 'PENDING'];
    return this.appointments.filter(
      (a) =>
        a.contactId === contactId &&
        confirmedStatuses.includes((a.status || '').toUpperCase())
    );
  }

  public async updateAppointmentSlot(
    id: string,
    dateTime: Date,
    doctorName?: string,
    reason?: string
  ): Promise<AppointmentData | undefined> {
    const apt = this.appointments.find((a) => a.id === id);
    if (apt) {
      const previousStatus = apt.status;
      apt.dateTime = dateTime;
      if (doctorName) apt.doctorName = doctorName;
      apt.status = 'RESCHEDULED';
      apt.wasRescheduled = true;
      if (reason) {
        apt.rescheduleReason = reason;
        apt.paymentStatus = `Reprogramado: ${reason}`;
      }
      const historyEntry: AppointmentHistoryEntry = {
        id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        appointmentId: id,
        previousStatus,
        newStatus: 'RESCHEDULED',
        changedBy: 'PATIENT_BOT',
        note: reason ? `Motivo de reprogramación: ${reason}` : 'Reprogramada por el paciente en WhatsApp',
        createdAt: new Date(),
      };
      this.statusHistory.unshift(historyEntry);

      if (this.isPrismaConnected && this.prisma) {
        await this.prisma.appointment
          .update({
            where: { id },
            data: {
              dateTime,
              ...(doctorName ? { doctorName } : {}),
              status: 'RESCHEDULED',
              ...(reason ? { paymentStatus: `Reprogramado: ${reason}` } : {}),
            },
          })
          .catch((err) => console.error('Error reprogramando cita en PostgreSQL:', err));

        await this.prisma.appointmentStatusHistory
          .create({
            data: {
              id: historyEntry.id,
              appointmentId: id,
              previousStatus,
              newStatus: 'RESCHEDULED',
              changedBy: 'PATIENT_BOT',
              note: historyEntry.note,
              createdAt: historyEntry.createdAt,
            },
          })
          .catch(() => null);
      }
    }
    return apt;
  }

  public async cancelAppointment(id: string, reason?: string): Promise<AppointmentData | undefined> {
    const apt = this.appointments.find((a) => a.id === id);
    if (apt) {
      const previousStatus = apt.status;
      apt.status = 'CANCELLED_BY_USER';
      apt.cancellationReason = reason || 'Cancelado por Usuario';
      apt.paymentStatus = reason ? `Cancelado: ${reason}` : 'Cancelado por Usuario';

      const historyEntry: AppointmentHistoryEntry = {
        id: `hist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        appointmentId: id,
        previousStatus,
        newStatus: 'CANCELLED_BY_USER',
        changedBy: 'PATIENT_BOT',
        note: reason ? `Motivo de cancelación: ${reason}` : 'Cancelada por el paciente en WhatsApp',
        createdAt: new Date(),
      };
      this.statusHistory.unshift(historyEntry);

      if (this.isPrismaConnected && this.prisma) {
        await this.prisma.appointment
          .update({
            where: { id },
            data: {
              status: 'CANCELLED_BY_USER',
              paymentStatus: reason ? `Cancelado: ${reason}` : 'Cancelado por Usuario',
            },
          })
          .catch((err) => console.error('Error cancelando cita en PostgreSQL:', err));

        await this.prisma.appointmentStatusHistory
          .create({
            data: {
              id: historyEntry.id,
              appointmentId: id,
              previousStatus,
              newStatus: 'CANCELLED_BY_USER',
              changedBy: 'PATIENT_BOT',
              note: historyEntry.note,
              createdAt: historyEntry.createdAt,
            },
          })
          .catch(() => null);
      }
    }
    return apt;
  }

  public updateAppointmentStatus(id: string, status: string): AppointmentData | undefined {
    const apt = this.appointments.find((a) => a.id === id);
    if (apt) {
      apt.status = status;
      if (this.isPrismaConnected && this.prisma) void this.prisma.appointment.update({ where: { id }, data: { status } }).catch((error) => console.error('Error actualizando cita en PostgreSQL:', error));
    }
    return apt;
  }

  public deleteAppointment(id: string): boolean {
    const initLen = this.appointments.length;
    this.appointments = this.appointments.filter((a) => a.id !== id);
    if (this.isPrismaConnected && this.prisma) {
      void this.prisma.appointment.delete({ where: { id } }).catch((error) => console.error('Error eliminando cita en PostgreSQL:', error));
    }
    return this.appointments.length < initLen || this.isPrismaConnected;
  }

  public clearAppointments(scope: 'ALL' | 'CANCELLED' = 'CANCELLED'): { deletedCount: number } {
    const initLen = this.appointments.length;
    if (scope === 'ALL') {
      this.appointments = [];
    } else {
      this.appointments = this.appointments.filter(
        (a) => a.status !== 'CANCELLED_BY_USER' && a.status !== 'CANCELLED'
      );
    }
    if (this.isPrismaConnected && this.prisma) {
      void this.prisma.appointment.deleteMany({
        where: scope === 'CANCELLED' ? { status: { in: ['CANCELLED', 'CANCELLED_BY_USER'] } } : undefined
      }).catch((error) => console.error('Error limpiando citas en PostgreSQL:', error));
    }
    return { deletedCount: initLen - this.appointments.length };
  }

  public async createSurgicalQuote(data: Omit<SurgicalQuoteData, 'id' | 'createdAt'>): Promise<SurgicalQuoteData> {
    await this.ready;
    const contact = this.contacts.get(data.contactId);
    const userTypeId = data.userTypeId || contact?.userTypeId;
    const userTypeCode = data.userTypeCode || contact?.userTypeCode || 'PARTICULAR';
    const userTypeName = data.userTypeName || contact?.userTypeName || 'Paciente Particular';

    const qte: SurgicalQuoteData = {
      id: `qte-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...data,
      userTypeId,
      userTypeCode,
      userTypeName,
      contactName: contact?.name,
      contactPhone: contact?.phone,
      createdAt: new Date(),
    };
    this.quotes.unshift(qte);
    if (this.isPrismaConnected && this.prisma) {
      await this.prisma.surgicalQuote.create({
        data: {
          id: qte.id,
          contactId: qte.contactId,
          userTypeId: qte.userTypeId || null,
          procedureDescription: qte.procedureDescription,
          hasMedicalOrder: qte.hasMedicalOrder,
          hasActiveEps: qte.hasActiveEps,
          medicalOrderFileUrl: qte.medicalOrderFileUrl || null,
          status: qte.status,
          cupsCode: qte.cupsCode || null,
          quotedAmount: qte.quotedAmount ?? null,
          createdAt: qte.createdAt,
        },
      });
    }
    return qte;
  }

  public deleteQuote(id: string): boolean {
    const initLen = this.quotes.length;
    this.quotes = this.quotes.filter((q) => q.id !== id);
    if (this.isPrismaConnected && this.prisma) {
      void this.prisma.surgicalQuote.delete({ where: { id } }).catch((error) => console.error('Error eliminando cotización en PostgreSQL:', error));
    }
    return this.quotes.length < initLen || this.isPrismaConnected;
  }

  public clearQuotes(): { deletedCount: number } {
    const deletedCount = this.quotes.length;
    this.quotes = [];
    if (this.isPrismaConnected && this.prisma) {
      void this.prisma.surgicalQuote.deleteMany().catch((error) => console.error('Error limpiando cotizaciones en PostgreSQL:', error));
    }
    return { deletedCount };
  }

  public async createSupportTicket(data: Omit<SupportTicketData, 'id' | 'createdAt'>): Promise<SupportTicketData> {
    await this.ready;
    const contact = this.contacts.get(data.contactId);
    const tkt: SupportTicketData = {
      id: `tkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...data,
      contactName: contact?.name,
      contactPhone: contact?.phone,
      createdAt: new Date(),
    };
    this.tickets.unshift(tkt);
    if (this.isPrismaConnected && this.prisma) await this.prisma.supportTicket.create({ data: { id: tkt.id, contactId: tkt.contactId, type: tkt.type, priority: tkt.priority, status: tkt.status, description: tkt.description, resolvedAt: tkt.resolvedAt || null, createdAt: tkt.createdAt } });
    return tkt;
  }

  public deleteTicket(id: string): boolean {
    const initLen = this.tickets.length;
    this.tickets = this.tickets.filter((t) => t.id !== id);
    if (this.isPrismaConnected && this.prisma) {
      void this.prisma.supportTicket.delete({ where: { id } }).catch((error) => console.error('Error eliminando ticket en PostgreSQL:', error));
    }
    return this.tickets.length < initLen || this.isPrismaConnected;
  }

  public clearTickets(scope: 'ALL' | 'RESOLVED' | 'NON_CRITICAL' = 'ALL'): { deletedCount: number } {
    const initLen = this.tickets.length;
    if (scope === 'ALL') {
      this.tickets = [];
    } else if (scope === 'RESOLVED') {
      this.tickets = this.tickets.filter((t) => t.status !== 'RESOLVED');
    } else if (scope === 'NON_CRITICAL') {
      this.tickets = this.tickets.filter((t) => t.priority === 'CRITICAL');
    }
    if (this.isPrismaConnected && this.prisma) {
      void this.prisma.supportTicket.deleteMany({
        where: scope === 'ALL' ? undefined : scope === 'RESOLVED' ? { status: 'RESOLVED' } : { priority: { not: 'CRITICAL' } }
      }).catch((error) => console.error('Error limpiando tickets en PostgreSQL:', error));
    }
    return { deletedCount: initLen - this.tickets.length };
  }

  public async createNpsSurvey(data: Omit<NpsSurveyData, 'id' | 'createdAt'>): Promise<NpsSurveyData> {
    await this.ready;
    const contact = this.contacts.get(data.contactId);
    const nps: NpsSurveyData = {
      id: `nps-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...data,
      contactName: contact?.name,
      contactPhone: contact?.phone,
      createdAt: new Date(),
    };
    this.npsSurveys.unshift(nps);
    if (this.isPrismaConnected && this.prisma) await this.prisma.npsSurvey.create({ data: { id: nps.id, contactId: nps.contactId, rating: nps.rating, comment: nps.comment || null, hasPqrs: nps.hasPqrs, createdAt: nps.createdAt } });
    return nps;
  }

  public getAllConversations(): ConversationData[] {
    const contactMap = new Map<string, ConversationData>();

    // Ordenar de más reciente a más antiguo
    const sorted = Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    for (const conv of sorted) {
      if (!contactMap.has(conv.contactId)) {
        const contact = this.contacts.get(conv.contactId);
        const convMsgs = this.messages
          .filter((m) => m.conversationId === conv.id)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const lastMessage = convMsgs.length > 0 ? convMsgs[convMsgs.length - 1] : undefined;
        contactMap.set(conv.contactId, {
          ...conv,
          contact,
          lastMessage,
        });
      }
    }

    return Array.from(contactMap.values());
  }

  private enrichAppointment(apt: AppointmentData): AppointmentData {
    const aptHistory = this.statusHistory.filter((h) => h.appointmentId === apt.id);
    const rescheduleEvents = aptHistory.filter((h) => (h.newStatus || '').toUpperCase() === 'RESCHEDULED');
    const cancelEvents = aptHistory.filter((h) =>
      ['CANCELLED', 'CANCELLED_BY_USER'].includes((h.newStatus || '').toUpperCase())
    );

    const paymentStr = apt.paymentStatus || '';
    const reasonFromPaymentReschedule = paymentStr.startsWith('Reprogramado:')
      ? paymentStr.replace(/^Reprogramado:\s*/i, '').trim()
      : undefined;
    const reasonFromPaymentCancel = paymentStr.startsWith('Cancelado:')
      ? paymentStr.replace(/^Cancelado:\s*/i, '').trim()
      : undefined;

    const latestRescheduleNote = rescheduleEvents[0]?.note
      ? rescheduleEvents[0].note.replace(/^Motivo de reprogramación:\s*/i, '').trim()
      : undefined;
    const latestCancelNote = cancelEvents[0]?.note
      ? cancelEvents[0].note.replace(/^Motivo de cancelación:\s*/i, '').trim()
      : undefined;

    const wasRescheduled =
      Boolean(apt.wasRescheduled) ||
      (apt.status || '').toUpperCase() === 'RESCHEDULED' ||
      rescheduleEvents.length > 0 ||
      Boolean(reasonFromPaymentReschedule);

    const rescheduleCount = Math.max(rescheduleEvents.length, wasRescheduled ? 1 : 0);
    const rescheduleReason = apt.rescheduleReason || latestRescheduleNote || reasonFromPaymentReschedule;
    const cancellationReason =
      apt.cancellationReason ||
      latestCancelNote ||
      reasonFromPaymentCancel ||
      (['CANCELLED', 'CANCELLED_BY_USER'].includes((apt.status || '').toUpperCase()) ? 'Cancelado por Usuario' : undefined);

    return {
      ...apt,
      wasRescheduled,
      rescheduleCount,
      rescheduleReason,
      cancellationReason,
      statusHistory: aptHistory,
    };
  }

  public getAllContacts(): ContactData[] {
    const allEnrichedApts = this.getAllAppointments();
    return Array.from(this.contacts.values())
      .map((contact) => {
        const cleanContactPhone = (contact.phone || '').replace(/[^0-9]/g, '');
        const patientApts = allEnrichedApts.filter(
          (a) =>
            a.contactId === contact.id ||
            (cleanContactPhone &&
              a.contactPhone &&
              a.contactPhone.replace(/[^0-9]/g, '').includes(cleanContactPhone))
        );

        const cancellationReasons: NonNullable<ContactData['cancellationReasons']> = [];
        const rescheduleReasons: NonNullable<ContactData['rescheduleReasons']> = [];

        for (const apt of patientApts) {
          const hist = apt.statusHistory || [];
          const cancelHist = hist.filter((h) =>
            ['CANCELLED', 'CANCELLED_BY_USER'].includes((h.newStatus || '').toUpperCase())
          );
          if (cancelHist.length > 0) {
            for (const ch of cancelHist) {
              cancellationReasons.push({
                appointmentId: apt.id,
                specialty: apt.specialty,
                doctorName: apt.doctorName,
                reason: (ch.note || '').replace(/^Motivo de cancelación:\s*/i, '').trim() || apt.cancellationReason || 'No especificado',
                date: ch.createdAt,
              });
            }
          } else if (['CANCELLED', 'CANCELLED_BY_USER'].includes((apt.status || '').toUpperCase())) {
            cancellationReasons.push({
              appointmentId: apt.id,
              specialty: apt.specialty,
              doctorName: apt.doctorName,
              reason: apt.cancellationReason || 'Cancelado por Usuario',
              date: apt.createdAt,
            });
          }

          const reschedHist = hist.filter((h) => (h.newStatus || '').toUpperCase() === 'RESCHEDULED');
          if (reschedHist.length > 0) {
            for (const rh of reschedHist) {
              rescheduleReasons.push({
                appointmentId: apt.id,
                specialty: apt.specialty,
                doctorName: apt.doctorName,
                reason: (rh.note || '').replace(/^Motivo de reprogramación:\s*/i, '').trim() || apt.rescheduleReason || 'Reprogramada por el paciente',
                date: rh.createdAt,
              });
            }
          } else if (apt.wasRescheduled || (apt.status || '').toUpperCase() === 'RESCHEDULED') {
            rescheduleReasons.push({
              appointmentId: apt.id,
              specialty: apt.specialty,
              doctorName: apt.doctorName,
              reason: apt.rescheduleReason || 'Reprogramada por el paciente',
              date: apt.dateTime,
            });
          }
        }

        return {
          ...contact,
          cancellationCount: cancellationReasons.length,
          cancellationReasons,
          rescheduleCount: rescheduleReasons.length,
          wasRescheduled: rescheduleReasons.length > 0,
          rescheduleReasons,
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  public getConversationById(id: string): ConversationData | undefined {
    const conv = this.conversations.get(id);
    if (!conv) return undefined;
    const contact = this.contacts.get(conv.contactId);
    return { ...conv, contact };
  }

  public getConversationMessages(conversationId: string): MessageData[] {
    return this.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  public getAllAppointments(): AppointmentData[] {
    return this.appointments.map((apt) => this.enrichAppointment(apt));
  }

  public getAllQuotes(): SurgicalQuoteData[] {
    return this.quotes;
  }

  public getAllTickets(): SupportTicketData[] {
    return this.tickets;
  }

  public getMetrics() {
    const totalConversations = this.conversations.size;
    const botClosedConversations = Array.from(this.conversations.values()).filter(
      (c) => c.status === 'BOT' || c.status === 'CLOSED'
    ).length;
    const requiresAgent = Array.from(this.conversations.values()).filter(
      (c) => c.status === 'REQUIRES_AGENT'
    ).length;
    const totalAppointments = this.appointments.length;
    const totalQuotes = this.quotes.length;
    const criticalAlarms = this.tickets.filter((t) => t.priority === 'CRITICAL' && t.status === 'OPEN').length;
    const openTickets = this.tickets.filter((t) => t.status === 'OPEN').length;

    const totalNps = this.npsSurveys.length;
    const avgNps =
      totalNps > 0
        ? (this.npsSurveys.reduce((acc, curr) => acc + curr.rating, 0) / totalNps).toFixed(1)
        : '4.8';

    const botAutomationRate =
      totalConversations > 0
        ? Math.round((botClosedConversations / totalConversations) * 100)
        : 85;

    return {
      totalConversations,
      requiresAgent,
      totalAppointments,
      totalQuotes,
      criticalAlarms,
      openTickets,
      avgNps,
      botAutomationRate,
      // Estado de persistencia real en PostgreSQL vía Prisma ORM
      isDatabaseConnected: this.isPrismaConnected,
      isDatabaseAvailable: this.isPrismaConnected,
    };
  }
}

export const store = new DataStore();
