-- Extensiones necesarias para rangos temporales y exclusiones GiST
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Regla de integridad médica estricta:
-- Evita dos citas concurrentes del mismo doctor en el mismo intervalo estándar de 30 minutos
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
