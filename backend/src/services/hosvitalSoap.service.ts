import axios from 'axios';
import { CONFIG } from '../config';

export interface HosvitalSoapAsicimePayload {
  empresa?: string;
  sede?: string;
  documento: string;
  tipoDocumento: string; // CC, TI, CE, PA, PPT
  codigoMedico: string;
  especialidad: number | string;
  consultorio: number | string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:mm:ss
  procedimiento: string; // CUPS
  eps?: string; // HUN25, HUN22
  tiempoAtencion?: number;
  usuario?: string;
}

export interface HosvitalSoapAsignarPayload {
  empresa?: string;
  sede?: string;
  consultorio: number | string;
  procedimiento: string; // Código CUPS (ej: 890202)
  fechaCita: string; // YYYY-MM-DD
  fechaHoraDisponible: string; // YYYY-MM-DDTHH:mm:ss
  usuario?: string;
  contrasena?: string;
}

export interface HosvitalSoapCancelarPayload {
  empresa?: string;
  sede?: string;
  cita: number;
  tipoDocumento: string; // CC, TI, CE, PA, PPT
  documento: string;
  motivoCancelacion?: string; // 1 caracter (ej: '1')
  consecutivoCancelacion?: string;
  usuario?: string;
  contrasena?: string;
}

export interface HosvitalSoapResponse {
  success: boolean;
  codigo?: number;
  respuesta?: string;
  rawXml?: string;
  error?: string;
}

/**
 * Servicio SOAP Nativo para Hosvital DigitalWare
 * Basado en las especificaciones oficiales:
 * 1. WSAsicitcon (Asignación Citas X Consultorio - Modo: ASI)
 * 2. WSCancita (Cancelación de Citas - Modo: UPD)
 */
export class HosvitalSoapService {
  private static readonly ASICIME_URL = `${CONFIG.HOSVITAL_SOAP_BASE_URL}${CONFIG.HOSVITAL_SOAP_ASICIME_PATH}`;
  private static readonly ASICITCON_URL = `${CONFIG.HOSVITAL_SOAP_BASE_URL}${CONFIG.HOSVITAL_SOAP_ASICITCON_PATH}`;
  private static readonly CANCITA_URL = `${CONFIG.HOSVITAL_SOAP_BASE_URL}${CONFIG.HOSVITAL_SOAP_CANCITA_PATH}`;

  /**
   * Códigos de respuesta oficiales de WSASICITCON (DigitalWare)
   */
  private static readonly ASICITCON_CODES: Record<number, string> = {
    0: 'Proceso Exitoso.',
    1037: 'No Existe Consultorio Para Asignar Citas Web',
    1038: 'No Existe Procedimiento',
    1039: 'La Fecha De Solicitud De La Cita No Puede Ser Nula',
    1040: 'Para La Fecha No Hay Agenda En El Consultorio',
    1041: 'Debe seleccionar Modo Correcto (ASI/CON)',
  };

  /**
   * Códigos de respuesta oficiales de WSCANCITA (DigitalWare)
   */
  private static readonly CANCITA_CODES: Record<number, string> = {
    0: 'Exitoso',
    9: 'El Documento Es Nulo',
    10: 'El Tipo De Documento Es Nulo',
    12: 'Cita viene vacía',
    100: 'No Existe MaeDir',
    101: 'No concuerda Usuario o contraseña de ejecución WS en MaeDir',
    102: 'El Modo no es el correcto',
    103: 'Empresa Nula o no válida',
    104: 'Sede Nula',
    105: 'Sede no valida',
    106: 'Sede no corresponde a la empresa',
  };

  /**
   * Método asignarCita (WSASICITCON) - Modo: ASI
   */
  /**
   * Método Maestro WSASICIME.ASIGNAR_CITA (Asignación Directa de Cita con Paciente en Hosvital)
   */
  public static async asignarCitaAsicime(params: HosvitalSoapAsicimePayload): Promise<HosvitalSoapResponse> {
    const empresa = params.empresa || CONFIG.HOSVITAL_EMPRESA || '1';
    const sede = params.sede || CONFIG.HOSVITAL_SEDE || '001';
    const documento = String(params.documento || '').replace(/\D/g, '');
    const tipoDocumento = (params.tipoDocumento || 'CC').trim().toUpperCase();
    const codigoMedico = (params.codigoMedico || 'ME445').trim();
    const especialidad = String(params.especialidad || '21').trim();
    const consultorio = String(params.consultorio || '200').trim();
    const fecha = params.fecha;
    const hora = params.hora.includes(':') ? (params.hora.length === 5 ? `${params.hora}:00` : params.hora) : '08:00:00';
    const procedimiento = (params.procedimiento || '890202').trim();
    const usuario = params.usuario || CONFIG.HOSVITAL_MAEDIR_USER || 'Hosvital';
    const eps = params.eps || CONFIG.HUN_DEFAULT_EPS || 'HUN22';
    const tiempoAtencion = params.tiempoAtencion || 20;

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hos="Hosvital">
   <soapenv:Header/>
   <soapenv:Body>
      <hos:WSASICIME.ASIGNAR_CITA>
         <hos:To_asicime_con>
            <hos:TO_ASICIME_CON.TO_ASICIME_CONIt>
               <hos:EMPCOD>${empresa}</hos:EMPCOD>
               <hos:MCDPTO>${sede}</hos:MCDPTO>
               <hos:MPCEDU>${documento}</hos:MPCEDU>
               <hos:MPTDOC>${tipoDocumento}</hos:MPTDOC>
               <hos:MMCODM>${codigoMedico}</hos:MMCODM>
               <hos:MECODE>${especialidad}</hos:MECODE>
               <hos:CONSCOD>${consultorio}</hos:CONSCOD>
               <hos:FECHA>${fecha}</hos:FECHA>
               <hos:HORA>${hora}</hos:HORA>
               <hos:CITPRO>${procedimiento}</hos:CITPRO>
               <hos:CITTIPORI>HC</hos:CITTIPORI>
               <hos:PPPTIPACT>I</hos:PPPTIPACT>
               <hos:CITNUM></hos:CITNUM>
               <hos:INDPRPAN></hos:INDPRPAN>
               <hos:MSUser>${usuario}</hos:MSUser>
               <hos:MENNIT>${eps}</hos:MENNIT>
               <hos:MMTieAte>${tiempoAtencion}</hos:MMTieAte>
            </hos:TO_ASICIME_CON.TO_ASICIME_CONIt>
         </hos:To_asicime_con>
      </hos:WSASICIME.ASIGNAR_CITA>
   </soapenv:Body>
</soapenv:Envelope>`;

    console.log(`\n======================================================`);
    console.log(`📡 [HosvitalSoap] ENVIANDO ASIGNACIÓN DE CITA MAESTRA (WSASICIME)`);
    console.log(`📍 URL: ${this.ASICIME_URL}`);
    console.log(`🏷️ SoapAction: Hosvitalaction/AWSASICIME.ASIGNAR_CITA`);
    console.log(`📄 XML Enviado:\n${xmlPayload}`);
    console.log(`======================================================`);

    try {
      const response = await axios.post(this.ASICIME_URL, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'Hosvitalaction/AWSASICIME.ASIGNAR_CITA',
        },
        timeout: CONFIG.HUN_API_TIMEOUT_MS || 8000,
      });

      console.log(`📥 [HosvitalSoap] Respuesta HTTP ${response.status} de WSASICIME:`);
      console.log(response.data);

      return this.parseAsicitconResponse(response.data);
    } catch (error: any) {
      console.error(`❌ [HosvitalSoap] Error en llamada SOAP WSASICIME:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawXml: error.response?.data,
      };
    }
  }

  public static async asignarCita(params: HosvitalSoapAsignarPayload): Promise<HosvitalSoapResponse> {
    const empresa = params.empresa || CONFIG.HOSVITAL_EMPRESA || '1';
    const sede = params.sede || CONFIG.HOSVITAL_SEDE || '001';
    const consultorio = String(params.consultorio || '200').trim();
    const procedimiento = (params.procedimiento || '890202').trim();
    const fechaCita = params.fechaCita;
    const fechaHora = params.fechaHoraDisponible.includes('T')
      ? params.fechaHoraDisponible
      : `${params.fechaCita}T${params.fechaHoraDisponible}`;
    const usuario = params.usuario || CONFIG.HOSVITAL_MAEDIR_USER || '';
    const contrasena = params.contrasena || CONFIG.HOSVITAL_MAEDIR_PASSWORD || '';

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:hos="Hosvital">
  <soapenv:Header/>
  <soapenv:Body>
    <hos:WSASICITCON.ASIGNARCITA>
      <hos:To_asicitcon>
        <hos:EMPRESA>${empresa}</hos:EMPRESA>
        <hos:SEDE>${sede}</hos:SEDE>
        <hos:CONSULTORIO>${consultorio}</hos:CONSULTORIO>
        <hos:PROCEDIMIENTO>${procedimiento}</hos:PROCEDIMIENTO>
        <hos:FECHA_CITA>${fechaCita}</hos:FECHA_CITA>
        <hos:It>
          <hos:It>
            <hos:FECHA_HORA_DISPONIBLE>${fechaHora}</hos:FECHA_HORA_DISPONIBLE>
          </hos:It>
        </hos:It>
      </hos:To_asicitcon>
      <hos:To_creaut>
        <hos:USUARIO>${usuario}</hos:USUARIO>
        <hos:CONTRASENA>${contrasena}</hos:CONTRASENA>
      </hos:To_creaut>
      <hos:To_respuesta>
        <hos:CODIGO>0</hos:CODIGO>
        <hos:RESPUESTA></hos:RESPUESTA>
      </hos:To_respuesta>
      <hos:Modo>ASI</hos:Modo>
    </hos:WSASICITCON.ASIGNARCITA>
  </soapenv:Body>
</soapenv:Envelope>`;

    console.log(`\n======================================================`);
    console.log(`📡 [HosvitalSoap] ENVIANDO ASIGNACIÓN DE CITA SOAP (WSASICITCON)`);
    console.log(`📍 URL: ${this.ASICITCON_URL}`);
    console.log(`🏷️ SoapAction: Hosvitalaction/AWSASICITCON.ASIGNARCITA`);
    console.log(`📄 XML Enviado:\n${xmlPayload}`);
    console.log(`======================================================`);

    try {
      const response = await axios.post(this.ASICITCON_URL, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'Hosvitalaction/AWSASICITCON.ASIGNARCITA',
        },
        timeout: CONFIG.HUN_API_TIMEOUT_MS || 8000,
      });

      console.log(`📥 [HosvitalSoap] Respuesta HTTP ${response.status} recibida:`);
      console.log(response.data);

      return this.parseAsicitconResponse(response.data);
    } catch (error: any) {
      console.error(`❌ [HosvitalSoap] Error en llamada SOAP asignarCita:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawXml: error.response?.data,
      };
    }
  }

  /**
   * Método CANCELARCITA (WSCancita) - Modo: UPD
   */
  public static async cancelarCita(params: HosvitalSoapCancelarPayload): Promise<HosvitalSoapResponse> {
    const empresa = params.empresa || CONFIG.HOSVITAL_EMPRESA || '1';
    const sede = params.sede || CONFIG.HOSVITAL_SEDE || '001';
    const cita = params.cita;
    const tipoDocumento = (params.tipoDocumento || 'CC').trim().toUpperCase();
    const documento = String(params.documento || '').replace(/\D/g, '');
    const motivoCancelacion = (params.motivoCancelacion || '1').trim().substring(0, 1);
    const consecutivo = params.consecutivoCancelacion || '';
    const usuario = params.usuario || CONFIG.HOSVITAL_MAEDIR_USER || '';
    const contrasena = params.contrasena || CONFIG.HOSVITAL_MAEDIR_PASSWORD || '';

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<s11:Envelope xmlns:s11="http://schemas.xmlsoap.org/soap/envelope/">
  <s11:Body>
    <ns1:WSCanCita.CANCELARCITA xmlns:ns1="HosVitalHIS">
      <ns1:To_cancit xmlns:ns1="Hosvital">
        <ns1:EMPRESA>${empresa}</ns1:EMPRESA>
        <ns1:SEDE>${sede}</ns1:SEDE>
        <ns1:CITA>${cita}</ns1:CITA>
        <ns1:TIPODOCUMENTO>${tipoDocumento}</ns1:TIPODOCUMENTO>
        <ns1:DOCUMENTO>${documento}</ns1:DOCUMENTO>
        <ns1:MOTIVOCANCELACION>${motivoCancelacion}</ns1:MOTIVOCANCELACION>
        <ns1:CONSECUTIVOCANCELACION>${consecutivo}</ns1:CONSECUTIVOCANCELACION>
      </ns1:To_cancit>
      <ns1:To_creaut xmlns:ns1="Hosvital">
        <ns1:EMPCOD>${empresa}</ns1:EMPCOD>
        <ns1:MCDPTO>${sede}</ns1:MCDPTO>
        <ns1:USUARIO>${usuario}</ns1:USUARIO>
        <ns1:CONTRASENA>${contrasena}</ns1:CONTRASENA>
      </ns1:To_creaut>
      <ns1:Modo>UPD</ns1:Modo>
    </ns1:WSCanCita.CANCELARCITA>
  </s11:Body>
</s11:Envelope>`;

    console.log(`\n======================================================`);
    console.log(`📡 [HosvitalSoap] ENVIANDO CANCELACIÓN DE CITA SOAP (WSCANCITA)`);
    console.log(`📍 URL: ${this.CANCITA_URL}`);
    console.log(`🏷️ SoapAction: HosVitalHISaction/AWSCANCITA.CANCELARCITA`);
    console.log(`📄 XML Enviado:\n${xmlPayload}`);
    console.log(`======================================================`);

    try {
      const response = await axios.post(this.CANCITA_URL, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'HosVitalHISaction/AWSCANCITA.CANCELARCITA',
        },
        timeout: CONFIG.HUN_API_TIMEOUT_MS || 8000,
      });

      console.log(`📥 [HosvitalSoap] Respuesta HTTP ${response.status} recibida:`);
      console.log(response.data);

      return this.parseCancitaResponse(response.data);
    } catch (error: any) {
      console.error(`❌ [HosvitalSoap] Error en llamada SOAP cancelarCita:`, error.response?.data || error.message);
      return {
        success: false,
        error: error.message,
        rawXml: error.response?.data,
      };
    }
  }

  /**
   * Parser XML para WSASICITCON (To_respuesta -> CODIGO, RESPUESTA)
   */
  private static parseAsicitconResponse(xml: string): HosvitalSoapResponse {
    const codeMatch = xml.match(/<CODIGO[^>]*>(\d+)<\/CODIGO>/i);
    const respMatch = xml.match(/<RESPUESTA[^>]*>(.*?)<\/RESPUESTA>/i);

    const codigo = codeMatch ? parseInt(codeMatch[1], 10) : undefined;
    let respuesta = respMatch ? respMatch[1].trim() : undefined;

    if (codigo !== undefined && !respuesta && this.ASICITCON_CODES[codigo]) {
      respuesta = this.ASICITCON_CODES[codigo];
    }

    const success = codigo === 0;
    return {
      success,
      codigo,
      respuesta: respuesta || (success ? 'Proceso Exitoso' : 'Error en respuesta SOAP'),
      rawXml: xml,
    };
  }

  /**
   * Parser XML para WSCANCITA (Codrespuesta, Respuesta)
   */
  private static parseCancitaResponse(xml: string): HosvitalSoapResponse {
    const codeMatch = xml.match(/<Codrespuesta[^>]*>(\d+)<\/Codrespuesta>/i)
      || xml.match(/<CODIGO[^>]*>(\d+)<\/CODIGO>/i);
    const respMatch = xml.match(/<Respuesta[^>]*>(.*?)<\/Respuesta>/i)
      || xml.match(/<RESPUESTA[^>]*>(.*?)<\/RESPUESTA>/i);

    const codigo = codeMatch ? parseInt(codeMatch[1], 10) : undefined;
    let respuesta = respMatch ? respMatch[1].trim() : undefined;

    if (codigo !== undefined && !respuesta && this.CANCITA_CODES[codigo]) {
      respuesta = this.CANCITA_CODES[codigo];
    }

    const success = codigo === 0;
    return {
      success,
      codigo,
      respuesta: respuesta || (success ? 'Cancelación Exitosa' : 'Error en respuesta SOAP'),
      rawXml: xml,
    };
  }
}
