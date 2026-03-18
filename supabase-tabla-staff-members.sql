-- Tabla staff_members: contactos de staff para mensajería admin ↔ secretaria
-- Ejecutar en Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS staff_members (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'secretary')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff puede leer staff_members" ON staff_members;

CREATE POLICY "Staff puede leer staff_members"
  ON staff_members FOR SELECT TO authenticated USING (true);

-- Auto-insertar admin y secretaria desde auth.users (emails conocidos)
INSERT INTO staff_members (id, email, role, display_name)
SELECT id, email, 'admin', 'Admin'
FROM auth.users WHERE email = 'centroyouandme@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'Admin', email = EXCLUDED.email;

INSERT INTO staff_members (id, email, role, display_name)
SELECT id, email, 'secretary', 'Secretaria'
FROM auth.users WHERE email = 'asistenteyouandme@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'secretary', display_name = 'Secretaria', email = EXCLUDED.email;

-- Inserts adicionales (opcional): María y Andrea como staff
INSERT INTO staff_members (id, email, role, display_name)
SELECT id, email, 'admin', 'María Fadhel'
FROM auth.users WHERE email = 'mfadhel.ot@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'María Fadhel', email = EXCLUDED.email;

INSERT INTO staff_members (id, email, role, display_name)
SELECT id, email, 'admin', 'Andrea García'
FROM auth.users WHERE email = 'andreagarciaot@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'Andrea García', email = EXCLUDED.email;

-- Elena Fadhel
INSERT INTO staff_members (id, email, role, display_name)
SELECT id, email, 'admin', 'Elena Fadhel'
FROM auth.users WHERE email = 'magaribyelena@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'Elena Fadhel', email = EXCLUDED.email;

-- Verificación rápida: estas 2 consultas deben devolver 5 filas.
SELECT id, email FROM auth.users
WHERE email IN (
  'mfadhel.ot@gmail.com',
  'andreagarciaot@gmail.com',
  'centroyouandme@gmail.com',
  'asistenteyouandme@gmail.com',
  'magaribyelena@gmail.com'
)
ORDER BY email;

SELECT id, email, role, display_name FROM staff_members
WHERE email IN (
  'mfadhel.ot@gmail.com',
  'andreagarciaot@gmail.com',
  'centroyouandme@gmail.com',
  'asistenteyouandme@gmail.com',
  'magaribyelena@gmail.com'
)
ORDER BY email;
