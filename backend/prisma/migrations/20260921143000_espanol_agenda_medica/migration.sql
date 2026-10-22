-- Renombra las tablas actuales sin eliminar datos.
DO $$
BEGIN
  IF to_regclass('public."User"') IS NOT NULL AND to_regclass('public.usuarios') IS NULL THEN ALTER TABLE "User" RENAME TO usuarios; END IF;
  IF to_regclass('public."Session"') IS NOT NULL AND to_regclass('public.sesiones') IS NULL THEN ALTER TABLE "Session" RENAME TO sesiones; END IF;
  IF to_regclass('public."Contact"') IS NOT NULL AND to_regclass('public.contactos') IS NULL THEN ALTER TABLE "Contact" RENAME TO contactos; END IF;
  IF to_regclass('public."Conversation"') IS NOT NULL AND to_regclass('public.conversaciones') IS NULL THEN ALTER TABLE "Conversation" RENAME TO conversaciones; END IF;
  IF to_regclass('public."Message"') IS NOT NULL AND to_regclass('public.mensajes') IS NULL THEN ALTER TABLE "Message" RENAME TO mensajes; END IF;
  IF to_regclass('public."Appointment"') IS NOT NULL AND to_regclass('public.citas') IS NULL THEN ALTER TABLE "Appointment" RENAME TO citas; END IF;
  IF to_regclass('public."SurgicalQuote"') IS NOT NULL AND to_regclass('public.cotizaciones_quirurgicas') IS NULL THEN ALTER TABLE "SurgicalQuote" RENAME TO cotizaciones_quirurgicas; END IF;
  IF to_regclass('public."SupportTicket"') IS NOT NULL AND to_regclass('public.tickets_soporte') IS NULL THEN ALTER TABLE "SupportTicket" RENAME TO tickets_soporte; END IF;
  IF to_regclass('public."NpsSurvey"') IS NOT NULL AND to_regclass('public.encuestas_nps') IS NULL THEN ALTER TABLE "NpsSurvey" RENAME TO encuestas_nps; END IF;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE IF EXISTS citas ADD COLUMN IF NOT EXISTS "doctorId" TEXT;
ALTER TABLE IF EXISTS citas ADD COLUMN IF NOT EXISTS "specialtyId" TEXT;
ALTER TABLE IF EXISTS citas ADD COLUMN IF NOT EXISTS "locationId" TEXT;
ALTER TABLE IF EXISTS citas ADD COLUMN IF NOT EXISTS "officeId" TEXT;

CREATE TABLE IF NOT EXISTS especialidades (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS doctores (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fullName" TEXT NOT NULL,
  "medicalLicense" TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS doctores_especialidades (
  "doctorId" TEXT NOT NULL,
  "specialtyId" TEXT NOT NULL,
  CONSTRAINT doctores_especialidades_pkey PRIMARY KEY ("doctorId", "specialtyId"),
  CONSTRAINT doctores_especialidades_doctor_fk FOREIGN KEY ("doctorId") REFERENCES doctores(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT doctores_especialidades_especialidad_fk FOREIGN KEY ("specialtyId") REFERENCES especialidades(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS sedes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  address TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS consultorios (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "locationId" TEXT NOT NULL,
  name TEXT NOT NULL,
  floor TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT consultorios_sede_fk FOREIGN KEY ("locationId") REFERENCES sedes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT consultorios_sede_nombre_key UNIQUE ("locationId", name)
);

CREATE TABLE IF NOT EXISTS horarios_doctor (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "doctorId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "officeId" TEXT,
  "dayOfWeek" INTEGER NOT NULL CHECK ("dayOfWeek" BETWEEN 0 AND 6),
  "startTime" TIME(0) NOT NULL,
  "endTime" TIME(0) NOT NULL,
  "slotMinutes" INTEGER NOT NULL DEFAULT 30 CHECK ("slotMinutes" > 0),
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT horarios_doctor_doctor_fk FOREIGN KEY ("doctorId") REFERENCES doctores(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT horarios_doctor_sede_fk FOREIGN KEY ("locationId") REFERENCES sedes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT horarios_doctor_consultorio_fk FOREIGN KEY ("officeId") REFERENCES consultorios(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT horarios_doctor_horas_validas CHECK ("endTime" > "startTime")
);

CREATE TABLE IF NOT EXISTS excepciones_agenda (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "doctorId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  reason TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BLOCKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT excepciones_doctor_fk FOREIGN KEY ("doctorId") REFERENCES doctores(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT excepciones_fechas_validas CHECK ("endsAt" > "startsAt")
);

CREATE TABLE IF NOT EXISTS historial_estados_cita (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "appointmentId" TEXT NOT NULL,
  "previousStatus" TEXT,
  "newStatus" TEXT NOT NULL,
  "changedBy" TEXT,
  note TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT historial_cita_fk FOREIGN KEY ("appointmentId") REFERENCES citas(id) ON DELETE CASCADE ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_doctor_fk') THEN
    ALTER TABLE citas ADD CONSTRAINT citas_doctor_fk FOREIGN KEY ("doctorId") REFERENCES doctores(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_especialidad_fk') THEN
    ALTER TABLE citas ADD CONSTRAINT citas_especialidad_fk FOREIGN KEY ("specialtyId") REFERENCES especialidades(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_sede_fk') THEN
    ALTER TABLE citas ADD CONSTRAINT citas_sede_fk FOREIGN KEY ("locationId") REFERENCES sedes(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_consultorio_fk') THEN
    ALTER TABLE citas ADD CONSTRAINT citas_consultorio_fk FOREIGN KEY ("officeId") REFERENCES consultorios(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS doctores_activos_nombre_idx ON doctores (active, "fullName");
CREATE INDEX IF NOT EXISTS horarios_doctor_dia_idx ON horarios_doctor ("doctorId", "dayOfWeek", active);
CREATE INDEX IF NOT EXISTS horarios_sede_dia_idx ON horarios_doctor ("locationId", "dayOfWeek", active);
CREATE INDEX IF NOT EXISTS excepciones_doctor_fechas_idx ON excepciones_agenda ("doctorId", "startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS historial_cita_fecha_idx ON historial_estados_cita ("appointmentId", "createdAt");
CREATE INDEX IF NOT EXISTS citas_doctor_fecha_idx ON citas ("doctorId", "dateTime");

-- Evita dos citas activas del mismo doctor en el mismo intervalo estándar de 30 minutos.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'citas_doctor_horario_excluyente') THEN
    ALTER TABLE citas ADD CONSTRAINT citas_doctor_horario_excluyente
      EXCLUDE USING gist (
        "doctorId" WITH =,
        tsrange("dateTime", "dateTime" + INTERVAL '30 minutes', '[)') WITH &&
      ) WHERE ("doctorId" IS NOT NULL AND status IN ('HELD', 'CONFIRMED'));
  END IF;
END $$;
