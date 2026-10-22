ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE mensajes ADD COLUMN IF NOT EXISTS "deliveryError" TEXT;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS cola_mensajes_entrantes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "waMessageId" TEXT UNIQUE,
  phone TEXT NOT NULL,
  "senderName" TEXT,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS cola_mensajes_estado_disponible_idx
  ON cola_mensajes_entrantes (status, "availableAt", "createdAt");
CREATE INDEX IF NOT EXISTS cola_mensajes_telefono_estado_idx
  ON cola_mensajes_entrantes (phone, status);

-- La duración de cada cita ahora participa en la exclusión de solapamientos.
ALTER TABLE citas DROP CONSTRAINT IF EXISTS citas_doctor_horario_excluyente;
ALTER TABLE citas
  ADD CONSTRAINT citas_doctor_horario_excluyente
  EXCLUDE USING gist (
    (COALESCE("doctorId", 'nombre:' || regexp_replace(lower(trim("doctorName")), '^(dr\(a\)\.|dr\.|dra\.)\s*', ''))) WITH =,
    tsrange(
      "dateTime",
      "dateTime" + ("durationMinutes" * INTERVAL '1 minute'),
      '[)'
    ) WITH &&
  ) WHERE (status IN ('HELD', 'CONFIRMED', 'PENDING', 'PAID_VIRTUAL', 'PAY_AT_WINDOW'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'citas_duracion_positiva_chk' AND conrelid = 'citas'::regclass
  ) THEN
    ALTER TABLE citas ADD CONSTRAINT citas_duracion_positiva_chk CHECK ("durationMinutes" > 0);
  END IF;
END $$;
