/**
 * Unit tests: funciones puras (utils, fechas, prioridad).
 */
import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    prioridadColor,
    prioridadTexto,
    formatearFechaHoraSlot,
    parsearFechasEvento,
} from '../lib/utils.js';

describe('escapeHtml', () => {
    it('escapa caracteres peligrosos', () => {
        expect(escapeHtml('&')).toBe('&amp;');
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('">')).toBe('&quot;&gt;');
    });

    it('convierte null/undefined a string vacía', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('deja texto seguro igual', () => {
        expect(escapeHtml('Hola mundo')).toBe('Hola mundo');
    });
});

describe('prioridadColor', () => {
    it('devuelve color para alta', () => {
        expect(prioridadColor('high')).toBe('#FF9B4E');
    });
    it('devuelve color para media', () => {
        expect(prioridadColor('medium')).toBe('#00CCC0');
    });
    it('devuelve gris por defecto', () => {
        expect(prioridadColor('low')).toBe('#5a5a5a');
        expect(prioridadColor('')).toBe('#5a5a5a');
    });
});

describe('prioridadTexto', () => {
    it('devuelve texto correcto por prioridad', () => {
        expect(prioridadTexto('high')).toBe('Alta');
        expect(prioridadTexto('medium')).toBe('Media');
        expect(prioridadTexto('low')).toBe('Baja');
        expect(prioridadTexto('')).toBe('Baja');
    });
});

describe('formatearFechaHoraSlot', () => {
    it('formatea fecha y hora para es-PR', () => {
        const r = formatearFechaHoraSlot('2025-03-20', '10:30');
        expect(r).toContain('-');
        expect(r).toMatch(/\d|mar|Mar|20|10|30/);
    });

    it('devuelve concatenación si falta algo', () => {
        expect(formatearFechaHoraSlot('', '10:00')).toBe('10:00');
        expect(formatearFechaHoraSlot('2025-01-01', '').trim()).toBe('2025-01-01');
    });
});

describe('parsearFechasEvento', () => {
    it('parsea rango tipo "15-20 de julio, 2025"', () => {
        const fechas = parsearFechasEvento('15-20 de julio, 2025');
        expect(fechas.length).toBe(6);
        expect(fechas[0].fecha).toBe('2025-07-15');
        expect(fechas[0].display).toContain('15');
        expect(fechas[5].fecha).toBe('2025-07-20');
    });

    it('devuelve un solo elemento si no hay rango', () => {
        const fechas = parsearFechasEvento('18 de diciembre, 2025');
        expect(fechas.length).toBe(1);
        expect(fechas[0].fecha).toBe('18 de diciembre, 2025');
        expect(fechas[0].display).toBe('18 de diciembre, 2025');
    });
});
