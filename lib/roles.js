/**
 * Lógica de roles (admin / secretaria) para You&Me.
 * Usado por script.js y por tests.
 */

const ADMIN_EMAIL = 'centroyouandme@gmail.com';
const SECRETARY_EMAIL = 'asistenteyouandme@gmail.com';

/**
 * Obtiene el rol según el email del usuario.
 * @param {string} email - Email del usuario (se normaliza a minúsculas)
 * @returns {'admin'|'secretary'|null}
 */
export function getRoleFromEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalized = email.toLowerCase().trim();
    if (normalized === ADMIN_EMAIL) return 'admin';
    if (normalized === SECRETARY_EMAIL) return 'secretary';
    return null;
}

/**
 * Comprueba si el usuario tiene permiso según sesión y rol.
 * No tiene efectos secundarios (no alert, no cambio de hash).
 * @param {object|null} currentSession - Sesión actual (null si no logueado)
 * @param {string|null} currentRole - Rol actual: 'admin' | 'secretary' | null
 * @param {string[]} requiredRoles - Roles permitidos (vacío = cualquier rol logueado)
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function requireStaffRoleCheck(currentSession, currentRole, requiredRoles = []) {
    if (!currentSession) {
        return { allowed: false, reason: 'no_session' };
    }
    if (Array.isArray(requiredRoles) && requiredRoles.length > 0 && !requiredRoles.includes(currentRole)) {
        return { allowed: false, reason: 'insufficient_role' };
    }
    return { allowed: true };
}

// Para uso en navegador: exponer en window
if (typeof window !== 'undefined') {
    window.getRoleFromEmail = getRoleFromEmail;
    window.requireStaffRoleCheck = requireStaffRoleCheck;
}
