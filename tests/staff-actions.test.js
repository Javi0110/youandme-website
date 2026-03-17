/**
 * Unit tests: acciones de staff (admin y secretaria) con mock data.
 * Valida que cada rol pueda hacer lo que le corresponde.
 */
import { describe, it, expect } from 'vitest';
import { getRoleFromEmail, requireStaffRoleCheck } from '../lib/roles.js';

// Mock: sesiones de admin y secretaria
const MOCK_SESSION_ADMIN = {
    user: { id: 'admin-uuid', email: 'centroyouandme@gmail.com' },
};
const MOCK_SESSION_SECRETARY = {
    user: { id: 'sec-uuid', email: 'asistenteyouandme@gmail.com' },
};

// Acciones en la app y qué roles pueden ejecutarlas (según script.js)
const STAFF_ACTIONS = {
    createTask: ['admin', 'secretary'],
    sendMessage: ['admin', 'secretary'],
    viewDashboard: ['admin', 'secretary'],
    viewCalendar: ['admin', 'secretary'],
    viewTasks: ['admin', 'secretary'],
};

function canPerformAction(role, actionKey) {
    const allowed = STAFF_ACTIONS[actionKey];
    if (!allowed || allowed.length === 0) return true; // sin restricción
    return allowed.includes(role);
}

describe('Acciones de staff con mock data', () => {
    describe('Admin puede', () => {
        it('crear tarea', () => {
            expect(canPerformAction('admin', 'createTask')).toBe(true);
            const r = requireStaffRoleCheck(MOCK_SESSION_ADMIN, 'admin', ['admin', 'secretary']);
            expect(r.allowed).toBe(true);
        });
        it('enviar mensaje', () => {
            expect(canPerformAction('admin', 'sendMessage')).toBe(true);
        });
        it('ver dashboard, calendario y tareas', () => {
            expect(canPerformAction('admin', 'viewDashboard')).toBe(true);
            expect(canPerformAction('admin', 'viewCalendar')).toBe(true);
            expect(canPerformAction('admin', 'viewTasks')).toBe(true);
        });
    });

    describe('Secretaria puede', () => {
        it('crear tarea', () => {
            expect(canPerformAction('secretary', 'createTask')).toBe(true);
            const r = requireStaffRoleCheck(MOCK_SESSION_SECRETARY, 'secretary', ['admin', 'secretary']);
            expect(r.allowed).toBe(true);
        });
        it('enviar mensaje', () => {
            expect(canPerformAction('secretary', 'sendMessage')).toBe(true);
        });
        it('ver dashboard, calendario y tareas', () => {
            expect(canPerformAction('secretary', 'viewDashboard')).toBe(true);
            expect(canPerformAction('secretary', 'viewCalendar')).toBe(true);
            expect(canPerformAction('secretary', 'viewTasks')).toBe(true);
        });
    });

    describe('Usuario sin sesión no puede', () => {
        it('acceder a ninguna acción de staff', () => {
            const r = requireStaffRoleCheck(null, null, []);
            expect(r.allowed).toBe(false);
            expect(r.reason).toBe('no_session');
        });
    });

    describe('Resolución de rol desde email (mock login)', () => {
        it('login con email admin asigna rol admin', () => {
            const role = getRoleFromEmail(MOCK_SESSION_ADMIN.user.email);
            expect(role).toBe('admin');
        });
        it('login con email secretaria asigna rol secretary', () => {
            const role = getRoleFromEmail(MOCK_SESSION_SECRETARY.user.email);
            expect(role).toBe('secretary');
        });
    });
});
