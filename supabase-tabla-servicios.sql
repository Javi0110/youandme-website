-- ============================================================
-- Catálogo de servicios (página pública + Admin → Manejar servicios)
-- Ejecuta UNA VEZ en Supabase: SQL Editor → New query → pega todo → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS public.servicios (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    nombre text NOT NULL,
    descripcion text NOT NULL,
    imagen text,
    orden int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for servicios" ON public.servicios;
CREATE POLICY "Allow all for servicios" ON public.servicios
    FOR ALL USING (true) WITH CHECK (true);

-- Semilla inicial (solo si la tabla está vacía)
INSERT INTO public.servicios (nombre, descripcion, imagen, orden)
SELECT * FROM (VALUES
  (
    'Terapia Ocupacional',
    'Ayudamos a desarrollar las habilidades necesarias para las actividades diarias, el juego y el aprendizaje.',
    'servicios/terapia-ocupacional.png',
    1
  ),
  (
    'Terapia de Habla y Lenguaje',
    'Trabajamos en la comunicación, articulación y desarrollo del lenguaje expresivo y receptivo.',
    'servicios/terapia-habla-lenguaje.png',
    2
  ),
  (
    'Terapia Oromotora',
    'Mejoramos las funciones de los músculos de la boca para alimentación y habla.',
    'servicios/terapia-oromotora.png',
    3
  ),
  (
    'Terapia de Disfagia',
    'Tratamiento especializado para dificultades en la deglución y alimentación.',
    'servicios/terapia-disfagia.png',
    4
  ),
  (
    'Terapia Psicológica',
    'Apoyo emocional y conductual para el bienestar integral de tu niño/a.',
    'servicios/terapia-psicologica.png',
    5
  ),
  (
    'Terapia Ocupacional con Enfoque en Integración Sensorial',
    'Trabajamos el procesamiento sensorial para mejorar la regulación y respuesta a estímulos.',
    'servicios/terapia-integracion-sensorial.png',
    6
  ),
  (
    'Terapia Física',
    'Mejoramos la fuerza, el equilibrio, la movilidad y las habilidades motoras gruesas para el desarrollo físico.',
    'servicios/terapia-fisica.png',
    7
  )
) AS v(nombre, descripcion, imagen, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.servicios LIMIT 1);
