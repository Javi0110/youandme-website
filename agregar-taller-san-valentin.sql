-- Ejecuta en Supabase SQL Editor si ya tienes eventos y quieres agregar el Taller de San Valentín
-- (Si estás configurando desde cero, usa supabase-seed-eventos.sql que ya lo incluye)

INSERT INTO public.eventos (nombre, descripcion, fecha, horario, edad, precio, cupos, imagen)
VALUES (
  'Taller Creativo de San Valentín',
  'Ven a crear, decorar y celebrar la amistad! Actividades incluidas: Pulseras personalizadas, Decora tu Tote Bag, Cupcakes divertidos.',
  '13 de febrero, 2026',
  '4:00 - 6:30 PM',
  'Todas las edades',
  40,
  15,
  'flyers/taller-san-valentin.png'
);
