# Guía de Despliegue en Windows Server — HUN ChatBot & Dashboard Clínico (Modo 100% Endpoints)

Esta carpeta (`ChatBot Proyect Deploy`) está configurada para operar **100% conectada a los Endpoints REST/SOAP de Hosvital HUN**, eliminando por completo el uso de archivos Excel.

---

## 1. Arquitectura de Comunicación por Endpoints

El sistema consulta y opera en tiempo real contra `HUN_API_URL` (configurado en `backend\.env`):

| Operación | Endpoint Configurado | Método |
| :--- | :--- | :--- |
| **Catálogo de Especialidades** | `/webServiceEspecialidad/especialidades` | `GET` |
| **Agenda y Cupos Disponibles** | `/webServiceAgenda/agenda` | `GET` |
| **Historial de Citas por Documento** | `/webServiceCitaDocumento/consultar_citas_documento` | `GET` |
| **Consulta de Cita por Número** | `/webServiceCitaNumero/consultar_citas_numero` | `GET` |
| **Asignar / Confirmar Cita** | `/webServiceCita/api/asignar_cita` | `POST` |
| **Cancelar Cita** | `/webServiceCancelarCitaH/cancelar_cita` | `POST` |
| **Verificar Estado de Cancelación** | `/webServiceCancelarCitaH/verificar_cancelacion/{id}` | `GET` |
| **Tarifas CUPS** | `/webServiceTarifas/tarifas` | `GET` |
| **Preparaciones e Indicaciones** | `/webServicePreparaciones/preparaciones` | `GET` |

Todas las rutas pueden personalizarse directamente en `backend\.env` sin necesidad de recompilar el código.

---

## 2. Requisitos en el Servidor Windows

1. **Node.js v20 LTS (64-bit):** [https://nodejs.org/](https://nodejs.org/)
2. **PostgreSQL 15/16 para Windows:** Para almacenar las conversaciones de WhatsApp, tickets PQRS, alarmas críticas y sesiones de agentes del Dashboard.
3. **Conectividad de Red:** El servidor Windows debe alcanzar la IP del servidor de Endpoints (`http://190.109.10.204` o la IP interna de Hosvital en el HUN).

---

## 3. Pasos de Despliegue (3 clics)

1. **`ABRIR_PUERTOS_FIREWALL.bat`** *(Clic derecho -> Ejecutar como Administrador)*:
   Habilita el puerto TCP `3001` en el Firewall de Windows.
2. **`INSTALAR_EN_SERVIDOR.bat`**:
   Instala las dependencias, sincroniza el esquema de sesiones/conversaciones en PostgreSQL y compila el proyecto.
3. **`INICIAR_PRODUCCION.bat`** (o **`INSTALAR_SERVICIO_24_7.bat`** como Administrador para servicio continuo con PM2):
   Inicia el servidor unificado en `http://localhost:3001` y en `http://IP_DEL_SERVIDOR:3001`.
