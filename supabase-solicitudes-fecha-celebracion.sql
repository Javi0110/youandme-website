-- ============================================================
-- Tabla para solicitudes de fecha de celebración (cuando no hay disponibilidad)
-- Ejecuta en Supabase: SQL Editor → New query → pega todo → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.solicitudes_fecha_celebracion (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha_solicitada date NOT NULL,
    nombre_contacto text NOT NULL,
    email text NOT NULL,
    telefono text NOT NULL,
    mensaje text,
    -- Estado de la solicitud: pendiente / aprobada / rechazada
    estado text NOT NULL DEFAULT 'pendiente',
    decision_comentario text,
    resuelta_en timestamptz,
    created_at timestamptz DEFAULT now()
);

-- Si la tabla ya existía, asegurarnos de que tenga las columnas nuevas
ALTER TABLE public.solicitudes_fecha_celebracion
    ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente',
    ADD COLUMN IF NOT EXISTS decision_comentario text,
    ADD COLUMN IF NOT EXISTS resuelta_en timestamptz;

ALTER TABLE public.solicitudes_fecha_celebracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for solicitudes_fecha_celebracion" ON public.solicitudes_fecha_celebracion;
CREATE POLICY "Allow all for solicitudes_fecha_celebracion"
ON public.solicitudes_fecha_celebracion
FOR ALL
USING (true)
WITH CHECK (true);
