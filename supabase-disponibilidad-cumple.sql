-- ============================================================
-- Tabla y lógica de disponibilidad para celebraciones (cumpleaños)
-- Ejecuta TODO este script UNA VEZ en Supabase:
-- Panel → SQL Editor → New query → pega todo → Run
--
-- Crea:
--  - Tabla disponibilidad_cumple
--  - Políticas RLS permisivas (como en reservas_eventos / reservas_cumple)
--  - Trigger para que, al crear una reserva de cumpleaños:
--      * Se bloquee el propio día reservado
--      * Se bloquee también el día anterior y el siguiente
-- ============================================================

-- 1) Tabla de disponibilidad para celebraciones
CREATE TABLE IF NOT EXISTS public.disponibilidad_cumple (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    fecha date NOT NULL,
    hora time NOT NULL,
    duracion_min integer NOT NULL,
    disponible boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 2) Habilitar RLS y política permisiva (como en otras tablas)
ALTER TABLE public.disponibilidad_cumple ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for disponibilidad_cumple" ON public.disponibilidad_cumple;
CREATE POLICY "Allow all for disponibilidad_cumple"
ON public.disponibilidad_cumple
FOR ALL
USING (true)
WITH CHECK (true);

-- 3) Trigger: al crear una reserva de cumpleaños, bloquear fecha -1, fecha y fecha +1
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'bloquear_fechas_cumple_reserva'
    ) THEN
        CREATE OR REPLACE FUNCTION public.bloquear_fechas_cumple_reserva()
        RETURNS trigger AS $func$
        DECLARE
            fecha_reserva date;
        BEGIN
            fecha_reserva := NEW.fecha;

            -- Bloquear el propio día y los días anterior y siguiente
            UPDATE public.disponibilidad_cumple
            SET disponible = false
            WHERE fecha IN (
                fecha_reserva - INTERVAL '1 day',
                fecha_reserva,
                fecha_reserva + INTERVAL '1 day'
            );

            RETURN NEW;
        END;
        $func$ LANGUAGE plpgsql;
    END IF;
END$$;

DROP TRIGGER IF EXISTS trg_bloquear_fechas_cumple_reserva ON public.reservas_cumple;

CREATE TRIGGER trg_bloquear_fechas_cumple_reserva
AFTER INSERT ON public.reservas_cumple
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_fechas_cumple_reserva();

