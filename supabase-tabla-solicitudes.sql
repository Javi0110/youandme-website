-- ============================================================
-- Ejecuta este script UNA VEZ en Supabase si las solicitudes
-- no se guardan en el servidor (Admin → Solicitudes vacío).
-- Panel → SQL Editor → New query → pega todo → Run
-- ============================================================

-- Tabla de solicitudes de servicio
CREATE TABLE IF NOT EXISTS public.solicitudes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    servicio text,
    paciente text,
    edad int,
    tutor text,
    email text,
    telefono text,
    tipo_cobertura text,
    motivo text,
    contacto_preferido text,
    contactado boolean DEFAULT false,
    agendado boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Si la tabla ya existía sin tipo_cobertura, añadir la columna
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'solicitudes' AND column_name = 'tipo_cobertura'
    ) THEN
        ALTER TABLE public.solicitudes ADD COLUMN tipo_cobertura text;
    END IF;
END $$;

-- Habilitar RLS
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- Permitir que cualquiera (anon) inserte: formulario público
DROP POLICY IF EXISTS "solicitudes_insert_anon" ON public.solicitudes;
CREATE POLICY "solicitudes_insert_anon" ON public.solicitudes
    FOR INSERT TO anon WITH CHECK (true);

-- Permitir que usuarios autenticados vean y actualicen: panel admin
DROP POLICY IF EXISTS "solicitudes_select_auth" ON public.solicitudes;
CREATE POLICY "solicitudes_select_auth" ON public.solicitudes
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "solicitudes_update_auth" ON public.solicitudes;
CREATE POLICY "solicitudes_update_auth" ON public.solicitudes
    FOR UPDATE TO authenticated USING (true);

-- Permitir que usuarios autenticados eliminen: panel admin
DROP POLICY IF EXISTS "solicitudes_delete_auth" ON public.solicitudes;
CREATE POLICY "solicitudes_delete_auth" ON public.solicitudes
    FOR DELETE TO authenticated USING (true);
