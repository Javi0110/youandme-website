/**
 * Unit tests: eventos y reservas con mock data.
 */
import { describe, it, expect } from 'vitest';
import { parsearFechasEvento } from '../lib/utils.js';

// Mock data de eventos (como los devuelve Supabase / app)
const MOCK_EVENTOS = [
    {
        id: 'evt-1',
        nombre: 'San Valentín',
        descripcion: 'Taller de manualidades',
        fecha: '14 de febrero, 2025',
        horario: '10:00 a 12:00',
        edad: '4-10',
        precio: 25,
        cupos: 15,
        imagen: '',
    },
    {
        id: 'evt-2',
        nombre: 'Campamento',
        descripcion: 'Campamento de verano',
        fecha: '15-20 de julio, 2025',
        horario: '9:00-15:00',
        edad: '6-12',
        precio: 50,
        cupos: 20,
        imagen: 'https://example.com/flyer.jpg',
    },
];

describe('Mock data de eventos', () => {
    it('tiene estructura válida para evento simple', () => {
        const e = MOCK_EVENTOS[0];
        expect(e.id).toBeDefined();
        expect(e.nombre).toBe('San Valentín');
        expect(typeof e.precio).toBe('number');
        expect(typeof e.cupos).toBe('number');
    });

    it('tiene estructura válida para evento multi-día', () => {
        const e = MOCK_EVENTOS[1];
        expect(e.fecha).toContain('-');
        expect(e.precio).toBe(50);
    });
});

describe('parsearFechasEvento con mock de fechas', () => {
    it('rango 18-22 de diciembre, 2025', () => {
        const fechas = parsearFechasEvento('18-22 de diciembre, 2025');
        expect(fechas.length).toBe(5);
        expect(fechas[0].fecha).toBe('2025-12-18');
        expect(fechas[4].fecha).toBe('2025-12-22');
    });

    it('rango 1-3 de enero, 2026', () => {
        const fechas = parsearFechasEvento('1-3 de enero, 2026');
        expect(fechas.length).toBe(3);
        expect(fechas[0].fecha).toBe('2026-01-01');
    });
});
