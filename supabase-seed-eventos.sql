-- Ejecuta este script en Supabase: SQL Editor → New query → pega y Run
-- Así la tabla eventos tendrá las 3 actividades iniciales

INSERT INTO public.eventos (nombre, descripcion, fecha, horario, edad, precio, cupos, imagen)
VALUES
  (
    'Campamento de Verano 2025',
    'Campamento de verano con actividades sensoriales, terapéuticas y recreativas para niños. Incluye meriendas y materiales.',
    '15-20 de julio, 2025',
    '9:00 AM - 1:00 PM',
    '3-8 años',
    250,
    15,
    ''
  ),
  (
    'Taller de Integración Sensorial',
    'Taller especializado para padres y niños sobre integración sensorial. Aprende técnicas que puedes usar en casa.',
    '5 de noviembre, 2025',
    '10:00 AM - 12:00 PM',
    'Padres y niños (2-6 años)',
    45,
    8,
    ''
  ),
  (
    'Campamento de Navidad',
    'Actividades navideñas, manualidades, juegos sensoriales y mucho más. ¡Una experiencia mágica para los niños!',
    '18-22 de diciembre, 2025',
    '9:00 AM - 1:00 PM',
    '3-10 años',
    275,
    20,
    ''
  ),
  (
    'Taller Creativo de San Valentín',
    'Ven a crear, decorar y celebrar la amistad! Actividades incluidas: Pulseras personalizadas, Decora tu Tote Bag, Cupcakes divertidos.',
    '13 de febrero, 2026',
    '4:00 - 6:30 PM',
    'Todas las edades',
    40,
    15,
    'flyers/taller-san-valentin.png'
  );
