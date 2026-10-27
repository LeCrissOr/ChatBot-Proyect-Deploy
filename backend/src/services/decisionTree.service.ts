import { BotReplyResult, ConversationFlow, FlowStateData, SpecialtyConfig, DynamicSlot } from '../types';
import { AgendaService } from './agenda.service';
import { HunApiService, normalizeHosvitalDocType } from './hunApi.service';
import { PreparacionesService } from './preparaciones.service';
import { TarifasService } from './tarifas.service';
import { CONFIG } from '../config';
import { store } from './store.service';
import { normalizeColombianPhone, isLidPhone, formatPhoneFriendly } from '../utils/phone';

// Especialidades oficiales disponibles en HUN para paciente particular (Catálogo Ambulatorio HUN)
export const HUN_SPECIALTIES: Record<string, SpecialtyConfig> = {
  'medicina interna': { id: 'med_interna', name: 'Medicina Interna', fee: 160000, slots: [] },
  'dermatologia': { id: 'dermatologia', name: 'Dermatología', fee: 160000, slots: [] },
  'cardiologia': { id: 'cardiologia', name: 'Cardiología', fee: 160000, slots: [] },
  'ortopedia': { id: 'ortopedia', name: 'Ortopedia y Traumatología', fee: 160000, slots: [] },
  'ginecologia': { id: 'ginecologia', name: 'Ginecología y Obstetricia', fee: 160000, slots: [] },
  'neurologia': { id: 'neurologia', name: 'Neurología', fee: 160000, slots: [] },
  'oftalmologia': { id: 'oftalmologia', name: 'Oftalmología', fee: 160000, slots: [] },
  'urologia': { id: 'urologia', name: 'Urología', fee: 160000, slots: [] },
  'anestesiologia': { id: 'anestesiologia', name: 'Anestesiología', fee: 160000, slots: [] },
  'anestesiologia cardiovascular': { id: 'anestesiologia_cardiovascular', name: 'Anestesiología Cardiovascular', fee: 160000, slots: [] },
  'cirugia de mano': { id: 'cirugia_mano', name: 'Cirugía de la Mano', fee: 160000, slots: [] },
  'cirugia cardiovascular': { id: 'cirugia_cardiovascular', name: 'Cirugía Cardiovascular', fee: 160000, slots: [] },
  'cirugia gastrointestinal': { id: 'cirugia_gastrointestinal', name: 'Cirugía Gastrointestinal', fee: 160000, slots: [] },
  'cirugia general': { id: 'cirugia_general', name: 'Cirugía General', fee: 160000, slots: [] },
  'cirugia hepatobiliar': { id: 'cirugia_hepatobiliar', name: 'Cirugía Hepatobiliar', fee: 160000, slots: [] },
  'cirugia maxilofacial': { id: 'cirugia_maxilofacial', name: 'Cirugía Maxilofacial', fee: 160000, slots: [] },
  'cirugia oncologica': { id: 'cirugia_oncologica', name: 'Cirugía Oncológica', fee: 160000, slots: [] },
  'cirugia plastica': { id: 'cirugia_plastica', name: 'Cirugía Plástica, Estética y Reconstructiva', fee: 160000, slots: [] },
  'cirugia vascular': { id: 'cirugia_vascular', name: 'Cirugía Vascular', fee: 160000, slots: [] },
  'cirugia de cabeza y cuello': { id: 'cirugia_cabeza_cuello', name: 'Cirugía de Cabeza y Cuello', fee: 160000, slots: [] },
  'cirugia de torax': { id: 'cirugia_torax', name: 'Cirugía de Tórax', fee: 160000, slots: [] },
  'dermatologia oncologica': { id: 'dermatologia_oncologica', name: 'Dermatología Oncológica', fee: 160000, slots: [] },
  'dolor y cuidados paliativos': { id: 'dolor_paliativos', name: 'Dolor y Cuidados Paliativos', fee: 160000, slots: [] },
  'electrofisiologia': { id: 'electrofisiologia', name: 'Electrofisiología', fee: 160000, slots: [] },
  'endocrinologia': { id: 'endocrinologia', name: 'Endocrinología', fee: 160000, slots: [] },
  'fisioterapia': { id: 'fisioterapia', name: 'Fisioterapia', fee: 90000, slots: [] },
  'fonoaudiologia': { id: 'fonoaudiologia', name: 'Fonoaudiología', fee: 90000, slots: [] },
  'gastroenterologia': { id: 'gastroenterologia', name: 'Gastroenterología', fee: 160000, slots: [] },
  'genetica medica': { id: 'genetica_medica', name: 'Genética Médica', fee: 160000, slots: [] },
  'geriatria': { id: 'geriatria', name: 'Geriatría', fee: 160000, slots: [] },
  'hematologia': { id: 'hematologia', name: 'Hematología', fee: 160000, slots: [] },
  'infectologia': { id: 'infectologia', name: 'Infectología', fee: 160000, slots: [] },
  'medicina del deporte': { id: 'medicina_deporte', name: 'Medicina del Deporte', fee: 160000, slots: [] },
  'medicina fisica y rehabilitacion': { id: 'medicina_rehabilitacion', name: 'Medicina Física y Rehabilitación', fee: 160000, slots: [] },
  'medicina general': { id: 'medicina_general', name: 'Medicina General', fee: 100000, slots: [] },
  'neumologia': { id: 'neumologia', name: 'Neumología', fee: 160000, slots: [] },
  'neurocirugia': { id: 'neurocirugia', name: 'Neurocirugía', fee: 160000, slots: [] },
  'neuropsicologia': { id: 'neuropsicologia', name: 'Neuropsicología', fee: 120000, slots: [] },
  'nutricion y dietetica': { id: 'nutricion', name: 'Nutrición y Dietética', fee: 110000, slots: [] },
  'odontologia general': { id: 'odontologia', name: 'Odontología General', fee: 95000, slots: [] },
  'oncologia': { id: 'oncologia', name: 'Oncología', fee: 160000, slots: [] },
  'otologia': { id: 'otologia', name: 'Otología', fee: 160000, slots: [] },
  'otorrinolaringologia': { id: 'otorrinolaringologia', name: 'Otorrinolaringología', fee: 160000, slots: [] },
  'psicologia': { id: 'psicologia', name: 'Psicología', fee: 110000, slots: [] },
  'psiquiatria': { id: 'psiquiatria', name: 'Psiquiatría', fee: 160000, slots: [] },
  'radiologia intervencionista': { id: 'radiologia_intervencionista', name: 'Radiología Intervencionista', fee: 160000, slots: [] },
  'reumatologia': { id: 'reumatologia', name: 'Reumatología', fee: 160000, slots: [] },
  'terapia ocupacional': { id: 'terapia_ocupacional', name: 'Terapia Ocupacional', fee: 90000, slots: [] },
};

// Horarios prioritarios reservados para referidos (F-03)
export const PRIORITY_REFERRAL_SLOTS = [
  { id: 'ref-slot-1', doctorName: 'Dr. Gabriel Fonseca (Especialista HUN)', dateTime: 'Mañana 07:00 AM (Cupo Prioritario)' },
  { id: 'ref-slot-2', doctorName: 'Dra. Marcela Rincón (Especialista HUN)', dateTime: 'Mañana 12:30 PM (Cupo Prioritario)' },
  { id: 'ref-slot-3', doctorName: 'Dr. Roberto Mendoza (Especialista HUN)', dateTime: 'Pasado mañana 07:30 AM (Cupo Prioritario)' },
];

export class DecisionTreeService {
  /**
   * Procesa un mensaje entrante según el árbol de flujos conversacionales HUN v1.0
   */
  public static async processMessage(
    userText: string,
    currentFlow: ConversationFlow,
    currentStep: string,
    stateData: FlowStateData,
    patientSavedName?: string
  ): Promise<BotReplyResult> {
    const text = userText.trim();
    const lower = text.toLowerCase();
    let data = { ...stateData };

    if (/^(hola|buen ?d[ií]a|buenos d[ií]as|buenas tardes|buenas noches)[!,. ]*$/i.test(lower)) {
      return this.getWelcomeFlow();
    }

    // 1. Detección proactiva de idioma extranjero (E-008)
    if (this.isEnglish(lower) && currentFlow === 'IDLE') {
      return this.sanitizeResult({
        replyMessages: [
          'Hello! Welcome to Hospital Universitario Nacional (HUN) Particular Patient Service 🏥',
          'An English-speaking representative has been assigned to assist you. A staff member will reply to this chat shortly.',
        ],
        nextFlow: 'F04_AUXILIAR',
        nextStep: 'ASSIGNED',
        status: 'REQUIRES_AGENT',
        updatedData: { ...data, isInternational: true },
        createTicket: {
          type: 'E008_INTERNATIONAL_PATIENT',
          priority: 'NORMAL',
          description: `Paciente internacional escribió en inglés: "${text}"`,
        },
      });
    }

    // 2. Si el chat está en manos de un auxiliar humano, el bot no responde
    // (A menos que el usuario escriba comandos para reiniciar)
    if (currentFlow === 'F04_AUXILIAR' && currentStep === 'ASSIGNED') {
      if (lower === 'menu' || lower === 'inicio' || lower === 'reiniciar' || lower === 'bot') {
        return this.getRootMenu();
      }
      return this.sanitizeResult({
        replyMessages: [
          'Tu chat está asignado a un auxiliar de atención particular del HUN. En breve te responderá directamente. (Escribe "menu" si deseas volver al bot automático).',
        ],
        nextFlow: 'F04_AUXILIAR',
        nextStep: 'ASSIGNED',
        status: 'REQUIRES_AGENT',
        updatedData: data,
      });
    }

    // Si el usuario se encuentra en las opciones post-confirmación de cita (1: Menú principal, 2: Terminar conversación)
    if (currentStep === 'POST_CONFIRMATION_OPTIONS') {
      return this.handlePostConfirmationOptions(text, lower, data, patientSavedName);
    }

    // Comandos universales de navegación (en CANCELAR_CITA la palabra "cancelar" forma parte de la confirmación)
    if (lower === 'menu' || lower === 'inicio' || (lower === 'cancelar' && currentFlow !== 'CANCELAR_CITA')) {
      return this.getRootMenu();
    }

    // Rutas de flujos
    let result: BotReplyResult;
    switch (currentFlow) {
      case 'IDLE':
        result = await this.handleRootSelection(text, lower, currentStep, data, patientSavedName);
        break;

      case 'PATIENT_REGISTRATION':
        result = this.handlePatientRegistration(text, lower, currentStep, data);
        break;

      case 'F01_CONSULTA':
        result = await this.handleF01Consulta(text, lower, currentStep, data, patientSavedName);
        break;

      case 'F02_QUIRURGICO':
        result = this.handleF02Quirurgico(text, lower, currentStep, data);
        break;

      case 'F03_REFERIDO':
        result = await this.handleF03Referido(text, lower, currentStep, data, patientSavedName);
        break;

      case 'REPROGRAMAR_CITA':
        result = await this.handleReprogramarCita(text, lower, currentStep, data, patientSavedName);
        break;

      case 'CANCELAR_CITA':
        result = await this.handleCancelarCita(text, lower, currentStep, data, patientSavedName);
        break;

      case 'POST_CONSULTA':
        result = this.handlePostConsulta(text, lower, currentStep, data);
        break;

      case 'POST_QX':
        result = this.handlePostQx(text, lower, currentStep, data);
        break;

      case 'PREPARACIONES_INFO':
        result = await this.handlePreparacionesInfo(text, lower, currentStep, data, patientSavedName);
        break;

      case 'NPS_SURVEY':
        result = this.handleNpsSurvey(text, lower, currentStep, data);
        break;

      default:
        result = this.getRootMenu(patientSavedName);
        break;
    }

    return this.sanitizeResult(result);
  }

  /**
   * Sanitiza cualquier doble asterisco ** en las respuestas salientes
   */
  private static sanitizeResult(result: BotReplyResult): BotReplyResult {
    return {
      ...result,
      replyMessages: result.replyMessages.map((m) => m.replace(/\*\*/g, '')),
    };
  }

  /**
   * Menú Principal del HUN (Árbol Página 1)
   */
  public static getWelcomeFlow(): BotReplyResult {
    return this.sanitizeResult({
      mediaUrl: '/nicol-sticker-clean.png',
      mediaType: 'sticker',
      replyMessages: [
        '¡Hola! Te damos la bienvenida al Hospital Universitario Nacional de Colombia.\n\n"Yo te cuido: Seguro" 🏥\n\nAl hacer uso de este canal, estás aceptando las Políticas de Tratamiento de la información (Datos personales) de nuestra institución que puedes consultar en https://www.hun.edu.co/politicas-de-tratamiento-de-datos-personales',
        'Indícanos por favor quién realizará la solicitud:\n\n1️⃣ Paciente Particular\n2️⃣ Egresado Universidad Nacional de Colombia\n3️⃣ Colaborador HUN\n4️⃣ Otro (Contactar con un asesor)\n\n(Puedes pulsar el botón o responder con el número de tu opción)',
      ],
      interactivePayload: {
        type: 'list',
        title: 'Tipo de Usuario',
        buttonText: '📋 Seleccionar Perfil',
        options: [
          { id: '1', title: '1. Paciente Particular', description: 'Tarifa Estándar HUN para usuarios particulares' },
          { id: '2', title: '2. Egresado UNAL', description: 'Tarifas preferenciales de la Universidad Nacional' },
          { id: '3', title: '3. Colaborador HUN', description: 'Tarifas institucionales HUN 2024 para colaboradores' },
          { id: '4', title: '4. Otro / Asesor', description: 'Contactar directamente con un asesor de atención' },
        ],
      },
      nextFlow: 'IDLE',
      nextStep: 'SELECT_USER_TYPE',
      updatedData: { fallbackCount: 0 },
    });
  }

  public static getRootMenu(_patientName?: string, userTypeMessage?: string): BotReplyResult {
    const greeting = _patientName ? `¡Hola ${_patientName}!\n\n` : '';
    const note = userTypeMessage ? `${userTypeMessage}\n\n` : '';
    return this.sanitizeResult({
      replyMessages: [
        `${greeting}${note}¿Cómo podemos ayudarte?\n\nEscoge una de las siguientes opciones:\n1️⃣ Cita Médica\n2️⃣ Laboratorios\n3️⃣ Radiología\n4️⃣ Cotizar Procedimientos Quirúrgicos\n5️⃣ Contactar con un asesor\n\n(Puedes pulsar el botón de opciones o responder con el número)`,
      ],
      interactivePayload: {
        type: 'list',
        title: 'Menú Principal HUN',
        buttonText: '📋 Ver Menú de Opciones',
        options: [
          { id: '1', title: '1. Cita Médica', description: 'Agendar, reprogramar o cancelar citas médicas con especialistas' },
          { id: '2', title: '2. Laboratorios', description: 'Preparación, ayuno y tarifas de exámenes de laboratorio clínico' },
          { id: '3', title: '3. Radiología', description: 'Preparación y tarifas de imágenes diagnósticas, ecografías y RX' },
          { id: '4', title: '4. Cotizar Procedimientos', description: 'Cotización de cirugías y procedimientos quirúrgicos' },
          { id: '5', title: '5. Contactar con Asesor', description: 'Habla directamente con un asesor de atención al usuario' },
        ],
      },
      nextFlow: 'IDLE',
      nextStep: 'ROOT_MENU',
      updatedData: { fallbackCount: 0 },
    });
  }

  /**
   * Genera la Ficha de Datos del Usuario
   */
  public static formatUserFicha(data: {
    name?: string;
    documentType?: string;
    documentId?: string;
    birthDate?: string;
    phone?: string;
    email?: string;
    city?: string;
    address?: string;
  }): string {
    const docType = data.documentType || 'Cédula de Ciudadanía';
    const docId = data.documentId || 'No registrado';
    const name = data.name || 'No registrado';
    const phone = data.phone && !isLidPhone(data.phone) ? formatPhoneFriendly(data.phone) : 'No registrado';
    const email = data.email || 'No registrado';
    const city = data.city || 'Bogotá D.C.';
    const address = data.address || 'No registrada';

    return [
      '📋 *FICHA DE DATOS DEL USUARIO*',
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      `👤 *Nombre Completo:* ${name}`,
      `🪪 *Tipo de Documento:* ${docType}`,
      `🔢 *Número de Documento:* ${docId}`,
      `🎂 *Fecha de Nacimiento:* ${data.birthDate || 'No registrada'}`,
      `📱 *Teléfono / Celular:* ${phone}`,
      `📧 *Correo Electrónico:* ${email}`,
      `🏙️ *Ciudad de Residencia:* ${city}`,
      `📍 *Dirección de Residencia:* ${address}`,
      '━━━━━━━━━━━━━━━━━━━━━━━━',
    ].join('\n');
  }

  /**
   * Panel de opciones de corrección de datos del usuario
   */
  public static getCorrectionPanel(data: FlowStateData): BotReplyResult {
    return this.sanitizeResult({
      replyMessages: [
        'Indícanos por favor qué dato deseas corregir:\n\n1️⃣ Número de Documento\n2️⃣ Tipo de Documento\n3️⃣ Nombre Completo\n4️⃣ Teléfono / Celular\n5️⃣ Correo Electrónico\n6️⃣ Ciudad de Residencia\n7️⃣ Dirección de Residencia\n\n(Puedes responder con el número de la opción que deseas modificar)',
      ],
      interactivePayload: {
        type: 'list',
        title: 'Corregir Datos',
        buttonText: '✏️ Seleccionar Dato',
        options: [
          { id: '1', title: '1. Número Documento', description: `Actual: ${data.patientDoc || 'No registrado'}` },
          { id: '2', title: '2. Tipo Documento', description: `Actual: ${data.patientDocumentType || 'Cédula de Ciudadanía'}` },
          { id: '3', title: '3. Nombre Completo', description: `Actual: ${data.patientName || 'No registrado'}` },
          { id: '4', title: '4. Teléfono / Celular', description: `Actual: ${data.patientPhone || 'No registrado'}` },
          { id: '5', title: '5. Correo Electrónico', description: `Actual: ${data.patientEmail || 'No registrado'}` },
          { id: '6', title: '6. Ciudad de Residencia', description: `Actual: ${data.residenceCity || 'Bogotá D.C.'}` },
          { id: '7', title: '7. Dirección Residencia', description: `Actual: ${data.residenceAddress || 'No registrada'}` },
        ],
      },
      nextFlow: 'IDLE',
      nextStep: 'SELECT_FIELD_TO_EDIT',
      updatedData: { ...data, fallbackCount: 0 },
    });
  }

  /**
   * Genera la Ficha de Datos del Paciente (cuando la cita es para alguien más o paciente asistido)
   */
  public static formatPatientFicha(data: {
    patientName?: string;
    patientDocumentType?: string;
    patientDoc?: string;
    patientPhone?: string;
    patientEmail?: string;
    patientCity?: string;
    patientAddress?: string;
    applicantName?: string;
    applicantDoc?: string;
  }): string {
    const docType = data.patientDocumentType || 'Cédula de Ciudadanía';
    const docId = data.patientDoc || 'No registrado';
    const name = data.patientName || 'No registrado';
    const phone = data.patientPhone && !isLidPhone(data.patientPhone) ? formatPhoneFriendly(data.patientPhone) : 'No registrado';
    const email = data.patientEmail || 'No registrado';
    const city = data.patientCity || 'Bogotá D.C.';
    const address = data.patientAddress || 'No registrada';

    const lines = [
      '📋 *FICHA DE DATOS DEL PACIENTE* 🏥',
      '━━━━━━━━━━━━━━━━━━━━━━━━',
      `👤 *Paciente:* ${name}`,
      `🪪 *Tipo de Documento:* ${docType}`,
      `🔢 *Número de Documento:* ${docId}`,
      `📱 *Teléfono de Contacto:* ${phone}`,
      `📧 *Correo Electrónico:* ${email}`,
      `🏙️ *Ciudad de Residencia:* ${city}`,
      `📍 *Dirección de Residencia:* ${address}`,
    ];

    if (data.applicantName) {
      lines.push(`👥 *Solicitante / Acompañante:* ${data.applicantName}${data.applicantDoc ? ` (${data.applicantDoc})` : ''}`);
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━');
    return lines.join('\n');
  }

  /**
   * Panel de opciones de corrección de datos del paciente
   */
  public static getPatientCorrectionPanel(data: FlowStateData): BotReplyResult {
    return this.sanitizeResult({
      replyMessages: [
        'Indícanos por favor qué dato del paciente deseas corregir:\n\n1️⃣ Número de Documento\n2️⃣ Tipo de Documento\n3️⃣ Nombre Completo\n4️⃣ Teléfono / Celular\n5️⃣ Correo Electrónico\n6️⃣ Ciudad de Residencia\n7️⃣ Dirección de Residencia\n\n(Puedes responder con el número de la opción que deseas modificar)',
      ],
      interactivePayload: {
        type: 'list',
        title: 'Corregir Datos del Paciente',
        buttonText: '✏️ Seleccionar Dato',
        options: [
          { id: '1', title: '1. Número Documento', description: `Actual: ${data.patientDoc || 'No registrado'}` },
          { id: '2', title: '2. Tipo Documento', description: `Actual: ${data.patientDocumentType || 'Cédula de Ciudadanía'}` },
          { id: '3', title: '3. Nombre Completo', description: `Actual: ${data.patientName || 'No registrado'}` },
          { id: '4', title: '4. Teléfono / Celular', description: `Actual: ${data.patientPhone || 'No registrado'}` },
          { id: '5', title: '5. Correo Electrónico', description: `Actual: ${data.patientEmail || 'No registrado'}` },
          { id: '6', title: '6. Ciudad de Residencia', description: `Actual: ${data.residenceCity || 'Bogotá D.C.'}` },
          { id: '7', title: '7. Dirección Residencia', description: `Actual: ${data.residenceAddress || 'No registrada'}` },
        ],
      },
      nextFlow: 'IDLE',
      nextStep: 'SELECT_PATIENT_FIELD_TO_EDIT',
      updatedData: { ...data, fallbackCount: 0 },
    });
  }

  /**
   * Busca en la base de datos por documento y genera la ficha o solicitud de nombre
   */
  public static async lookupAndShowUserCard(cleanDoc: string, data: FlowStateData): Promise<BotReplyResult> {
    const foundContact = await store.findContactByDocument(cleanDoc);
    const activeContact = data.contactId ? store.getContactById(data.contactId) : undefined;
    const isRegistered = Boolean(
      (foundContact && foundContact.name && foundContact.name.trim().length > 0) ||
      (activeContact && activeContact.documentId === cleanDoc && activeContact.name && activeContact.name.trim().length > 0)
    );

    const docType = data.patientDocumentType || foundContact?.documentType || activeContact?.documentType || 'Cédula de Ciudadanía';

    if (isRegistered) {
      const name = foundContact?.name || activeContact?.name || 'Paciente';
      const phone = foundContact?.phone || activeContact?.phone || data.contactPhone || '';
      const email = foundContact?.email || activeContact?.email || '';
      const city = foundContact?.residenceCity || activeContact?.residenceCity || 'Bogotá D.C.';
      const address = foundContact?.residenceAddress || activeContact?.residenceAddress || '';

      if (data.contactId) {
        await store.updateContactProfile(data.contactId, {
          name,
          documentId: cleanDoc,
          documentType: docType,
          email: email || undefined,
          residenceCity: city,
          residenceAddress: address || undefined,
        });
      }

      const ficha = this.formatUserFicha({
        name,
        documentType: docType,
        documentId: cleanDoc,
        birthDate: (foundContact?.birthDate || activeContact?.birthDate)?.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }),
        phone,
        email,
        city,
        address,
      });

      return this.sanitizeResult({
        replyMessages: [
          `¡Hola, ${name}! 👋 Encontramos tus datos registrados en el sistema del Hospital Universitario Nacional (HUN).\n\n${ficha}\n\n¿Los datos registrados son correctos?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmación de Datos',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'VERIFY_USER_DATA',
        updatedData: {
          ...data,
          patientFound: true,
          patientName: name,
          patientDoc: cleanDoc,
          patientDocumentType: docType,
          patientPhone: phone,
          patientEmail: email,
          residenceCity: city,
          residenceAddress: address,
          fallbackCount: 0,
        },
      });
    }

    // Si no está registrado en base de datos
    return this.sanitizeResult({
      replyMessages: [
        `No encontramos registros previos con el documento *${cleanDoc}*. Para brindarte una mejor atención en el Hospital Universitario Nacional, indícanos por favor tu Nombre Completo:`,
      ],
      nextFlow: 'IDLE',
      nextStep: 'REGISTER_NEW_NAME',
      updatedData: {
        ...data,
        patientFound: false,
        patientDoc: cleanDoc,
        patientDocumentType: docType,
        fallbackCount: 0,
      },
    });
  }

  /**
   * Submenú de Cita Médica:
   * 1. Agendar Cita Médica
   * 2. Reprogramar Cita Médica
   * 3. Cancelar Cita Médica
   * 4. Contactar con un asesor
   * 5. Volver al Menú Principal
   */
  public static getCitaMedicaMenu(data: FlowStateData = {}): BotReplyResult {
    return this.sanitizeResult({
      replyMessages: [
        'Has seleccionado *Cita Médica* 🩺.\n\n¿Qué gestión deseas realizar con tu cita?\n\n1️⃣ Agendar Cita Médica\n2️⃣ Reprogramar Cita Médica\n3️⃣ Cancelar Cita Médica\n4️⃣ Contactar con un asesor\n5️⃣ Volver al Menú Principal\n\n(Puedes pulsar el botón de opciones o responder con el número)',
      ],
      interactivePayload: {
        type: 'list',
        title: 'Gestión de Citas Médicas',
        buttonText: '📋 Opciones de Cita',
        options: [
          { id: '1', title: '1. Agendar Cita Médica', description: 'Consulta externa ambulatoria con especialista HUN' },
          { id: '2', title: '2. Reprogramar Cita', description: 'Modificar fecha u hora de una cita asignada' },
          { id: '3', title: '3. Cancelar Cita', description: 'Cancelar una cita médica confirmada en el hospital' },
          { id: '4', title: '4. Contactar con Asesor', description: 'Hablar con un asesor de atención al usuario' },
          { id: '5', title: '5. Menú Principal', description: 'Regresar al menú principal de opciones' },
        ],
      },
      nextFlow: 'IDLE',
      nextStep: 'CITA_MEDICA_MENU',
      updatedData: { ...data, fallbackCount: 0 },
    });
  }

  /**
   * Obtiene la tarifa oficial de consulta médica ambulatoria según perfil de usuario y tipo de consulta
   */
  public static getSpecialtyFee(
    _specialtyName?: string,
    isFirstTime: boolean = true,
    userTypeCode?: string
  ): { fee: number; tierLabel: string } {
    const code = (userTypeCode || 'PARTICULAR').toUpperCase();
    if (code === 'EGRESADO_UNAL') {
      return {
        fee: isFirstTime ? 140000 : 100000,
        tierLabel: 'Tarifa Preferencial Egresado UNAL',
      };
    }
    if (code === 'COLABORADOR_HUN') {
      return {
        fee: isFirstTime ? 140000 : 100000,
        tierLabel: 'Tarifa Institucional Colaborador HUN 2024',
      };
    }
    // PARTICULAR por defecto
    return {
      fee: isFirstTime ? 160000 : 120000,
      tierLabel: 'Tarifa Particular Estándar',
    };
  }

  /**
   * Obtiene las recomendaciones de preparación previa específicas para el servicio médico o especialidad agendada.
   * Consulta tanto la base de datos de procedimientos diagnósticos/imágenes/laboratorios como recomendaciones clínicas por especialidad.
   */
  public static async getPreparationInstructionsForService(
    serviceOrSpecialty: string,
    cupsCode?: string
  ): Promise<string> {
    const norm = this.normalizeText(serviceOrSpecialty);

    // 1. Si existe código CUPS o el servicio corresponde a un procedimiento/estudio en la base de datos de preparaciones
    try {
      const searchTerm = cupsCode || serviceOrSpecialty;
      const match = await PreparacionesService.findForPatient(searchTerm);
      if (match.matchType === 'EXACT' && match.procedures[0]) {
        return await PreparacionesService.formatPatientInstructions(match.procedures[0]);
      }
    } catch (err) {
      // Continuar a guía clínica
    }

    // 2. Guía institucional de preparación según el tipo de especialidad o servicio agendado
    const lines: string[] = [];
    lines.push(`📋 *INDICACIONES Y PREPARACIÓN PREVIA PARA TU CITA* 🏥`);
    lines.push(`• *Servicio agendado:* ${serviceOrSpecialty}\n`);

    if (norm.includes('oftalmolog')) {
      lines.push(`👁️ *Recomendaciones para Oftalmología:*`);
      lines.push(`• Asiste con un acompañante adulto responsable (se puede requerir dilatación de pupilas).`);
      lines.push(`• Trae gafas de sol para tu regreso debido a la sensibilidad a la luz posterior al examen.`);
      lines.push(`• Si usas lentes de contacto, suspende su uso 24 horas antes y trae tus lentes formulados actuales.`);
    } else if (norm.includes('gastro') || norm.includes('endoscop') || norm.includes('colonoscop')) {
      lines.push(`🍽️ *Recomendaciones para Gastroenterología:*`);
      lines.push(`• Si tu cita incluye endoscopia o procedimiento, mantén ayuno estricto mínimo de 8 horas.`);
      lines.push(`• Trae tu historial de endoscopias, biopsias o ecografías digestivas previas.`);
      lines.push(`• Asiste con ropa cómoda de dos piezas.`);
    } else if (norm.includes('cardio')) {
      lines.push(`❤️ *Recomendaciones para Cardiología:*`);
      lines.push(`• Trae tu último electrocardiograma, ecocardiograma o prueba de esfuerzo si dispones de ellos.`);
      lines.push(`• Trae la lista completa y dosis de los medicamentos que consumes diariamente.`);
      lines.push(`• No suspendas tu medicación habitual a menos que tu médico te lo haya indicado.`);
    } else if (norm.includes('dermatolog')) {
      lines.push(`🧴 *Recomendaciones para Dermatología:*`);
      lines.push(`• Asiste sin maquillaje, esmaltes en uñas ni cremas corporales o faciales aplicadas.`);
      lines.push(`• Viste ropa cómoda y fácil de retirar para la valoración dermatológica completa.`);
    } else if (norm.includes('urolog')) {
      lines.push(`💧 *Recomendaciones para Urología:*`);
      lines.push(`• Trae los resultados de antígeno prostático (PSA), urocultivo o ecografías renales previas.`);
      lines.push(`• Si tu cita incluye ecografía de vías urinarias, ingiere 4 a 6 vasos de agua 1 hora antes para mantener la vejiga llena.`);
    } else if (norm.includes('ginecolog') || norm.includes('obstetr')) {
      lines.push(`🌸 *Recomendaciones para Ginecología / Obstetricia:*`);
      lines.push(`• Trae tu última citología cervicovaginal, ecografía pélvica/transvaginal o mamografía.`);
      lines.push(`• No apliques óvulos, cremas vaginales ni tengas relaciones 48 horas previas si se programó toma de muestras.`);
    } else if (norm.includes('pediatr')) {
      lines.push(`👶 *Recomendaciones para Pediatría:*`);
      lines.push(`• Trae el carnet de vacunación actualizado y la curva de crecimiento y desarrollo.`);
      lines.push(`• El menor debe asistir acompañado por sus padres o representante legal con documento.`);
    } else if (norm.includes('ortoped') || norm.includes('traumatolog')) {
      lines.push(`🦴 *Recomendaciones para Ortopedia:*`);
      lines.push(`• Trae las radiografías (RX), tomografías (TAC) o resonancias (RMN) físicas o en CD/enlace.`);
      lines.push(`• Viste ropa cómoda y holgada que permita examinar la extremidad o articulación afectada.`);
    } else if (norm.includes('endocrino')) {
      lines.push(`🩸 *Recomendaciones para Endocrinología:*`);
      lines.push(`• Trae tus últimos exámenes de perfil tiroideo (TSH, T4 libre), glicemia, hemoglobina glicosilada o perfil lipídico.`);
      lines.push(`• Si tienes glucómetro, trae tu registro o libreta de glucometrías de las últimas 2 semanas.`);
    } else if (norm.includes('nutricion')) {
      lines.push(`🥗 *Recomendaciones para Nutrición y Dietética:*`);
      lines.push(`• Trae tus últimos exámenes de laboratorio general (hemograma, lípidos, glicemia, función renal).`);
      lines.push(`• Si es posible, anota un recordatorio de lo que comiste en los últimos 3 días (desayuno, almuerzo, cena y meriendas).`);
    } else {
      lines.push(`🩺 *Recomendaciones para Consulta Externa (${serviceOrSpecialty}):*`);
      lines.push(`• Trae tu documento de identidad original en físico.`);
      lines.push(`• Trae tu orden médica vigente, resumen de historia clínica y exámenes diagnósticos previos.`);
      lines.push(`• Lleva la lista escrita de todos los medicamentos que tomas con sus horarios y dosis.`);
    }

    lines.push(`\n📌 *Recomendaciones generales del HUN:*`);
    lines.push(`• Llega con 20 minutos de anticipación al módulo de admisiones.`);
    lines.push(`• Recuerda que en el HUN "Yo te cuido: Seguro". ¡Te esperamos! 🏥`);

    return lines.join('\n');
  }

  /**
   * Normaliza y valida la fecha de nacimiento ingresada por el paciente:
   * Acepta con guiones (15-05-1990), con barras (15/05/1990), con puntos (15.05.1990),
   * con espacios (15 05 1990) o números continuos (15051990).
   * Siempre retorna el formato unificado con slash (DD/MM/AAAA) para la base de datos.
   */
  public static parseAndNormalizeBirthDate(raw: string): { formatted: string; isValid: boolean } | null {
    const clean = raw.trim();
    let day: number | null = null;
    let month: number | null = null;
    let year: number | null = null;

    // Caso 1: Con separadores (- / . o espacio)
    const sepMatch = clean.match(/^(\d{1,2})[-/.\s](\d{1,2})[-/.\s](\d{4})$/);
    if (sepMatch) {
      day = parseInt(sepMatch[1], 10);
      month = parseInt(sepMatch[2], 10);
      year = parseInt(sepMatch[3], 10);
    } else {
      // Caso 2: Sin separadores (8 dígitos continuos DDMMYYYY)
      const digitsMatch = clean.match(/^(\d{2})(\d{2})(\d{4})$/);
      if (digitsMatch) {
        day = parseInt(digitsMatch[1], 10);
        month = parseInt(digitsMatch[2], 10);
        year = parseInt(digitsMatch[3], 10);
      }
    }

    if (day === null || month === null || year === null) {
      return null;
    }

    // Validación de año coherente (entre 1900 y año actual)
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      return null;
    }
    if (month < 1 || month > 12) {
      return null;
    }

    // Validación de días del mes (bisiestos incluidos)
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return null;
    }

    // Validación de no ser fecha futura
    const parsedDate = new Date(year, month - 1, day);
    if (parsedDate > new Date()) {
      return null;
    }

    // Formato unificado con slash: DD/MM/AAAA
    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const yyyy = String(year);
    const formatted = `${dd}/${mm}/${yyyy}`;

    return { formatted, isValid: true };
  }

  private static toBirthDate(value?: string): Date | undefined {
    const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return undefined;
    const date = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00-05:00`);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private static handlePatientRegistration(text: string, lower: string, step: string, data: FlowStateData): BotReplyResult {
    const yesNo = (question: string, nextStep: string, value: boolean): BotReplyResult => ({
      replyMessages: [question, '1️⃣ Sí\n2️⃣ No (Corregir)'],
      nextFlow: 'PATIENT_REGISTRATION',
      nextStep,
      updatedData: { ...data, [step]: value },
    });

    if (step === 'LOOKUP_DOCUMENT') {
      const cleanDoc = text.replace(/[^0-9]/g, '');
      if (cleanDoc.length < 5) {
        return {
          replyMessages: [
            '⚠️ El documento debe contener solo números (mínimo 5 dígitos, sin puntos, comas o espacios). Por favor inténtalo nuevamente:',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }

      if (data.patientFound) {
        return {
          replyMessages: [
            `¡Hola ${data.patientName || 'paciente'}! Encontramos tus datos en nuestra base institucional del HUN.`,
            '¿La cita médica es para ti o para alguien más?\n\n1️⃣ Sí, es para mí\n2️⃣ No, es para alguien más',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'REQUEST_FOR_SELF',
          updatedData: { ...data, patientDoc: cleanDoc },
        };
      }

      return {
        replyMessages: [
          `No encontramos registros previos con el documento ${cleanDoc}. Vamos a recopilar tus datos para tu registro en el Hospital Universitario Nacional.\n\nPor favor indícanos tu Nombre Completo:`,
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'OTHER_NAME',
        updatedData: { ...data, patientDoc: cleanDoc, requestForSelf: true },
      };
    }

    if (step === 'REQUEST_FOR_SELF') {
      if (
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si') ||
        lower.includes('para mí') ||
        lower.includes('para mi') ||
        lower.includes('es para mi')
      ) {
        return {
          replyMessages: [
            `Perfecto, continuemos con tu cita médica, ${data.patientName || ''}.`,
            this.getSpecialtiesMenuPrompt(),
          ],
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_SPECIALTY',
          updatedData: { ...data, requestForSelf: true },
        };
      }

      if (
        lower === '2' ||
        lower.startsWith('no') ||
        lower.includes('alguien') ||
        lower.includes('otra') ||
        lower.includes('otro')
      ) {
        return {
          replyMessages: [
            'Por favor digita los datos de la persona que requiere la atención médica:\n\nNombre Completo:',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'OTHER_NAME',
          updatedData: { ...data, requestForSelf: false, patientName: undefined, patientDoc: undefined },
        };
      }

      return {
        replyMessages: [
          'Por favor responde únicamente con el número:\n\n1️⃣ Sí, es para mí\n2️⃣ No, es para alguien más',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: step,
        updatedData: data,
      };
    }

    if (step === 'OTHER_NAME') {
      if (text.trim().length < 3) {
        return {
          replyMessages: ['⚠️ Por favor escribe el nombre completo del paciente:'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'OTHER_NAME',
          updatedData: data,
        };
      }
      return {
        replyMessages: [
          'Por favor selecciona el tipo de documento de identidad:\n\n1️⃣ Cédula de Ciudadanía\n2️⃣ Tarjeta de Identidad\n3️⃣ Permiso de Protección Temporal\n4️⃣ Cédula de Extranjería\n5️⃣ Ver más opciones\n6️⃣ Cancelar',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'OTHER_DOCUMENT_TYPE',
        updatedData: { ...data, patientName: text.trim() },
      };
    }

    if (step === 'OTHER_DOCUMENT_TYPE' || step === 'OTHER_DOCUMENT_TYPE_MORE') {
      const types = step === 'OTHER_DOCUMENT_TYPE'
        ? ['Cédula de Ciudadanía', 'Tarjeta de Identidad', 'Permiso de Protección Temporal', 'Cédula de Extranjería']
        : ['Pasaporte', 'Salvoconducto de permanencia', 'Documento extranjero'];
      const n = Number(text);

      if ((step === 'OTHER_DOCUMENT_TYPE' && n === 6) || (step === 'OTHER_DOCUMENT_TYPE_MORE' && n === 9)) {
        return {
          replyMessages: [
            '¿Deseas regresar al menú principal o terminar la conversación?\n\n1️⃣ Ir al Menú Principal\n2️⃣ Terminar Conversación',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'CANCEL_OPTIONS',
          updatedData: data,
        };
      }

      if (step === 'OTHER_DOCUMENT_TYPE' && n === 5) {
        return {
          replyMessages: [
            'Más opciones de documento de identidad:\n\n1️⃣ Pasaporte\n2️⃣ Salvoconducto de permanencia\n3️⃣ Documento extranjero\n9️⃣ Cancelar',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'OTHER_DOCUMENT_TYPE_MORE',
          updatedData: data,
        };
      }

      const idx = n - 1;
      if (!Number.isInteger(n) || !types[idx]) {
        return {
          replyMessages: ['⚠️ Por favor selecciona una opción válida de la lista.'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }

      if (data.patientDoc && data.requestForSelf) {
        return {
          replyMessages: [
            `El documento de identificación es ${types[idx]} ${data.patientDoc}, ¿es correcto?`,
            '1️⃣ Sí\n2️⃣ No (Corregir)',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'OTHER_DOCUMENT_CONFIRM',
          updatedData: { ...data, patientDocumentType: types[idx] },
        };
      }

      return {
        replyMessages: [
          'Por favor digita el número de documento de identidad (sin puntos, comas o espacios. Ejemplo: 12345678):',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'OTHER_DOCUMENT_NUMBER',
        updatedData: { ...data, patientDocumentType: types[idx] },
      };
    }

    if (step === 'CANCEL_OPTIONS') {
      return lower === '1'
        ? this.getRootMenu()
        : {
            replyMessages: [
              'Por favor califica tu experiencia seleccionando un número del 1 al 5 ⭐:\n\n1️⃣ Muy insatisfecho\n2️⃣ Insatisfecho\n3️⃣ Regular\n4️⃣ Bueno\n5️⃣ Excelente',
            ],
            nextFlow: 'NPS_SURVEY',
            nextStep: 'NPS_SCORE',
            updatedData: data,
          };
    }

    if (step === 'OTHER_DOCUMENT_NUMBER') {
      const cleanNum = text.replace(/[^0-9]/g, '');
      if (cleanNum.length < 5) {
        return {
          replyMessages: ['⚠️ El número debe contener únicamente dígitos (mínimo 5), sin puntos, comas o espacios.'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }
      return {
        replyMessages: [
          `El documento de identificación ${data.patientDocumentType} ${cleanNum}, ¿es correcto?`,
          '1️⃣ Sí\n2️⃣ No (Corregir)',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'OTHER_DOCUMENT_CONFIRM',
        updatedData: { ...data, patientDoc: cleanNum },
      };
    }

    if (step === 'OTHER_DOCUMENT_CONFIRM') {
      return lower === '1' || lower.startsWith('sí') || lower.startsWith('si')
        ? {
            replyMessages: [
              'Por favor digita tu fecha de nacimiento (puedes escribirla con o sin guiones, por ejemplo: 15-05-1990 o 15051990):',
            ],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'BIRTH_DATE',
            updatedData: { ...data, patientDoc: data.patientDoc || '' },
          }
        : {
            replyMessages: ['Por favor digita nuevamente el número de documento:'],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'OTHER_DOCUMENT_NUMBER',
            updatedData: data,
          };
    }

    if (step === 'BIRTH_DATE') {
      const parsed = DecisionTreeService.parseAndNormalizeBirthDate(text);
      if (!parsed) {
        return {
          replyMessages: [
            '⚠️ Por favor ingresa una fecha válida en formato día, mes y año (puedes escribirla con o sin guiones, por ejemplo: 15-05-1990 o 15051990).',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }
      return {
        replyMessages: [
          `La fecha de nacimiento ${parsed.formatted}, ¿es correcta?`,
          '1️⃣ Sí\n2️⃣ No (Corregir)',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'BIRTH_DATE_CONFIRM',
        updatedData: { ...data, patientBirthDate: parsed.formatted },
      };
    }

    if (step === 'BIRTH_DATE_CONFIRM') {
      return lower === '1' || lower.startsWith('sí') || lower.startsWith('si')
        ? {
            replyMessages: [
              'Por favor digita tu número de Teléfono/Celular (sin puntos, comas ni espacios. Ejemplo: 3101234567):',
            ],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'PATIENT_PHONE',
            updatedData: data,
          }
        : {
            replyMessages: ['Por favor digita nuevamente la fecha de nacimiento (Ejemplo: 15-05-1990 o 15051990):'],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'BIRTH_DATE',
            updatedData: data,
          };
    }

    if (step === 'PATIENT_PHONE') {
      const cleanPhone = text.replace(/\D/g, '');
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        return {
          replyMessages: ['⚠️ El teléfono debe contener solo números y tener entre 7 y 15 dígitos.'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }
      return {
        replyMessages: [
          `El número telefónico ${cleanPhone}, ¿es correcto?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'PATIENT_PHONE_CONFIRM',
        updatedData: { ...data, patientPhone: cleanPhone },
      };
    }

    if (step === 'PATIENT_PHONE_CONFIRM') {
      return lower === '1' || lower.startsWith('sí') || lower.startsWith('si')
        ? {
            replyMessages: ['Por favor digita tu dirección de correo electrónico (Ejemplo: paciente@gmail.com):'],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'PATIENT_EMAIL',
            updatedData: data,
          }
        : {
            replyMessages: ['Por favor digita nuevamente tu número celular:'],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'PATIENT_PHONE',
            updatedData: data,
          };
    }

    if (step === 'PATIENT_EMAIL') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim())) {
        return {
          replyMessages: ['⚠️ Por favor ingresa un correo electrónico válido (Ejemplo: usuario@correo.com):'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }
      return {
        replyMessages: [
          `El correo ${text.trim()}, ¿es correcto?`,
          '1️⃣ Sí\n2️⃣ No (Corregir)',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'PATIENT_EMAIL_CONFIRM',
        updatedData: { ...data, patientEmail: text.trim() },
      };
    }

    if (step === 'PATIENT_EMAIL_CONFIRM') {
      return lower === '1' || lower.startsWith('sí') || lower.startsWith('si')
        ? {
            replyMessages: ['Por favor digita tu Ciudad de Residencia (Ejemplo: Bogotá):'],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'RESIDENCE_CITY',
            updatedData: data,
          }
        : {
            replyMessages: ['Por favor digita nuevamente tu correo electrónico:'],
            nextFlow: 'PATIENT_REGISTRATION',
            nextStep: 'PATIENT_EMAIL',
            updatedData: data,
          };
    }

    if (step === 'RESIDENCE_CITY') {
      if (text.trim().length < 2) {
        return {
          replyMessages: ['⚠️ Por favor escribe una ciudad válida (Ejemplo: Bogotá):'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }
      return {
        replyMessages: ['Por favor digita tu dirección de residencia (Ejemplo: Calle 123 # 45-67 Sur):'],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'RESIDENCE_ADDRESS',
        updatedData: { ...data, residenceCity: text.trim() },
      };
    }

    if (step === 'RESIDENCE_ADDRESS') {
      if (text.trim().length < 5) {
        return {
          replyMessages: ['⚠️ Por favor escribe una dirección de residencia completa (Ejemplo: Calle 123 # 45-67 Sur):'],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: step,
          updatedData: data,
        };
      }
      return {
        replyMessages: [
          `La dirección de residencia ${text.trim()}, ¿es correcta?`,
          '1️⃣ Sí\n2️⃣ No (Corregir)',
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'RESIDENCE_ADDRESS_CONFIRM',
        updatedData: { ...data, residenceAddress: text.trim() },
      };
    }

    if (step === 'RESIDENCE_ADDRESS_CONFIRM') {
      if (lower === '1' || lower.startsWith('sí') || lower.startsWith('si')) {
        const ficha = this.formatUserFicha({
          name: data.patientName,
          documentType: data.patientDocumentType,
          documentId: data.patientDoc,
          birthDate: data.patientBirthDate,
          phone: data.patientPhone,
          email: data.patientEmail,
          city: data.residenceCity,
          address: data.residenceAddress,
        });
        return {
          replyMessages: [
            `¡Terminamos de capturar tus datos! Revisa la ficha y confirma si son correctos:\n\n${ficha}\n\n¿Los datos registrados son correctos?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
          ],
          interactivePayload: {
            type: 'button',
            title: 'Confirmación de Datos',
            options: [
              { id: '1', title: '1. Sí' },
              { id: '2', title: '2. No (Corregir)' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'VERIFY_USER_DATA',
          updatedData: { ...data, registrationComplete: true },
        };
      }
      return {
        replyMessages: ['Por favor digita nuevamente tu dirección de residencia:'],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'RESIDENCE_ADDRESS',
        updatedData: data,
      };
    }

    return {
      replyMessages: ['No entendí esa opción. Escribe "menu" para volver al inicio.'],
      nextFlow: 'PATIENT_REGISTRATION',
      nextStep: step,
      updatedData: data,
    };
  }

  /**
   * Manejador de selección en Menú Principal
   */
  private static async handleRootSelection(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData,
    patientName?: string
  ): Promise<BotReplyResult> {
    const cleanNum = text.replace(/\D/g, '');

    // Paso inicial obligatorio: Selección de tipo de usuario
    if (step === 'SELECT_USER_TYPE') {
      let userType = 'PARTICULAR';
      let userTypeCode = 'PARTICULAR';
      let userTypeName = 'Paciente Particular';
      let profileNote = '✅ Perfil registrado: *Paciente Particular* (Tarifa Estándar HUN).';

      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.includes('particular') ||
        lower.includes('paciente particular')
      ) {
        userType = 'PARTICULAR';
        userTypeCode = 'PARTICULAR';
        userTypeName = 'Paciente Particular';
        profileNote = '✅ Perfil registrado: *Paciente Particular* (Tarifa Estándar HUN).';
      } else if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.includes('egresad') ||
        lower.includes('un') ||
        lower.includes('nacional')
      ) {
        userType = 'EGRESADO_UNAL';
        userTypeCode = 'EGRESADO_UNAL';
        userTypeName = 'Egresado Universidad Nacional de Colombia';
        profileNote = '🎓 Perfil registrado: *Egresado Universidad Nacional de Colombia*.\n¡Tienes acceso a tarifas preferenciales institucionales de la UNAL!';
      } else if (
        cleanNum === '3' ||
        lower === '3' ||
        lower.includes('colaborador') ||
        lower.includes('funcionario') ||
        lower.includes('empleado') ||
        lower.includes('trabajador')
      ) {
        userType = 'COLABORADOR_HUN';
        userTypeCode = 'COLABORADOR_HUN';
        userTypeName = 'Colaborador HUN';
        profileNote = '🏥 Perfil registrado: *Colaborador HUN*.\n¡Tienes acceso al beneficio de tarifa institucional HUN 2024!';
      } else if (
        cleanNum === '4' ||
        lower === '4' ||
        lower.includes('otro') ||
        lower.includes('asesor') ||
        lower.includes('convenio')
      ) {
        userType = 'OTRO';
        userTypeCode = 'OTRO';
        userTypeName = 'Otro (Contactar con un asesor)';
        profileNote = 'Has seleccionado la opción *Otro* para contactar con un asesor del Hospital Universitario Nacional 🏥.';
      } else {
        return this.sanitizeResult({
          replyMessages: [
            '⚠️ Por favor indica quién realiza la solicitud respondiendo con un número del 1 al 4:\n\n1️⃣ Paciente Particular\n2️⃣ Egresado Universidad Nacional de Colombia\n3️⃣ Colaborador HUN\n4️⃣ Otro (Contactar con un asesor)',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo de Usuario',
            buttonText: '📋 Seleccionar Perfil',
            options: [
              { id: '1', title: '1. Paciente Particular', description: 'Tarifa Estándar HUN para usuarios particulares' },
              { id: '2', title: '2. Egresado UNAL', description: 'Tarifas preferenciales de la Universidad Nacional' },
              { id: '3', title: '3. Colaborador HUN', description: 'Tarifas institucionales HUN 2024 para colaboradores' },
              { id: '4', title: '4. Otro / Asesor', description: 'Contactar directamente con un asesor de atención' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'SELECT_USER_TYPE',
          updatedData: data,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          profileNote,
          'Para continuar con tu solicitud, por favor selecciona tu tipo de documento de identidad:\n\n1️⃣ Cédula de Ciudadanía (CC)\n2️⃣ Tarjeta de Identidad (TI)\n3️⃣ Cédula de Extranjería (CE)\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil\n\n(Puedes pulsar el botón o responder con el número de tu opción)',
        ],
        interactivePayload: {
          type: 'list',
          title: 'Tipo de Documento',
          buttonText: '📋 Seleccionar Tipo Doc',
          options: [
            { id: '1', title: '1. Cédula de Ciudadanía', description: 'CC para mayores de 18 años' },
            { id: '2', title: '2. Tarjeta de Identidad', description: 'TI para menores de 7 a 17 años' },
            { id: '3', title: '3. Cédula de Extranjería', description: 'CE para extranjeros residentes' },
            { id: '4', title: '4. Permiso PPT', description: 'Permiso por Protección Temporal' },
            { id: '5', title: '5. Pasaporte', description: 'Documento internacional de viaje' },
            { id: '6', title: '6. Registro Civil', description: 'RC para menores de 7 años' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'AUTH_DOC_TYPE',
        updatedData: {
          ...data,
          userType,
          userTypeCode,
          userTypeName,
          fallbackCount: 0,
        },
      });
    }

    // Paso 2: Selección de Tipo de Documento
    if (step === 'AUTH_DOC_TYPE') {
      const cleanDigits = text.replace(/\D/g, '');
      // Si el usuario escribe directamente su número de documento (5+ dígitos numéricos)
      if (cleanDigits.length >= 5 && !['1', '2', '3', '4', '5', '6'].includes(text.trim())) {
        const defaultDocType = data.patientDocumentType || 'Cédula de Ciudadanía';
        data.patientDocumentType = defaultDocType;
        return this.lookupAndShowUserCard(cleanDigits, data);
      }

      const docTypes: Record<string, string> = {
        '1': 'Cédula de Ciudadanía',
        '2': 'Tarjeta de Identidad',
        '3': 'Cédula de Extranjería',
        '4': 'Permiso por Protección Temporal (PPT)',
        '5': 'Pasaporte',
        '6': 'Registro Civil',
      };

      let selectedType: string | undefined;
      if (docTypes[cleanNum]) {
        selectedType = docTypes[cleanNum];
      } else if (lower.includes('ciudadan') || lower.includes('cc')) {
        selectedType = 'Cédula de Ciudadanía';
      } else if (lower.includes('tarjeta') || lower.includes('ti')) {
        selectedType = 'Tarjeta de Identidad';
      } else if (lower.includes('extranjer') || lower.includes('ce')) {
        selectedType = 'Cédula de Extranjería';
      } else if (lower.includes('ppt') || lower.includes('proteccion') || lower.includes('temporal')) {
        selectedType = 'Permiso por Protección Temporal (PPT)';
      } else if (lower.includes('pasaporte')) {
        selectedType = 'Pasaporte';
      } else if (lower.includes('registro') || lower.includes('rc')) {
        selectedType = 'Registro Civil';
      }

      if (!selectedType) {
        return this.sanitizeResult({
          replyMessages: [
            '⚠️ Por favor selecciona una opción válida del 1 al 6 para tu tipo de documento:\n\n1️⃣ Cédula de Ciudadanía (CC)\n2️⃣ Tarjeta de Identidad (TI)\n3️⃣ Cédula de Extranjería (CE)\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo de Documento',
            buttonText: '📋 Seleccionar Tipo Doc',
            options: [
              { id: '1', title: '1. Cédula de Ciudadanía', description: 'CC para mayores de 18 años' },
              { id: '2', title: '2. Tarjeta de Identidad', description: 'TI para menores de 7 a 17 años' },
              { id: '3', title: '3. Cédula de Extranjería', description: 'CE para residentes extranjeros' },
              { id: '4', title: '4. Permiso PPT', description: 'Permiso por Protección Temporal' },
              { id: '5', title: '5. Pasaporte', description: 'Documento internacional de viaje' },
              { id: '6', title: '6. Registro Civil', description: 'RC para menores de edad' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'AUTH_DOC_TYPE',
          updatedData: data,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `Has seleccionado: *${selectedType}*.\n\nPor favor digita tu número de documento de identidad (sin puntos, comas ni espacios. Ejemplo: 1020304050):`,
        ],
        nextFlow: 'IDLE',
        nextStep: 'AUTH_DOC_NUMBER',
        updatedData: {
          ...data,
          patientDocumentType: selectedType,
          fallbackCount: 0,
        },
      });
    }

    // Paso 3: Entrada de Número de Documento y Validación en Base de Datos
    if (step === 'AUTH_DOC_NUMBER') {
      const cleanDoc = text.replace(/[^0-9a-zA-Z]/g, '').trim();
      if (cleanDoc.length < 4) {
        return this.sanitizeResult({
          replyMessages: [
            '⚠️ El documento debe contener al menos 4 caracteres (sin puntos, comas ni espacios). Por favor inténtalo nuevamente:',
          ],
          nextFlow: 'IDLE',
          nextStep: 'AUTH_DOC_NUMBER',
          updatedData: data,
        });
      }

      return this.lookupAndShowUserCard(cleanDoc, data);
    }

    // Paso 3B: Si es un paciente nuevo no registrado previamente
    if (step === 'REGISTER_NEW_NAME') {
      const cleanName = text.trim();
      if (cleanName.length < 3) {
        return this.sanitizeResult({
          replyMessages: ['⚠️ Por favor escribe tu nombre completo (mínimo 3 letras):'],
          nextFlow: 'IDLE',
          nextStep: 'REGISTER_NEW_NAME',
          updatedData: data,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `¡Mucho gusto, ${cleanName}! Para completar tu registro, por favor digita tu fecha de nacimiento (Ejemplo: 01-01-1990):`,
        ],
        nextFlow: 'PATIENT_REGISTRATION',
        nextStep: 'BIRTH_DATE',
        updatedData: {
          ...data,
          patientName: cleanName,
          fallbackCount: 0,
        },
      });
    }

    // Paso 4: Confirmación inicial de la Ficha de Datos
    if (step === 'VERIFY_USER_DATA') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si') ||
        lower === 'correcto'
      ) {
        if (data.patientFound === false && data.contactId) {
          await store.updateContactProfile(data.contactId, {
            name: data.patientName,
            documentId: data.patientDoc,
            documentType: data.patientDocumentType,
            birthDate: this.toBirthDate(data.patientBirthDate),
            email: data.patientEmail,
            residenceCity: data.residenceCity,
            residenceAddress: data.residenceAddress,
          });
        }
        const greetingName = data.patientName || 'Paciente';
        return this.sanitizeResult({
          replyMessages: [
            `${greetingName}, ¿la cita médica es para ti o es para alguien más?\n\n1️⃣ Sí, es para mí\n2️⃣ No, es para alguien más\n\n(Puedes pulsar el botón o responder con el número de tu opción)`,
          ],
          interactivePayload: {
            type: 'button',
            title: '¿Para quién es la cita?',
            options: [
              { id: '1', title: '1. Sí, es para mí' },
              { id: '2', title: '2. No, es para alguien más' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'REQUEST_FOR_SELF',
          updatedData: {
            ...data,
            fallbackCount: 0,
          },
        });
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no') ||
        lower.includes('corregir')
      ) {
        return this.getCorrectionPanel(data);
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor responde con el número de tu opción:\n\n1️⃣ Sí (Los datos son correctos)\n2️⃣ No (Deseo corregir mis datos)',
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmación de Datos',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'VERIFY_USER_DATA',
        updatedData: data,
      });
    }

    // Paso 5: Selección de qué dato corregir
    if (step === 'SELECT_FIELD_TO_EDIT') {
      if (cleanNum === '1' || lower.includes('numero') || lower.includes('documento')) {
        return this.sanitizeResult({
          replyMessages: [
            `Número de documento actual: *${data.patientDoc || 'No registrado'}*.\n\nPor favor ingresa tu número de documento corregido (sin puntos, comas ni espacios):`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'documentId',
            editingLabel: 'número de documento',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '2' || lower.includes('tipo')) {
        return this.sanitizeResult({
          replyMessages: [
            `Tipo de documento actual: *${data.patientDocumentType || 'Cédula de Ciudadanía'}*.\n\nPor favor selecciona tu tipo de documento corregido:\n\n1️⃣ Cédula de Ciudadanía (CC)\n2️⃣ Tarjeta de Identidad (TI)\n3️⃣ Cédula de Extranjería (CE)\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil\n\n(Responde con el número de tu opción)`,
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo de Documento',
            buttonText: '📋 Seleccionar Tipo Doc',
            options: [
              { id: '1', title: '1. Cédula de Ciudadanía', description: 'CC para mayores de 18 años' },
              { id: '2', title: '2. Tarjeta de Identidad', description: 'TI para menores de 7 a 17 años' },
              { id: '3', title: '3. Cédula de Extranjería', description: 'CE para residentes extranjeros' },
              { id: '4', title: '4. Permiso PPT', description: 'Permiso por Protección Temporal' },
              { id: '5', title: '5. Pasaporte', description: 'Documento internacional de viaje' },
              { id: '6', title: '6. Registro Civil', description: 'RC para menores de edad' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'documentType',
            editingLabel: 'tipo de documento',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '3' || lower.includes('nombre')) {
        return this.sanitizeResult({
          replyMessages: [
            `Nombre actual: *${data.patientName || 'No registrado'}*.\n\nPor favor ingresa tu Nombre Completo corregido:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'name',
            editingLabel: 'nombre completo',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '4' || lower.includes('telefono') || lower.includes('celular')) {
        return this.sanitizeResult({
          replyMessages: [
            `Teléfono actual: *${data.patientPhone || 'No registrado'}*.\n\nPor favor ingresa tu número de Teléfono / Celular corregido (Ejemplo: 3101234567):`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'phone',
            editingLabel: 'teléfono',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '5' || lower.includes('correo') || lower.includes('email')) {
        return this.sanitizeResult({
          replyMessages: [
            `Correo actual: *${data.patientEmail || 'No registrado'}*.\n\nPor favor ingresa tu Correo Electrónico corregido (Ejemplo: usuario@correo.com):`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'email',
            editingLabel: 'correo electrónico',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '6' || lower.includes('ciudad')) {
        return this.sanitizeResult({
          replyMessages: [
            `Ciudad actual: *${data.residenceCity || 'Bogotá D.C.'}*.\n\nPor favor ingresa tu Ciudad de Residencia corregida (Ejemplo: Bogotá):`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'residenceCity',
            editingLabel: 'ciudad de residencia',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '7' || lower.includes('direccion') || lower.includes('dirección')) {
        return this.sanitizeResult({
          replyMessages: [
            `Dirección actual: *${data.residenceAddress || 'No registrada'}*.\n\nPor favor ingresa tu Dirección de Residencia corregida (Ejemplo: Calle 45 # 28-15):`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'residenceAddress',
            editingLabel: 'dirección de residencia',
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor indica qué dato deseas corregir respondiendo con un número del 1 al 7:\n\n1️⃣ Número de Documento\n2️⃣ Tipo de Documento\n3️⃣ Nombre Completo\n4️⃣ Teléfono / Celular\n5️⃣ Correo Electrónico\n6️⃣ Ciudad de Residencia\n7️⃣ Dirección de Residencia',
        ],
        interactivePayload: {
          type: 'list',
          title: 'Corregir Datos',
          buttonText: '✏️ Seleccionar Dato',
          options: [
            { id: '1', title: '1. Número Documento', description: `Actual: ${data.patientDoc || 'No registrado'}` },
            { id: '2', title: '2. Tipo Documento', description: `Actual: ${data.patientDocumentType || 'Cédula de Ciudadanía'}` },
            { id: '3', title: '3. Nombre Completo', description: `Actual: ${data.patientName || 'No registrado'}` },
            { id: '4', title: '4. Teléfono / Celular', description: `Actual: ${data.patientPhone || 'No registrado'}` },
            { id: '5', title: '5. Correo Electrónico', description: `Actual: ${data.patientEmail || 'No registrado'}` },
            { id: '6', title: '6. Ciudad de Residencia', description: `Actual: ${data.residenceCity || 'Bogotá D.C.'}` },
            { id: '7', title: '7. Dirección Residencia', description: `Actual: ${data.residenceAddress || 'No registrada'}` },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'SELECT_FIELD_TO_EDIT',
        updatedData: data,
      });
    }

    // Paso 6: Entrada del valor corregido
    if (step === 'INPUT_EDIT_VALUE') {
      const field = data.editingField || 'documentId';
      const label = data.editingLabel || 'dato';
      let newValue = text.trim();

      if (field === 'documentId') {
        const cleanDoc = text.replace(/[^0-9a-zA-Z]/g, '').trim();
        if (cleanDoc.length < 4) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ El número de documento debe contener al menos 4 caracteres. Por favor inténtalo de nuevo:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_EDIT_VALUE',
            updatedData: data,
          });
        }
        newValue = cleanDoc;
        data.patientDoc = cleanDoc;
      } else if (field === 'documentType') {
        const typesMap: Record<string, string> = {
          '1': 'Cédula de Ciudadanía',
          '2': 'Tarjeta de Identidad',
          '3': 'Cédula de Extranjería',
          '4': 'Permiso por Protección Temporal (PPT)',
          '5': 'Pasaporte',
          '6': 'Registro Civil',
        };
        if (typesMap[cleanNum]) {
          newValue = typesMap[cleanNum];
        } else if (lower.includes('ciudadan') || lower.includes('cc')) {
          newValue = 'Cédula de Ciudadanía';
        } else if (lower.includes('tarjeta') || lower.includes('ti')) {
          newValue = 'Tarjeta de Identidad';
        } else if (lower.includes('extranjer') || lower.includes('ce')) {
          newValue = 'Cédula de Extranjería';
        } else if (lower.includes('ppt') || lower.includes('temporal')) {
          newValue = 'Permiso por Protección Temporal (PPT)';
        } else if (lower.includes('pasaporte')) {
          newValue = 'Pasaporte';
        } else if (lower.includes('registro') || lower.includes('rc')) {
          newValue = 'Registro Civil';
        }
        data.patientDocumentType = newValue;
      } else if (field === 'name') {
        if (newValue.length < 3) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ El nombre debe contener al menos 3 caracteres. Por favor inténtalo de nuevo:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_EDIT_VALUE',
            updatedData: data,
          });
        }
        data.patientName = newValue;
      } else if (field === 'phone') {
        const cleanPh = text.replace(/\D/g, '');
        if (cleanPh.length < 7) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ El número de teléfono debe contener al menos 7 dígitos. Por favor inténtalo de nuevo:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_EDIT_VALUE',
            updatedData: data,
          });
        }
        newValue = cleanPh;
        data.patientPhone = cleanPh;
      } else if (field === 'email') {
        if (!newValue.includes('@') || !newValue.includes('.')) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ Por favor escribe un correo electrónico válido (Ejemplo: usuario@correo.com):'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_EDIT_VALUE',
            updatedData: data,
          });
        }
        data.patientEmail = newValue;
      } else if (field === 'residenceCity') {
        data.residenceCity = newValue;
      } else if (field === 'residenceAddress') {
        data.residenceAddress = newValue;
      }

      // Actualizar en base de datos inmediatamente
      if (data.contactId && data.patientFound !== false) {
        await store.updateContactProfile(data.contactId, {
          name: data.patientName,
          documentId: data.patientDoc,
          documentType: data.patientDocumentType,
          email: data.patientEmail,
          residenceCity: data.residenceCity,
          residenceAddress: data.residenceAddress,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `Acabas de actualizar tu ${label} a ${newValue}.\n\n¿Es correcto?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmar Actualización',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'CONFIRM_SINGLE_CORRECTION',
        updatedData: {
          ...data,
          lastEditedField: field,
          lastEditedLabel: label,
          lastEditedValue: newValue,
          fallbackCount: 0,
        },
      });
    }

    // Paso 7: Confirmar la corrección individual realizada
    if (step === 'CONFIRM_SINGLE_CORRECTION') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si') ||
        lower === 'correcto'
      ) {
        return this.sanitizeResult({
          replyMessages: [
            '¿Deseas corregir algún otro dato?\n\n1️⃣ Sí\n2️⃣ No',
          ],
          interactivePayload: {
            type: 'button',
            title: '¿Corregir otro dato?',
            options: [
              { id: '1', title: '1. Sí' },
              { id: '2', title: '2. No' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'ASK_ANOTHER_CORRECTION',
          updatedData: { ...data, fallbackCount: 0 },
        });
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no') ||
        lower.includes('corregir')
      ) {
        return this.sanitizeResult({
          replyMessages: [
            `Entendido. Por favor ingresa nuevamente tu ${data.lastEditedLabel || 'dato'}:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: data.lastEditedField,
            editingLabel: data.lastEditedLabel,
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `Por favor responde si la actualización es correcta:\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmar Actualización',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'CONFIRM_SINGLE_CORRECTION',
        updatedData: data,
      });
    }

    // Paso 8: Preguntar si desea corregir algún otro dato
    if (step === 'ASK_ANOTHER_CORRECTION') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si')
      ) {
        return this.getCorrectionPanel(data);
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no')
      ) {
        const ficha = this.formatUserFicha({
          name: data.patientName,
          documentType: data.patientDocumentType,
          documentId: data.patientDoc,
          birthDate: data.patientBirthDate,
          phone: data.patientPhone,
          email: data.patientEmail,
          city: data.residenceCity,
          address: data.residenceAddress,
        });

        if (data.patientFound === false && data.contactId) {
          await store.updateContactProfile(data.contactId, {
            name: data.patientName,
            documentId: data.patientDoc,
            documentType: data.patientDocumentType,
            birthDate: this.toBirthDate(data.patientBirthDate),
            email: data.patientEmail,
            residenceCity: data.residenceCity,
            residenceAddress: data.residenceAddress,
          });
        }

        const greetingName = data.patientName || 'Paciente';
        return this.sanitizeResult({
          replyMessages: [
            `Tus datos han sido actualizados correctamente.\n\n${ficha}`,
            `${greetingName}, ¿la cita médica es para ti o es para alguien más?\n\n1️⃣ Sí, es para mí\n2️⃣ No, es para alguien más\n\n(Puedes pulsar el botón o responder con el número de tu opción)`,
          ],
          interactivePayload: {
            type: 'button',
            title: '¿Para quién es la cita?',
            options: [
              { id: '1', title: '1. Sí, es para mí' },
              { id: '2', title: '2. No, es para alguien más' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'REQUEST_FOR_SELF',
          updatedData: {
            ...data,
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor indica si deseas corregir otro dato:\n\n1️⃣ Sí\n2️⃣ No',
        ],
        interactivePayload: {
          type: 'button',
          title: '¿Corregir otro dato?',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'ASK_ANOTHER_CORRECTION',
        updatedData: data,
      });
    }

    // Paso 9: ¿La cita es para ti o para alguien más?
    if (step === 'REQUEST_FOR_SELF') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si') ||
        lower.includes('para mí') ||
        lower.includes('para mi') ||
        lower.includes('es para mi') ||
        lower.includes('es para mí')
      ) {
        if (data.userType === 'OTRO') {
          return this.sanitizeResult({
            replyMessages: [
              '✅ Tus datos han sido validados exitosamente.',
              'Has seleccionado la opción *Otro* para contactar con un asesor del Hospital Universitario Nacional 🏥.',
              'Un auxiliar de atención revisará tu solicitud y te contactará en este chat en breve para orientarte con la tarifa y proceso correspondiente.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            createTicket: {
              type: 'MANUAL_AGENT',
              priority: 'NORMAL',
              description: `Usuario ${data.patientName || 'Solicitante'} (${data.patientDoc || 'Sin doc'}) seleccionó 'Otro' en tipo de solicitante.`,
            },
            updatedData: { ...data, requestForSelf: true, fallbackCount: 0 },
          });
        }

        const root = this.getRootMenu(
          data.patientName,
          '¡Perfecto! Continuemos con tu solicitud.'
        );
        return {
          ...root,
          updatedData: {
            ...data,
            requestForSelf: true,
            fallbackCount: 0,
          },
        };
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no') ||
        lower.includes('alguien') ||
        lower.includes('otra') ||
        lower.includes('otro')
      ) {
        return this.sanitizeResult({
          replyMessages: [
            'Entendido. Vamos a registrar los datos del paciente que recibirá la atención médica en el Hospital Universitario Nacional 🏥.\n\nPor favor selecciona el tipo de documento del paciente:\n\n1️⃣ Cédula de Ciudadanía (CC)\n2️⃣ Tarjeta de Identidad (TI)\n3️⃣ Cédula de Extranjería (CE)\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil\n\n(Puedes pulsar el botón o responder con el número de tu opción)',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo Doc del Paciente',
            buttonText: '📋 Seleccionar Tipo Doc',
            options: [
              { id: '1', title: '1. Cédula de Ciudadanía', description: 'CC para mayores de 18 años' },
              { id: '2', title: '2. Tarjeta de Identidad', description: 'TI para menores de 7 a 17 años' },
              { id: '3', title: '3. Cédula de Extranjería', description: 'CE para residentes extranjeros' },
              { id: '4', title: '4. Permiso PPT', description: 'Permiso por Protección Temporal' },
              { id: '5', title: '5. Pasaporte', description: 'Documento internacional de viaje' },
              { id: '6', title: '6. Registro Civil', description: 'RC para menores de edad' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'PATIENT_OTHER_DOC_TYPE',
          updatedData: {
            ...data,
            requestForSelf: false,
            applicantName: data.patientName,
            applicantDoc: data.patientDoc,
            applicantDocType: data.patientDocumentType,
            applicantPhone: data.patientPhone || data.contactPhone,
            applicantEmail: data.patientEmail,
            applicantCity: data.residenceCity,
            applicantAddress: data.residenceAddress,
            patientName: undefined,
            patientDoc: undefined,
            patientDocumentType: undefined,
            patientPhone: undefined,
            patientEmail: undefined,
            residenceCity: undefined,
            residenceAddress: undefined,
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor responde con el número de tu opción:\n\n1️⃣ Sí, es para mí\n2️⃣ No, es para alguien más',
        ],
        interactivePayload: {
          type: 'button',
          title: '¿Para quién es la cita?',
          options: [
            { id: '1', title: '1. Sí, es para mí' },
            { id: '2', title: '2. No, es para alguien más' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'REQUEST_FOR_SELF',
        updatedData: data,
      });
    }

    // Paso 10: Selección de tipo de documento del paciente
    if (step === 'PATIENT_OTHER_DOC_TYPE') {
      const typesMap: Record<string, string> = {
        '1': 'Cédula de Ciudadanía',
        '2': 'Tarjeta de Identidad',
        '3': 'Cédula de Extranjería',
        '4': 'Permiso por Protección Temporal (PPT)',
        '5': 'Pasaporte',
        '6': 'Registro Civil',
      };

      let selectedType = typesMap[cleanNum];
      if (!selectedType) {
        if (lower.includes('ciudadan') || lower.includes('cc')) selectedType = 'Cédula de Ciudadanía';
        else if (lower.includes('tarjeta') || lower.includes('ti')) selectedType = 'Tarjeta de Identidad';
        else if (lower.includes('extranjer') || lower.includes('ce')) selectedType = 'Cédula de Extranjería';
        else if (lower.includes('ppt') || lower.includes('temporal')) selectedType = 'Permiso por Protección Temporal (PPT)';
        else if (lower.includes('pasaporte')) selectedType = 'Pasaporte';
        else if (lower.includes('registro') || lower.includes('rc')) selectedType = 'Registro Civil';
      }

      if (!selectedType) {
        return this.sanitizeResult({
          replyMessages: [
            '⚠️ Por favor selecciona un tipo de documento válido respondiendo con el número (1 a 6):',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo Doc del Paciente',
            buttonText: '📋 Seleccionar Tipo Doc',
            options: [
              { id: '1', title: '1. Cédula de Ciudadanía', description: 'CC para mayores de 18 años' },
              { id: '2', title: '2. Tarjeta de Identidad', description: 'TI para menores de 7 a 17 años' },
              { id: '3', title: '3. Cédula de Extranjería', description: 'CE para residentes extranjeros' },
              { id: '4', title: '4. Permiso PPT', description: 'Permiso por Protección Temporal' },
              { id: '5', title: '5. Pasaporte', description: 'Documento internacional de viaje' },
              { id: '6', title: '6. Registro Civil', description: 'RC para menores de edad' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'PATIENT_OTHER_DOC_TYPE',
          updatedData: data,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `Has seleccionado: *${selectedType}*.\n\nPor favor digita el número de documento de identidad del paciente (sin puntos, comas ni espacios. Ejemplo: 1020304050):`,
        ],
        nextFlow: 'IDLE',
        nextStep: 'PATIENT_OTHER_DOC_NUMBER',
        updatedData: {
          ...data,
          patientDocumentType: selectedType,
          fallbackCount: 0,
        },
      });
    }

    // Paso 11: Entrada de documento del paciente y validación en base de datos
    if (step === 'PATIENT_OTHER_DOC_NUMBER') {
      const cleanDoc = text.replace(/[^0-9a-zA-Z]/g, '').trim();
      if (cleanDoc.length < 4) {
        return this.sanitizeResult({
          replyMessages: [
            '⚠️ El documento del paciente debe contener al menos 4 caracteres (sin puntos, comas ni espacios). Por favor inténtalo nuevamente:',
          ],
          nextFlow: 'IDLE',
          nextStep: 'PATIENT_OTHER_DOC_NUMBER',
          updatedData: data,
        });
      }

      data.patientDoc = cleanDoc;
      const foundPatient = await store.findContactByDocument(cleanDoc);

      if (foundPatient && foundPatient.name && foundPatient.name.trim().length > 0) {
        const patientName = foundPatient.name;
        const patientDocType = foundPatient.documentType || data.patientDocumentType || 'Cédula de Ciudadanía';
        const phone = foundPatient.phone || data.applicantPhone || data.contactPhone || '';
        const email = foundPatient.email || '';
        const city = foundPatient.residenceCity || 'Bogotá D.C.';
        const address = foundPatient.residenceAddress || '';

        const ficha = this.formatPatientFicha({
          patientName,
          patientDocumentType: patientDocType,
          patientDoc: cleanDoc,
          patientPhone: phone,
          patientEmail: email,
          patientCity: city,
          patientAddress: address,
          applicantName: data.applicantName,
          applicantDoc: data.applicantDoc,
        });

        return this.sanitizeResult({
          replyMessages: [
            `¡Encontramos los registros del paciente en el sistema del Hospital Universitario Nacional! 🏥\n\n${ficha}\n\n¿Los datos del paciente son correctos?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
          ],
          interactivePayload: {
            type: 'button',
            title: 'Confirmación Paciente',
            options: [
              { id: '1', title: '1. Sí' },
              { id: '2', title: '2. No (Corregir)' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'VERIFY_PATIENT_DATA',
          updatedData: {
            ...data,
            patientName,
            patientDocumentType: patientDocType,
            patientDoc: cleanDoc,
            patientPhone: phone,
            patientEmail: email,
            residenceCity: city,
            residenceAddress: address,
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `No encontramos registros previos del paciente con el documento *${cleanDoc}*.\n\nPara registrarlo en el sistema del Hospital Universitario Nacional, por favor escribe su Nombre Completo:`,
        ],
        nextFlow: 'IDLE',
        nextStep: 'PATIENT_OTHER_NAME',
        updatedData: {
          ...data,
          patientDoc: cleanDoc,
          fallbackCount: 0,
        },
      });
    }

    // Paso 12: Nombre del paciente nuevo
    if (step === 'PATIENT_OTHER_NAME') {
      const cleanName = text.trim();
      if (cleanName.length < 3) {
        return this.sanitizeResult({
          replyMessages: ['⚠️ Por favor escribe el nombre completo del paciente (mínimo 3 letras):'],
          nextFlow: 'IDLE',
          nextStep: 'PATIENT_OTHER_NAME',
          updatedData: data,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `Por favor indícanos un número de Teléfono / Celular de contacto para *${cleanName}* (puedes ingresar el número del paciente o tu propio número como acompañante/acudiente):`,
        ],
        nextFlow: 'IDLE',
        nextStep: 'PATIENT_OTHER_PHONE',
        updatedData: {
          ...data,
          patientName: cleanName,
          fallbackCount: 0,
        },
      });
    }

    // Paso 13: Teléfono del paciente nuevo
    if (step === 'PATIENT_OTHER_PHONE') {
      const cleanPhone = text.replace(/\D/g, '');
      if (cleanPhone.length < 7 || cleanPhone.length > 15) {
        return this.sanitizeResult({
          replyMessages: ['⚠️ El número de teléfono debe contener solo dígitos (entre 7 y 15 números). Por favor inténtalo de nuevo:'],
          nextFlow: 'IDLE',
          nextStep: 'PATIENT_OTHER_PHONE',
          updatedData: data,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          'Por favor ingresa el correo electrónico del paciente (o escribe *no* si no dispone de uno):',
        ],
        nextFlow: 'IDLE',
        nextStep: 'PATIENT_OTHER_EMAIL',
        updatedData: {
          ...data,
          patientPhone: cleanPhone,
          fallbackCount: 0,
        },
      });
    }

    // Paso 14: Correo electrónico del paciente nuevo
    if (step === 'PATIENT_OTHER_EMAIL') {
      const cleanEmail = text.trim();
      const isNone = ['no', 'ninguno', 'na', 'n/a', 'no tiene', 'sin correo'].includes(cleanEmail.toLowerCase());

      if (!isNone && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
        return this.sanitizeResult({
          replyMessages: [
            '⚠️ Por favor escribe un correo electrónico válido (Ejemplo: paciente@correo.com) o escribe *no* si no tiene:',
          ],
          nextFlow: 'IDLE',
          nextStep: 'PATIENT_OTHER_EMAIL',
          updatedData: data,
        });
      }

      const emailVal = isNone ? undefined : cleanEmail;

      return this.sanitizeResult({
        replyMessages: [
          'Por favor indícanos la Ciudad de Residencia del paciente (Ejemplo: Bogotá):',
        ],
        nextFlow: 'IDLE',
        nextStep: 'PATIENT_OTHER_CITY',
        updatedData: {
          ...data,
          patientEmail: emailVal,
          fallbackCount: 0,
        },
      });
    }

    // Paso 15: Ciudad de residencia y persistencia en base de datos
    if (step === 'PATIENT_OTHER_CITY') {
      const city = text.trim() || 'Bogotá D.C.';
      const docType = data.patientDocumentType || 'Cédula de Ciudadanía';
      const cleanDoc = data.patientDoc || '';
      const patientName = data.patientName || 'Paciente';
      const phone = data.patientPhone || data.applicantPhone || data.contactPhone || '';

      // Persistir paciente en base de datos
      await store.createOrUpdatePatientContact({
        documentId: cleanDoc,
        documentType: docType,
        name: patientName,
        phone,
        email: data.patientEmail,
        residenceCity: city,
        residenceAddress: data.residenceAddress,
      });

      const ficha = this.formatPatientFicha({
        patientName,
        patientDocumentType: docType,
        patientDoc: cleanDoc,
        patientPhone: phone,
        patientEmail: data.patientEmail,
        patientCity: city,
        patientAddress: data.residenceAddress,
        applicantName: data.applicantName,
        applicantDoc: data.applicantDoc,
      });

      return this.sanitizeResult({
        replyMessages: [
          `¡Paciente registrado exitosamente en la base de datos del Hospital Universitario Nacional! 🏥\n\n${ficha}\n\n¿Los datos del paciente son correctos?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmación Paciente',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'VERIFY_PATIENT_DATA',
        updatedData: {
          ...data,
          residenceCity: city,
          fallbackCount: 0,
        },
      });
    }

    // Paso 16: Verificación de los datos del paciente
    if (step === 'VERIFY_PATIENT_DATA') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si') ||
        lower === 'correcto'
      ) {
        if (data.userType === 'OTRO') {
          return this.sanitizeResult({
            replyMessages: [
              '✅ Datos del paciente validados exitosamente.',
              'Has seleccionado la opción *Otro* para contactar con un asesor del Hospital Universitario Nacional 🏥.',
              'Un auxiliar de atención revisará tu solicitud y te contactará en este chat en breve para orientarte con la cita del paciente.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            createTicket: {
              type: 'MANUAL_AGENT',
              priority: 'NORMAL',
              description: `Solicitante ${data.applicantName || 'Acompañante'} (${data.applicantDoc || 'Sin doc'}) solicitó atención para paciente ${data.patientName} (${data.patientDoc}).`,
            },
            updatedData: { ...data, fallbackCount: 0 },
          });
        }

        const root = this.getRootMenu(
          data.applicantName || data.patientName,
          '✅ Paciente registrado exitosamente en el HUN. Continuemos con tu solicitud.'
        );
        return {
          ...root,
          updatedData: {
            ...data,
            fallbackCount: 0,
          },
        };
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no') ||
        lower.includes('corregir')
      ) {
        return this.getPatientCorrectionPanel(data);
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor responde con el número de tu opción:\n\n1️⃣ Sí (Los datos son correctos)\n2️⃣ No (Deseo corregir los datos del paciente)',
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmación Paciente',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'VERIFY_PATIENT_DATA',
        updatedData: data,
      });
    }

    // Paso 17: Selección de qué dato del paciente corregir
    if (step === 'SELECT_PATIENT_FIELD_TO_EDIT') {
      if (cleanNum === '1' || lower.includes('numero') || lower.includes('documento')) {
        return this.sanitizeResult({
          replyMessages: [
            `Número de documento actual del paciente: *${data.patientDoc || 'No registrado'}*.\n\nPor favor ingresa el número de documento corregido:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'documentId',
            editingLabel: 'número de documento',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '2' || lower.includes('tipo')) {
        return this.sanitizeResult({
          replyMessages: [
            `Tipo de documento actual del paciente: *${data.patientDocumentType || 'Cédula de Ciudadanía'}*.\n\nPor favor selecciona el tipo de documento corregido:\n\n1️⃣ Cédula de Ciudadanía (CC)\n2️⃣ Tarjeta de Identidad (TI)\n3️⃣ Cédula de Extranjería (CE)\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil`,
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo de Documento',
            buttonText: '📋 Seleccionar Tipo Doc',
            options: [
              { id: '1', title: '1. Cédula de Ciudadanía', description: 'CC para mayores de 18 años' },
              { id: '2', title: '2. Tarjeta de Identidad', description: 'TI para menores de 7 a 17 años' },
              { id: '3', title: '3. Cédula de Extranjería', description: 'CE para residentes extranjeros' },
              { id: '4', title: '4. Permiso PPT', description: 'Permiso por Protección Temporal' },
              { id: '5', title: '5. Pasaporte', description: 'Documento internacional de viaje' },
              { id: '6', title: '6. Registro Civil', description: 'RC para menores de edad' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'documentType',
            editingLabel: 'tipo de documento',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '3' || lower.includes('nombre')) {
        return this.sanitizeResult({
          replyMessages: [
            `Nombre actual del paciente: *${data.patientName || 'No registrado'}*.\n\nPor favor ingresa el Nombre Completo corregido:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'name',
            editingLabel: 'nombre completo',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '4' || lower.includes('telefono') || lower.includes('celular')) {
        return this.sanitizeResult({
          replyMessages: [
            `Teléfono actual del paciente: *${data.patientPhone || 'No registrado'}*.\n\nPor favor ingresa el número de Teléfono / Celular corregido:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'phone',
            editingLabel: 'teléfono',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '5' || lower.includes('correo') || lower.includes('email')) {
        return this.sanitizeResult({
          replyMessages: [
            `Correo actual del paciente: *${data.patientEmail || 'No registrado'}*.\n\nPor favor ingresa el Correo Electrónico corregido (o escribe *no* si no tiene):`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'email',
            editingLabel: 'correo electrónico',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '6' || lower.includes('ciudad')) {
        return this.sanitizeResult({
          replyMessages: [
            `Ciudad actual del paciente: *${data.residenceCity || 'Bogotá D.C.'}*.\n\nPor favor ingresa la Ciudad de Residencia corregida:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'residenceCity',
            editingLabel: 'ciudad de residencia',
            fallbackCount: 0,
          },
        });
      }

      if (cleanNum === '7' || lower.includes('direccion') || lower.includes('dirección')) {
        return this.sanitizeResult({
          replyMessages: [
            `Dirección actual del paciente: *${data.residenceAddress || 'No registrada'}*.\n\nPor favor ingresa la Dirección de Residencia corregida:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: 'residenceAddress',
            editingLabel: 'dirección de residencia',
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor indica qué dato deseas corregir respondiendo con un número del 1 al 7:\n\n1️⃣ Número de Documento\n2️⃣ Tipo de Documento\n3️⃣ Nombre Completo\n4️⃣ Teléfono / Celular\n5️⃣ Correo Electrónico\n6️⃣ Ciudad de Residencia\n7️⃣ Dirección de Residencia',
        ],
        nextFlow: 'IDLE',
        nextStep: 'SELECT_PATIENT_FIELD_TO_EDIT',
        updatedData: data,
      });
    }

    // Paso 18: Entrada del valor corregido para el paciente
    if (step === 'INPUT_PATIENT_EDIT_VALUE') {
      const field = data.editingField || 'documentId';
      const label = data.editingLabel || 'dato';
      let newValue = text.trim();

      if (field === 'documentId') {
        const cleanDoc = text.replace(/[^0-9a-zA-Z]/g, '').trim();
        if (cleanDoc.length < 4) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ El número de documento debe contener al menos 4 caracteres. Por favor inténtalo de nuevo:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_PATIENT_EDIT_VALUE',
            updatedData: data,
          });
        }
        newValue = cleanDoc;
        data.patientDoc = cleanDoc;
      } else if (field === 'documentType') {
        const typesMap: Record<string, string> = {
          '1': 'Cédula de Ciudadanía',
          '2': 'Tarjeta de Identidad',
          '3': 'Cédula de Extranjería',
          '4': 'Permiso por Protección Temporal (PPT)',
          '5': 'Pasaporte',
          '6': 'Registro Civil',
        };
        if (typesMap[cleanNum]) {
          newValue = typesMap[cleanNum];
        } else if (lower.includes('ciudadan') || lower.includes('cc')) {
          newValue = 'Cédula de Ciudadanía';
        } else if (lower.includes('tarjeta') || lower.includes('ti')) {
          newValue = 'Tarjeta de Identidad';
        } else if (lower.includes('extranjer') || lower.includes('ce')) {
          newValue = 'Cédula de Extranjería';
        } else if (lower.includes('ppt') || lower.includes('temporal')) {
          newValue = 'Permiso por Protección Temporal (PPT)';
        } else if (lower.includes('pasaporte')) {
          newValue = 'Pasaporte';
        } else if (lower.includes('registro') || lower.includes('rc')) {
          newValue = 'Registro Civil';
        }
        data.patientDocumentType = newValue;
      } else if (field === 'name') {
        if (newValue.length < 3) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ El nombre debe contener al menos 3 caracteres. Por favor inténtalo de nuevo:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_PATIENT_EDIT_VALUE',
            updatedData: data,
          });
        }
        data.patientName = newValue;
      } else if (field === 'phone') {
        const cleanPh = text.replace(/\D/g, '');
        if (cleanPh.length < 7) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ El número de teléfono debe contener al menos 7 dígitos. Por favor inténtalo de nuevo:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_PATIENT_EDIT_VALUE',
            updatedData: data,
          });
        }
        newValue = cleanPh;
        data.patientPhone = cleanPh;
      } else if (field === 'email') {
        const isNone = ['no', 'ninguno', 'na', 'n/a', 'no tiene'].includes(newValue.toLowerCase());
        if (!isNone && (!newValue.includes('@') || !newValue.includes('.'))) {
          return this.sanitizeResult({
            replyMessages: ['⚠️ Por favor escribe un correo electrónico válido o escribe *no* si no tiene:'],
            nextFlow: 'IDLE',
            nextStep: 'INPUT_PATIENT_EDIT_VALUE',
            updatedData: data,
          });
        }
        newValue = isNone ? 'No registrado' : newValue;
        data.patientEmail = isNone ? undefined : newValue;
      } else if (field === 'residenceCity') {
        data.residenceCity = newValue;
      } else if (field === 'residenceAddress') {
        data.residenceAddress = newValue;
      }

      // Actualizar en base de datos inmediatamente
      if (data.patientDoc && data.patientName) {
        await store.createOrUpdatePatientContact({
          documentId: data.patientDoc,
          documentType: data.patientDocumentType || 'Cédula de Ciudadanía',
          name: data.patientName,
          phone: data.patientPhone,
          email: data.patientEmail,
          residenceCity: data.residenceCity,
          residenceAddress: data.residenceAddress,
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          `Acabas de actualizar el ${label} del paciente a ${newValue}.\n\n¿Es correcto?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmar Actualización',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'CONFIRM_SINGLE_PATIENT_CORRECTION',
        updatedData: {
          ...data,
          lastEditedPatientField: field,
          lastEditedPatientLabel: label,
          lastEditedPatientValue: newValue,
          fallbackCount: 0,
        },
      });
    }

    // Paso 19: Confirmar corrección individual del paciente
    if (step === 'CONFIRM_SINGLE_PATIENT_CORRECTION') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si') ||
        lower === 'correcto'
      ) {
        return this.sanitizeResult({
          replyMessages: [
            '¿Deseas corregir algún otro dato del paciente?\n\n1️⃣ Sí\n2️⃣ No',
          ],
          interactivePayload: {
            type: 'button',
            title: '¿Corregir otro dato?',
            options: [
              { id: '1', title: '1. Sí' },
              { id: '2', title: '2. No' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'ASK_ANOTHER_PATIENT_CORRECTION',
          updatedData: { ...data, fallbackCount: 0 },
        });
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no') ||
        lower.includes('corregir')
      ) {
        return this.sanitizeResult({
          replyMessages: [
            `Entendido. Por favor ingresa nuevamente el ${data.lastEditedPatientLabel || 'dato'} del paciente:`,
          ],
          nextFlow: 'IDLE',
          nextStep: 'INPUT_PATIENT_EDIT_VALUE',
          updatedData: {
            ...data,
            editingField: data.lastEditedPatientField,
            editingLabel: data.lastEditedPatientLabel,
            fallbackCount: 0,
          },
        });
      }

      return this.sanitizeResult({
        replyMessages: [
          'Por favor responde si la actualización es correcta:\n\n1️⃣ Sí\n2️⃣ No (Corregir)',
        ],
        interactivePayload: {
          type: 'button',
          title: 'Confirmar Actualización',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No (Corregir)' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'CONFIRM_SINGLE_PATIENT_CORRECTION',
        updatedData: data,
      });
    }

    // Paso 20: Preguntar si desea corregir algún otro dato del paciente
    if (step === 'ASK_ANOTHER_PATIENT_CORRECTION') {
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('sí') ||
        lower.startsWith('si')
      ) {
        return this.getPatientCorrectionPanel(data);
      }

      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('no')
      ) {
        const ficha = this.formatPatientFicha({
          patientName: data.patientName,
          patientDocumentType: data.patientDocumentType,
          patientDoc: data.patientDoc,
          patientPhone: data.patientPhone,
          patientEmail: data.patientEmail,
          patientCity: data.residenceCity,
          patientAddress: data.residenceAddress,
          applicantName: data.applicantName,
          applicantDoc: data.applicantDoc,
        });

        if (data.userType === 'OTRO') {
          return this.sanitizeResult({
            replyMessages: [
              `Los datos del paciente han sido actualizados correctamente.\n\n${ficha}`,
              'Has seleccionado la opción *Otro* para contactar con un asesor del Hospital Universitario Nacional 🏥.',
              'Un auxiliar de atención revisará tu solicitud y te contactará en este chat en breve para orientarte con la cita del paciente.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            createTicket: {
              type: 'MANUAL_AGENT',
              priority: 'NORMAL',
              description: `Solicitante ${data.applicantName || 'Acompañante'} (${data.applicantDoc || 'Sin doc'}) solicitó atención para paciente ${data.patientName} (${data.patientDoc}).`,
            },
            updatedData: { ...data, fallbackCount: 0 },
          });
        }

        const root = this.getRootMenu(
          data.applicantName || data.patientName,
          `Los datos del paciente han sido actualizados correctamente.\n\n${ficha}`
        );
        return {
          ...root,
          updatedData: {
            ...data,
            fallbackCount: 0,
          },
        };
      }

      return this.sanitizeResult({
        replyMessages: [
          '⚠️ Por favor indica si deseas corregir otro dato del paciente:\n\n1️⃣ Sí\n2️⃣ No',
        ],
        interactivePayload: {
          type: 'button',
          title: '¿Corregir otro dato?',
          options: [
            { id: '1', title: '1. Sí' },
            { id: '2', title: '2. No' },
          ],
        },
        nextFlow: 'IDLE',
        nextStep: 'ASK_ANOTHER_PATIENT_CORRECTION',
        updatedData: data,
      });
    }

    // Si no ha seleccionado tipo de usuario previamente, forzamos la pregunta
    if (!data.userType && step !== 'SELECT_USER_TYPE') {
      return this.getWelcomeFlow();
    }

    // Si el paciente se encuentra en el panel de opciones de agendamiento y cotización
    if (step === 'SCHEDULE_MENU') {
      // 1. Consulta médica ambulatoria (F-01)
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('1') ||
        lower.includes('consulta') ||
        lower.includes('ambulatoria') ||
        lower.includes('especialista')
      ) {
        if (data.patientDoc) {
          const targetPatient = data.patientName || patientName || '';
          const note = targetPatient
            ? `Continuemos con el agendamiento para *${targetPatient}* (Doc: ${data.patientDoc}).`
            : '';
          return {
            replyMessages: [
              `Has seleccionado *Consulta médica ambulatoria (F-01)* en el HUN 🏥.${note ? `\n\n${note}` : ''}`,
              this.getSpecialtiesMenuPrompt(),
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SPECIALTY',
            updatedData: { ...data, fallbackCount: 0 },
          };
        }

        return {
          replyMessages: [
            'Has seleccionado Consulta médica ambulatoria (F-01).',
            'Por favor digita tu número de documento de identidad (sin puntos ni espacios):',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'LOOKUP_DOCUMENT',
          updatedData: { ...data, fallbackCount: 0 },
        };
      }

      // 2. Cotización de procedimiento quirúrgico (F-02)
      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('2') ||
        lower.includes('cotizar') ||
        lower.includes('cotizacion') ||
        lower.includes('cotización') ||
        lower.includes('cirugia') ||
        lower.includes('cirugía') ||
        lower.includes('quirurgico') ||
        lower.includes('quirúrgico') ||
        lower.includes('operacion') ||
        lower.includes('operación') ||
        lower.includes('procedimiento')
      ) {
        return {
          replyMessages: [
            'Has seleccionado Cotización de procedimiento quirúrgico (F-02).',
            '¿Qué procedimiento quieres cotizar?\n\nEscríbelo como quieras (por ejemplo: "cirugía de rodilla", "operación de vesícula", "hernia inguinal", etc.):',
          ],
          nextFlow: 'F02_QUIRURGICO',
          nextStep: 'F02_PROCEDURE_DESC',
          updatedData: { ...data, fallbackCount: 0 },
        };
      }

      // 3. Cita referida por médico especialista (F-03)
      if (
        cleanNum === '3' ||
        lower === '3' ||
        lower.startsWith('3') ||
        lower.includes('referido') ||
        lower.includes('referida') ||
        lower.includes('referencia')
      ) {
        return {
          replyMessages: [
            'Has seleccionado Cita referida por especialista (F-03). Este es un flujo de atención preferencial.',
            '¿El médico que te refirió te compartió un código de referencia o el nombre del especialista?\n\n1️⃣ Tengo un código de referencia\n2️⃣ Tengo el nombre del especialista\n3️⃣ No tengo código ni nombre',
          ],
          nextFlow: 'F03_REFERIDO',
          nextStep: 'F03_CODE_OR_NAME',
          updatedData: { ...data, fallbackCount: 0 },
        };
      }

      // 4. Volver al menú principal
      if (
        cleanNum === '4' ||
        lower === '4' ||
        lower.includes('volver') ||
        lower.includes('menu') ||
        lower.includes('menú') ||
        lower.includes('inicio') ||
        lower.includes('regresar')
      ) {
        return this.getRootMenu(patientName);
      }

      return {
        replyMessages: [
          '⚠️ Por favor responde con el número de tu opción deseada:\n\n1️⃣ Consulta médica ambulatoria (Cita con especialista)\n2️⃣ Cotización de procedimiento quirúrgico\n3️⃣ Cita referida por médico especialista (Modelo A / B)\n4️⃣ Volver al menú principal',
        ],
        nextFlow: 'IDLE',
        nextStep: 'SCHEDULE_MENU',
        updatedData: data,
      };
    }

    // SUBMENÚ: Si el usuario está en el submenú de Cita Médica
    if (step === 'CITA_MEDICA_MENU') {
      // 1. Agendar Cita Médica
      if (
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('1') ||
        lower.includes('agendar') ||
        lower.includes('consulta')
      ) {
        if (data.patientDoc) {
          const targetPatient = data.patientName || patientName || '';
          const note = targetPatient
            ? `Continuemos con el agendamiento para *${targetPatient}* (Doc: ${data.patientDoc}).`
            : '';
          return {
            replyMessages: [
              `Has seleccionado *Agendar Cita Médica* ambulatoria en el HUN 🏥.${note ? `\n\n${note}` : ''}`,
              this.getSpecialtiesMenuPrompt(),
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SPECIALTY',
            updatedData: { ...data, fallbackCount: 0 },
          };
        }

        return {
          replyMessages: [
            'Has seleccionado *Agendar Cita Médica* ambulatoria en el HUN 🏥.',
            'Por favor digita tu número de documento de identidad (sin puntos ni espacios. Ejemplo: 12345678):',
          ],
          nextFlow: 'PATIENT_REGISTRATION',
          nextStep: 'LOOKUP_DOCUMENT',
          updatedData: { ...data, fallbackCount: 0 },
        };
      }

      // 2. Reprogramar Cita Médica
      if (
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('2') ||
        lower.includes('reprogramar') ||
        lower.includes('reagendar') ||
        lower.includes('cambiar cita')
      ) {
        const apts = (data.confirmedAppointments || []).filter(
          (a: any) => a.status === 'CONFIRMED' || a.status === 'RESCHEDULED' || a.status === 'HELD' || a.status === 'PENDING'
        );
        if (apts.length === 0) {
          return {
            replyMessages: [
              'Actualmente no registras citas médicas confirmadas activas en el Hospital Universitario Nacional.',
              '¿Deseas agendar una nueva cita médica o volver al menú principal?\n\n1️⃣ Agendar Cita médica\n2️⃣ Volver al menú principal',
            ],
            nextFlow: 'REPROGRAMAR_CITA',
            nextStep: 'NO_APPOINTMENTS',
            updatedData: { ...data, fallbackCount: 0 },
          };
        }

        const listText = apts
          .map((a: any, i: number) => {
            const dt = new Date(a.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            return `${i + 1}️⃣ ${a.specialty} · ${a.doctorName} (${dt})`;
          })
          .join('\n');

        return {
          replyMessages: [
            `Estas son tus citas médicas confirmadas en el HUN:\n\n${listText}\n\nPor favor responde con el número de la cita que deseas reprogramar:`,
          ],
          nextFlow: 'REPROGRAMAR_CITA',
          nextStep: 'SELECT_APPOINTMENT',
          updatedData: { ...data, availableConfirmedAppointments: apts, fallbackCount: 0 },
        };
      }

      // 3. Cancelar Cita Médica
      if (
        cleanNum === '3' ||
        lower === '3' ||
        lower.startsWith('3') ||
        lower.includes('cancelar') ||
        lower.includes('anular')
      ) {
        const apts = (data.confirmedAppointments || []).filter(
          (a: any) => a.status === 'CONFIRMED' || a.status === 'RESCHEDULED' || a.status === 'HELD' || a.status === 'PENDING'
        );
        if (apts.length === 0) {
          return {
            replyMessages: [
              'Actualmente no registras citas médicas confirmadas activas para cancelar en el Hospital Universitario Nacional.',
              '¿Deseas volver al menú principal o terminar la conversación?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'CANCELAR_CITA',
            nextStep: 'NO_APPOINTMENTS',
            updatedData: { ...data, fallbackCount: 0 },
          };
        }

        const listText = apts
          .map((a: any, i: number) => {
            const dt = new Date(a.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
            return `${i + 1}️⃣ ${a.specialty} · ${a.doctorName} (${dt})`;
          })
          .join('\n');

        return {
          replyMessages: [
            `Estas son tus citas médicas confirmadas en el HUN:\n\n${listText}\n\nPor favor responde con el número de la cita que deseas cancelar:`,
          ],
          nextFlow: 'CANCELAR_CITA',
          nextStep: 'SELECT_APPOINTMENT',
          updatedData: { ...data, availableConfirmedAppointments: apts, fallbackCount: 0 },
        };
      }

      // 4. Contactar con un asesor
      if (
        cleanNum === '4' ||
        lower === '4' ||
        lower.startsWith('4') ||
        lower.includes('asesor') ||
        lower.includes('humano') ||
        lower.includes('contactar')
      ) {
        return {
          replyMessages: [
            'Has solicitado contactar con un asesor de atención particular del Hospital Universitario Nacional 🏥',
            'Un auxiliar de atención revisará tu mensaje y te responderá en este mismo chat en breve.',
          ],
          nextFlow: 'F04_AUXILIAR',
          nextStep: 'ASSIGNED',
          status: 'REQUIRES_AGENT',
          updatedData: { ...data, fallbackCount: 0 },
          createTicket: {
            type: 'MANUAL_AGENT',
            priority: 'NORMAL',
            description: `Solicitud de asesor desde submenú de cita médica: "${text}"`,
          },
        };
      }

      // 5. Volver al Menú Principal
      if (
        cleanNum === '5' ||
        lower === '5' ||
        lower.includes('volver') ||
        lower.includes('menu') ||
        lower.includes('menú') ||
        lower.includes('inicio')
      ) {
        return this.getRootMenu(patientName);
      }

      return {
        replyMessages: [
          '⚠️ Por favor responde con un número del 1 al 5:\n\n1️⃣ Agendar Cita Médica\n2️⃣ Reprogramar Cita Médica\n3️⃣ Cancelar Cita Médica\n4️⃣ Contactar con un asesor\n5️⃣ Volver al Menú Principal',
        ],
        nextFlow: 'IDLE',
        nextStep: 'CITA_MEDICA_MENU',
        updatedData: data,
      };
    }

    // 1. Cita Médica -> Despliega el submenú de Cita Médica
    if (
      cleanNum === '1' ||
      lower === '1' ||
      lower.startsWith('1') ||
      lower.includes('cita') ||
      lower.includes('consulta') ||
      lower.includes('medica') ||
      lower.includes('médica')
    ) {
      return this.getCitaMedicaMenu(data);
    }

    // 2. Laboratorios -> Lleva a consulta directa de exámenes de laboratorio
    if (
      cleanNum === '2' ||
      lower === '2' ||
      lower.startsWith('2') ||
      lower.includes('laboratorio') ||
      lower.includes('analisis') ||
      lower.includes('análisis') ||
      lower.includes('muestra')
    ) {
      return {
        replyMessages: [
          'Has seleccionado *Laboratorios* del Hospital Universitario Nacional 🔬🩸.',
          'Aquí puedes consultar tarifas oficiales, condiciones de ayuno y preparación para exámenes de laboratorio clínico (ej: hemograma, glicemia, perfil lipídico, urocultivo).\n\nPor favor escribe el *nombre del examen de laboratorio* o su código CUPS:',
        ],
        interactivePayload: {
          type: 'list',
          title: 'Laboratorios Frecuentes HUN',
          buttonText: '🔬 Ver Ejemplos de Laboratorios',
          options: [
            { id: '1', title: 'Hemograma tipo IV', description: 'Cuadro hemático completo y recuento celular' },
            { id: '2', title: 'Glucosa en suero', description: 'Glicemia en ayunas' },
            { id: '3', title: 'Perfil lipídico', description: 'Colesterol total, HDL, LDL y triglicéridos' },
            { id: '4', title: 'Creatinina en suero', description: 'Evaluación de función renal' },
            { id: '5', title: 'Urocultivo', description: 'Cultivo de orina con antibiograma' },
          ],
        },
        nextFlow: 'PREPARACIONES_INFO',
        nextStep: 'INPUT_PROCEDURE',
        updatedData: { ...data, searchCategory: 'LABORATORIO', fallbackCount: 0 },
      };
    }

    // 3. Radiología -> Lleva a consulta de imágenes diagnósticas
    if (
      cleanNum === '3' ||
      lower === '3' ||
      lower.startsWith('3') ||
      lower.includes('radiolog') ||
      lower.includes('imagen') ||
      lower.includes('ecograf') ||
      lower.includes('resonancia') ||
      lower.includes('tomograf') ||
      lower.includes('rayos x')
    ) {
      return {
        replyMessages: [
          'Has seleccionado *Radiología e Imágenes Diagnósticas* del HUN 🩻🏥.',
          'Aquí puedes consultar la preparación previa (ayuno, ingesta de agua, suspensión de medicamentos) y tarifas oficiales para ecografías, tomografías (TAC), resonancias magnéticas y rayos X.\n\nPor favor escribe el *nombre del estudio radiológico* (ej: "ecografía abdomen", "resonancia rodilla", "radiografía tórax") o su código CUPS:',
        ],
        interactivePayload: {
          type: 'list',
          title: 'Estudios de Radiología HUN',
          buttonText: '🩻 Ver Estudios Radiológicos',
          options: [
            { id: '1', title: 'Ecografía de abdomen total', description: 'Requiere ayuno previo de 6 a 8 horas' },
            { id: '2', title: 'Resonancia Magnética', description: 'RMN simple o con contraste institucional' },
            { id: '3', title: 'Tomografía computarizada (TAC)', description: 'TAC de cráneo, tórax, abdomen o columna' },
            { id: '4', title: 'Radiografía de tórax (RX)', description: 'Rayos X convencional sin cita previa' },
            { id: '5', title: 'Ecografía obstétrica / pélvica', description: 'Vejiga llena con ingesta previa de agua' },
          ],
        },
        nextFlow: 'PREPARACIONES_INFO',
        nextStep: 'INPUT_PROCEDURE',
        updatedData: { ...data, searchCategory: 'IMAGENES', fallbackCount: 0 },
      };
    }

    // 4. Cotizar Procedimientos Quirúrgicos
    if (
      cleanNum === '4' ||
      lower === '4' ||
      lower.startsWith('4') ||
      lower.includes('cotizar') ||
      lower.includes('quirurg') ||
      lower.includes('cirug') ||
      lower.includes('operacion')
    ) {
      return {
        replyMessages: [
          'Has seleccionado *Cotizar Procedimientos Quirúrgicos* (F-02) 🏥.',
          '¿Qué procedimiento o cirugía requieres cotizar?\n\nEscríbelo como quieras (por ejemplo: "cirugía de rodilla", "colecistectomía / vesícula", "hernia inguinal", "artroscopia", etc.):',
        ],
        nextFlow: 'F02_QUIRURGICO',
        nextStep: 'F02_PROCEDURE_DESC',
        updatedData: { ...data, fallbackCount: 0 },
      };
    }

    // 5. Contactar con un asesor
    if (
      cleanNum === '5' ||
      lower === '5' ||
      lower.startsWith('5') ||
      lower.includes('asesor') ||
      lower.includes('humano') ||
      lower.includes('contactar') ||
      lower.includes('hablar')
    ) {
      return {
        replyMessages: [
          'Has solicitado contactar con un asesor de atención del Hospital Universitario Nacional 🏥.',
          'Un auxiliar de atención revisará tu mensaje y te responderá en este mismo chat en breve. Por favor mantente atento a este canal.',
        ],
        nextFlow: 'F04_AUXILIAR',
        nextStep: 'ASSIGNED',
        status: 'REQUIRES_AGENT',
        updatedData: { ...data, fallbackCount: 0 },
        createTicket: {
          type: 'MANUAL_AGENT',
          priority: 'NORMAL',
          description: `Solicitud de asesor humano desde el menú principal: "${text}"`,
        },
      };
    }

    // Soporte complementario de cotización quirúrgica y referidos
    if (lower.includes('quirurgico') || lower.includes('cirugia') || lower.includes('cotizar') || lower.includes('operacion')) {
      return {
        replyMessages: [
          'Has seleccionado Cotización de procedimiento quirúrgico (F-02).',
          '¿Qué procedimiento quieres cotizar?\n\nEscríbelo como quieras (por ejemplo: "cirugía de rodilla", "operación de vesícula", "hernia inguinal", etc.):',
        ],
        nextFlow: 'F02_QUIRURGICO',
        nextStep: 'F02_PROCEDURE_DESC',
        updatedData: { ...data, fallbackCount: 0 },
      };
    }

    if (lower.includes('referido')) {
      return {
        replyMessages: [
          'Has seleccionado Cita referida por especialista (F-03). Este es un flujo de atención preferencial.',
          '¿El médico que te refirió te compartió un código de referencia o el nombre del especialista?\n\n1️⃣ Tengo un código de referencia\n2️⃣ Tengo el nombre del especialista\n3️⃣ No tengo código ni nombre',
        ],
        nextFlow: 'F03_REFERIDO',
        nextStep: 'F03_CODE_OR_NAME',
        updatedData: { ...data, fallbackCount: 0 },
      };
    }

    // Si el paciente escribe directamente un examen de laboratorio o estudio desde el menú principal
    const labDirect = await TarifasService.findLabProcedure(text);
    if (labDirect) {
      return this.handlePreparacionesInfo(text, lower, 'INPUT_PROCEDURE', { ...data, searchCategory: 'LABORATORIO' }, patientName);
    }

    const prepDirect = await PreparacionesService.findForPatient(text);
    if (prepDirect.matchType === 'EXACT' || prepDirect.matchType === 'MULTIPLE') {
      return this.handlePreparacionesInfo(text, lower, 'INPUT_PROCEDURE', { ...data, searchCategory: 'IMAGENES' }, patientName);
    }

    // Manejo de Fallback x2 (E-003)
    return this.handleFallback(text, 'IDLE', 'ROOT_MENU', data);
  }

  /**
   * Construye el mensaje y payload interactivo con los 5 motivos de reprogramación o cancelación
   */
  private static getModificationReasonPrompt(
    actionLabel: 'reprogramar' | 'cancelar',
    nextFlow: ConversationFlow,
    nextStep: string,
    data: FlowStateData,
    introMessage?: string,
    isRetry: boolean = false
  ): BotReplyResult {
    const prefix = isRetry
      ? '⚠️ Por favor responde con el número de una de las 5 opciones:\n\n'
      : introMessage
      ? `${introMessage}\n\n`
      : '';

    const questionText = `${prefix}¿Cuál es el motivo por el que deseas ${actionLabel} tu cita médica?\n\n1️⃣ Conflictos de tiempo y trabajo\n2️⃣ Problemas de movilidad o transporte\n3️⃣ Estado de salud actual\n4️⃣ Motivos económicos o administrativos\n5️⃣ Otro motivo\n\n(Puedes pulsar el botón de opciones o responder con el número de tu opción)`;

    return {
      replyMessages: [questionText],
      interactivePayload: {
        type: 'list',
        title: actionLabel === 'reprogramar' ? 'Motivo de Reprogramación' : 'Motivo de Cancelación',
        buttonText: '📋 Seleccionar Motivo',
        options: [
          { id: '1', title: '1. Tiempo y trabajo', description: 'Conflictos de tiempo, horarios laborales o personales' },
          { id: '2', title: '2. Movilidad o transporte', description: 'Problemas de desplazamiento o transporte' },
          { id: '3', title: '3. Estado de salud', description: 'Estado de salud actual, mejoría o urgencia médica' },
          { id: '4', title: '4. Económico / Admin', description: 'Motivos económicos, autorización o administrativos' },
          { id: '5', title: '5. Otro motivo', description: 'Especificar otro motivo diferente' },
        ],
      },
      nextFlow,
      nextStep,
      updatedData: data,
    };
  }

  /**
   * Interpreta la selección de uno de los 5 motivos de reprogramación o cancelación
   */
  private static parseModificationReason(
    text: string,
    lower: string
  ): { type: 'SELECTED'; reason: string } | { type: 'OTHER' } | { type: 'INVALID' } {
    const cleanNum = text.replace(/\D/g, '');
    if (
      cleanNum === '1' ||
      lower === '1' ||
      lower.includes('tiempo') ||
      lower.includes('trabajo') ||
      lower.includes('conflicto') ||
      lower.includes('laboral')
    ) {
      return { type: 'SELECTED', reason: 'Conflictos de tiempo y trabajo' };
    }
    if (
      cleanNum === '2' ||
      lower === '2' ||
      lower.includes('movilidad') ||
      lower.includes('transporte') ||
      lower.includes('desplazamiento')
    ) {
      return { type: 'SELECTED', reason: 'Problemas de movilidad o transporte' };
    }
    if (
      cleanNum === '3' ||
      lower === '3' ||
      lower.includes('salud') ||
      lower.includes('mejoria') ||
      lower.includes('mejoría')
    ) {
      return { type: 'SELECTED', reason: 'Estado de salud actual' };
    }
    if (
      cleanNum === '4' ||
      lower === '4' ||
      lower.includes('economico') ||
      lower.includes('económico') ||
      lower.includes('administrativo') ||
      lower.includes('dinero')
    ) {
      return { type: 'SELECTED', reason: 'Motivos económicos o administrativos' };
    }
    if (
      cleanNum === '5' ||
      lower === '5' ||
      lower.includes('otro')
    ) {
      return { type: 'OTHER' };
    }
    return { type: 'INVALID' };
  }

  /**
   * Consulta los cupos disponibles y construye el paso SELECT_NEW_SLOT de reprogramación
   */
  private static async buildRescheduleSlotsPrompt(
    selectedApt: any,
    data: FlowStateData,
    introPrefix: string = ''
  ): Promise<BotReplyResult> {
    data.selectedAppointmentForReschedule = selectedApt;

    let dynamicSlots = await AgendaService.getAvailableSlotsForDoctor(
      selectedApt.specialty,
      selectedApt.doctorName,
      undefined,
      3
    );

    if (dynamicSlots.length === 0) {
      dynamicSlots = await AgendaService.getAvailableSlotsForSpecialty(
        selectedApt.specialty,
        undefined,
        3
      );
    }

    if (dynamicSlots.length === 0) {
      return {
        replyMessages: [
          `No encontramos cupos disponibles inmediatos en agenda médica para reprogramar tu cita de ${selectedApt.specialty} con ${selectedApt.doctorName}.`,
          '¿Deseas que un auxiliar valide opciones de sobrecupo o volver al menú principal?\n\n1️⃣ Ir al menú principal',
        ],
        nextFlow: 'IDLE',
        nextStep: 'ROOT_MENU',
        updatedData: data,
        createTicket: {
          type: 'RESCHEDULE_NO_SLOTS',
          priority: 'HIGH',
          description: `Sin cupos para reprogramar cita ${selectedApt.id} de ${selectedApt.specialty} con ${selectedApt.doctorName} (Motivo: ${data.rescheduleReason || data.cancellationReason || 'No especificado'})`,
        },
      };
    }

    data.dynamicSlots = dynamicSlots;
    data.rescheduleAvailableSlots = dynamicSlots.map((s) => ({
      id: s.id,
      dateTime: s.dateTimeStr,
      doctorName: s.doctorName,
    }));

    const slotsPrompt = dynamicSlots
      .map((s, i) => `${i + 1}️⃣ ${s.dateTimeStr}`)
      .join('\n');

    return {
      replyMessages: [
        `${introPrefix}Horarios disponibles en agenda médica para reprogramar tu cita de *${selectedApt.specialty}*:\n\n${slotsPrompt}\n\nPor favor responde con el número del nuevo horario:`,
      ],
      interactivePayload: {
        type: 'list',
        title: `Horarios ${selectedApt.specialty}`.slice(0, 24),
        buttonText: '🗓️ Elegir Nuevo Horario',
        options: dynamicSlots.map((s, i) => ({
          id: String(i + 1),
          title: `Opción ${i + 1}`,
          description: `${s.dateTimeStr} · ${s.doctorName}`.slice(0, 72),
        })),
      },
      nextFlow: 'REPROGRAMAR_CITA',
      nextStep: 'SELECT_NEW_SLOT',
      updatedData: data,
    };
  }

  /**
   * Construye el paso de retención (ofrecer reprogramar antes de permitir cancelar)
   */
  private static buildCancelRetentionPrompt(
    selectedApt: any,
    reason: string,
    data: FlowStateData,
    isRetry: boolean = false
  ): BotReplyResult {
    const dt = selectedApt?.dateTime
      ? new Date(selectedApt.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
      : 'horario programado';
    const specialty = selectedApt?.specialty || 'tu especialidad';

    const prefix = isRetry
      ? '⚠️ Por favor responde con un número del 1 al 3:\n\n'
      : `Entendemos tu situación (*Motivo: ${reason}*). En el Hospital Universitario Nacional tu salud y la continuidad de tu tratamiento son nuestra prioridad 🏥.\n\nPara que no pierdas tu proceso médico en *${specialty}*, te sugerimos *reprogramar tu cita* en una nueva fecha y horario que se ajuste mejor a tu disponibilidad.\n\n`;

    return {
      replyMessages: [
        `${prefix}¿Qué prefieres hacer?\n\n1️⃣ 🔄 Reprogramar mi cita en otra fecha/horario (Recomendado)\n2️⃣ ✅ Conservar mi cita actual (${dt})\n3️⃣ ❌ Continuar con la cancelación de la cita`,
      ],
      interactivePayload: {
        type: 'list',
        title: 'Alternativas para tu Cita',
        buttonText: '📋 Elegir Opción',
        options: [
          { id: '1', title: '1. Reprogramar Cita', description: 'Recomendado: Cambiar fecha u hora de tu cita' },
          { id: '2', title: '2. Conservar Cita Actual', description: `Mantener tu cita del ${dt}` },
          { id: '3', title: '3. Cancelar Cita', description: 'Continuar con el proceso de cancelación' },
        ],
      },
      nextFlow: 'CANCELAR_CITA',
      nextStep: 'OFFER_RESCHEDULE',
      updatedData: data,
    };
  }

  /**
   * Flujo de Reprogramación de Cita Médica
   */
  private static async handleReprogramarCita(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData,
    patientSavedName?: string
  ): Promise<BotReplyResult> {
    switch (step) {
      case 'NO_APPOINTMENTS': {
        if (lower === '1' || lower.includes('agendar') || lower.includes('cita')) {
          return {
            replyMessages: [
              'Has seleccionado Agendar Cita médica (F-01).',
              this.getSpecialtiesMenuPrompt(),
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SPECIALTY',
            updatedData: { ...data, fallbackCount: 0 },
          };
        }
        return this.getRootMenu(patientSavedName);
      }

      case 'SELECT_APPOINTMENT': {
        const apts = data.availableConfirmedAppointments || data.confirmedAppointments || [];
        const num = parseInt(text.replace(/\D/g, ''), 10);
        if (isNaN(num) || num < 1 || num > apts.length) {
          return {
            replyMessages: [
              `⚠️ Por favor selecciona una cita válida respondiendo con un número entre 1 y ${apts.length}:`,
            ],
            nextFlow: 'REPROGRAMAR_CITA',
            nextStep: 'SELECT_APPOINTMENT',
            updatedData: data,
          };
        }

        const selectedApt = apts[num - 1];
        data.selectedAppointmentForReschedule = selectedApt;

        return this.getModificationReasonPrompt(
          'reprogramar',
          'REPROGRAMAR_CITA',
          'RESCHEDULE_REASON',
          data,
          `Has seleccionado reprogramar tu cita de *${selectedApt.specialty}* con *${selectedApt.doctorName}*.`
        );
      }

      case 'RESCHEDULE_REASON': {
        const parsed = this.parseModificationReason(text, lower);
        if (parsed.type === 'INVALID') {
          return this.getModificationReasonPrompt(
            'reprogramar',
            'REPROGRAMAR_CITA',
            'RESCHEDULE_REASON',
            data,
            undefined,
            true
          );
        }

        if (parsed.type === 'OTHER') {
          return {
            replyMessages: [
              'Por favor indícanos brevemente el motivo por el que deseas reprogramar tu cita médica:',
            ],
            nextFlow: 'REPROGRAMAR_CITA',
            nextStep: 'RESCHEDULE_CUSTOM_REASON',
            updatedData: data,
          };
        }

        data.rescheduleReason = parsed.reason;
        const selectedApt = data.selectedAppointmentForReschedule;
        return this.buildRescheduleSlotsPrompt(selectedApt, data);
      }

      case 'RESCHEDULE_CUSTOM_REASON': {
        const customReason = text.trim();
        if (customReason.length < 2) {
          return {
            replyMessages: [
              '⚠️ Por favor indícanos brevemente el motivo por el que deseas reprogramar tu cita médica:',
            ],
            nextFlow: 'REPROGRAMAR_CITA',
            nextStep: 'RESCHEDULE_CUSTOM_REASON',
            updatedData: data,
          };
        }

        data.rescheduleReason = customReason;
        const selectedApt = data.selectedAppointmentForReschedule;
        return this.buildRescheduleSlotsPrompt(selectedApt, data);
      }

      case 'SELECT_NEW_SLOT': {
        const slots = data.dynamicSlots || [];
        const num = parseInt(text.replace(/\D/g, ''), 10);
        if (isNaN(num) || num < 1 || num > slots.length) {
          return {
            replyMessages: [
              `⚠️ Por favor selecciona un horario válido respondiendo con un número entre 1 y ${slots.length}:`,
            ],
            nextFlow: 'REPROGRAMAR_CITA',
            nextStep: 'SELECT_NEW_SLOT',
            updatedData: data,
          };
        }

        const chosenSlot = slots[num - 1];
        (data as any).selectedDynamicSlot = chosenSlot;
        data.pendingNewSlot = {
          id: chosenSlot.id,
          dateTime: chosenSlot.dateTimeStr,
          doctorName: chosenSlot.doctorName,
        };

        const reasonLine = data.rescheduleReason ? `\n• Motivo: ${data.rescheduleReason}` : '';

        return {
          replyMessages: [
            `¿Estás seguro de reprogramar tu cita médica?\n\n• Especialidad: ${data.selectedAppointmentForReschedule?.specialty}\n• Médico: ${chosenSlot.doctorName}\n• Nuevo horario: ${chosenSlot.dateTimeStr}${reasonLine}\n\n1️⃣ Sí\n2️⃣ No`,
          ],
          interactivePayload: {
            type: 'button',
            title: 'Confirmar Reprogramación',
            options: [
              { id: '1', title: '1. Sí, reprogramar' },
              { id: '2', title: '2. No, conservar actual' },
            ],
          },
          nextFlow: 'REPROGRAMAR_CITA',
          nextStep: 'CONFIRM_RESCHEDULE',
          updatedData: data,
        };
      }

      case 'CONFIRM_RESCHEDULE': {
        const cleanNum = text.replace(/\D/g, '');
        if (
          cleanNum === '1' ||
          lower === '1' ||
          lower.startsWith('si') ||
          lower.startsWith('sí') ||
          lower.includes('confirmar') ||
          lower.includes('reprogramar')
        ) {
          const aptId = data.selectedAppointmentForReschedule?.id;
          const dynamicSlot = (data as any).selectedDynamicSlot as DynamicSlot | undefined;
          const newDate = dynamicSlot?.isoDateTime
            ? new Date(dynamicSlot.isoDateTime)
            : new Date(Date.now() + 48 * 60 * 60 * 1000);
          const doctorName = dynamicSlot?.doctorName || data.pendingNewSlot?.doctorName;
          const reason = data.rescheduleReason || 'Reprogramación solicitada por el paciente';

          return {
            replyMessages: [
              `✅ ¡Tu cita ha sido reprogramada exitosamente! 🏥\n\n• Especialidad: ${data.selectedAppointmentForReschedule?.specialty}\n• Médico: ${doctorName}\n• Nuevo horario: ${dynamicSlot?.dateTimeStr || data.pendingNewSlot?.dateTime}\n• Motivo registrado: ${reason}\n• Sede: Hospital Universitario Nacional (Bogotá CAN - Calle 44 # 59-75)\n\nRecuerda presentarte 20 minutos antes con tu documento de identidad.`,
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            rescheduleAppointment: aptId ? {
              appointmentId: aptId,
              newDateTime: newDate,
              newDoctorName: doctorName,
              reason,
            } : undefined,
            updatedData: { ...data, appointmentRescheduled: true },
          };
        }

        if (cleanNum === '2' || lower === '2' || lower.startsWith('no') || lower.includes('cancelar') || lower.includes('conservar')) {
          return {
            replyMessages: [
              'Has decidido conservar tu cita médica original. No se realizaron modificaciones en tu programación.',
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            updatedData: data,
          };
        }

        return {
          replyMessages: [
            'Por favor responde con el número:\n\n1️⃣ Sí\n2️⃣ No',
          ],
          nextFlow: 'REPROGRAMAR_CITA',
          nextStep: 'CONFIRM_RESCHEDULE',
          updatedData: data,
        };
      }

      default:
        return this.getRootMenu(patientSavedName);
    }
  }

  /**
   * Flujo de Cancelación de Cita Médica (con Retención Prioritaria: Reprogramar primero, Cancelar como última alternativa)
   */
  private static async handleCancelarCita(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData,
    patientSavedName?: string
  ): Promise<BotReplyResult> {
    switch (step) {
      case 'NO_APPOINTMENTS': {
        if (lower === '1' || lower.includes('menu') || lower.includes('inicio') || lower.includes('si')) {
          return this.getRootMenu(patientSavedName);
        }
        return {
          replyMessages: [
            '¡Muchas gracias por comunicarte con el Hospital Universitario Nacional (HUN)! 👋\n\nQue tengas un excelente día.',
          ],
          nextFlow: 'IDLE',
          nextStep: 'SESSION_CLOSED',
          status: 'CLOSED',
          updatedData: data,
        };
      }

      case 'SELECT_APPOINTMENT': {
        const apts = data.availableConfirmedAppointments || data.confirmedAppointments || [];
        const num = parseInt(text.replace(/\D/g, ''), 10);
        if (isNaN(num) || num < 1 || num > apts.length) {
          return {
            replyMessages: [
              `⚠️ Por favor selecciona una cita válida respondiendo con un número entre 1 y ${apts.length}:`,
            ],
            nextFlow: 'CANCELAR_CITA',
            nextStep: 'SELECT_APPOINTMENT',
            updatedData: data,
          };
        }

        const selectedApt = apts[num - 1];
        data.selectedAppointmentForCancel = selectedApt;
        data.selectedAppointmentForReschedule = selectedApt;

        // Paso 1 tras elegir cita: Preguntar los 5 motivos
        return this.getModificationReasonPrompt(
          'cancelar',
          'CANCELAR_CITA',
          'CANCEL_REASON',
          data,
          `Lamentamos que tengas inconvenientes para asistir a tu cita de *${selectedApt.specialty}* con *${selectedApt.doctorName}*.`
        );
      }

      case 'CANCEL_REASON': {
        const parsed = this.parseModificationReason(text, lower);
        if (parsed.type === 'INVALID') {
          return this.getModificationReasonPrompt(
            'cancelar',
            'CANCELAR_CITA',
            'CANCEL_REASON',
            data,
            undefined,
            true
          );
        }

        if (parsed.type === 'OTHER') {
          return {
            replyMessages: [
              'Por favor indícanos brevemente el motivo de la cancelación:',
            ],
            nextFlow: 'CANCELAR_CITA',
            nextStep: 'CANCEL_CUSTOM_REASON',
            updatedData: data,
          };
        }

        data.cancellationReason = parsed.reason;
        data.rescheduleReason = parsed.reason;

        // Paso 2: Ofrecer reprogramar la cita como alternativa prioritaria antes de cancelar
        return this.buildCancelRetentionPrompt(data.selectedAppointmentForCancel, parsed.reason, data);
      }

      case 'CANCEL_CUSTOM_REASON': {
        const customReason = text.trim();
        if (customReason.length < 2) {
          return {
            replyMessages: [
              '⚠️ Por favor indícanos brevemente el motivo de la cancelación:',
            ],
            nextFlow: 'CANCELAR_CITA',
            nextStep: 'CANCEL_CUSTOM_REASON',
            updatedData: data,
          };
        }

        data.cancellationReason = customReason;
        data.rescheduleReason = customReason;

        // Paso 2: Ofrecer reprogramar la cita como alternativa prioritaria antes de cancelar
        return this.buildCancelRetentionPrompt(data.selectedAppointmentForCancel, customReason, data);
      }

      case 'OFFER_RESCHEDULE': {
        const cleanNum = text.replace(/\D/g, '');
        const selectedApt = data.selectedAppointmentForCancel || data.selectedAppointmentForReschedule;
        const reason = data.cancellationReason || data.rescheduleReason || 'Motivo registrado por el paciente';

        // Opción 1: Reprogramar cita (Recomendado) -> Pasa directo a elegir nuevo horario sin volver a pedir motivo
        if (
          cleanNum === '1' ||
          lower === '1' ||
          lower.includes('reprogramar') ||
          lower.includes('reagendar') ||
          lower.includes('otra fecha')
        ) {
          return this.buildRescheduleSlotsPrompt(
            selectedApt,
            data,
            '¡Excelente decisión! Vamos a reprogramar tu cita para que no pierdas la continuidad de tu atención médica 🏥.\n\n'
          );
        }

        // Opción 2: Conservar cita actual sin cambios
        if (
          cleanNum === '2' ||
          lower === '2' ||
          lower.includes('conservar') ||
          lower.includes('mantener')
        ) {
          return {
            replyMessages: [
              `¡Perfecto! Tu cita médica de *${selectedApt?.specialty || 'consulta externa'}* se mantiene confirmada y programada en el HUN sin modificaciones.`,
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            updatedData: data,
          };
        }

        // Opción 3: Continuar con la cancelación (Pasa a la última confirmación donde reprogramar sigue siendo la opción 1)
        if (
          cleanNum === '3' ||
          lower === '3' ||
          lower.includes('continuar') ||
          lower.includes('cancelar') ||
          lower.includes('cancelación') ||
          lower.includes('cancelacion')
        ) {
          const dt = selectedApt?.dateTime
            ? new Date(selectedApt.dateTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
            : 'Horario asignado';

          return {
            replyMessages: [
              `⚠️ ¿Estás completamente seguro de cancelar definitivamente tu cita médica?\n\n• Especialidad: ${selectedApt?.specialty}\n• Médico: ${selectedApt?.doctorName}\n• Horario: ${dt}\n• Motivo: ${reason}\n\nRecuerda que al cancelar se liberará tu cupo.\n\n1️⃣ 🔄 Prefiero reprogramar mi cita para otra fecha\n2️⃣ ❌ Sí, cancelar definitivamente mi cita`,
            ],
            interactivePayload: {
              type: 'button',
              title: 'Confirmación Final',
              options: [
                { id: '1', title: '1. Reprogramar cita' },
                { id: '2', title: '2. Sí, cancelar' },
              ],
            },
            nextFlow: 'CANCELAR_CITA',
            nextStep: 'CONFIRM_CANCEL',
            updatedData: data,
          };
        }

        return this.buildCancelRetentionPrompt(selectedApt, reason, data, true);
      }

      case 'CONFIRM_CANCEL': {
        const cleanNum = text.replace(/\D/g, '');
        const selectedApt = data.selectedAppointmentForCancel || data.selectedAppointmentForReschedule;
        const reason = data.cancellationReason || 'Cancelado por el paciente';

        // Opción 1: Prefiere reprogramar su cita
        if (
          cleanNum === '1' ||
          lower === '1' ||
          lower.includes('reprogramar') ||
          lower.includes('reagendar') ||
          lower.startsWith('no')
        ) {
          return this.buildRescheduleSlotsPrompt(
            selectedApt,
            data,
            '¡Excelente decisión! Vamos a reprogramar tu cita médica 🏥.\n\n'
          );
        }

        // Opción 2: Confirmación definitiva de cancelación (Última alternativa)
        if (
          cleanNum === '2' ||
          lower === '2' ||
          lower.startsWith('si') ||
          lower.startsWith('sí') ||
          lower.includes('cancelar') ||
          lower.includes('definitivamente')
        ) {
          const aptId = selectedApt?.id;
          const specialty = selectedApt?.specialty || 'especialidad solicitada';
          return {
            replyMessages: [
              `✅ Tu cita médica de ${specialty} ha sido cancelada exitosamente.\nMotivo registrado: ${reason}.\n\nEsperamos poder atenderte en una próxima oportunidad en el Hospital Universitario Nacional.`,
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            cancelAppointmentId: aptId,
            cancelAppointmentReason: reason,
            updatedData: { ...data, appointmentCancelled: true, cancellationReason: reason },
          };
        }

        return {
          replyMessages: [
            'Por favor responde únicamente con el número de tu elección:\n\n1️⃣ 🔄 Prefiero reprogramar mi cita para otra fecha\n2️⃣ ❌ Sí, cancelar definitivamente mi cita',
          ],
          nextFlow: 'CANCELAR_CITA',
          nextStep: 'CONFIRM_CANCEL',
          updatedData: data,
        };
      }

      default:
        return this.getRootMenu(patientSavedName);
    }
  }

  /**
   * Manejador de opciones post-confirmación de cita:
   * 1: Ir al menú principal
   * 2: Terminar conversación (Mensaje de despedida formal)
   */
  private static handlePostConfirmationOptions(
    text: string,
    lower: string,
    data: FlowStateData,
    patientSavedName?: string
  ): BotReplyResult {
    const patientName = data.patientName || patientSavedName;

    // Opción 1: Ir al menú principal
    if (
      lower === '1' ||
      lower.includes('menu') ||
      lower.includes('principal') ||
      lower.includes('inicio') ||
      lower.includes('ir')
    ) {
      return this.getRootMenu(patientName);
    }

    // Opción 2: Terminar conversación (Envío de Encuesta NPS)
    if (
      lower === '2' ||
      lower.includes('terminar') ||
      lower.includes('cerrar') ||
      lower.includes('salir') ||
      lower.includes('finalizar') ||
      lower.includes('adios') ||
      lower.includes('chao') ||
      lower.includes('no') ||
      lower.includes('gracias')
    ) {
      const farewellGreeting = patientName ? ` ${patientName}` : '';
      return this.sanitizeResult({
        replyMessages: [
          `¡Muchas gracias por confiar en el Hospital Universitario Nacional (HUN)${farewellGreeting}! 🏥`,
          'Por favor califica tu experiencia seleccionando un número del 1 al 5 ⭐:\n\n1️⃣ Muy insatisfecho\n2️⃣ Insatisfecho\n3️⃣ Regular\n4️⃣ Bueno\n5️⃣ Excelente',
        ],
        nextFlow: 'NPS_SURVEY',
        nextStep: 'NPS_SCORE',
        updatedData: data,
      });
    }

    // Respuesta no reconocida: pedir que elija 1 o 2
    return this.sanitizeResult({
      replyMessages: [
        'Por favor selecciona una de las siguientes opciones respondiendo con el número:\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
      ],
      nextFlow: 'IDLE',
      nextStep: 'POST_CONFIRMATION_OPTIONS',
      updatedData: data,
    });
  }

  /**
   * Genera el menú de selección de especialidades con el catálogo completo del HUN y opción de asesor
   */
  public static getSpecialtiesMenuPrompt(): string {
    const list = Object.values(HUN_SPECIALTIES);
    const options = list
      .map((s, idx) => `${idx + 1}. ${s.name}`)
      .join('\n');
    const advisorIndex = list.length + 1;

    return [
      '¿Para qué especialidad necesitas tu cita médica en el Hospital Universitario Nacional? 🏥',
      '',
      '*Especialidades médicas y quirúrgicas disponibles:*',
      options,
      `${advisorIndex}. 👨‍💼 Contactar con un asesor / Otra especialidad`,
      '',
      '(Responde con el número de la opción o escribe el nombre de la especialidad que buscas)',
    ].join('\n');
  }

  private static normalizeText(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /**
   * Obtiene cupos disponibles para una especialidad médica, priorizando la API oficial de Hosvital
   * y realizando fallback automático a la agenda local si Hosvital no responde o no tiene cupos.
   */
  private static async getSlotsForSpecialty(
    specialtyName: string,
    codEspecialidadHosvital?: number | string,
    limit: number = 3
  ): Promise<DynamicSlot[]> {
    try {
      let targetCode = codEspecialidadHosvital;

      if (!targetCode) {
        const hosvitalSpecs = await HunApiService.getEspecialidades();
        const normTarget = this.normalizeText(specialtyName);
        const match = hosvitalSpecs.find((s) => {
          const normSpec = this.normalizeText(s.descripcion);
          return normSpec.includes(normTarget) || normTarget.includes(normSpec);
        });
        if (match) {
          targetCode = match.codigo;
        }
      }

      if (targetCode) {
        const hosvitalSlots = await HunApiService.consultarAgendaEspecialidad(targetCode);
        if (hosvitalSlots && hosvitalSlots.length > 0) {
          const mappedSlots: DynamicSlot[] = hosvitalSlots.slice(0, limit).map((s, idx) => {
            const timeStr = s.hora_inicial ? s.hora_inicial.substring(0, 5) : '08:00';
            const cupsVal = Array.isArray(s.cups)
              ? (s.cups[0]?.codigo || '890202')
              : (typeof s.cups === 'string' ? s.cups : '890202');
            const consultorioStr = s.numero_consultorio ? String(s.numero_consultorio).trim() : '200';
            const doctorName = s.nombre_medico?.trim() || 'Especialista HUN';
            const specName = s.nombre_especialidad?.trim() || specialtyName;

            return {
              id: `hosvital-${s.id_agenda_detalle || s.idAgendaDetalle || idx}-${Date.now()}`,
              doctorName,
              doctorCode: s.codigo_medico?.trim() || 'ME445',
              officeCode: consultorioStr,
              specialtyName: specName,
              dateTimeStr: `${s.fecha_atencion} ${timeStr} (Cons. ${consultorioStr}) con ${doctorName}`,
              isoDateTime: `${s.fecha_atencion}T${s.hora_inicial || '08:00:00'}`,
              agendaDetalleId: Number(s.id_agenda_detalle || s.idAgendaDetalle) || 677,
              codigoMedico: s.codigo_medico?.trim() || 'ME445',
              cups: cupsVal,
              consultorio: consultorioStr,
              tiempoAtencion: Number(s.tiempo_intervalo) || 20,
              codEspecialidadHosvital: Number(targetCode),
            };
          });

          if (mappedSlots.length > 0) {
            console.log(`✅ [DecisionTree] ${mappedSlots.length} cupos obtenidos directamente de Hosvital para ${specialtyName}`);
            return mappedSlots;
          }
        }
      }

      if (CONFIG.HOSVITAL_ENABLED) {
        console.log(`ℹ️ [DecisionTree] No hay cupos reales abiertos en Hosvital para ${specialtyName}.`);
        return [];
      }
    } catch (err: any) {
      console.warn(`⚠️ [DecisionTree] Error consultando agenda Hosvital: ${err.message}`);
      if (CONFIG.HOSVITAL_ENABLED) {
        return [];
      }
    }

    return AgendaService.getAvailableSlotsForSpecialty(specialtyName, undefined, limit);
  }

  /**
   * Construye el menú interactivo para que el paciente elija su médico de preferencia
   * o el cupo más próximo con cualquier especialista disponible en la especialidad.
   */
  private static async buildF01DoctorSelectionPrompt(
    data: FlowStateData,
    introMessage?: string,
    isRetry: boolean = false
  ): Promise<BotReplyResult> {
    const specialtyName = data.specialty || 'Consulta Externa';
    const doctors = await AgendaService.getDoctorsForSpecialty(specialtyName);
    data.availableSpecialtyDoctors = doctors;

    const docLines = doctors
      .map((doc, idx) => `${idx + 2}️⃣ 👨‍⚕️ ${doc.name}`)
      .join('\n');
    const customDocOptNum = doctors.length + 2;

    const menuText =
      `👨‍⚕️ *Preferencia de Médico Especialista (${specialtyName})*\n\n` +
      `¿Deseas agendar o continuar tu tratamiento con algún médico especialista en particular?\n\n` +
      `1️⃣ ⚡ Cualquier especialista disponible (Cupo más próximo)\n` +
      (docLines ? `${docLines}\n` : '') +
      `${customDocOptNum}️⃣ 🔎 Escribir el nombre de otro médico especialista\n\n` +
      `Por favor responde con el número de tu elección:`;

    const replyMessages: string[] = [];
    if (isRetry) {
      replyMessages.push(`⚠️ Por favor selecciona una opción válida del *1 al ${customDocOptNum}*, o escribe el nombre del especialista:`);
    } else if (introMessage) {
      replyMessages.push(introMessage);
    }
    replyMessages.push(menuText);

    return {
      replyMessages,
      interactivePayload: {
        type: 'list',
        title: `Especialistas · ${specialtyName}`.slice(0, 60),
        buttonText: '👨‍⚕️ Elegir Especialista',
        options: [
          {
            id: '1',
            title: '1. Cualquier especialista',
            description: 'Mostrar los cupos más próximos disponibles en la especialidad',
          },
          ...doctors.map((doc, idx) => ({
            id: String(idx + 2),
            title: `${idx + 2}. ${doc.name}`.slice(0, 60),
            description: `Continuar tratamiento o agendar con ${doc.name} (${specialtyName})`.slice(0, 72),
          })),
          {
            id: String(customDocOptNum),
            title: `${customDocOptNum}. Otro médico especialista`,
            description: 'Escribir manualmente el nombre del médico de tu preferencia',
          },
        ],
      },
      nextFlow: 'F01_CONSULTA',
      nextStep: 'F01_SELECT_DOCTOR',
      updatedData: data,
    };
  }

  /**
   * Construye la lista de horarios disponibles en F01_CONSULTA filtrando por médico preferido
   * (si fue indicado) o mostrando la agenda general más próxima de la especialidad.
   */
  private static async buildF01SlotsPrompt(
    data: FlowStateData,
    preferredDoctorName?: string
  ): Promise<BotReplyResult> {
    const specialtyName = data.specialty || 'Consulta Externa';

    if (preferredDoctorName && preferredDoctorName.trim().length > 0) {
      const cleanRequestedDoc = preferredDoctorName.trim();
      const doctorSlots = await AgendaService.getAvailableSlotsForDoctor(
        specialtyName,
        cleanRequestedDoc,
        undefined,
        3,
        true
      );

      if (doctorSlots.length === 0) {
        data.preferredDoctor = cleanRequestedDoc;
        data.dynamicSlots = [];
        return {
          replyMessages: [
            `🔎 Consultamos la agenda de *${specialtyName}*, pero en este momento *${cleanRequestedDoc}* no cuenta con cupos directos habilitados por este canal.`,
            `¿Cómo prefieres continuar para no retrasar tu atención médica?\n\n` +
              `1️⃣ 📋 Ingresar a lista de espera prioritaria con *${cleanRequestedDoc}*\n` +
              `2️⃣ 👨‍⚕️ Ver horarios disponibles con otros especialistas de *${specialtyName}*\n` +
              `3️⃣ 💬 Contactar con un asesor de agendamiento`,
          ],
          interactivePayload: {
            type: 'list',
            title: 'Sin cupos con especialista',
            buttonText: '📋 Elegir Alternativa',
            options: [
              {
                id: '1',
                title: '1. Lista de espera médico',
                description: `Solicitar cupo prioritario con ${cleanRequestedDoc}`.slice(0, 72),
              },
              {
                id: '2',
                title: '2. Otros especialistas',
                description: `Ver horarios próximos en ${specialtyName}`.slice(0, 72),
              },
              {
                id: '3',
                title: '3. Hablar con un asesor',
                description: 'Validar agenda con un auxiliar de admisiones HUN',
              },
            ],
          },
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_DOCTOR_NOT_FOUND',
          updatedData: data,
        };
      }

      const slots = doctorSlots.slice(0, 3);
      const matchedDoctorName = slots[0].doctorName || cleanRequestedDoc;
      data.dynamicSlots = slots;
      data.preferredDoctor = matchedDoctorName;

      const otherDocsOpt = slots.length + 1;
      const waitlistOpt = slots.length + 2;

      const slotOptions = slots
        .map((s, idx) => `${idx + 1}️⃣ ${s.dateTimeStr}`)
        .join('\n');

      return {
        replyMessages: [
          `👨‍⚕️ Consultando agenda del especialista *${matchedDoctorName}* (${specialtyName})...`,
          `Tenemos estos horarios disponibles con *${matchedDoctorName}*:\n\n` +
            `${slotOptions}\n` +
            `${otherDocsOpt}️⃣ 🔄 Ver horarios con otros especialistas de ${specialtyName}\n` +
            `${waitlistOpt}️⃣ 📋 Solicitar otra fecha / Lista de espera con ${matchedDoctorName}\n\n` +
            `(Abre el menú de horarios o responde con el número de tu opción):`,
        ],
        interactivePayload: {
          type: 'list',
          title: `Agenda · ${matchedDoctorName}`.slice(0, 60),
          buttonText: '🗓️ Ver Horarios del Médico',
          options: [
            ...slots.map((s, idx) => ({
              id: String(idx + 1),
              title: `${idx + 1}. ${s.dateTimeStr}`.slice(0, 60),
              description: `${matchedDoctorName} · ${specialtyName} HUN`.slice(0, 72),
            })),
            {
              id: String(otherDocsOpt),
              title: `${otherDocsOpt}. Otros especialistas`,
              description: `Ver cupos más próximos con otros médicos de ${specialtyName}`.slice(0, 72),
            },
            {
              id: String(waitlistOpt),
              title: `${waitlistOpt}. Lista de espera`,
              description: `Solicitar otra fecha con ${matchedDoctorName}`.slice(0, 72),
            },
          ],
        },
        nextFlow: 'F01_CONSULTA',
        nextStep: 'F01_SELECT_SLOT',
        updatedData: data,
      };
    }

    // Sin médico específico -> Cualquier especialista disponible (cupos más próximos)
    data.preferredDoctor = undefined;
    const rawSlots = await this.getSlotsForSpecialty(specialtyName, data.codEspecialidadHosvital, 3);
    const slots = rawSlots.slice(0, 3);
    data.dynamicSlots = slots;

    if (slots.length === 0) {
      return {
        replyMessages: [
          `Consultando disponibilidad en agenda para ${specialtyName}...`,
          `En este momento no encontramos cupos abiertos inmediatos en la agenda médica para ${specialtyName}.`,
          '¿Deseas que un auxiliar valide sobrecupo o te agregue a la lista de espera prioritaria?\n\n1️⃣ Sí, agregar a lista de espera\n2️⃣ Probar con otra especialidad\n3️⃣ Menú principal',
        ],
        nextFlow: 'F01_CONSULTA',
        nextStep: 'F01_SPECIALTY_NOT_FOUND',
        updatedData: { ...data, attemptedSpecialty: specialtyName },
      };
    }

    const slotOptions = slots
      .map((s, idx) => `${idx + 1}️⃣ ${s.dateTimeStr}`)
      .join('\n');
    const waitlistOpt = `${slots.length + 1}️⃣ Solicitar otra fecha / Lista de espera`;

    return {
      replyMessages: [
        `Consultando disponibilidad en agenda médica para ${specialtyName}...`,
        `Tenemos estos horarios disponibles para ti:\n\n${slotOptions}\n${waitlistOpt}\n\n(Abre el menú de horarios o responde con el número de tu opción):`,
      ],
      interactivePayload: {
        type: 'list',
        title: `Horarios para ${specialtyName}`.slice(0, 60),
        buttonText: '🗓️ Ver Horarios Disponibles',
        options: [
          ...slots.map((s, idx) => ({
            id: String(idx + 1),
            title: `${idx + 1}. ${s.dateTimeStr}`.slice(0, 60),
            description: `${s.doctorName} · Hospital Universitario Nacional`.slice(0, 72),
          })),
          {
            id: String(slots.length + 1),
            title: `${slots.length + 1}. Lista de espera`,
            description: 'Solicitar otra fecha o ingresar a lista de espera',
          },
        ],
      },
      nextFlow: 'F01_CONSULTA',
      nextStep: 'F01_SELECT_SLOT',
      updatedData: data,
    };
  }

  /**
   * Flujo F-01: Consulta / Ambulatorio · Cierre 100% en bot (Árbol Páginas 2)
   */
  private static async handleF01Consulta(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData,
    patientSavedName?: string
  ): Promise<BotReplyResult> {
    const normUser = this.normalizeText(text);

    switch (step) {
      case 'F01_SPECIALTY': {
        const specList = Object.values(HUN_SPECIALTIES);
        const advisorOptionNumber = specList.length + 1;
        let specialty: { id: string; name: string; fee: number } | null = null;

        const cleanDigitsOnly = normUser.replace(/\D/g, '');
        const directNum = cleanDigitsOnly.length >= 1 && cleanDigitsOnly.length <= 3 ? parseInt(cleanDigitsOnly, 10) : NaN;

        // Opción directa de contactar con un asesor desde el menú de especialidades
        if (
          cleanDigitsOnly === String(advisorOptionNumber) ||
          directNum === advisorOptionNumber ||
          normUser.includes('asesor') ||
          normUser.includes('humano') ||
          normUser.includes('auxiliar') ||
          normUser.includes('agente')
        ) {
          return {
            replyMessages: [
              'Has solicitado contactar con un asesor de agendamiento del Hospital Universitario Nacional 🏥.',
              'Un auxiliar de citas médicas revisará tu solicitud y te contactará en este chat en breve para asignarte el espacio requerido.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            updatedData: data,
            createTicket: {
              type: 'SPECIALTY_INQUIRY',
              priority: 'NORMAL',
              description: `Solicitud de asesor desde menú de especialidades: "${text}"`,
            },
          };
        }

        // Soporte de selección por número (1 al número de especialidades)
        let chosenIndex = -1;
        if (!isNaN(directNum) && directNum >= 1 && directNum <= specList.length && normUser.trim().length <= 6) {
          chosenIndex = directNum - 1;
        } else {
          const numRegexMatch = normUser.match(/(?:^|\b|\D)(?:opcion|opción|numero|número|num|#|\.)?\s*(\d{1,2})(?:\b|\.|\D|$)/i);
          if (numRegexMatch && numRegexMatch[1]) {
            const parsed = parseInt(numRegexMatch[1], 10);
            if (parsed === advisorOptionNumber) {
              return {
                replyMessages: [
                  'Has solicitado contactar con un asesor de agendamiento del Hospital Universitario Nacional 🏥.',
                  'Un auxiliar de citas médicas revisará tu solicitud y te contactará en este chat en breve para asignarte el espacio requerido.',
                ],
                nextFlow: 'F04_AUXILIAR',
                nextStep: 'ASSIGNED',
                status: 'REQUIRES_AGENT',
                updatedData: data,
                createTicket: {
                  type: 'SPECIALTY_INQUIRY',
                  priority: 'NORMAL',
                  description: `Solicitud de asesor desde menú de especialidades: "${text}"`,
                },
              };
            }
            if (parsed >= 1 && parsed <= specList.length) {
              chosenIndex = parsed - 1;
            }
          }
        }

        if (chosenIndex >= 0) {
          specialty = specList[chosenIndex];
        } else {
          // Búsqueda en especialidades predefinidas
          const foundKey = Object.keys(HUN_SPECIALTIES).find((k) => {
            const normKey = this.normalizeText(k);
            return normUser.includes(normKey) || normKey.includes(normUser);
          });
          if (foundKey) {
            specialty = HUN_SPECIALTIES[foundKey];
          } else {
            const foundSpec = specList.find((s) => {
              const normName = this.normalizeText(s.name);
              return normUser.includes(normName) || normName.includes(normUser);
            });
            if (foundSpec) {
              specialty = foundSpec;
            }
          }
        }

        // Búsqueda en catálogo oficial de especialidades de Hosvital
        if (!specialty) {
          try {
            const hosvitalSpecs = await HunApiService.getEspecialidades();
            const foundHosvital = hosvitalSpecs.find((s) => {
              const normDesc = this.normalizeText(s.descripcion);
              return normDesc.includes(normUser) || normUser.includes(normDesc);
            });
            if (foundHosvital) {
              specialty = {
                id: `hosvital_${foundHosvital.codigo}`,
                name: foundHosvital.descripcion.trim(),
                fee: 195000,
              };
              data.codEspecialidadHosvital = parseInt(foundHosvital.codigo, 10);
            }
          } catch (e) {
            // Seguir al fallback
          }
        }

        // Búsqueda dinámica en agenda médica real del HUN (Hosvital / PostgreSQL) si no coincidió
        if (!specialty) {
          const realSlots = await this.getSlotsForSpecialty(text, undefined, 3);
          if (realSlots.length > 0) {
            specialty = {
              id: realSlots[0].specialtyName.toLowerCase().replace(/\s+/g, '_'),
              name: realSlots[0].specialtyName,
              fee: 190000,
            };
            data.dynamicSlots = realSlots;
            if (realSlots[0].codEspecialidadHosvital) {
              data.codEspecialidadHosvital = realSlots[0].codEspecialidadHosvital;
            }
          }
        }

        if (!specialty) {
          // Caso E-001 Sin disponibilidad / Especialidad no parametrizada
          return {
            replyMessages: [
              `No encontramos agenda directa para "${text}" en este momento o se encuentra sujeta a disponibilidad especial.`,
              '¿Deseas que un auxiliar de agendamiento valide cupos adicionales en lista de espera prioritaria?\n\n1️⃣ Sí, agregar a lista de espera\n2️⃣ Probar con otra especialidad\n3️⃣ Menú principal',
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SPECIALTY_NOT_FOUND',
            updatedData: { ...data, attemptedSpecialty: text },
          };
        }

        data.specialty = specialty.name;
        const feeInfo = this.getSpecialtyFee(specialty.name, true, data.userTypeCode || data.userType);
        data.price = feeInfo.fee;

        return {
          replyMessages: [
            `Especialidad seleccionada: ${specialty.name}.`,
            '¿Es tu primera consulta en esta especialidad en el HUN o vienes de control?\n\n1️⃣ Primera vez (1ª vez)\n2️⃣ Cita de control\n\n(Abre el menú de opciones o responde con tu número)',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Tipo de Consulta',
            buttonText: '📋 Seleccionar Tipo',
            options: [
              { id: '1', title: '1. Primera vez (1ª vez)', description: 'Primera consulta médica en esta especialidad en el HUN' },
              { id: '2', title: '2. Cita de control', description: 'Consulta médica de seguimiento o control clínico' },
            ],
          },
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_VISIT_TYPE',
          updatedData: data,
        };
      }

      case 'F01_SPECIALTY_NOT_FOUND': {
        if (lower === '1' || lower.includes('si') || lower.includes('espera')) {
          return {
            replyMessages: [
              `✅ Quedaste registrado(a) en la lista de espera de agendamiento HUN para ${data.attemptedSpecialty || 'la especialidad solicitada'}.`,
              'Tan pronto se libere un cupo te contactaremos por este medio.',
            ],
            nextFlow: 'IDLE',
            nextStep: 'ROOT_MENU',
            updatedData: data,
            createTicket: {
              type: 'E001_WAITING_LIST',
              priority: 'NORMAL',
              description: `Lista de espera para especialidad: ${data.attemptedSpecialty}`,
            },
          };
        }
        if (lower === '2' || lower.includes('otra')) {
          return {
            replyMessages: [
              this.getSpecialtiesMenuPrompt(),
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SPECIALTY',
            updatedData: data,
          };
        }
        return this.getRootMenu();
      }

      case 'F01_VISIT_TYPE': {
        const isFirst = lower === '1' || lower.includes('primera') || lower.includes('1');
        data.isFirstTime = isFirst;
        const feeInfo = this.getSpecialtyFee(data.specialty, isFirst, data.userTypeCode || data.userType);
        data.price = feeInfo.fee;
        data.feeTierLabel = feeInfo.tierLabel;

        // Si ya tenemos nombre y documento (registrados o encontrados en base de datos),
        // pasamos a la selección de médico especialista de preferencia
        if ((data.patientName || patientSavedName) && data.patientDoc) {
          const name = data.patientName || patientSavedName;
          data.patientName = name;

          return await this.buildF01DoctorSelectionPrompt(
            data,
            `Registrado: ${isFirst ? 'Primera vez' : 'Control'} para ${name}.`
          );
        }

        // Si solo tenemos el nombre del paciente, saltamos al documento
        if (patientSavedName || data.patientName) {
          const name = data.patientName || patientSavedName;
          data.patientName = name;
          return {
            replyMessages: [
              `Registrado: ${isFirst ? 'Primera vez' : 'Control'} para ${name}.`,
              '¿Cuál es tu número de documento de identidad (Cédula de Ciudadanía / Extranjería / TI)?\n\n(Lo solicitamos para consultar tu historia clínica en el HUN y vincular la cita)',
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_PATIENT_DOC',
            updatedData: data,
          };
        }

        return {
          replyMessages: [
            `Registrado: ${isFirst ? 'Primera vez' : 'Control'}.`,
            '¿Cuál es tu nombre completo?',
          ],
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_PATIENT_NAME',
          updatedData: data,
        };
      }

      case 'F01_PATIENT_NAME': {
        if (text.length < 3) {
          return {
            replyMessages: ['Por favor indícanos tu nombre completo:'],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_PATIENT_NAME',
            updatedData: data,
          };
        }
        data.patientName = text;

        return {
          replyMessages: [
            `Gracias, ${text}.`,
            '¿Cuál es tu número de cédula o documento de identidad?\n\n(Lo solicitamos para consultar tu historia clínica en el HUN y vincular la cita)',
          ],
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_PATIENT_DOC',
          updatedData: data,
        };
      }

      case 'F01_PATIENT_DOC': {
        const docClean = text.replace(/[^0-9a-zA-Z]/g, '');
        if (docClean.length < 4) {
          return {
            replyMessages: ['⚠️ Por favor escribe un número de documento válido:'],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_PATIENT_DOC',
            updatedData: data,
          };
        }
        data.patientDoc = docClean;

        // Consultar si el paciente ya tiene historial en Hosvital para autocompletar nombre o EPS
        try {
          const hosvitalHist = await HunApiService.consultarCitasPaciente(data.patientDocumentType || 'CC', docClean);
          if (hosvitalHist && hosvitalHist.length > 0) {
            const first = hosvitalHist[0];
            if (first.Nombre_Paciente && (!data.patientName || data.patientName.toLowerCase() === 'paciente')) {
              data.patientName = first.Nombre_Paciente.trim();
            }
            if (first.Cod_Eps) {
              data.epsCode = first.Cod_Eps.trim();
              data.hasActiveEps = true;
            }
          }
        } catch (e) {
          // Ignorar fallo de historial
        }

        // Pasar a la selección de médico especialista de preferencia o cupo más próximo
        return await this.buildF01DoctorSelectionPrompt(data);
      }

      case 'F01_SELECT_DOCTOR': {
        const specialtyName = data.specialty || 'Consulta Externa';
        const doctors: Array<{ name: string; code: string; specialtyName: string; officeCode: string }> =
          data.availableSpecialtyDoctors || (await AgendaService.getDoctorsForSpecialty(specialtyName));
        data.availableSpecialtyDoctors = doctors;

        const customDocOptNum = doctors.length + 2;
        const cleanNum = text.replace(/\D/g, '');
        const choice = cleanNum.length >= 1 && cleanNum.length <= 2 ? parseInt(cleanNum, 10) : NaN;

        // Opción 1: Cualquier especialista disponible (Cupo más próximo)
        if (
          choice === 1 ||
          normUser.includes('cualquier') ||
          normUser.includes('proximo') ||
          normUser.includes('primero') ||
          normUser.includes('sin preferencia')
        ) {
          return await this.buildF01SlotsPrompt(data, undefined);
        }

        // Opciones 2 a N+1: Selección de uno de los médicos listados de la especialidad
        if (!isNaN(choice) && choice >= 2 && choice <= doctors.length + 1) {
          const selectedDoctor = doctors[choice - 2];
          return await this.buildF01SlotsPrompt(data, selectedDoctor.name);
        }

        // Opción N+2: Escribir el nombre de otro médico especialista
        if (
          choice === customDocOptNum ||
          normUser.includes('escribir') ||
          normUser.includes('otro medico') ||
          normUser.includes('buscar medico') ||
          normUser.includes('otro especialista')
        ) {
          return {
            replyMessages: [
              `🔎 Por favor escribe el *nombre y apellido del médico especialista* de *${specialtyName}* con quien deseas agendar o continuar tu tratamiento (Ej: *Dr. Carlos Mendoza*):`,
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_INPUT_CUSTOM_DOCTOR',
            updatedData: data,
          };
        }

        // Si el paciente escribió directamente el nombre de un médico de la lista o uno personalizado
        const matchedListedDoc = doctors.find((doc) => {
          const normDoc = this.normalizeText(doc.name).replace(/\b(dr|dra|doctor|doctora)\b/g, '').trim();
          const normInputClean = normUser.replace(/\b(dr|dra|doctor|doctora)\b/g, '').trim();
          return (
            normInputClean.length >= 3 &&
            (normDoc.includes(normInputClean) || normInputClean.includes(normDoc))
          );
        });

        if (matchedListedDoc) {
          return await this.buildF01SlotsPrompt(data, matchedListedDoc.name);
        }

        if (text.trim().length >= 5 && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(text) && isNaN(choice)) {
          const rawName = text.trim();
          const formattedDoc = /^(dr\.?|dra\.?|doctor|doctora)\b/i.test(rawName)
            ? rawName
            : `Dr(a). ${rawName}`;
          return await this.buildF01SlotsPrompt(data, formattedDoc);
        }

        return await this.buildF01DoctorSelectionPrompt(data, undefined, true);
      }

      case 'F01_INPUT_CUSTOM_DOCTOR': {
        const rawInput = text.trim();
        if (rawInput.length < 3 || /^\d+$/.test(rawInput)) {
          return {
            replyMessages: [
              `⚠️ Por favor escribe un nombre y apellido válido del médico especialista de *${data.specialty || 'la especialidad'}* (Ej: *Dr. Carlos Mendoza*):`,
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_INPUT_CUSTOM_DOCTOR',
            updatedData: data,
          };
        }

        const formattedDoc = /^(dr\.?|dra\.?|doctor|doctora)\b/i.test(rawInput)
          ? rawInput
          : `Dr(a). ${rawInput}`;

        return await this.buildF01SlotsPrompt(data, formattedDoc);
      }

      case 'F01_DOCTOR_NOT_FOUND': {
        const requestedDoc = data.preferredDoctor || 'el especialista solicitado';
        const specialtyName = data.specialty || 'Consulta Externa';

        if (lower === '1' || lower.includes('lista') || lower.includes('espera')) {
          return {
            replyMessages: [
              `✅ Quedaste registrado(a) en la *lista de espera prioritaria* de *${specialtyName}* para continuar tu tratamiento con *${requestedDoc}*.`,
              'Un auxiliar de admisiones del HUN te contactará por este medio tan pronto se habilite un cupo en la agenda del especialista.',
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            updatedData: data,
            createTicket: {
              type: 'E001_WAITING_LIST',
              priority: 'NORMAL',
              description: `Lista de espera prioritaria con médico específico (${requestedDoc}) en ${specialtyName}, paciente ${data.patientName || 'Particular'} (Doc: ${data.patientDoc || 'N/A'})`,
            },
          };
        }

        if (lower === '2' || lower.includes('otros') || lower.includes('horarios') || lower.includes('especialistas')) {
          return await this.buildF01SlotsPrompt(data, undefined);
        }

        if (lower === '3' || lower.includes('asesor') || lower.includes('auxiliar') || lower.includes('agente')) {
          return {
            replyMessages: [
              `Has solicitado contactar con un asesor de agendamiento para validar la agenda de *${requestedDoc}* en *${specialtyName}* 🏥.`,
              'Un auxiliar de citas médicas revisará tu solicitud y te responderá en breve por este chat.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            updatedData: data,
            createTicket: {
              type: 'SPECIALTY_INQUIRY',
              priority: 'NORMAL',
              description: `Solicitud de cita con médico específico: ${requestedDoc} (${specialtyName}) - Paciente ${data.patientName || 'Particular'} (Doc: ${data.patientDoc || 'N/A'})`,
            },
          };
        }

        return {
          replyMessages: [
            `⚠️ Por favor selecciona una opción válida (1, 2 o 3):\n\n` +
              `1️⃣ 📋 Ingresar a lista de espera prioritaria con *${requestedDoc}*\n` +
              `2️⃣ 👨‍⚕️ Ver horarios disponibles con otros especialistas de *${specialtyName}*\n` +
              `3️⃣ 💬 Contactar con un asesor de agendamiento`,
          ],
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_DOCTOR_NOT_FOUND',
          updatedData: data,
        };
      }

      case 'F01_SELECT_SLOT': {
        let slots = data.dynamicSlots || [];
        if (slots.length === 0 && data.specialty) {
          slots = data.preferredDoctor
            ? await AgendaService.getAvailableSlotsForDoctor(data.specialty, data.preferredDoctor, undefined, 3)
            : await this.getSlotsForSpecialty(data.specialty, data.codEspecialidadHosvital, 3);
          data.dynamicSlots = slots;
        }

        const cleanNum = text.replace(/\D/g, '');
        const choice = parseInt(cleanNum, 10);
        const hasPreferredDoctor = Boolean(data.preferredDoctor);
        const otherDoctorsChoice = hasPreferredDoctor ? slots.length + 1 : -1;
        const waitlistChoice = hasPreferredDoctor ? slots.length + 2 : slots.length + 1;

        // Si estaba viendo agenda de un médico específico y elige "Ver horarios con otros especialistas"
        if (
          hasPreferredDoctor &&
          (choice === otherDoctorsChoice ||
            lower.includes('otros especialistas') ||
            lower.includes('otro medico') ||
            lower.includes('otro médico') ||
            lower.includes('otros horarios'))
        ) {
          return await this.buildF01SlotsPrompt(data, undefined);
        }

        // Lista de espera (opción 4 en agenda general, o opción 5 en agenda filtrada por médico)
        if (
          choice === waitlistChoice ||
          (!hasPreferredDoctor && choice === 4) ||
          lower.includes('otra fecha') ||
          lower.includes('espera') ||
          lower.includes('lista')
        ) {
          const doctorDetail = data.preferredDoctor ? ` con *${data.preferredDoctor}*` : '';
          return {
            replyMessages: [
              `✅ Quedaste registrado(a) en la lista de espera de agendamiento HUN para *${data.specialty}*${doctorDetail}.`,
              'Un auxiliar de admisiones te contactará cuando se habiliten nuevas fechas u horarios.',
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación',
            ],
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            updatedData: data,
            createTicket: {
              type: 'E001_WAITING_LIST',
              priority: 'NORMAL',
              description: `Lista de espera para ${data.specialty}${data.preferredDoctor ? ` (Médico preferido: ${data.preferredDoctor})` : ''}, paciente ${data.patientName || 'Particular'} (Doc: ${data.patientDoc || 'N/A'})`,
            },
          };
        }

        if (isNaN(choice) || choice < 1 || choice > slots.length) {
          const maxOpt = hasPreferredDoctor ? slots.length + 2 : slots.length + 1;
          return {
            replyMessages: [
              `⚠️ Por favor elige una opción válida entre 1 y ${maxOpt}:`,
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SELECT_SLOT',
            updatedData: data,
          };
        }

        const selectedSlot = slots[choice - 1];
        data.selectedSlot = {
          id: selectedSlot.id,
          doctorName: selectedSlot.doctorName,
          dateTime: selectedSlot.dateTimeStr,
          durationMinutes: selectedSlot.durationMinutes,
        };
        (data as any).selectedDynamicSlot = selectedSlot;

        // Paso 7: Tarifa + Link de pago + confirmación
        const feeInfo = this.getSpecialtyFee(data.specialty, data.isFirstTime ?? true, data.userTypeCode || data.userType);
        data.price = feeInfo.fee;
        data.feeTierLabel = feeInfo.tierLabel;

        const formattedFee = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(data.price);

        const tierNote = data.userTypeName
          ? ` (${data.userTypeName} · ${feeInfo.tierLabel})`
          : ` (${feeInfo.tierLabel})`;

        return {
          replyMessages: [
            `Has seleccionado:\n🗓️ ${selectedSlot.dateTimeStr}\n\nLa consulta de ${data.specialty} tiene un valor de *${formattedFee}*${tierNote}.\n🔗 Link de pago seguro PSE: https://pagos.hun.edu.co/citas?ref=${encodeURIComponent(data.patientDoc || 'HUN')}`,
            '¿Cómo prefieres gestionar el pago?\n1️⃣ Pago virtual PSE\n2️⃣ Pago en ventanilla el día de la cita\n3️⃣ Confirmar cita directa',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Gestión de Pago HUN',
            buttonText: '📋 Opciones de Pago',
            options: [
              { id: '1', title: '1. Pago Virtual PSE', description: 'Pago electrónico seguro inmediato con tarjeta o PSE' },
              { id: '2', title: '2. Pago en Ventanilla', description: 'Cancela directamente en caja del HUN el día de tu cita' },
              { id: '3', title: '3. Confirmar Cita', description: 'Confirmar y agendar la cita médica inmediatamente' },
            ],
          },
          nextFlow: 'F01_CONSULTA',
          nextStep: 'F01_PAYMENT_METHOD',
          updatedData: data,
        };
      }

      case 'F01_PAYMENT_METHOD': {
        let payStatus = 'PENDING';
        if (lower === '1' || lower.includes('virtual') || lower.includes('pse')) {
          payStatus = 'PAID_VIRTUAL';
        } else if (lower === '2' || lower.includes('ventanilla')) {
          payStatus = 'PAY_AT_WINDOW';
        }

        data.paymentMethod = payStatus;

        // Paso 8: POST /webServiceCita/api/asignar_cita · Bloqueo del cupo y confirmación en Hosvital
        const selectedDyn = (data as any).selectedDynamicSlot as DynamicSlot | undefined;
        const appointmentDate = selectedDyn?.isoDateTime
          ? new Date(selectedDyn.isoDateTime)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);
        const doctorName = selectedDyn?.doctorName || data.selectedSlot?.doctorName || 'Médico Especialista HUN';
        const officeCode = selectedDyn?.officeCode || null;
        const patientName = data.patientName || patientSavedName || 'Paciente';
        const docText = data.patientDoc ? ` (Doc: ${data.patientDoc})` : '';
        const officeText = officeCode ? `\n• Consultorio: Cons. ${officeCode}` : '';

        let numeroCitaHosvital: number | undefined;

        let hosvitalErrorMsg: string | undefined;

        if (selectedDyn?.agendaDetalleId) {
          try {
            const fechaStr = selectedDyn.isoDateTime ? selectedDyn.isoDateTime.split('T')[0] : appointmentDate.toISOString().split('T')[0];
            const horaStr = selectedDyn.isoDateTime?.includes('T') ? selectedDyn.isoDateTime.split('T')[1].substring(0, 8) : '08:00:00';
            const cupsVal = selectedDyn.cups || '890202';

            const docTypeHosvital = normalizeHosvitalDocType(data.patientDocumentType || 'CC');
            const docNumClean = String(data.patientDoc || '79810144').replace(/\D/g, '');

            console.log(`📡 [DecisionTree] Publicando cita en Hosvital para paciente ${docTypeHosvital} ${docNumClean}...`);
            const asignarRes = await HunApiService.asignarCita({
              paciente: {
                tipo: docTypeHosvital,
                documento: docNumClean,
              },
              medico: {
                codigo_medico: selectedDyn.codigoMedico || selectedDyn.doctorCode || 'ME445',
                especialidad: selectedDyn.codEspecialidadHosvital || 21,
              },
              agenda_detalle_id: selectedDyn.agendaDetalleId,
              consultorio: selectedDyn.consultorio || selectedDyn.officeCode || 200,
              fecha: fechaStr,
              hora: horaStr,
              procedimiento: cupsVal,
              tiempo_atencion: selectedDyn.tiempoAtencion || 20,
              eps: data.epsCode || CONFIG.HUN_DEFAULT_EPS || 'HUN25',
            });

            if (asignarRes.numeroCitaHosvital) {
              numeroCitaHosvital = asignarRes.numeroCitaHosvital;
              data.numeroCitaHosvital = numeroCitaHosvital;
              console.log(`🎉 [DecisionTree] Cita asentada exitosamente en Hosvital #${numeroCitaHosvital}`);
            } else {
              hosvitalErrorMsg = asignarRes.message || (asignarRes.soap?.descripcion) || 'Sin confirmación de cupo en Hosvital';
              console.warn(`⚠️ [DecisionTree] Hosvital no confirmó la cita: ${hosvitalErrorMsg}`);
            }
          } catch (err: any) {
            hosvitalErrorMsg = err.message;
            console.warn(`⚠️ [DecisionTree] Error conectando con asignar_cita de Hosvital: ${err.message}`);
          }
        }

        // REGLA ESTRICTA DE PRODUCCIÓN: Si Hosvital está habilitado y NO devolvió número oficial de cita,
        // NUNCA confirmar la cita localmente ni engañar al paciente o a la base de datos.
        if (CONFIG.HOSVITAL_ENABLED && !numeroCitaHosvital) {
          console.warn(`❌ [DecisionTree] Asignación en Hosvital no completada. Motivo: ${hosvitalErrorMsg || 'Rechazo'}. NO se confirma cita en BD.`);
          return {
            replyMessages: [
              `⚠️ En este momento no fue posible confirmar tu cita en el sistema central de Hosvital.\n\n• Motivo reportado: ${hosvitalErrorMsg || 'El turno ya no está disponible o requiere validación hospitalaria'}.\n\nPara asegurar tu atención y no perder tu solicitud, hemos radicado un caso prioritario para la Coordinación de Admisiones del HUN. Un auxiliar te contactará para formalizar tu cita directamente en Hosvital.`,
              '¿Deseas realizar alguna otra gestión?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación\n\nPor favor responde con el número de tu opción (1 o 2):',
            ],
            interactivePayload: {
              type: 'list',
              title: 'Gestión en Admisiones',
              buttonText: '📋 Opciones Posteriores',
              options: [
                { id: '1', title: '1. Ir al Menú Principal', description: 'Consultar otra especialidad o servicio' },
                { id: '2', title: '2. Terminar Conversación', description: 'Finalizar la sesión de atención' },
              ],
            },
            nextFlow: 'IDLE',
            nextStep: 'POST_CONFIRMATION_OPTIONS',
            createTicket: {
              type: 'E001_WAITING_LIST',
              priority: 'HIGH',
              description: `Fallo de confirmación en Hosvital: Paciente ${patientName}${docText}, especialidad ${data.specialty || 'General'}, médico ${doctorName}, horario ${selectedDyn?.dateTimeStr || 'N/A'}. Error devuelto: ${hosvitalErrorMsg || 'Sin número de cita'}`,
            },
            updatedData: {
              ...data,
              appointmentConfirmed: false,
              hasConfirmedAppointment: false,
            },
          };
        }

        const hosvitalText = numeroCitaHosvital ? `\n• Número Oficial Hosvital: #${numeroCitaHosvital}` : '';

        // Obtener instrucciones de preparación según el servicio o especialidad agendada
        const prepInstructions = await this.getPreparationInstructionsForService(
          data.specialty || 'Consulta Médica General',
          selectedDyn?.cups
        );

        return {
          replyMessages: [
            '🎉 ¡Tu cita ha sido confirmada con éxito en Hosvital! 🏥',
            `Detalles de tu cita:\n• Especialidad: ${data.specialty}\n• Paciente: ${patientName}${docText}\n• Horario: ${selectedDyn?.dateTimeStr || data.selectedSlot?.dateTime}\n• Especialista: ${doctorName}${officeText}${hosvitalText}\n• Sede: Hospital Universitario Nacional de Colombia (Bogotá - Calle 44 # 59-75)\n• Forma de pago: ${payStatus === 'PAY_AT_WINDOW' ? 'Pago en ventanilla' : 'Pago virtual'}\n\nTe enviaremos un recordatorio automático 24 horas antes de tu cita.`,
            prepInstructions,
            '¿Qué deseas hacer a continuación?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación\n\nPor favor responde con el número de tu opción (1 o 2):',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Siguientes Pasos',
            buttonText: '📋 Opciones Posteriores',
            options: [
              { id: '1', title: '1. Ir al Menú Principal', description: 'Realizar otra consulta, laboratorio o cotización' },
              { id: '2', title: '2. Terminar Conversación', description: 'Finalizar la sesión de atención' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'POST_CONFIRMATION_OPTIONS',
          updatedData: {
            ...data,
            appointmentConfirmed: true,
            hasConfirmedAppointment: true,
            numeroCitaHosvital: numeroCitaHosvital,
          },
          createAppointment: {
            specialty: data.specialty || 'General',
            doctorName: doctorName,
            dateTime: appointmentDate,
            durationMinutes: selectedDyn?.durationMinutes || 30,
            isFirstTime: data.isFirstTime ?? true,
            price: data.price || 180000,
            paymentStatus: payStatus,
            isReferral: false,
            doctorId: selectedDyn?.doctorCode || undefined,
            officeId: selectedDyn?.officeCode || undefined,
            numeroCitaHosvital: numeroCitaHosvital,
            referralCode: numeroCitaHosvital ? `HOSVITAL-${numeroCitaHosvital}` : undefined,
          },
        };
      }

      default:
        return this.getRootMenu();
    }
  }

  /**
   * Flujo F-02: Quirúrgico (con y sin MAES) · Bot captura · Auxiliar ejecuta (Árbol Página 3)
   */
  private static handleF02Quirurgico(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData
  ): BotReplyResult {
    switch (step) {
      case 'F02_PROCEDURE_DESC': {
        if (text.length < 3) {
          return {
            replyMessages: ['Por favor descríbenos brevemente el procedimiento que deseas cotizar:'],
            nextFlow: 'F02_QUIRURGICO',
            nextStep: 'F02_PROCEDURE_DESC',
            updatedData: data,
          };
        }
        data.procedureDesc = text;

        return {
          replyMessages: [
            `Procedimiento a cotizar: ${text}.`,
            '¿Ya tienes orden médica emitida por un especialista para esta cirugía?\n\n1️⃣ Sí, ya tengo orden médica\n2️⃣ No tengo orden médica aún',
          ],
          nextFlow: 'F02_QUIRURGICO',
          nextStep: 'F02_HAS_ORDER',
          updatedData: data,
        };
      }

      case 'F02_HAS_ORDER': {
        if (lower === '2' || lower.includes('no')) {
          // Desvío a F-01 consulta previa
          return {
            replyMessages: [
              'Para realizar una cotización quirúrgica y programar cirugía en el HUN, es requisito contar con una valoración médica previa por un especialista de nuestra institución.',
              this.getSpecialtiesMenuPrompt(),
            ],
            nextFlow: 'F01_CONSULTA',
            nextStep: 'F01_SPECIALTY',
            updatedData: { ...data, needsPreOpConsult: true },
          };
        }

        data.hasMedicalOrder = true;
        return {
          replyMessages: ['¿Cuál es tu nombre completo?'],
          nextFlow: 'F02_QUIRURGICO',
          nextStep: 'F02_PATIENT_NAME',
          updatedData: data,
        };
      }

      case 'F02_PATIENT_NAME': {
        data.patientName = text;
        return {
          replyMessages: [
            `Gracias, ${text}.`,
            '¿Cuentas con EPS activa actualmente? (Esta información es importante para verificar posibles coberturas compartidas en insumos o medicamentos institucionales):\n\n1️⃣ Sí, tengo EPS activa\n2️⃣ No tengo EPS activa / Totalmente particular',
          ],
          nextFlow: 'F02_QUIRURGICO',
          nextStep: 'F02_EPS_ACTIVE',
          updatedData: data,
        };
      }

      case 'F02_EPS_ACTIVE': {
        const hasEps = lower === '1' || lower.includes('si');
        data.hasActiveEps = hasEps;

        return {
          replyMessages: [
            `Hemos registrado tu solicitud de cotización para: ${data.procedureDesc}.`,
            'Tu cotización formal incluirá:\n• Derechos de sala de cirugía\n• Insumos y medicamentos especializados\n• Estancia y recuperación institucional\n\nNuestro equipo de Auxiliares de Cotización Quirúrgica revisará tu caso y te enviará la propuesta detallada en un plazo máximo de 72 horas hábiles.',
            'Opcional: Si tienes foto o PDF de tu orden médica o historia clínica, puedes enviarla en este momento adjuntándola al chat. (O escribe "listo" para finalizar):',
          ],
          nextFlow: 'F02_QUIRURGICO',
          nextStep: 'F02_ATTACH_ORDER',
          updatedData: data,
        };
      }

      case 'F02_ATTACH_ORDER': {
        return {
          replyMessages: [
            '✅ ¡Solicitud recibida correctamente! 🎉',
            'Un auxiliar clínico del HUN ha sido asignado a tu cotización. Te notificaremos tan pronto esté lista con el desglose de costos y el link de pago.',
            'Escribe "menu" si deseas consultar algo más.',
          ],
          nextFlow: 'IDLE',
          nextStep: 'QUOTATION_PENDING',
          updatedData: data,
          createQuote: {
            procedureDescription: data.procedureDesc || 'Procedimiento quirúrgico',
            hasMedicalOrder: data.hasMedicalOrder ?? true,
            hasActiveEps: data.hasActiveEps ?? false,
            medicalOrderFileUrl: text !== 'listo' && text.length > 5 ? text : undefined,
          },
          createTicket: {
            type: 'SURGICAL_QUOTE_REQUEST',
            priority: 'HIGH',
            description: `Cotización quirúrgica para ${data.patientName}: ${data.procedureDesc}. EPS: ${data.hasActiveEps ? 'Sí' : 'No'}`,
          },
        };
      }

      default:
        return this.getRootMenu();
    }
  }

  /**
   * Flujo F-03: Referido por especialista · Modelo A / Modelo B · 2 datos (Árbol Página 4)
   */
  private static async handleF03Referido(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData,
    patientSavedName?: string
  ): Promise<BotReplyResult> {
    switch (step) {
      case 'F03_CODE_OR_NAME': {
        if (lower === '1' || lower.includes('codigo')) {
          return {
            replyMessages: [
              'Por favor escribe el código de referencia que te compartió tu médico especialista:',
            ],
            nextFlow: 'F03_REFERIDO',
            nextStep: 'F03_VALIDATE_CODE',
            updatedData: data,
          };
        }

        if (lower === '2' || lower.includes('nombre')) {
          return {
            replyMessages: [
              'Por favor escribe el nombre completo del médico especialista que te refirió:',
            ],
            nextFlow: 'F03_REFERIDO',
            nextStep: 'F03_DOCTOR_NAME',
            updatedData: data,
          };
        }

        // Opción 3: Sin código ni nombre -> Derivar a auxiliar
        return {
          replyMessages: [
            'Para acceder a la ruta de referidos prioritarios se requiere el código o nombre del especialista vinculante.',
            'Un auxiliar de admisiones revisará tu caso para ubicar la referencia. En breve te responderá.',
          ],
          nextFlow: 'F04_AUXILIAR',
          nextStep: 'ASSIGNED',
          status: 'REQUIRES_AGENT',
          updatedData: data,
          createTicket: {
            type: 'REFERRAL_WITHOUT_DATA',
            priority: 'NORMAL',
            description: 'Paciente intentó ingresar por referidos sin código ni nombre',
          },
        };
      }

      case 'F03_VALIDATE_CODE': {
        const code = text.toUpperCase().replace(/\s+/g, '');
        // Mock validación otrosíes / códigos activos
        const isValidCode = code.startsWith('HUN') || code.includes('REF') || code.length >= 4;

        if (!isValidCode) {
          // Excepción E-005 Código inválido
          return {
            replyMessages: [
              '⚠️ El código ingresado no se encuentra activo en nuestro sistema de otrosíes.',
              'Un asesor del equipo de referidos se comunicará contigo en un máximo de 30 minutos para validar la referencia médica manualmente.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            updatedData: { ...data, referralCode: text },
            createTicket: {
              type: 'E005_INVALID_CODE',
              priority: 'HIGH',
              description: `Código de referencia inválido ingresado: ${text}`,
            },
          };
        }

        data.referralCode = code;
        data.referralDoctor = 'Dr. Juan Camilo Roa (Especialista Referente HUN)';
        // Determinamos modelo (ej. Modelo B si requiere aviso de honorarios)
        data.referralModel = 'MODEL_B';

        return {
          replyMessages: [
            `✅ Código de referencia verificado: ${code} (Especialista: ${data.referralDoctor}).`,
            '⚠️ Aviso importante sobre honorarios profesionales (Modelo B):\nLos honorarios del especialista referente son independientes del HUN y se acuerdan directamente con él. El Hospital Universitario Nacional factura los derechos institucionales, sala e insumos.\n\n¿Aceptas y estás de acuerdo con esta condición?\n1️⃣ Sí, acepto y continuar con agendamiento\n2️⃣ Deseo hablar con un asesor',
          ],
          nextFlow: 'F03_REFERIDO',
          nextStep: 'F03_MODEL_B_CONSENT',
          updatedData: data,
        };
      }

      case 'F03_DOCTOR_NAME': {
        data.referralDoctor = text;
        data.referralModel = 'MODEL_A';

        return {
          replyMessages: [
            `Especialista registrado: ${text}.`,
            '¿Cuál es tu nombre completo?',
          ],
          nextFlow: 'F03_REFERIDO',
          nextStep: 'F03_PATIENT_NAME',
          updatedData: data,
        };
      }

      case 'F03_MODEL_B_CONSENT': {
        if (lower === '2' || lower.includes('asesor') || lower.includes('no')) {
          return {
            replyMessages: [
              'Entendido. Te transferimos a un asesor comercial para resolver tus inquietudes sobre el Modelo de Honorarios.',
            ],
            nextFlow: 'F04_AUXILIAR',
            nextStep: 'ASSIGNED',
            status: 'REQUIRES_AGENT',
            updatedData: data,
            createTicket: {
              type: 'MODEL_B_INQUIRY',
              priority: 'NORMAL',
              description: 'Paciente solicita aclaración de honorarios Modelo B',
            },
          };
        }

        return {
          replyMessages: [
            'Aceptación de condiciones registrada.',
            '¿Cuál es tu nombre completo?',
          ],
          nextFlow: 'F03_REFERIDO',
          nextStep: 'F03_PATIENT_NAME',
          updatedData: data,
        };
      }

      case 'F03_PATIENT_NAME': {
        data.patientName = text;

        let dynamicSlots: DynamicSlot[] = [];
        if (data.referralDoctor) {
          const cleanDoc = data.referralDoctor.replace(/Dr\.|Dra\.|Especialista|Referente|\(.*?\)/gi, '').trim();
          dynamicSlots = await AgendaService.getAvailableSlotsForDoctor('', cleanDoc, undefined, 3);
        }
        if (dynamicSlots.length === 0) {
          dynamicSlots = await AgendaService.getAvailableSlotsForSpecialty('CIRUGIA', undefined, 3);
        }

        if (dynamicSlots.length > 0) {
          data.dynamicSlots = dynamicSlots;
          const options = dynamicSlots
            .map((s, idx) => `${idx + 1}️⃣ ${s.dateTimeStr} (Cupo Prioritario)`)
            .join('\n');

          return {
            replyMessages: [
              `Gracias ${text}. Al ser paciente referido, tienes acceso al Pool Prioritario de Citas del HUN.`,
              `Selecciona el horario que prefieras:\n\n${options}\n\n(Responde con el número de tu opción):`,
            ],
            nextFlow: 'F03_REFERIDO',
            nextStep: 'F03_SELECT_PRIORITY_SLOT',
            updatedData: data,
          };
        }

        const options = PRIORITY_REFERRAL_SLOTS.map(
          (s, idx) => `${idx + 1}️⃣ ${s.dateTime} (${s.doctorName})`
        ).join('\n');

        return {
          replyMessages: [
            `Gracias ${text}. Al ser paciente referido, tienes acceso al Pool Prioritario de Citas del HUN.`,
            `Selecciona el horario que prefieras:\n\n${options}\n\n(Responde 1, 2 o 3):`,
          ],
          nextFlow: 'F03_REFERIDO',
          nextStep: 'F03_SELECT_PRIORITY_SLOT',
          updatedData: data,
        };
      }

      case 'F03_SELECT_PRIORITY_SLOT': {
        const choice = parseInt(text.replace(/\D/g, ''), 10);
        const dynamicSlots = data.dynamicSlots || [];
        const slotsCount = dynamicSlots.length > 0 ? dynamicSlots.length : PRIORITY_REFERRAL_SLOTS.length;

        if (isNaN(choice) || choice < 1 || choice > slotsCount) {
          return {
            replyMessages: [`⚠️ Por favor selecciona una opción válida (1 a ${slotsCount}):`],
            nextFlow: 'F03_REFERIDO',
            nextStep: 'F03_SELECT_PRIORITY_SLOT',
            updatedData: data,
          };
        }

        let doctorName = 'Especialista HUN';
        let dateTimeStr = 'Próxima fecha';
        let isoDateTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        let doctorCode: string | undefined = undefined;
        let officeCode: string | undefined = undefined;

        if (dynamicSlots.length > 0) {
          const selectedDyn = dynamicSlots[choice - 1];
          doctorName = selectedDyn.doctorName;
          dateTimeStr = selectedDyn.dateTimeStr;
          isoDateTime = new Date(selectedDyn.isoDateTime);
          doctorCode = selectedDyn.doctorCode || undefined;
          officeCode = selectedDyn.officeCode || undefined;
          data.selectedSlot = { id: selectedDyn.id, doctorName, dateTime: dateTimeStr };
        } else {
          const slot = PRIORITY_REFERRAL_SLOTS[choice - 1];
          data.selectedSlot = slot;
          doctorName = slot.doctorName;
          dateTimeStr = slot.dateTime;
        }

        const patientName = data.patientName || patientSavedName || 'Paciente';

        const prepInstructions = await this.getPreparationInstructionsForService(
          data.specialty || 'Cirugía / Especialidad Referida'
        );

        return {
          replyMessages: [
            '🎉 ¡Cita prioritaria confirmada exitosamente! ✅',
            `Resumen de tu cita referida:\n• Paciente: ${patientName}\n• Especialista: ${doctorName}\n• Horario reservado: ${dateTimeStr}\n• Sede: Hospital Universitario Nacional de Colombia (Bogotá - Calle 44 # 59-75)\n\nSi tienes la orden médica o indicación escrita del especialista, puedes adjuntarla en este chat como foto o documento.`,
            prepInstructions,
            '¿Qué deseas hacer a continuación?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación\n\nPor favor responde con el número de tu opción (1 o 2):',
          ],
          interactivePayload: {
            type: 'list',
            title: 'Siguientes Pasos',
            buttonText: '📋 Opciones Posteriores',
            options: [
              { id: '1', title: '1. Ir al Menú Principal', description: 'Realizar otra consulta, laboratorio o cotización' },
              { id: '2', title: '2. Terminar Conversación', description: 'Finalizar la sesión de atención' },
            ],
          },
          nextFlow: 'IDLE',
          nextStep: 'POST_CONFIRMATION_OPTIONS',
          updatedData: {
            ...data,
            appointmentConfirmed: true,
            hasConfirmedAppointment: true,
          },
          createAppointment: {
            specialty: 'Referencia Especializada',
            doctorName: doctorName,
            dateTime: isoDateTime,
            isFirstTime: true,
            price: 180000,
            paymentStatus: 'CONFIRMED_REFERRAL',
            isReferral: true,
            referralCode: data.referralCode,
            referralModel: data.referralModel,
            doctorId: doctorCode,
            officeId: officeCode,
          },
        };
      }

      default:
        return this.getRootMenu();
    }
  }

  /**
   * Módulo de Post-Atención: Seguimiento 24-48h Consulta
   */
  private static handlePostConsulta(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData
  ): BotReplyResult {
    return {
      replyMessages: [
        'Agradecemos tus comentarios. Tu seguimiento ha quedado registrado en la historia de atención del HUN.',
        'Si requieres una nueva cita o tienes dudas adicionales, escribe "menu".',
      ],
      nextFlow: 'IDLE',
      nextStep: 'POST_CONSULT_DONE',
      updatedData: data,
    };
  }

  /**
   * Módulo de Post-Atención: Signos de alarma Post-Quirúrgicos (Árbol Páginas 4-5)
   * ¡CRÍTICO! Si presenta signos de alarma dispara alerta inmediata
   */
  private static handlePostQx(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData
  ): BotReplyResult {
    if (lower === '1' || lower.includes('si') || lower.includes('alarma') || lower.includes('fiebre') || lower.includes('dolor') || lower.includes('sangrado')) {
      return {
        replyMessages: [
          '🚨 ALERTA CLÍNICA REGISTRADA 🚨',
          'Hemos activado de manera inmediata al equipo de Enfermería y Auxiliares de Cirugía del HUN. Un profesional de la salud te contactará en este momento a tu número telefónico.',
          '⚠️ Si presentas una urgencia médica vital inminente, por favor acércate de inmediato al servicio de Urgencias del Hospital Universitario Nacional (Calle 44 # 59-75) o a tu centro asistencial más cercano.',
        ],
        nextFlow: 'F04_AUXILIAR',
        nextStep: 'CRITICAL_ALARM',
        status: 'REQUIRES_AGENT',
        updatedData: { ...data, hasPostQxAlarm: true },
        createTicket: {
          type: 'POST_QX_ALARM',
          priority: 'CRITICAL',
          description: `🚨 SIGNO DE ALARMA POST-QX REPORTADO: "${text}"`,
        },
      };
    }

    return {
      replyMessages: [
        'Nos alegra saber que tu evolución marcha sin signos de alarma.',
        'Recuerda seguir estrictamente las indicaciones de tu fórmula médica y asistir a tu control postoperatorio.',
      ],
      nextFlow: 'IDLE',
      nextStep: 'POST_QX_OK',
      updatedData: data,
    };
  }

  /**
   * Módulo de Encuesta NPS 48-72h (Árbol Página 5 y Excepción E-009)
   */
  private static handleNpsSurvey(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData
  ): BotReplyResult {
    const score = parseInt(text.replace(/[^0-9]/g, ''), 10);

    if (isNaN(score) || score < 1 || score > 5) {
      return {
        replyMessages: [
          'Por favor califica tu experiencia seleccionando un número del 1 al 5 ⭐:\n\n1️⃣ Muy insatisfecho\n2️⃣ Insatisfecho\n3️⃣ Regular\n4️⃣ Bueno\n5️⃣ Excelente',
        ],
        nextFlow: 'NPS_SURVEY',
        nextStep: 'NPS_SCORE',
        updatedData: data,
      };
    }

    data.npsScore = score;

    if (score <= 3) {
      // Excepción E-009: NPS <= 3 dispara PQRS automática y contacto en máx 2 días hábiles
      return {
        replyMessages: [
          `Has calificado con ${score}/5 estrellas. Lamentamos sinceramente que tu experiencia no haya sido completamente satisfactoria.`,
          'Hemos abierto una solicitud formal de PQRS ante la Dirección de Experiencia del Usuario del HUN. Un asesor de servicio se pondrá en contacto contigo en un máximo de 2 días hábiles para atender tu caso y buscar una solución oportuna.',
        ],
        nextFlow: 'IDLE',
        nextStep: 'NPS_COMPLETED',
        status: 'CLOSED',
        updatedData: {
          ...data,
          sessionClosed: true,
          appointmentConfirmed: true,
        },
        createNps: {
          rating: score,
          comment: `Calificación baja recibida: ${score}/5`,
          hasPqrs: true,
        },
        createTicket: {
          type: 'E009_PQRS',
          priority: 'HIGH',
          description: `Apertura automática de PQRS por calificación NPS de ${score}/5 estrellas`,
        },
      };
    }

    // NPS >= 4 Satisfactorio
    return {
      replyMessages: [
        `¡Muchas gracias por tu calificación de ${score} ⭐!`,
        'En el Hospital Universitario Nacional trabajamos constantemente para brindarte la mejor atención humana y científica.',
      ],
      nextFlow: 'IDLE',
      nextStep: 'NPS_COMPLETED',
      status: 'CLOSED',
      updatedData: {
        ...data,
        sessionClosed: true,
        appointmentConfirmed: true,
      },
      createNps: {
        rating: score,
        hasPqrs: false,
      },
    };
  }

  /**
   * Manejo de Fallback x2 (Excepción E-003):
   * 1er fallo: reenvío de opciones.
   * 2do fallo consecutivo: derivación automática a auxiliar humano.
   */
  private static handleFallback(
    userText: string,
    currentFlow: ConversationFlow,
    currentStep: string,
    data: FlowStateData
  ): BotReplyResult {
    const fallbacks = (data.fallbackCount || 0) + 1;
    data.fallbackCount = fallbacks;

    if (fallbacks >= 2) {
      return {
        replyMessages: [
          'No hemos podido comprender tu solicitud después de 2 intentos.',
          'Para asegurarte una atención adecuada, hemos derivado tu caso a nuestro equipo de Auxiliares de Atención Particular del HUN.',
          'Un asesor humano te atenderá por este chat en breve. ¡Gracias por tu paciencia!',
        ],
        nextFlow: 'F04_AUXILIAR',
        nextStep: 'ASSIGNED',
        status: 'REQUIRES_AGENT',
        updatedData: { ...data, fallbackCount: 0 },
        createTicket: {
          type: 'E003_FALLBACK_X2',
          priority: 'NORMAL',
          description: `Derivación automática por Fallback x2. Último mensaje: "${userText}"`,
        },
      };
    }

    return {
      replyMessages: [
        'Disculpa, no logramos reconocer esa opción.',
        'Por favor selecciona una de las opciones válidas enviando únicamente el número o la palabra clave.',
      ],
      nextFlow: currentFlow,
      nextStep: currentStep,
      updatedData: data,
    };
  }

  /**
   * Manejador del flujo de consulta de preparaciones y laboratorios de exámenes (Imágenes HUN)
   */
  private static async handlePreparacionesInfo(
    text: string,
    lower: string,
    step: string,
    data: FlowStateData,
    patientName?: string
  ): Promise<BotReplyResult> {
    const cleanNum = text.replace(/\D/g, '');

    // Comandos universales de navegación
    if (lower === 'menu' || lower === 'inicio' || lower === 'salir' || lower === 'cancelar') {
      return this.getRootMenu(patientName);
    }

    // Paso de confirmación del procedimiento consultado (Especialmente Laboratorios)
    if (step === 'CONFIRM_LAB_PROCEDURE') {
      const isYes =
        cleanNum === '1' ||
        lower === '1' ||
        lower.startsWith('1') ||
        lower.includes('si') ||
        lower.includes('sí') ||
        lower.includes('correcto') ||
        lower.includes('confirmar');

      const isNo =
        cleanNum === '2' ||
        lower === '2' ||
        lower.startsWith('2') ||
        lower.includes('no') ||
        lower.includes('corregir') ||
        lower.includes('cambiar');

      if (isYes) {
        const tariff = data.pendingLabTariff;
        if (tariff) {
          const userTypeParam = data.userTypeCode || data.userType;
          // Tarjeta 1: Información del procedimiento y su valor
          const tariffCard = TarifasService.formatPatientTariffMessage(tariff, userTypeParam);
          // Tarjeta 2: Preparación para el procedimiento
          const prepCard = PreparacionesService.getLaboratoryPreparationCard(tariff);

          return {
            replyMessages: [
              tariffCard,
              prepCard,
              '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
            ],
            interactivePayload: {
              type: 'button',
              options: [
                { id: '1', title: '1. Consultar otro' },
                { id: '2', title: '2. Menú Principal' },
              ],
            },
            nextFlow: 'PREPARACIONES_INFO',
            nextStep: 'AFTER_INSTRUCTION',
            updatedData: {
              ...data,
              lastProcedureId: tariff.cups,
              pendingLabTariff: undefined,
              pendingLabName: undefined,
              fallbackCount: 0,
            },
          };
        }
      }

      if (isNo) {
        return {
          replyMessages: [
            'Entendido. Por favor escribe nuevamente el nombre del examen de laboratorio o código CUPS que deseas consultar:',
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'INPUT_PROCEDURE',
          updatedData: {
            ...data,
            pendingLabTariff: undefined,
            pendingLabName: undefined,
            fallbackCount: 0,
          },
        };
      }

      if (lower === 'menu' || lower === 'inicio' || lower === 'salir') {
        return this.getRootMenu(patientName);
      }

      // Si el paciente escribe directamente otro término de búsqueda
      return this.handlePreparacionesInfo(text, lower, 'INPUT_PROCEDURE', data, patientName);
    }

    // Paso 1: El paciente escribe el nombre del procedimiento o código CUPS
    if (step === 'INPUT_PROCEDURE') {
      let queryText = text;
      if (data.searchCategory === 'LABORATORIO' && cleanNum.length === 1 && parseInt(cleanNum, 10) >= 1 && parseInt(cleanNum, 10) <= 5) {
        const labOptions = ['hemograma', 'glicemia', 'perfil lipidico', 'creatinina', 'urocultivo'];
        queryText = labOptions[parseInt(cleanNum, 10) - 1];
      }

      const isLabFlow =
        data.searchCategory === 'LABORATORIO' ||
        lower.includes('hemograma') ||
        lower.includes('glicemia') ||
        lower.includes('glucosa') ||
        lower.includes('laboratorio') ||
        lower.includes('urocultivo') ||
        lower.includes('perfil lipidico');

      // Si es flujo de laboratorio o busca un examen de laboratorio:
      const labMatch = await TarifasService.findLabProcedure(queryText);
      if (labMatch && isLabFlow) {
        return {
          replyMessages: [
            `El procedimiento consultado es ${labMatch.displayName}\n\n1. Sí\n2. No (Corregir)`,
          ],
          interactivePayload: {
            type: 'button',
            options: [
              { id: '1', title: '1. Sí' },
              { id: '2', title: '2. No (Corregir)' },
            ],
          },
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'CONFIRM_LAB_PROCEDURE',
          updatedData: {
            ...data,
            pendingLabTariff: labMatch.tariff,
            pendingLabName: labMatch.displayName,
            fallbackCount: 0,
          },
        };
      }

      const searchResult = await PreparacionesService.findForPatient(text);

      if (searchResult.matchType === 'EXACT') {
        const proc = searchResult.procedures[0];
        const instructionText = await PreparacionesService.formatPatientInstructions(proc);

        return {
          replyMessages: [
            instructionText,
            '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'AFTER_INSTRUCTION',
          updatedData: { ...data, lastProcedureId: proc.packageId, fallbackCount: 0 },
        };
      }

      if (searchResult.matchType === 'MULTIPLE') {
        const procs = searchResult.procedures;
        const optionsList = procs
          .map((p, i) => `${i + 1}️⃣ *${p.name}*\n   _Servicio: ${p.area}_${p.mainCups ? ` · CUPS: ${p.mainCups}` : ''}`)
          .join('\n\n');

        return {
          replyMessages: [
            `Encontramos varios estudios relacionados con tu consulta:\n\n${optionsList}\n\nPor favor responde con el *número* del procedimiento que deseas consultar (o escribe otro nombre para buscar de nuevo):`,
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'SELECT_PROCEDURE_FROM_LIST',
          updatedData: {
            ...data,
            matchingProcedures: procs.map((p) => ({
              packageId: p.packageId,
              name: p.name,
              area: p.area,
              mainCups: p.mainCups,
            })),
            fallbackCount: 0,
          },
        };
      }

      // Si no se encontró en preparaciones, buscar en el catálogo oficial de tarifas CUPS (laboratorios, consultas, terapias, imágenes)
      const userTypeParam = data.userTypeCode || data.userType;
      const tariffResult = await TarifasService.findForPatient(text);
      if (tariffResult.matchType === 'EXACT') {
        const tariff = tariffResult.tariffs[0];
        const tariffMsg = TarifasService.formatPatientTariffMessage(tariff, userTypeParam);
        return {
          replyMessages: [
            tariffMsg,
            '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'AFTER_INSTRUCTION',
          updatedData: { ...data, fallbackCount: 0 },
        };
      }

      if (tariffResult.matchType === 'MULTIPLE') {
        const tfs = tariffResult.tariffs;
        const optionsList = tfs
          .map((t, i) => {
            const displayFee = userTypeParam === 'EGRESADO_UNAL' && t.egresadosFee
              ? t.egresadosFee
              : userTypeParam === 'COLABORADOR_HUN' && t.hun2024Fee
              ? t.hun2024Fee
              : t.particularFee;
            return `${i + 1}️⃣ *${t.description}*\n   _Categoría: ${t.categoryLabel} · CUPS: ${t.cups}_\n   💵 *Tarifa:* $${Number(displayFee).toLocaleString('es-CO')}`;
          })
          .join('\n\n');

        return {
          replyMessages: [
            `Encontramos las siguientes tarifas oficiales para tu consulta:\n\n${optionsList}\n\nPor favor responde con el *número* del estudio para ver el detalle de la tarifa (o escribe otro examen):`,
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'SELECT_TARIFF_FROM_LIST',
          updatedData: {
            ...data,
            matchingTariffs: tfs.map((t) => ({ id: t.id, cups: t.cups, description: t.description })),
            fallbackCount: 0,
          },
        };
      }

      // No se encontró coincidencia directa ni en preparaciones ni en tarifas
      return {
        replyMessages: [
          `No encontramos un estudio o preparación registrada con "${text}".`,
          'Por favor verifica el nombre indicado en tu orden médica (por ejemplo: "ecografía", "hemograma", "resonancia", "biopsia") o escribe el código CUPS numérico.\n\n(O escribe "menu" para volver al inicio)',
        ],
        nextFlow: 'PREPARACIONES_INFO',
        nextStep: 'INPUT_PROCEDURE',
        updatedData: { ...data, fallbackCount: (data.fallbackCount || 0) + 1 },
      };
    }

    // Paso 2B: Selección de lista de tarifas CUPS
    if (step === 'SELECT_TARIFF_FROM_LIST') {
      const list = (data.matchingTariffs || []) as Array<{ id: string; cups: string; description: string }>;
      const selectedIndex = parseInt(cleanNum, 10) - 1;
      const userTypeParam = data.userTypeCode || data.userType;

      if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < list.length) {
        const chosen = list[selectedIndex];
        const tariff = await TarifasService.getById(chosen.id);

        if (tariff) {
          const tariffMsg = TarifasService.formatPatientTariffMessage(tariff, userTypeParam);
          return {
            replyMessages: [
              tariffMsg,
              '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
            ],
            nextFlow: 'PREPARACIONES_INFO',
            nextStep: 'AFTER_INSTRUCTION',
            updatedData: { ...data, matchingTariffs: undefined, fallbackCount: 0 },
          };
        }
      }

      // Reintentar búsqueda en tarifas
      const retryTariff = await TarifasService.findForPatient(text);
      if (retryTariff.matchType === 'EXACT') {
        const tariffMsg = TarifasService.formatPatientTariffMessage(retryTariff.tariffs[0], userTypeParam);
        return {
          replyMessages: [
            tariffMsg,
            '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'AFTER_INSTRUCTION',
          updatedData: { ...data, matchingTariffs: undefined, fallbackCount: 0 },
        };
      }

      return {
        replyMessages: [
          `Opción no válida. Por favor responde con un número del 1 al ${list.length}, o escribe el nombre o CUPS que deseas consultar:`,
        ],
        nextFlow: 'PREPARACIONES_INFO',
        nextStep: 'SELECT_TARIFF_FROM_LIST',
        updatedData: data,
      };
    }

    // Paso 2: Selección de la lista de coincidencias
    if (step === 'SELECT_PROCEDURE_FROM_LIST') {
      const list = (data.matchingProcedures || []) as Array<{ packageId: string; name: string }>;
      const selectedIndex = parseInt(cleanNum, 10) - 1;

      if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < list.length) {
        const chosen = list[selectedIndex];
        const fullProcedure = await PreparacionesService.getByPackageId(chosen.packageId);

        if (fullProcedure) {
          const instructionText = await PreparacionesService.formatPatientInstructions(fullProcedure);
          return {
            replyMessages: [
              instructionText,
              '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
            ],
            nextFlow: 'PREPARACIONES_INFO',
            nextStep: 'AFTER_INSTRUCTION',
            updatedData: { ...data, lastProcedureId: chosen.packageId, matchingProcedures: undefined, fallbackCount: 0 },
          };
        }
      }

      // Si no digitó un número válido, tratar el texto como una nueva búsqueda
      const retrySearch = await PreparacionesService.findForPatient(text);
      if (retrySearch.matchType === 'EXACT') {
        const proc = retrySearch.procedures[0];
        const instructionText = await PreparacionesService.formatPatientInstructions(proc);
        return {
          replyMessages: [
            instructionText,
            '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'AFTER_INSTRUCTION',
          updatedData: { ...data, lastProcedureId: proc.packageId, matchingProcedures: undefined, fallbackCount: 0 },
        };
      }

      if (retrySearch.matchType === 'MULTIPLE') {
        const procs = retrySearch.procedures;
        const optionsList = procs
          .map((p, i) => `${i + 1}️⃣ *${p.name}*\n   _Servicio: ${p.area}_${p.mainCups ? ` · CUPS: ${p.mainCups}` : ''}`)
          .join('\n\n');

        return {
          replyMessages: [
            `Encontramos estos estudios con tu nueva búsqueda:\n\n${optionsList}\n\nPor favor responde con el número de tu examen:`,
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'SELECT_PROCEDURE_FROM_LIST',
          updatedData: {
            ...data,
            matchingProcedures: procs.map((p) => ({
              packageId: p.packageId,
              name: p.name,
              area: p.area,
              mainCups: p.mainCups,
            })),
            fallbackCount: 0,
          },
        };
      }

      return {
        replyMessages: [
          `Opción no válida. Por favor responde con un número del 1 al ${list.length}, o escribe el nombre del estudio que deseas consultar (o escribe "menu" para salir):`,
        ],
        nextFlow: 'PREPARACIONES_INFO',
        nextStep: 'SELECT_PROCEDURE_FROM_LIST',
        updatedData: data,
      };
    }

    // Paso 3: Opciones posteriores a ver la preparación
    if (step === 'AFTER_INSTRUCTION') {
      if (cleanNum === '1' || lower.includes('otro') || lower.includes('consultar') || lower.includes('examen')) {
        return {
          replyMessages: [
            'Escribe el nombre del otro examen o procedimiento que deseas consultar (o su código CUPS):',
          ],
          nextFlow: 'PREPARACIONES_INFO',
          nextStep: 'INPUT_PROCEDURE',
          updatedData: { ...data, fallbackCount: 0 },
        };
      }

      if (cleanNum === '2' || lower.includes('menu') || lower.includes('inicio') || lower.includes('terminar')) {
        return this.getRootMenu(patientName);
      }

      // Si el paciente escribe directamente otro nombre de examen aquí:
      const directSearch = await PreparacionesService.findForPatient(text);
      if (directSearch.matchType === 'EXACT' || directSearch.matchType === 'MULTIPLE') {
        return this.handlePreparacionesInfo(text, lower, 'INPUT_PROCEDURE', data, patientName);
      }

      return {
        replyMessages: [
          '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
        ],
        nextFlow: 'PREPARACIONES_INFO',
        nextStep: 'AFTER_INSTRUCTION',
        updatedData: data,
      };
    }

    return this.getRootMenu(patientName);
  }

  private static isEnglish(text: string): boolean {
    const englishWords = ['hello', 'hi', 'appointment', 'doctor', 'help', 'hospital', 'surgery', 'good morning', 'good afternoon'];
    return englishWords.some((w) => text.includes(w));
  }

  /**
   * Obtiene el mensaje o pregunta pendiente para reanudar el flujo tras inactividad
   */
  public static getStepPrompt(
    flow: ConversationFlow,
    step: string,
    data: FlowStateData,
    patientName?: string
  ): string[] {
    switch (step) {
      case 'SELECT_USER_TYPE':
        return [
          'Indícanos por favor quién realizará la solicitud:\n\n1️⃣ Paciente Particular\n2️⃣ Egresado Universidad Nacional de Colombia\n3️⃣ Colaborador HUN\n4️⃣ Otro (Contactar con un asesor)',
        ];

      case 'AUTH_DOC_TYPE':
        return [
          'Por favor selecciona tu tipo de documento de identidad:\n\n1️⃣ Cédula de Ciudadanía (CC)\n2️⃣ Tarjeta de Identidad (TI)\n3️⃣ Cédula de Extranjería (CE)\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil',
        ];

      case 'AUTH_DOC_NUMBER':
        return [
          'Por favor digita tu número de documento de identidad (sin puntos, comas ni espacios):',
        ];

      case 'REGISTER_NEW_NAME':
        return [
          'Por favor indícanos tu Nombre Completo para registrarte en el sistema:',
        ];

      case 'BIRTH_DATE':
        return ['Por favor digita tu fecha de nacimiento (Ejemplo: 01-01-1990):'];

      case 'BIRTH_DATE_CONFIRM':
        return [`La fecha de nacimiento ${data.patientBirthDate || ''}, ¿es correcta?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`];

      case 'PATIENT_PHONE':
        return ['Por favor digita tu número de Teléfono/Celular (sin puntos, comas ni espacios. Ejemplo: 3101234567):'];

      case 'PATIENT_PHONE_CONFIRM':
        return [`El número telefónico ${data.patientPhone || ''}, ¿es correcto?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`];

      case 'PATIENT_EMAIL':
        return ['Por favor digita tu dirección de correo electrónico (Ejemplo: paciente@gmail.com):'];

      case 'PATIENT_EMAIL_CONFIRM':
        return [`El correo ${data.patientEmail || ''}, ¿es correcto?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`];

      case 'RESIDENCE_CITY':
        return ['Por favor digita tu Ciudad de Residencia (Ejemplo: Bogotá):'];

      case 'RESIDENCE_ADDRESS':
        return ['Por favor digita tu dirección de residencia (Ejemplo: Calle 123 # 45-67 Sur):'];

      case 'RESIDENCE_ADDRESS_CONFIRM':
        return [`La dirección de residencia ${data.residenceAddress || ''}, ¿es correcta?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`];

      case 'VERIFY_USER_DATA':
        return [
          '¿Los datos registrados son correctos?\n\n1️⃣ Sí\n2️⃣ No (Corregir)',
        ];

      case 'SELECT_FIELD_TO_EDIT':
        return [
          'Indícanos por favor qué dato deseas corregir:\n\n1️⃣ Número de Documento\n2️⃣ Tipo de Documento\n3️⃣ Nombre Completo\n4️⃣ Teléfono / Celular\n5️⃣ Correo Electrónico\n6️⃣ Ciudad de Residencia\n7️⃣ Dirección de Residencia',
        ];

      case 'INPUT_EDIT_VALUE':
        return [
          `Por favor ingresa el nuevo valor para tu ${data.editingLabel || 'dato'}:`,
        ];

      case 'CONFIRM_SINGLE_CORRECTION':
        return [
          `Acabas de actualizar tu ${data.lastEditedLabel || 'dato'} a ${data.lastEditedValue || ''}.\n\n¿Es correcto?\n\n1️⃣ Sí\n2️⃣ No (Corregir)`,
        ];

      case 'ASK_ANOTHER_CORRECTION':
        return [
          '¿Deseas corregir algún otro dato?\n\n1️⃣ Sí\n2️⃣ No',
        ];

      case 'INPUT_PROCEDURE':
        return [
          'Por favor escribe el nombre del examen o procedimiento que deseas consultar (o su código CUPS):',
        ];

      case 'SELECT_PROCEDURE_FROM_LIST':
        return [
          'Por favor selecciona el número del examen que deseas consultar de la lista anterior:',
        ];

      case 'AFTER_INSTRUCTION':
        return [
          '¿Deseas consultar otro estudio o volver al menú principal?\n\n1️⃣ Consultar otro examen o laboratorio\n2️⃣ Ir al menú principal',
        ];

      case 'F01_SPECIALTY':
        return [this.getSpecialtiesMenuPrompt()];

      case 'F01_VISIT_TYPE':
        return [
          `Continuamos con tu cita de ${data.specialty || 'especialidad'}.\n¿Es tu primera consulta en esta especialidad en el HUN o vienes de control?\n\n1️⃣ Primera vez (1ª vez)\n2️⃣ Cita de control`,
        ];

      case 'F01_PATIENT_NAME':
        return ['¿Cuál es tu nombre completo?'];

      case 'F01_PATIENT_DOC':
        return [
          '¿Cuál es tu número de documento de identidad (Cédula de Ciudadanía / Extranjería / TI)?\n\n(Lo solicitamos para consultar tu historia clínica en el HUN y vincular la cita)',
        ];

      case 'F01_SELECT_DOCTOR': {
        const docs: Array<{ name: string }> = data.availableSpecialtyDoctors || [];
        const docLines = docs.map((d, idx) => `${idx + 2}️⃣ 👨‍⚕️ ${d.name}`).join('\n');
        const customOpt = docs.length + 2;
        return [
          `👨‍⚕️ *Preferencia de Médico Especialista (${data.specialty || 'Consulta Externa'})*\n\n` +
            `¿Deseas agendar o continuar tu tratamiento con algún médico especialista en particular?\n\n` +
            `1️⃣ ⚡ Cualquier especialista disponible (Cupo más próximo)\n` +
            (docLines ? `${docLines}\n` : '') +
            `${customOpt}️⃣ 🔎 Escribir el nombre de otro médico especialista\n\n` +
            `Por favor responde con el número de tu elección:`,
        ];
      }

      case 'F01_INPUT_CUSTOM_DOCTOR':
        return [
          `🔎 Por favor escribe el *nombre y apellido del médico especialista* de *${data.specialty || 'la especialidad'}* con quien deseas agendar o continuar tu tratamiento (Ej: *Dr. Carlos Mendoza*):`,
        ];

      case 'F01_DOCTOR_NOT_FOUND':
        return [
          `¿Cómo prefieres continuar para tu cita de *${data.specialty || 'Consulta Externa'}*?\n\n` +
            `1️⃣ 📋 Ingresar a lista de espera prioritaria con *${data.preferredDoctor || 'el especialista solicitado'}*\n` +
            `2️⃣ 👨‍⚕️ Ver horarios disponibles con otros especialistas de *${data.specialty || 'la especialidad'}*\n` +
            `3️⃣ 💬 Contactar con un asesor de agendamiento`,
        ];

      case 'F01_SELECT_SLOT': {
        const specialtyKey = Object.keys(HUN_SPECIALTIES).find(
          (k) => HUN_SPECIALTIES[k].name === data.specialty
        );
        const specConfig = specialtyKey ? HUN_SPECIALTIES[specialtyKey] : Object.values(HUN_SPECIALTIES)[0];
        const slotOptions = specConfig.slots
          .map((s, idx) => `${idx + 1}️⃣ ${s.dateTime} con ${s.doctorName}`)
          .join('\n');
        return [
          `Horarios disponibles para ${data.specialty}:\n\n${slotOptions}\n\n¿Cuál te queda mejor? (Responde 1, 2 o 3):`,
        ];
      }

      case 'F01_PAYMENT_METHOD':
        return [
          '¿Cómo prefieres gestionar el pago de tu cita?\n1️⃣ Pago virtual inmediato (PSE / Tarjeta)\n2️⃣ Pago en ventanilla el día de la cita\n3️⃣ Confirmar cita ahora',
        ];

      case 'F02_PROCEDURE_DESC':
        return ['¿Qué procedimiento quirúrgico deseas cotizar?'];

      case 'F02_HAS_ORDER':
        return [
          '¿Ya tienes orden médica emitida por un especialista para esta cirugía?\n\n1️⃣ Sí, ya tengo orden médica\n2️⃣ No tengo orden médica aún',
        ];

      case 'F02_EPS_ACTIVE':
        return [
          '¿Cuentas con EPS activa actualmente?\n\n1️⃣ Sí, tengo EPS activa\n2️⃣ No tengo EPS activa / Totalmente particular',
        ];

      case 'F03_CODE_OR_NAME':
        return [
          '¿El médico que te refirió te compartió un código de referencia o el nombre del especialista?\n\n1️⃣ Tengo un código de referencia\n2️⃣ Tengo el nombre del especialista\n3️⃣ No tengo código ni nombre',
        ];

      case 'F03_SELECT_PRIORITY_SLOT': {
        const options = PRIORITY_REFERRAL_SLOTS.map(
          (s, idx) => `${idx + 1}️⃣ ${s.dateTime} (${s.doctorName})`
        ).join('\n');
        return [
          `Selecciona tu horario prioritario de cita referida:\n\n${options}\n\n(Responde 1, 2 o 3):`,
        ];
      }

      case 'RESCHEDULE_REASON':
        return [
          '¿Cuál es el motivo por el que deseas reprogramar tu cita médica?\n\n1️⃣ Conflictos de tiempo y trabajo\n2️⃣ Problemas de movilidad o transporte\n3️⃣ Estado de salud actual\n4️⃣ Motivos económicos o administrativos\n5️⃣ Otro motivo\n\n(Por favor responde con el número de tu opción)',
        ];

      case 'RESCHEDULE_CUSTOM_REASON':
        return [
          'Por favor indícanos brevemente el motivo por el que deseas reprogramar tu cita médica:',
        ];

      case 'CONFIRM_RESCHEDULE':
        return [
          '¿Estás seguro de reprogramar tu cita médica?\n\n1️⃣ Sí\n2️⃣ No',
        ];

      case 'OFFER_RESCHEDULE':
        return [
          '¿Qué prefieres hacer con tu cita médica?\n\n1️⃣ 🔄 Reprogramar mi cita en otra fecha/horario (Recomendado)\n2️⃣ ✅ Conservar mi cita actual\n3️⃣ ❌ Continuar con la cancelación de la cita',
        ];

      case 'CONFIRM_CANCEL':
        return [
          '⚠️ ¿Estás completamente seguro de cancelar definitivamente tu cita médica?\n\n1️⃣ 🔄 Prefiero reprogramar mi cita para otra fecha\n2️⃣ ❌ Sí, cancelar definitivamente mi cita',
        ];

      case 'CANCEL_REASON':
        return [
          '¿Cuál es el motivo por el que deseas cancelar tu cita médica?\n\n1️⃣ Conflictos de tiempo y trabajo\n2️⃣ Problemas de movilidad o transporte\n3️⃣ Estado de salud actual\n4️⃣ Motivos económicos o administrativos\n5️⃣ Otro motivo\n\n(Por favor responde con el número de tu opción)',
        ];

      case 'CANCEL_CUSTOM_REASON':
        return [
          'Por favor indícanos brevemente el motivo de la cancelación:',
        ];

      case 'SCHEDULE_MENU':
        return [
          '¿En qué podemos ayudarte para tu agendamiento en el Hospital Universitario Nacional?\n\n1️⃣ Consulta médica ambulatoria (Cita con especialista)\n2️⃣ Cotización de procedimiento quirúrgico\n3️⃣ Cita referida por médico especialista (Modelo A / B)\n4️⃣ Volver al menú principal\n\n(Por favor responde con el número de tu opción)',
        ];

      case 'POST_CONFIRMATION_OPTIONS':
        return [
          '¿Qué deseas hacer a continuación?\n\n1️⃣ Ir al menú principal\n2️⃣ Terminar conversación\n\nPor favor responde con el número de tu opción (1 o 2):',
        ];

      case 'REQUEST_FOR_SELF':
        return [
          `${patientName || 'Paciente'}, ¿la cita médica es para ti o es para alguien más?\n\n1️⃣ Sí, es para mí\n2️⃣ No, es para alguien más\n\n(Puedes responder con el número 1 o 2)`,
        ];

      case 'PATIENT_OTHER_DOC_TYPE':
        return [
          'Por favor selecciona el tipo de documento del paciente que recibirá la atención médica:\n\n1️⃣ Cédula de Ciudadanía\n2️⃣ Tarjeta de Identidad\n3️⃣ Cédula de Extranjería\n4️⃣ Permiso por Protección Temporal (PPT)\n5️⃣ Pasaporte\n6️⃣ Registro Civil',
        ];

      case 'PATIENT_OTHER_DOC_NUMBER':
        return [
          'Por favor digita el número de documento de identidad del paciente (sin puntos, comas ni espacios):',
        ];

      case 'PATIENT_OTHER_NAME':
        return [
          'Por favor escribe el Nombre Completo del paciente que recibirá la atención médica:',
        ];

      case 'PATIENT_OTHER_PHONE':
        return [
          'Por favor indícanos un número de Teléfono / Celular de contacto para el paciente:',
        ];

      case 'PATIENT_OTHER_EMAIL':
        return [
          'Por favor ingresa el correo electrónico del paciente (o escribe "no" si no tiene):',
        ];

      case 'PATIENT_OTHER_CITY':
        return [
          'Por favor indícanos la Ciudad de Residencia del paciente (Ejemplo: Bogotá):',
        ];

      case 'VERIFY_PATIENT_DATA':
        return [
          '¿Los datos registrados del paciente son correctos?\n\n1️⃣ Sí\n2️⃣ No (Corregir)',
        ];

      case 'SELECT_PATIENT_FIELD_TO_EDIT':
        return [
          'Indícanos por favor qué dato del paciente deseas corregir respondiendo con un número del 1 al 7:\n\n1️⃣ Número de Documento\n2️⃣ Tipo de Documento\n3️⃣ Nombre Completo\n4️⃣ Teléfono / Celular\n5️⃣ Correo Electrónico\n6️⃣ Ciudad de Residencia\n7️⃣ Dirección de Residencia',
        ];

      case 'CONFIRM_SINGLE_PATIENT_CORRECTION':
        return [
          'Por favor responde si la actualización realizada es correcta:\n\n1️⃣ Sí\n2️⃣ No (Corregir)',
        ];

      case 'ASK_ANOTHER_PATIENT_CORRECTION':
        return [
          '¿Deseas corregir algún otro dato del paciente?\n\n1️⃣ Sí\n2️⃣ No',
        ];

      default:
        return this.getRootMenu(patientName).replyMessages;
    }
  }
}
