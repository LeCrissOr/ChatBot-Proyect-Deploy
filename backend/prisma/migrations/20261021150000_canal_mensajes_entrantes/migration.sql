ALTER TABLE cola_mensajes_entrantes
  ADD COLUMN IF NOT EXISTS "sourceChannel" TEXT NOT NULL DEFAULT 'META';
