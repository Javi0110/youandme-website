/**
 * Lógica de roles (admin / secretaria) - versión navegador (sin export).
 */
(function() {
const ADMIN_EMAIL = 'centroyouandme@gmail.com';
const SECRETARY_EMAIL = 'asistenteyouandme@gmail.com';

function getRoleFromEmail(email) {
    if (!email || typeof email !== 'string') return null;
    const normalized = email.toLowerCase().trim();
    if (normalized === ADMIN_EMAIL) return 'admin';
    if (normalized === SECRETARY_EMAIL) return 'secretary';
    return null;
}

function requireStaffRoleCheck(currentSession, currentRole, requiredRoles) {
    if (!currentSession) return { allowed: false, reason: 'no_session' };
    requiredRoles = requiredRoles || [];
    if (Array.isArray(requiredRoles) && requiredRoles.length > 0 && !requiredRoles.includes(currentRole)) {
        return { allowed: false, reason: 'insufficient_role' };
    }
    return { allowed: true };
}

if (typeof window !== 'undefined') {
    window.getRoleFromEmail = getRoleFromEmail;
    window.requireStaffRoleCheck = requireStaffRoleCheck;
}
})();
