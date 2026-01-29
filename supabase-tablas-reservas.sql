-- Ejecuta este script en Supabase: SQL Editor → New query → pega y Run
-- Crea las tablas para guardar reservas de actividades y cumpleaños

-- Reservas de actividades (eventos)
-- evento_id guarda el id de la fila en eventos (uuid o integer según tu tabla)
CREATE TABLE IF NOT EXISTS public.reservas_eventos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    evento_id text NOT NULL,
    nombre_nino text,
    edad_nino int,
    nombre_padre text,
    email text,
    telefono text,
    dias int DEFAULT 1,
    total numeric DEFAULT 0,
    pagado boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Reservas de cumpleaños
CREATE TABLE IF NOT EXISTS public.reservas_cumple (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre_nino text,
    fecha date,
    contacto text,
    telefono text,
    email text,
    horas text,
    decoracion text,
    equipo boolean DEFAULT false,
    pretend_play boolean DEFAULT false,
    actividad text,
    num_ninos int DEFAULT 0,
    total numeric DEFAULT 0,
    pagado boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Habilitar RLS y políticas para que la web (anon key) pueda insertar y leer
ALTER TABLE public.reservas_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas_cumple ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for reservas_eventos" ON public.reservas_eventos;
CREATE POLICY "Allow all for reservas_eventos" ON public.reservas_eventos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for reservas_cumple" ON public.reservas_cumple;
CREATE POLICY "Allow all for reservas_cumple" ON public.reservas_cumple FOR ALL USING (true) WITH CHECK (true);
