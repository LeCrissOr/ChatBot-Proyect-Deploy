# Hospital Universitario Nacional (HUN) · Bot Paciente Particular

Sistema integral de **Chatbot para WhatsApp Business** y **Dashboard Clínico en Tiempo Real** para la atención de pacientes particulares en el **Hospital Universitario Nacional de Colombia (Corporación Salud UN)**.

Implementado con base en el documento oficial:
> **Árbol de Flujo Conversacional — Bot Paciente Particular HUN · WhatsApp Business · v1.0 · Junio 2026**

---

## 🚀 Arquitectura del Proyecto

```
HUN ChatBot Deploy/
├── backend/                  # API REST, Integración Hosvital, Webhooks de Meta y WebSockets
│   ├── prisma/               # Esquema PostgreSQL (Contactos, Sesiones, Citas, Cotizaciones, Tickets)
│   ├── src/
│   │   ├── config/           # Variables de entorno y configuración de Endpoints
│   │   ├── controllers/      # Webhook, Agenda, Chat en vivo, Métricas
│   │   ├── routes/           # Rutas Express (/api/webhook, /api/chat, /api/agenda, /api/metrics)
│   │   ├── services/
│   │   │   ├── decisionTree.service.ts  # Árbol de decisiones institucional HUN
│   │   │   ├── hunApi.service.ts        # Cliente de Endpoints Hosvital / HUN
│   │   │   ├── whatsapp.service.ts      # Meta WhatsApp Cloud API y Baileys
│   │   │   ├── socket.service.ts        # Transmisión WebSockets en tiempo real
│   │   │   └── store.service.ts         # Persistencia PostgreSQL (Prisma ORM)
│   │   └── server.ts         # Servidor HTTP Unificado + Express + Socket.io
│   └── package.json
│
├── frontend/                 # Dashboard Web Administrativo y Clínico (React 19 + TypeScript)
│   ├── dist/                 # Compilación optimizada de producción servida por Express
│   ├── src/
│   │   ├── components/
│   │   │   ├── TopBar.tsx           # Navegación e indicadores en vivo
│   │   │   ├── OverviewTab.tsx      # KPIs, Automatización y Resumen de Flujos
│   │   │   ├── LiveChatTab.tsx      # Bandeja de Entrada, Chat en vivo e Intervención
│   │   │   ├── AgendaTab.tsx        # Agenda Médica conectada a Endpoints Hosvital
│   │   │   ├── SimulatorTab.tsx     # Simulador WhatsApp para validación operativa
│   │   │   ├── ClinicalTab.tsx      # Gestión de Citas y Cotizaciones Quirúrgicas
│   │   │   ├── TicketsTab.tsx       # Alarmas Post-Qx y Excepciones (E-001 a E-010)
│   │   │   └── SettingsTab.tsx      # Configuración de Meta, Endpoints y PostgreSQL
│   │   ├── lib/                     # Clientes Axios y Socket.io
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
```

---

## 🌳 Flujos Conversacionales Implementados

### 1. F-01: Consulta / Ambulatorio (Cierre 100% en Bot)
- **Especialidad:** Selección de especialidad médica o quirúrgica desde el catálogo oficial de Hosvital. *(Regla clínica: NO se solicita diagnóstico ni síntoma)*.
- **Tipo de visita:** Primera vez o Control.
- **Identificación:** Verificación y registro de datos del paciente y acompañante.
- **Agenda:** Consulta de disponibilidad en vivo contra el Endpoint `/webServiceAgenda/agenda` de Hosvital.
- **Tarifa & Pago:** Tarifa autorizada según perfil (Particular, Egresado UNAL, Colaborador HUN) y modalidad de pago.
- **Confirmación:** Asignación de cita mediante `/webServiceCita/api/asignar_cita`.

### 2. F-02: Quirúrgico (con y sin MAES) · Bot captura · Auxiliar ejecuta
- **Procedimiento:** Captura del procedimiento quirúrgico solicitado.
- **Orden médica:** Validación de orden vigente; si requiere valoración inicial redirige a **F-01**.
- **EPS:** Identificación de entidad aseguradora.
- **SLA:** Generación de cotización en el Dashboard para gestión en máximo 72 horas hábiles.

### 3. F-03: Referido por Especialista · Modelo A / Modelo B
- **Validación:** Verificación de código de remisión o especialista referente.
- **Agenda Prioritaria:** Asignación preferencial y notificación de condiciones de atención.

### 4. Módulo de Post-Atención Transversal
- **Seguimiento 24-48h Consulta y Quirúrgico:** Detección de signos de alarma postoperatorios (fiebre, dolor agudo, sangrado) con disparo inmediato de **Alerta Crítica** en tiempo real en el Dashboard.
- **Encuesta NPS 48-72h:** Calificación de 1 a 5 estrellas ⭐ y apertura automática de **PQRS (E-009)** en calificaciones ≤ 3.

---

## ⚡ Despliegue e Inicio en Servidor Windows

Consulta la guía detallada en **`GUIA_DESPLIEGUE_WINDOWS.md`** o utiliza los ejecutables incluidos en la raíz:

1. **`ABRIR_PUERTOS_FIREWALL.bat`** *(Ejecutar como Administrador)*: Habilita los puertos en Windows Defender Firewall.
2. **`INSTALAR_EN_SERVIDOR.bat`**: Instala dependencias, sincroniza el esquema PostgreSQL y genera la compilación de producción.
3. **`INICIAR_PRODUCCION.bat`**: Inicia el servidor unificado en `http://localhost:3001`.
4. **`INSTALAR_SERVICIO_24_7.bat`** *(Ejecutar como Administrador)*: Registra el servicio continuo con PM2 en Windows Server.
