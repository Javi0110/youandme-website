/**
 * Unit tests: roles admin y secretaria.
 * Mock data y validación de que cada rol puede hacer lo debido.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getRoleFromEmail, requireStaffRoleCheck } from '../lib/roles.js';

describe('getRoleFromEmail', () => {
    it('asigna rol admin al email del centro', () => {
        expect(getRoleFromEmail('centroyouandme@gmail.com')).toBe('admin');
        expect(getRoleFromEmail('CENTROYOUANDME@GMAIL.COM')).toBe('admin');
        expect(getRoleFromEmail('  centroyouandme@gmail.com  ')).toBe('admin');
    });

    it('asigna rol secretary al email de la asistente', () => {
        expect(getRoleFromEmail('asistenteyouandme@gmail.com')).toBe('secretary');
        expect(getRoleFromEmail('AsistenteYouAndMe@gmail.com')).toBe('secretary');
    });

    it('devuelve null para otros emails', () => {
        expect(getRoleFromEmail('otro@gmail.com')).toBe(null);
        expect(getRoleFromEmail('')).toBe(null);
        expect(getRoleFromEmail(null)).toBe(null);
        expect(getRoleFromEmail(undefined)).toBe(null);
    });
});

describe('requireStaffRoleCheck', () => {
    const mockSession = { user: { id: '1', email: 'centroyouandme@gmail.com' } };

    it('deniega acceso sin sesión', () => {
        const result = requireStaffRoleCheck(null, null, []);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('no_session');
    });

    it('permite a admin con sesión (roles requeridos vacíos)', () => {
        const result = requireStaffRoleCheck(mockSession, 'admin', []);
        expect(result.allowed).toBe(true);
    });

    it('permite a secretaria con sesión (roles requeridos vacíos)', () => {
        const result = requireStaffRoleCheck(mockSession, 'secretary', []);
        expect(result.allowed).toBe(true);
    });

    it('permite a admin cuando se requiere admin', () => {
        expect(requireStaffRoleCheck(mockSession, 'admin', ['admin']).allowed).toBe(true);
        expect(requireStaffRoleCheck(mockSession, 'admin', ['admin', 'secretary']).allowed).toBe(true);
    });

    it('permite a secretaria cuando se requiere secretaria o admin', () => {
        expect(requireStaffRoleCheck(mockSession, 'secretary', ['secretary']).allowed).toBe(true);
        expect(requireStaffRoleCheck(mockSession, 'secretary', ['admin', 'secretary']).allowed).toBe(true);
    });

    it('deniega a secretaria cuando solo se permite admin', () => {
        const result = requireStaffRoleCheck(mockSession, 'secretary', ['admin']);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('insufficient_role');
    });

    it('deniega a admin cuando solo se requiere secretaria (si en el futuro se usa)', () => {
        const result = requireStaffRoleCheck(mockSession, 'admin', ['secretary']);
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('insufficient_role');
    });

    it('ambos roles pueden acceder a tareas y mensajes (admin y secretary)', () => {
        const sessionAdmin = { user: { id: '1' } };
        const sessionSec = { user: { id: '2' } };
        const required = ['admin', 'secretary'];
        expect(requireStaffRoleCheck(sessionAdmin, 'admin', required).allowed).toBe(true);
        expect(requireStaffRoleCheck(sessionSec, 'secretary', required).allowed).toBe(true);
    });
});
