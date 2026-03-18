-- Tablas para Referidos + scheduler de recordatorios (tareas)
-- Ejecutar en Supabase SQL Editor.

-- Para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Pacientes / referidos
CREATE TABLE IF NOT EXISTS referral_patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  referral_expires_on DATE NOT NULL,
  comentarios_admin TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Si la columna ya existía sin comentarios_admin, agrégala (migración segura)
ALTER TABLE referral_patients ADD COLUMN IF NOT EXISTS comentarios_admin TEXT;

ALTER TABLE referral_patients ENABLE ROW LEVEL SECURITY;

-- Permitir solo a cuentas de staff (existen en staff_members)
DROP POLICY IF EXISTS "Staff puede leer referral_patients" ON referral_patients;
DROP POLICY IF EXISTS "Staff puede insertar referral_patients" ON referral_patients;
DROP POLICY IF EXISTS "Staff puede actualizar referral_patients" ON referral_patients;
DROP POLICY IF EXISTS "Staff puede borrar referral_patients" ON referral_patients;

CREATE POLICY "Staff puede leer referral_patients"
  ON referral_patients FOR SELECT TO authenticated
  USING (exists (select 1 from staff_members sm where sm.id = auth.uid()));

CREATE POLICY "Staff puede insertar referral_patients"
  ON referral_patients FOR INSERT TO authenticated
  WITH CHECK (
    exists (select 1 from staff_members sm where sm.id = auth.uid())
  );

CREATE POLICY "Staff puede actualizar referral_patients"
  ON referral_patients FOR UPDATE TO authenticated
  USING (exists (select 1 from staff_members sm where sm.id = auth.uid()))
  WITH CHECK (exists (select 1 from staff_members sm where sm.id = auth.uid()));

CREATE POLICY "Staff puede borrar referral_patients"
  ON referral_patients FOR DELETE TO authenticated
  USING (exists (select 1 from staff_members sm where sm.id = auth.uid()));

-- 2) Log para evitar duplicar reminders
CREATE TABLE IF NOT EXISTS referral_reminder_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_patient_id UUID NOT NULL REFERENCES referral_patients(id) ON DELETE CASCADE,
  reminder_due_on DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT referral_reminder_jobs_unique UNIQUE (referral_patient_id, reminder_due_on)
);

ALTER TABLE referral_reminder_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff puede leer referral_reminder_jobs" ON referral_reminder_jobs;
DROP POLICY IF EXISTS "Staff puede insertar referral_reminder_jobs" ON referral_reminder_jobs;

CREATE POLICY "Staff puede leer referral_reminder_jobs"
  ON referral_reminder_jobs FOR SELECT TO authenticated
  USING (exists (select 1 from staff_members sm where sm.id = auth.uid()));

CREATE POLICY "Staff puede insertar referral_reminder_jobs"
  ON referral_reminder_jobs FOR INSERT TO authenticated
  WITH CHECK (exists (select 1 from staff_members sm where sm.id = auth.uid()));

