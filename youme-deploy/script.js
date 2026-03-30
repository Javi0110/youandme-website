// Stripe Configuration (Reemplaza con tu clave pública)
// Inicializar Stripe solo si está disponible - NO bloquea si no está
let stripe;
try {
    if (typeof Stripe !== 'undefined') {
        stripe = Stripe('pk_test_51QKxexGxaxrh1Ws0ZmVF9K3YPz9nK1Oi7FvSdwQJb3IxBgFbDlqKsR0NTIKDkJrN0kVYZL9WzH0yqDe8C1qW0qW000000000'); // REEMPLAZAR CON TU CLAVE
    }
} catch (e) {
    console.log('Stripe no disponible:', e);
}

// ==================== SUPABASE CONFIGURATION ====================
// Configuración de Supabase desde window.SUPABASE_CONFIG (definido en index.html)
// Nota: la librería de Supabase expone un objeto global llamado `supabase`.
// Para evitar conflicto, nuestro cliente se llama `supabaseClient`.
let supabaseClient;
let currentStaffSession = null;
let currentStaffRole = null;
const STAFF_PORTAL_CONTACTS = [
    { email: 'mfadhel.ot@gmail.com', role: 'admin', label: 'Maria Fadhel' },
    { email: 'andreagarciaot@gmail.com', role: 'admin', label: 'Andrea García' },
    { email: 'centroyouandme@gmail.com', role: 'admin', label: 'Admin' },
    { email: 'asistenteyouandme@gmail.com', role: 'secretary', label: 'Secretaria' },
    { email: 'magaribyelena@gmail.com', role: 'admin', label: 'Elena Fadhel' }
];

function rolePorEmailStaff(email) {
    const normalized = String(email || '').toLowerCase().trim();
    const found = STAFF_PORTAL_CONTACTS.find(c => c.email === normalized);
    return found?.role || null;
}

function inicializarSupabase() {
    try {
        if (typeof window.supabase === 'undefined' || !window.SUPABASE_CONFIG) {
            return; // Supabase aún no está cargado o no hay configuración
        }
        
        const SUPABASE_URL = window.SUPABASE_CONFIG?.url || '';
        const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG?.anonKey || '';
        
        // Inicializar Supabase solo si las credenciales están configuradas
        if (SUPABASE_URL && SUPABASE_ANON_KEY && 
            SUPABASE_URL !== 'TU_SUPABASE_URL_AQUI' && 
            SUPABASE_ANON_KEY !== 'TU_SUPABASE_ANON_KEY_AQUI') {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase inicializado correctamente');

            // Cargar sesión de staff si existe
            supabaseClient.auth.getSession().then(({ data }) => {
                currentStaffSession = data.session || null;
                if (currentStaffSession) {
                    cargarRolStaffYActualizarUI();
                } else {
                    actualizarUIStaff();
                }
            });

            supabaseClient.auth.onAuthStateChange((_event, session) => {
                currentStaffSession = session;
                if (session) {
                    cargarRolStaffYActualizarUI();
                } else {
                    currentStaffRole = null;
                    actualizarUIStaff();
                }
            });
        }
    } catch (error) {
        console.log('⚠️ Supabase no disponible (continuando sin él):', error);
        // No bloquear la ejecución si Supabase falla
    }
}

// ==================== EMAIL DE CONFIRMACIÓN (Brevo vía Edge Function de Supabase) ====================
// Cliente + copia a centroyouandme y magaribyelena.

async function enviarEmailRelay(payload) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg?.url || !cfg?.anonKey) {
        console.warn('SUPABASE_CONFIG no configurado. No se envía email.');
        return;
    }
    try {
        const url = `${cfg.url.replace(/\/$/, '')}/functions/v1/send-email`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.anonKey}`,
            },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            console.error('Error enviando email (Brevo):', data?.error || res.statusText);
        }
    } catch (e) {
        console.error('Error enviando email (Brevo):', e?.message || e);
    }
}

async function enviarEmailConfirmacionSolicitud(email, nombrePaciente, servicio, tutor) {
    if (!email) return;
    await enviarEmailRelay({
        type: 'solicitud',
        to_email: email,
        nombre_paciente: nombrePaciente || '',
        servicio: servicio || '',
        tutor: tutor || '',
    });
}

async function enviarEmailNotificacionAdminSolicitud(solicitudData = {}) {
    const adminEmail = 'centroyouandme@gmail.com';
    const paciente = solicitudData.paciente || '';
    const servicio = solicitudData.servicio || '';
    const tutor = solicitudData.tutor || '';
    const telefono = solicitudData.telefono || '';
    const cobertura = solicitudData.tipo_cobertura || 'No indicado';
    const motivo = solicitudData.motivo || '';
    const contacto = solicitudData.contacto_preferido || '';
    const resumen = [
        `Paciente: ${paciente}`,
        `Servicio: ${servicio}`,
        `Tutor: ${tutor}`,
        `Teléfono: ${telefono}`,
        `Cobertura/Pago: ${cobertura}`,
        `Contacto preferido: ${contacto}`,
        `Motivo: ${motivo}`
    ].join('\n');

    await enviarEmailRelay({
        type: 'solicitud',
        to_email: adminEmail,
        nombre_paciente: paciente,
        servicio: `${servicio} (copia admin)`,
        tutor: `${tutor} | Tel: ${telefono} | Cobertura: ${cobertura} | Contacto: ${contacto} | Motivo: ${motivo}`,
        resumen
    });
}

async function enviarEmailConfirmacionActividad(email, nombreNino, nombreActividad, total) {
    if (!email) return;
    let totalNum = total;
    if (total !== null && total !== undefined && total !== '') {
        totalNum = Number(total);
    } else {
        totalNum = 0;
    }
    const totalFormato = totalNum > 0 ? '$' + totalNum : (total != null ? '$' + total : '$0');
    const instruccionesAth = 'Realiza el pago a través de ATH Móvil: Pay a business → YouandMeCenter';
    await enviarEmailRelay({
        type: 'actividad',
        to_email: email,
        nombre_nino: nombreNino || '',
        nombre_actividad: nombreActividad || 'Actividad',
        total: totalFormato,
        mensaje_pago: instruccionesAth,
    });
}

async function enviarEmailConfirmacionCumple(detalles) {
    const email = detalles?.email;
    if (!email) {
        console.warn('Falta email en detalles de cumpleaños. No se envía email.');
        return;
    }
    let totalReserva = detalles.total;
    if (totalReserva !== null && totalReserva !== undefined && totalReserva !== '') {
        totalReserva = Number(totalReserva);
    } else {
        totalReserva = 0;
    }
    const totalFormato = totalReserva > 0 ? '$' + totalReserva : (detalles.total != null ? '$' + detalles.total : '$0');
    const instruccionesAth = 'Realiza el pago a través de ATH Móvil: Pay a business → YouandMeCenter';
    const nombreActividad = 'Celebración / Cumpleaños - ' + (detalles.nombreNino || '');
    await enviarEmailRelay({
        type: 'cumple',
        to_email: email,
        nombre_nino: detalles.nombreNino || '',
        nombre_actividad: nombreActividad,
        total: totalFormato,
        mensaje_pago: instruccionesAth,
    });
}

async function enviarEmailDecisionSolicitudFecha(email, nombreContacto, fechaStr, estado, comentario) {
    if (!email) return;
    await enviarEmailRelay({
        type: 'solicitud_fecha_decision',
        to_email: email,
        nombre_contacto: nombreContacto || '',
        fecha_solicitada: fechaStr || '',
        estado: estado === 'aprobada' ? 'aprobada' : 'rechazada',
        decision_mensaje: comentario || ''
    });
}

// ==================== PACIENTES ==================== (ya añadidos anteriormente)
// ... (se asume que las funciones de pacientes están aquí) ...

// ==================== APPOINTMENTS (CITAS) ====================

async function cargarCitasStaff() {
    if (!supabaseClient || !currentStaffSession) return;
    try {
        const { data, error } = await supabaseClient
            .from('appointments')
            .select('*')
            .order('date', { ascending: true });
        if (error) throw error;
        window.__appointmentsCache = data || [];
        renderizarCitasStaff();
    } catch (e) {
        console.error('Error cargando citas:', e);
        const cont = document.getElementById('appointmentsList');
        if (cont) cont.innerHTML = '<p style="color:#b91c1c; font-size:0.9rem;">No se pudieron cargar las citas.</p>';
    }
}

function renderizarCitasStaff() {
    const cont = document.getElementById('appointmentsList');
    if (!cont) return;
    const searchEl = document.getElementById('appointmentsSearch');
    const term = (searchEl?.value || '').toLowerCase();

    const lista = (window.__appointmentsCache || []).filter(a => {
        if (!term) return true;
        const txt = `${a.therapy_type || ''} ${a.therapist || ''} ${a.notes || ''}`.toLowerCase();
        return txt.includes(term);
    });

    if (!lista.length) {
        cont.innerHTML = '<p style="font-size:0.9rem; color:#6b7280;">No hay citas registradas.</p>';
        return;
    }

    cont.innerHTML = lista.map(a => {
        const fecha = a.date ? new Date(a.date).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
        const status =
            a.status === 'completed' ? 'Completada' :
            a.status === 'cancelled' ? 'Cancelada' : 'Programada';
        return `
        <div class="staff-card" style="margin-bottom:0.5rem; cursor:pointer;" data-appointment-id="${a.id}">
          <h4 style="margin-bottom:0.25rem;">${a.therapy_type || 'Cita'}</h4>
          <p style="font-size:0.85rem; color:#4b5563;"><strong>Terapeuta:</strong> ${a.therapist || '—'}</p>
          <p style="font-size:0.8rem; color:#6b7280; margin-top:0.15rem;">
            <strong>Fecha:</strong> ${fecha} · <strong>Estado:</strong> ${status}
          </p>
        </div>`;
    }).join('');

    cont.querySelectorAll('[data-appointment-id]').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.getAttribute('data-appointment-id');
            const a = (window.__appointmentsCache || []).find(x => x.id === id);
            if (a) cargarCitaEnFormulario(a);
        });
    });
}

function cargarCitaEnFormulario(a) {
    document.getElementById('appointmentId').value = a.id;
    document.getElementById('appointmentPatientId').value = a.patient_id || '';
    document.getElementById('appointmentTherapyType').value = a.therapy_type || '';
    document.getElementById('appointmentDate').value = a.date ? a.date.substring(0,16) : '';
    document.getElementById('appointmentTherapist').value = a.therapist || '';
    document.getElementById('appointmentStatus').value = a.status || 'scheduled';
    document.getElementById('appointmentNotes').value = a.notes || '';
    const statusEl = document.getElementById('appointmentFormStatus');
    if (statusEl) {
        statusEl.textContent = 'Editando cita existente.';
        statusEl.style.color = '#6b7280';
    }
}

async function guardarCitaDesdeFormulario(e) {
    e.preventDefault();
    if (!supabaseClient || !currentStaffSession) return;

    const id = document.getElementById('appointmentId').value || null;
    const patientId = document.getElementById('appointmentPatientId').value.trim() || null;
    const therapyType = document.getElementById('appointmentTherapyType').value.trim();
    const dateVal = document.getElementById('appointmentDate').value;
    const therapist = document.getElementById('appointmentTherapist').value.trim();
    const status = document.getElementById('appointmentStatus').value || 'scheduled';
    const notes = document.getElementById('appointmentNotes').value.trim();
    const statusEl = document.getElementById('appointmentFormStatus');

    if (!dateVal) {
        if (statusEl) {
            statusEl.textContent = 'La fecha y hora son obligatorias.';
            statusEl.style.color = '#b91c1c';
        }
        return;
    }

    const payload = {
        patient_id: patientId || null,
        therapy_type: therapyType || null,
        date: new Date(dateVal).toISOString(),
        therapist: therapist || null,
        status,
        notes: notes || null,
        updated_at: new Date().toISOString()
    };

    try {
        if (!id) {
            const { error } = await supabaseClient.from('appointments').insert([payload]);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.from('appointments').update(payload).eq('id', id);
            if (error) throw error;
        }
        if (statusEl) {
            statusEl.textContent = 'Cita guardada correctamente.';
            statusEl.style.color = '#16a34a';
        }
        document.getElementById('appointmentForm').reset();
        document.getElementById('appointmentId').value = '';
        await cargarCitasStaff();
        if (typeof staffCalendar !== 'undefined' && staffCalendar) {
            staffCalendar.refetchEvents();
        }
    } catch (e) {
        console.error('Error guardando cita:', e);
        if (statusEl) {
            statusEl.textContent = 'No se pudo guardar la cita.';
            statusEl.style.color = '#b91c1c';
        }
    }
}

async function eliminarCita(id) {
    if (!supabaseClient || !id) return;
    try {
        const { error } = await supabaseClient.from('appointments').delete().eq('id', id);
        if (error) throw error;
        await cargarCitasStaff();
        if (typeof staffCalendar !== 'undefined' && staffCalendar) {
            staffCalendar.refetchEvents();
        }
    } catch (e) {
        console.error('Error eliminando cita:', e);
        alert('No se pudo eliminar la cita.');
    }
}

async function cargarContactosStaffPortal() {
    if (!supabaseClient) return [];
    const targetEmails = STAFF_PORTAL_CONTACTS.map(c => c.email);
    const byId = new Map();

    try {
        const { data: staffRows } = await supabaseClient
            .from('staff_members')
            .select('id, email, role, display_name')
            .in('email', targetEmails);
        (staffRows || []).forEach(r => {
            if (!r?.id || !r?.email) return;
            const normalized = String(r.email).toLowerCase().trim();
            const base = STAFF_PORTAL_CONTACTS.find(c => c.email === normalized);
            byId.set(r.id, {
                id: r.id,
                email: normalized,
                role: r.role || base?.role || null,
                label: r.display_name || base?.label || normalized
            });
        });
    } catch (_) { /* fallback con profiles */ }

    if (byId.size < targetEmails.length) {
        try {
            const { data: profileRows } = await supabaseClient
                .from('profiles')
                .select('id, email, role')
                .in('email', targetEmails);
            (profileRows || []).forEach(r => {
                if (!r?.id || !r?.email || byId.has(r.id)) return;
                const normalized = String(r.email).toLowerCase().trim();
                const base = STAFF_PORTAL_CONTACTS.find(c => c.email === normalized);
                byId.set(r.id, {
                    id: r.id,
                    email: normalized,
                    role: r.role || base?.role || null,
                    label: base?.label || normalized
                });
            });
        } catch (_) { /* ignore */ }
    }

    return Array.from(byId.values());
}

async function cargarRolStaffYActualizarUI() {
    if (!supabaseClient || !currentStaffSession) {
        return;
    }
    const email = (currentStaffSession.user.email || '').toLowerCase().trim();
    // Roles correctos por email (centro = admin, asistente = secretary) - usa lib/roles.js si está cargado
    if (typeof window.getRoleFromEmail === 'function') {
        const roleFromLib = window.getRoleFromEmail(currentStaffSession.user.email);
        if (roleFromLib) currentStaffRole = roleFromLib;
    }
    if (!currentStaffRole) {
        const roleByEmail = rolePorEmailStaff(email);
        if (roleByEmail) {
            currentStaffRole = roleByEmail;
        } else {
            try {
                const { data: staffData } = await supabaseClient
                    .from('staff_members')
                    .select('role')
                    .eq('id', currentStaffSession.user.id)
                    .maybeSingle();
                currentStaffRole = staffData?.role || null;
            } catch (_) { /* fallback a profiles */ }
            if (!currentStaffRole) {
                try {
                    const { data, error } = await supabaseClient
                        .from('profiles')
                        .select('role')
                        .eq('id', currentStaffSession.user.id)
                        .maybeSingle();
                    if (error) throw error;
                    currentStaffRole = data?.role || null;
                } catch (e) {
                    console.error('Error cargando rol de staff:', e);
                    currentStaffRole = null;
                }
            }
        }
    }
    actualizarUIStaff();
}

function actualizarUIStaff() {
    const loggedOut = document.getElementById('staffLoggedOut');
    const loggedIn = document.getElementById('staffLoggedIn');
    const welcome = document.getElementById('staffWelcome');
    const backToAdminBtn = document.getElementById('backToAdminBtn');

    if (!loggedOut || !loggedIn) return;

    if (!currentStaffSession) {
        loggedOut.style.display = '';
        loggedIn.style.display = 'none';
        if (backToAdminBtn) backToAdminBtn.style.display = 'none';
        return;
    }

    loggedOut.style.display = 'none';
    loggedIn.style.display = '';

    const email = currentStaffSession.user.email || '';
    const rol = currentStaffRole || 'secretary';
    if (welcome) {
        welcome.textContent = email ? `Sesión: ${email} (${rol})` : `Sesión (${rol})`;
    }

    // Mostrar acceso rápido al panel de administración solo para admin
    if (backToAdminBtn) {
        if (currentStaffRole === 'admin') {
            backToAdminBtn.style.display = '';
            backToAdminBtn.onclick = () => navigateToPage('admin');
        } else {
            backToAdminBtn.style.display = 'none';
            backToAdminBtn.onclick = null;
        }
    }

    cargarResumenDashboardStaff().catch((e) => {
        console.error('Error cargando resumen de dashboard:', e);
    });

    // Scheduler de recordatorios por vencimiento de referidos (1 vez al día)
    ejecutarSchedulerReferidos().catch((e) => {
        console.error('Error ejecutando scheduler de referidos:', e);
    });
}

function requireStaffRole(requiredRoles = []) {
    if (typeof window.requireStaffRoleCheck === 'function') {
        const r = window.requireStaffRoleCheck(currentStaffSession, currentStaffRole, requiredRoles);
        if (!r.allowed) {
            if (r.reason === 'no_session') alert('Debe iniciar sesión de staff para acceder.');
            else alert('No tiene permisos para acceder a esta sección.');
            window.location.hash = '#staff';
            return false;
        }
        return true;
    }
    if (!currentStaffSession) {
        alert('Debe iniciar sesión de staff para acceder.');
        window.location.hash = '#staff';
        return false;
    }
    if (requiredRoles.length > 0 && !requiredRoles.includes(currentStaffRole)) {
        alert('No tiene permisos para acceder a esta sección.');
        window.location.hash = '#staff';
        return false;
    }
    return true;
}

async function cargarResumenDashboardStaff() {
    if (!supabaseClient || !currentStaffSession) return;

    const uid = currentStaffSession.user.id;
    const hoyISO = obtenerHoyISO();

    let tareasHoy = 0;
    let mensajesSinLeer = 0;

    try {
        const [tareasRes, mensajesRes] = await Promise.all([
            supabaseClient
                .from('tasks')
                .select('id, due_date, description, status')
                .or(`assigned_to.eq.${uid},created_by.eq.${uid}`)
                .in('status', ['pending', 'in_progress']),
            supabaseClient
                .from('messages')
                .select('id')
                .eq('receiver_id', uid)
                .eq('read_status', false)
        ]);

        if (!tareasRes.error && Array.isArray(tareasRes.data)) {
            const tareasValidas = await filtrarTareasReferidosStale(tareasRes.data);
            tareasHoy = tareasValidas.filter(t => {
                const dueISO = normalizarFechaISO(t.due_date);
                if (!dueISO) return false;
                const activeISO = dueISO > hoyISO ? dueISO : hoyISO;
                return activeISO === hoyISO;
            }).length;
        }
        if (!mensajesRes.error && Array.isArray(mensajesRes.data)) mensajesSinLeer = mensajesRes.data.length;
    } catch (e) {
        console.error('Error consultando resumen de dashboard:', e);
    }

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };
    setText('dashTasksTodayCount', tareasHoy);
    setText('dashUnreadMessagesCount', mensajesSinLeer);
}

function inicializarStaffPortal() {
    const form = document.getElementById('staffLoginForm');
    const logoutBtn = document.getElementById('staffLogoutBtn');
    const errorEl = document.getElementById('staffLoginError');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient) return;
            const emailInput = document.getElementById('staffEmail');
            const passwordInput = document.getElementById('staffPassword');
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            try {
                if (errorEl) errorEl.style.display = 'none';
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) {
                    if (errorEl) {
                        errorEl.textContent = `No se pudo iniciar sesión: ${error?.message || 'credenciales inválidas'}`;
                        errorEl.style.display = 'block';
                    }
                    return;
                }
                window.location.hash = '#staff-dashboard';
            } catch (err) {
                console.error('Error login staff:', err);
                if (errorEl) {
                    errorEl.textContent = `Ocurrió un error al iniciar sesión: ${err?.message || 'desconocido'}`;
                    errorEl.style.display = 'block';
                }
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!supabaseClient) return;
            await supabaseClient.auth.signOut();
            window.location.hash = '#inicio';
        });
    }

    // Navegación lateral del dashboard
    const navItems = document.querySelectorAll('.staff-nav-item');
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.getAttribute('data-section');
            if (!section) return;
            navItems.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mostrarSeccionStaff(section);
        });
    });

    const activarNavSection = (section) => {
        const navItems = document.querySelectorAll('.staff-nav-item');
        navItems.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-section') === section);
        });
        mostrarSeccionStaff(section);
    };

    document.querySelectorAll('.staff-dash-card[data-click]').forEach(card => {
        card.addEventListener('click', () => {
            const section = card.getAttribute('data-click');
            if (section) activarNavSection(section);
        });
    });

    window.addEventListener('hashchange', manejarRutasStaff);
    manejarRutasStaff();
}

function mostrarSeccionStaff(section) {
    const allSections = document.querySelectorAll('.staff-section');
    allSections.forEach(s => {
        if (s.getAttribute('data-staff-section') === section) {
            s.style.display = '';
        } else {
            s.style.display = 'none';
        }
    });

    const titleEl = document.getElementById('staffSectionTitle');
    const subtitleEl = document.querySelector('.staff-section-subtitle');
    const calendarControls = document.getElementById('staffCalendarHeaderControls');
    if (!titleEl || !subtitleEl) return;

    const map = {
        dashboard: { title: 'Dashboard', subtitle: 'Resumen: tareas de hoy y mensajes sin leer.' },
        tasks: { title: 'Tareas', subtitle: 'Crear, asignar y marcar tareas como completadas.' },
        calendar: { title: 'Calendario', subtitle: 'Tareas con fecha límite. Clic para editar.' },
        referrals: { title: 'Referidos', subtitle: 'Vencimientos de referidos + recordatorios automáticos.' },
        messages: { title: 'Mensajes', subtitle: 'Comunicación entre todo el staff.' }
    };

    const info = map[section] || map.dashboard;
    titleEl.textContent = info.title;
    if (subtitleEl) subtitleEl.textContent = info.subtitle;

    if (calendarControls) {
        calendarControls.style.display = section === 'calendar' ? 'flex' : 'none';
    }

    if (section === 'tasks') {
        cargarOpcionesAsignarTareas().catch(() => { /* ignore */ });
        cargarTareasStaff();
    }
    else if (section === 'messages') cargarConversacionesStaff();
    else if (section === 'calendar') inicializarStaffCalendar();
    else if (section === 'referrals') {
        cargarPacientesReferidos().catch(() => { /* ignore */ });
        inicializarStaffReferralsCalendar();
    }
}

function manejarRutasStaff() {
    const hash = window.location.hash || '#inicio';
    if (hash === '#staff' || hash === '#staff-dashboard') {
        if (!requireStaffRole([])) return;
    }
}

// ==================== STAFF PORTAL: TAREAS, MENSAJES, CALENDARIO ====================
let staffCalendar = null;
let staffTasksCache = [];
let staffReferralsCalendar = null;
let staffReferralsCache = [];
const REFERRAL_PATIENT_NEW_OPTION_VALUE = '__new__';
let __referralReminderSchedulerLastRunISO = null;

function formatoDiaLargoES(date) {
    try {
        // Evita corrimientos de un día al parsear cadenas YYYY-MM-DD en Safari/Chrome.
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const [y, m, d] = date.split('-').map(Number);
            return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('es-PR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        return new Date(date).toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch (_) {
        return String(date);
    }
}

function obtenerHoyISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function normalizarFechaISO(dateStr) {
    if (!dateStr) return null;
    if (typeof dateStr === 'string') {
        const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatearFechaCorta(dateStr) {
    const iso = normalizarFechaISO(dateStr);
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).toLocaleDateString('es-PR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatearHorarioTarea(dateStr) {
    if (!dateStr) return 'Sin horario';
    if (typeof dateStr === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Sin horario';
        if (/T12:00:00(\.000)?Z$/.test(dateStr)) return 'Sin horario';
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Sin horario';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (hh === '00' && mm === '00') return 'Sin horario';
    return `${hh}:${mm}`;
}

function sumarDiasISO(dateISO, deltaDays) {
    const iso = normalizarFechaISO(dateISO);
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    // Usar UTC evita corrimientos por zona horaria.
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    return dt.toISOString().slice(0, 10);
}

async function cargarOpcionesAsignarTareas() {
    const select = document.getElementById('taskAssigneeSelect');
    if (!select || !supabaseClient || !currentStaffSession) return;

    const staffRows = await cargarContactosStaffPortal();

    const currentEmpty = select.querySelector('option[value=""]');
    select.innerHTML = '';
    if (currentEmpty) select.appendChild(currentEmpty);

    (staffRows || []).forEach(s => {
        if (!s?.email) return;
        const opt = document.createElement('option');
        opt.value = s.email.toLowerCase().trim();
        opt.textContent = s.label || s.display_name || opt.value;
        select.appendChild(opt);
    });
}

async function cargarPacientesReferidos() {
    if (!supabaseClient || !currentStaffSession) return [];
    const { data, error } = await supabaseClient
        .from('referral_patients')
        .select('id, patient_name, referral_expires_on, comentarios_admin')
        .order('referral_expires_on', { ascending: true });
    if (error) throw error;
    staffReferralsCache = data || [];
    cargarOpcionesPacienteReferidoDropdown();
    renderizarListaPacientesReferidos();
    return staffReferralsCache;
}

function cargarOpcionesPacienteReferidoDropdown() {
    const selectEl = document.getElementById('referralPatientSelect');
    if (!selectEl) return;

    const currentValue = selectEl.value;
    selectEl.innerHTML = '<option value="">Seleccione paciente</option>';

    (staffReferralsCache || []).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        const expISO = normalizarFechaISO(p.referral_expires_on);
        const expText = expISO ? formatearFechaCorta(expISO) : '';
        opt.textContent = expText ? `${p.patient_name} (vence ${expText})` : p.patient_name;
        selectEl.appendChild(opt);
    });

    const optNew = document.createElement('option');
    optNew.value = REFERRAL_PATIENT_NEW_OPTION_VALUE;
    optNew.textContent = '+ Nuevo paciente';
    selectEl.appendChild(optNew);

    if (currentValue && Array.from(selectEl.options).some(o => o.value === currentValue)) {
        selectEl.value = currentValue;
    }

    const customGroup = document.getElementById('referralPatientCustomGroup');
    const customInput = document.getElementById('referralPatientNameCustom');
    const showNew = selectEl.value === REFERRAL_PATIENT_NEW_OPTION_VALUE;
    if (customGroup) customGroup.style.display = showNew ? '' : 'none';
    if (customInput && !showNew) customInput.value = '';
}

function renderizarListaPacientesReferidos() {
    const listEl = document.getElementById('staffReferralsPatientsList');
    if (!listEl) return;

    const items = staffReferralsCache || [];
    if (items.length === 0) {
        listEl.innerHTML = `
          <div style="padding:0.9rem; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; color:#6b7280; font-size:0.9rem;">
            Todavía no hay pacientes cargados.
          </div>
        `;
        return;
    }

    listEl.innerHTML = items.map(p => {
        const expISO = normalizarFechaISO(p.referral_expires_on);
        const expText = expISO ? formatearFechaCorta(expISO) : '—';
        return `
          <div style="border:1px solid #e5e7eb; border-radius:10px; padding:0.7rem; display:flex; justify-content:space-between; gap:0.75rem; align-items:flex-start; flex-wrap:wrap;">
            <div style="min-width:0;">
              <div style="font-weight:800; color:#111827; word-break:break-word;">${escaparHtml(p.patient_name || 'Paciente')}</div>
              <div style="font-size:0.85rem; color:#6b7280; margin-top:0.2rem;">Vence: ${escaparHtml(expText)}</div>
            </div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
              <button type="button" class="btn btn-secondary" data-referral-list-edit-id="${escaparHtml(p.id)}" style="padding:0.35rem 0.7rem;">Editar</button>
              <button type="button" class="btn btn-secondary" data-referral-list-delete-id="${escaparHtml(p.id)}" style="padding:0.35rem 0.7rem; background:#f97373; border-color:#f97373; color:#fff;">Borrar</button>
            </div>
          </div>
        `;
    }).join('');
}

function cargarPacienteReferidoEnFormulario(p) {
    const idEl = document.getElementById('referralPatientId');
    const selectEl = document.getElementById('referralPatientSelect');
    const expiresEl = document.getElementById('referralExpiresOn');
    const customGroup = document.getElementById('referralPatientCustomGroup');
    const customInput = document.getElementById('referralPatientNameCustom');
    if (!idEl || !selectEl || !expiresEl) return;

    idEl.value = p?.id || '';
    selectEl.value = p?.id || '';
    if (customGroup) customGroup.style.display = 'none';
    if (customInput) customInput.value = '';
    expiresEl.value = p?.referral_expires_on ? normalizarFechaISO(p.referral_expires_on) : '';
    const statusEl = document.getElementById('referralFormStatus');
    if (statusEl) statusEl.textContent = 'Editando. Guarda para aplicar cambios.';
}

function limpiarFormularioReferidos() {
    const form = document.getElementById('referralPatientForm');
    if (!form) return;
    form.reset();
    const statusEl = document.getElementById('referralFormStatus');
    if (statusEl) statusEl.textContent = '';
    const idEl = document.getElementById('referralPatientId');
    if (idEl) idEl.value = '';
    const selectEl = document.getElementById('referralPatientSelect');
    if (selectEl) selectEl.value = '';
    const customGroup = document.getElementById('referralPatientCustomGroup');
    if (customGroup) customGroup.style.display = 'none';
    const customInput = document.getElementById('referralPatientNameCustom');
    if (customInput) customInput.value = '';
}

function asegurarModalDetalleReferido() {
    let modal = document.getElementById('staffReferralQuickModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'staffReferralQuickModal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:2000; background:rgba(15,23,42,0.45); padding:1rem; overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:720px; margin:3rem auto; background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:0.95rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
          <div>
            <h4 id="staffReferralModalTitle" style="margin:0; font-size:1.05rem;">Detalle de referido</h4>
            <p id="staffReferralModalMeta" style="margin:0.25rem 0 0 0; font-size:0.85rem; color:#6b7280;"></p>
          </div>
          <button type="button" class="btn btn-secondary" id="staffReferralModalCloseBtn" style="padding:0.35rem 0.7rem;">Cerrar</button>
        </div>

        <div style="margin-top:0.85rem; display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div>
            <label style="display:block; font-size:0.82rem; color:#6b7280; margin-bottom:0.25rem;">Paciente</label>
            <input type="text" id="staffReferralModalPatientName" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.95rem;" />
          </div>
          <div>
            <label style="display:block; font-size:0.82rem; color:#6b7280; margin-bottom:0.25rem;">Vencimiento</label>
            <input type="date" id="staffReferralModalExpiresOn" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.95rem;" />
          </div>
        </div>

        <div style="margin-top:0.85rem;">
          <label style="display:block; font-size:0.82rem; color:#6b7280; margin-bottom:0.25rem;">Comentarios</label>
          <textarea id="staffReferralModalComments" rows="4" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.95rem;"></textarea>
        </div>

        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.85rem;">
          <button type="button" class="btn btn-primary" id="staffReferralModalSaveBtn">Guardar</button>
          <button type="button" class="btn btn-secondary" id="staffReferralModalDeleteBtn" style="background:#f97373; border-color:#f97373; color:#fff;">Borrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function cerrarModalDetalleReferido() {
    const modal = document.getElementById('staffReferralQuickModal');
    if (modal) modal.style.display = 'none';
}

function abrirModalDetalleReferido(p) {
    if (!p) return;
    const modal = asegurarModalDetalleReferido();
    modal.style.display = 'block';
    modal.setAttribute('data-referral-id', p.id || '');

    const titleEl = document.getElementById('staffReferralModalTitle');
    const metaEl = document.getElementById('staffReferralModalMeta');
    const nameEl = document.getElementById('staffReferralModalPatientName');
    const expiresEl = document.getElementById('staffReferralModalExpiresOn');
    const commentsEl = document.getElementById('staffReferralModalComments');

    if (titleEl) titleEl.textContent = `Detalle de referido: ${p.patient_name || ''}`;
    const fecha = p.referral_expires_on ? formatearFechaCorta(p.referral_expires_on) : '—';
    if (metaEl) metaEl.textContent = `Vence: ${fecha}`;
    if (nameEl) nameEl.value = p.patient_name || '';
    if (expiresEl) expiresEl.value = p.referral_expires_on ? normalizarFechaISO(p.referral_expires_on) : '';
    if (commentsEl) commentsEl.value = p.comentarios_admin || '';
}

document.addEventListener('click', async (e) => {
    // Acciones rápidas desde la lista de pacientes existentes
    const listEditBtn = e.target?.closest?.('[data-referral-list-edit-id]');
    if (listEditBtn) {
        const referralId = listEditBtn.getAttribute('data-referral-list-edit-id') || '';
        const p = (staffReferralsCache || []).find(x => String(x.id) === String(referralId));
        if (p) {
            cargarPacienteReferidoEnFormulario(p);
            abrirModalDetalleReferido(p);
        }
        return;
    }

    const listDeleteBtn = e.target?.closest?.('[data-referral-list-delete-id]');
    if (listDeleteBtn) {
        const referralId = listDeleteBtn.getAttribute('data-referral-list-delete-id') || '';
        if (!referralId) return;
        const ok = window.confirm('¿Borrar este paciente referido? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
            const { error } = await supabaseClient.from('referral_patients').delete().eq('id', referralId);
            if (error) throw error;

            await supabaseClient.from('tasks')
                .delete()
                .ilike('description', `%reminder_type=reminder|referral_patient_id=${referralId}%`);

            cerrarModalDetalleReferido();
            limpiarFormularioReferidos();
            await cargarPacientesReferidos();
            if (staffReferralsCalendar) staffReferralsCalendar.refetchEvents();
            if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            await cargarTareasStaff();
            await cargarResumenDashboardStaff();
        } catch (err) {
            console.error('Error borrando referido (lista):', err);
        }
        return;
    }

    const modal = document.getElementById('staffReferralQuickModal');
    if (!modal || modal.style.display === 'none') return;

    if (e.target === modal || e.target?.closest?.('#staffReferralModalCloseBtn')) {
        cerrarModalDetalleReferido();
        return;
    }

    const referralId = modal.getAttribute('data-referral-id') || '';
    if (!referralId) return;

    const saveBtn = e.target?.closest?.('#staffReferralModalSaveBtn');
    if (saveBtn) {
        const name = document.getElementById('staffReferralModalPatientName')?.value?.trim() || '';
        const expiresOnRaw = document.getElementById('staffReferralModalExpiresOn')?.value || '';
        const expiresISO = normalizarFechaISO(expiresOnRaw);
        const comments = document.getElementById('staffReferralModalComments')?.value?.trim() || null;
        if (!name || !expiresISO) return;

        try {
            const { error } = await supabaseClient
                .from('referral_patients')
                .update({ patient_name: name, referral_expires_on: expiresISO, comentarios_admin: comments })
                .eq('id', referralId);
            if (error) throw error;

            cerrarModalDetalleReferido();
            await cargarPacientesReferidos();
            if (staffReferralsCalendar) staffReferralsCalendar.refetchEvents();
            document.getElementById('referralPatientId') && cargarPacienteReferidoEnFormulario(staffReferralsCache.find(x => x.id === referralId));
        } catch (err) {
            console.error('Error guardando referido (modal):', err);
        }
        return;
    }

    const deleteBtn = e.target?.closest?.('#staffReferralModalDeleteBtn');
    if (deleteBtn) {
        const ok = window.confirm('¿Borrar este referido? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
            const { error } = await supabaseClient.from('referral_patients').delete().eq('id', referralId);
            if (error) throw error;

            const { error: tasksDelErr } = await supabaseClient
                .from('tasks')
                .delete()
                .ilike('description', `%reminder_type=reminder|referral_patient_id=${referralId}%`);
            if (tasksDelErr) {
                console.warn('No se pudieron borrar tasks recordatorios del referido:', tasksDelErr?.message || tasksDelErr);
                alert('No se pudieron borrar algunos to-dos del referido (permisos). Se ocultarán del calendario igualmente.');
            }

            cerrarModalDetalleReferido();
            // Refresca para ocultar reminders aunque no hayan podido borrarse por RLS.
            await cargarTareasStaff();
            await cargarResumenDashboardStaff();
            if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            await cargarPacientesReferidos();
            if (staffReferralsCalendar) staffReferralsCalendar.refetchEvents();
            limpiarFormularioReferidos();
        } catch (err) {
            console.error('Error borrando referido (modal):', err);
        }
        return;
    }
});

async function inicializarStaffReferralsCalendar() {
    const el = document.getElementById('staffReferralsCalendar');
    if (!el || typeof FullCalendar === 'undefined') return;
    if (staffReferralsCalendar) {
        staffReferralsCalendar.refetchEvents();
        return;
    }

    staffReferralsCalendar = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next', center: 'title', right: '' },
        locale: 'es',
        selectable: false,
        events: async (info, successCallback) => {
            try {
                // Cargar una vez si no hay cache.
                if (!Array.isArray(staffReferralsCache) || staffReferralsCache.length === 0) {
                    await cargarPacientesReferidos();
                }

                const startISO = normalizarFechaISO(info.startStr);
                const endISO = normalizarFechaISO(info.endStr);
                const events = (staffReferralsCache || []).map(r => {
                    const expISO = normalizarFechaISO(r.referral_expires_on);
                    if (!expISO) return null;
                    // Solo pintar dentro del rango visible (endStr es fin exclusivo).
                    if (startISO && endISO && expISO < startISO) return null;
                    if (startISO && endISO && expISO >= endISO) return null;
                    return {
                        id: r.id,
                        title: r.patient_name || 'Paciente',
                        start: expISO,
                        allDay: true,
                        extendedProps: { referralPatientId: r.id }
                    };
                }).filter(Boolean);

                successCallback(events);
            } catch (e) {
                console.error('Error cargando calendario de referidos:', e);
                successCallback([]);
            }
        },
        eventClick: (arg) => {
            const referralId = arg.event.extendedProps?.referralPatientId || arg.event.id;
            const p = (staffReferralsCache || []).find(x => x.id === referralId);
            if (p) {
                cargarPacienteReferidoEnFormulario(p);
                abrirModalDetalleReferido(p);
            }
        }
    });

    staffReferralsCalendar.render();
}

async function ejecutarSchedulerReferidos() {
    if (!supabaseClient || !currentStaffSession) return;
    const hoyISO = obtenerHoyISO();
    if (__referralReminderSchedulerLastRunISO === hoyISO) return;
    __referralReminderSchedulerLastRunISO = hoyISO;

    // Ventana: crear recordatorios dentro de +/- unos días alrededor de hoy.
    const reminderBackDays = 14;
    const reminderForwardDays = 1;
    const reminderStartISO = sumarDiasISO(hoyISO, -reminderBackDays);
    const reminderEndISO = sumarDiasISO(hoyISO, reminderForwardDays);
    if (!reminderStartISO || !reminderEndISO) return;

    // Traer staff (para asignar cada reminder).
    const { data: staffRows, error: staffErr } = await supabaseClient
        .from('staff_members')
        .select('id');
    if (staffErr) throw staffErr;
    const staffIds = (staffRows || []).map(r => r.id).filter(Boolean);
    if (staffIds.length === 0) return;

    // Traer referidos cuyos vencimientos caerán cerca del rango de reminders.
    // Reminder = expires_on - 7 días.
    const startExpiresISO = sumarDiasISO(reminderStartISO, 7);
    const endExpiresISO = sumarDiasISO(reminderEndISO, 7);
    if (!startExpiresISO || !endExpiresISO) return;

    const { data: referralRows, error: refErr } = await supabaseClient
        .from('referral_patients')
        .select('id, patient_name, referral_expires_on')
        .gte('referral_expires_on', startExpiresISO)
        .lte('referral_expires_on', endExpiresISO);
    if (refErr) throw refErr;

    if (!Array.isArray(referralRows) || referralRows.length === 0) return;

    // Cargar jobs existentes para evitar duplicados.
    const { data: jobs, error: jobsErr } = await supabaseClient
        .from('referral_reminder_jobs')
        .select('referral_patient_id, reminder_due_on')
        .gte('reminder_due_on', reminderStartISO)
        .lte('reminder_due_on', reminderEndISO);
    if (jobsErr) throw jobsErr;

    const jobKeySet = new Set((jobs || []).map(j => `${j.referral_patient_id}|${normalizarFechaISO(j.reminder_due_on)}`));

    const nowISO = new Date().toISOString();

    // Crear reminders faltantes.
    for (const r of referralRows) {
        const expiresISO = normalizarFechaISO(r.referral_expires_on);
        if (!expiresISO) continue;
        const reminderDueISO = sumarDiasISO(expiresISO, -7);
        if (!reminderDueISO) continue;

        if (reminderDueISO < reminderStartISO || reminderDueISO > reminderEndISO) continue;

        const key = `${r.id}|${reminderDueISO}`;
        if (jobKeySet.has(key)) continue;

        // Insertar job primero para evitar duplicados (único en la tabla).
        try {
            const { error: jobInsErr } = await supabaseClient
                .from('referral_reminder_jobs')
                .insert([{
                    referral_patient_id: r.id,
                    reminder_due_on: reminderDueISO,
                    created_by: currentStaffSession.user.id
                }]);
            if (jobInsErr) throw jobInsErr;
            jobKeySet.add(key);
        } catch (e) {
            console.warn('No se pudo insertar job de reminder (probable duplicado):', e?.message || e);
            continue;
        }

        const expiresDisplay = formatearFechaCorta(expiresISO);
        const title = `Avisar a padres de ${r.patient_name} que el referido vencerá ${expiresDisplay}`;
        const description = `reminder_type=reminder|referral_patient_id=${r.id}`;
        const dueDateUTC = `${reminderDueISO}T12:00:00.000Z`;

        const tasksBatch = staffIds.map(staffId => ({
            title,
            description,
            priority: 'low',
            due_date: dueDateUTC,
            status: 'pending',
            created_by: staffId,
            assigned_to: staffId,
            updated_at: nowISO
        }));

        // Insertar por lotes (4 staff).
        try {
            const { error: taskErr } = await supabaseClient.from('tasks').insert(tasksBatch);
            if (taskErr) throw taskErr;
        } catch (e) {
            console.error('Error insertando tareas reminder:', e);
        }
    }

    // Refrescar UI relevante.
    try {
        cargarResumenDashboardStaff();
        if (document.querySelector('.staff-section[data-staff-section="tasks"]')?.style?.display !== 'none') {
            cargarTareasStaff();
        }
        if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
    } catch (_) { /* ignore */ }
}

async function obtenerTareasParaDia(dateStr) {
    const dayISO = normalizarFechaISO(dateStr);
    if (!dayISO) return [];
    const todayISO = obtenerHoyISO();

    if (Array.isArray(staffTasksCache) && staffTasksCache.length > 0) {
        // Tareas no completadas: solo aparecen en su "día activo" (due_date o, si venció, hoy).
        return staffTasksCache.filter(t => {
            if (!t || t.status === 'completed') return false;
            const dueISO = normalizarFechaISO(t.due_date);
            if (!dueISO) return false;
            const activeISO = dueISO > todayISO ? dueISO : todayISO;
            return activeISO === dayISO;
        });
    }

    const uid = currentStaffSession?.user?.id;
    if (!uid) return [];
    if (!supabaseClient) return [];

    try {
        const { data, error } = await supabaseClient
            .from('tasks')
            .select('id, title, description, due_date, priority, status')
            .not('due_date', 'is', null)
            .neq('status', 'completed')
            .or(`assigned_to.eq.${uid},created_by.eq.${uid}`)
            .order('priority', { ascending: false })
            .order('title', { ascending: true });
        if (error) throw error;
        // Filtro por "día activo único": due_date (si aún no vence) o hoy (si ya venció).
        const tareasActivas = (data || []).filter(t => {
            const dueISO = normalizarFechaISO(t.due_date);
            if (!dueISO || t.status === 'completed') return false;
            const activeISO = dueISO > todayISO ? dueISO : todayISO;
            return activeISO === dayISO;
        });
        return await filtrarTareasReferidosStale(tareasActivas);
    } catch (e) {
        console.error('Error obteniendo tareas del día:', e);
        return [];
    }
}

function abrirDesgloseDia() {
    const box = document.getElementById('staffDayBreakdown');
    if (box) box.style.display = 'block';
}

function cerrarDesgloseDia() {
    const box = document.getElementById('staffDayBreakdown');
    if (box) box.style.display = 'none';
}

function escaparHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function limpiarDescripcionInternaParaMostrar(desc) {
    if (!desc) return '';
    let cleaned = String(desc);
    cleaned = cleaned.replace(/reminder_type=reminder\|referral_patient_id=[^\n\r]*/g, '');
    cleaned = cleaned.replace(/reservation_type=(cumple|evento)\|reservation_id=[^\n\r]*/g, '');
    return cleaned.trim();
}

function extraerReferralIdDeReminder(desc) {
    if (!desc) return null;
    const m = String(desc).match(/reminder_type=reminder\|referral_patient_id=([^\n\r]*)/);
    const id = m?.[1]?.trim() || '';
    return id || null;
}

async function filtrarTareasReferidosStale(tareas) {
    if (!supabaseClient || !Array.isArray(tareas) || tareas.length === 0) return tareas;

    const referralIds = Array.from(new Set(
        tareas.map(t => extraerReferralIdDeReminder(t?.description))
            .filter(Boolean)
    ));
    if (referralIds.length === 0) return tareas;

    try {
        const { data: rows, error } = await supabaseClient
            .from('referral_patients')
            .select('id')
            .in('id', referralIds);
        if (error) throw error;

        const existSet = new Set((rows || []).map(r => String(r.id)));
        return tareas.filter(t => {
            const rid = extraerReferralIdDeReminder(t?.description);
            if (!rid) return true;
            return existSet.has(String(rid));
        });
    } catch (e) {
        console.warn('No se pudieron filtrar tareas con referidos:', e);
        return tareas;
    }
}

function renderizarDesgloseDia(dateStr, tasks) {
    const titleEl = document.getElementById('staffDayBreakdownTitle');
    const subtitleEl = document.getElementById('staffDayBreakdownSubtitle');
    const contentEl = document.getElementById('staffDayBreakdownContent');
    if (!titleEl || !subtitleEl || !contentEl) return;

    titleEl.textContent = `Desglose: ${formatoDiaLargoES(dateStr)}`;
    const total = tasks.length;
    subtitleEl.textContent = total === 0 ? 'No hay tareas con fecha límite para este día.' : `${total} tarea(s) con fecha límite.`;

    const tasksHtml = total === 0 ? '' : tasks.map(t => {
        const priority = t.priority || 'medium';
        const status = t.status || 'pending';
        const badgeColor = prioridadColor(priority);
        const statusLabel = status === 'completed' ? 'Completada' : status === 'in_progress' ? 'En progreso' : 'Pendiente';
        const desc = limpiarDescripcionInternaParaMostrar(t.description);
        return `
          <div class="staff-day-task-item" data-task-id="${escaparHtml(t.id)}" role="button" style="cursor:pointer; display:flex; align-items:flex-start; justify-content:space-between; gap:0.75rem; padding:0.75rem; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:0.6rem;">
            <div style="min-width:0;">
              <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; color:#fff; padding:0.15rem 0.5rem; border-radius:999px; background:${badgeColor};">
                  ${escaparHtml(priority.toUpperCase())}
                </span>
                <span style="font-size:0.78rem; color:#6b7280;">${escaparHtml(statusLabel)}</span>
              </div>
              <div style="margin-top:0.25rem; font-weight:700; color:#111827; word-break:break-word;">${escaparHtml(t.title || 'Tarea')}</div>
              ${desc ? `<div style="margin-top:0.25rem; color:#4b5563; font-size:0.88rem; white-space:pre-wrap; word-break:break-word;">${escaparHtml(desc)}</div>` : ''}
            </div>
            <div style="flex:0 0 auto; display:flex; gap:0.5rem;">
              <button type="button" class="btn btn-secondary staff-day-edit-btn" data-task-id="${escaparHtml(t.id)}" style="padding:0.45rem 0.8rem;">Editar</button>
            </div>
          </div>
        `;
    }).join('');

    const addTaskBtnEl = `
      <div style="margin-top:0.75rem; padding:0.75rem; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; color:#6b7280; font-size:0.9rem;">
        ${total === 0 ? `<div style="margin-bottom:0.6rem;">Ninguna tarea para este día.</div>` : ''}
        <button type="button" class="btn btn-primary" id="staffAddTaskForDayBtn" data-day="${escaparHtml(dateStr)}">
          Agregar tarea para este día
        </button>
      </div>
    `;

    contentEl.innerHTML = (tasksHtml || '') + addTaskBtnEl;
}

async function mostrarDesgloseParaFecha(dateStr) {
    abrirDesgloseDia();
    const subtitleEl = document.getElementById('staffDayBreakdownSubtitle');
    const contentEl = document.getElementById('staffDayBreakdownContent');
    const titleEl = document.getElementById('staffDayBreakdownTitle');
    if (titleEl) titleEl.textContent = `Desglose: ${formatoDiaLargoES(dateStr)}`;
    if (subtitleEl) subtitleEl.textContent = 'Cargando tareas…';
    if (contentEl) contentEl.innerHTML = '';
    const tasks = await obtenerTareasParaDia(dateStr);
    renderizarDesgloseDia(dateStr, tasks);
}

async function abrirVistaDetalleDiaCompleta(dateStr) {
    const calEl = document.getElementById('staffCalendar');
    const dayScreen = document.getElementById('staffTodayDetailScreen');
    const titleEl = document.getElementById('staffTodayDetailTitle');
    const subtitleEl = document.getElementById('staffTodayDetailSubtitle');
    const contentEl = document.getElementById('staffTodayDetailContent');
    if (!calEl || !dayScreen || !titleEl || !subtitleEl || !contentEl) return;

    calEl.style.display = 'none';
    const eventDetail = document.getElementById('staffCalendarEventDetail');
    const dayBreakdown = document.getElementById('staffDayBreakdown');
    if (eventDetail) eventDetail.style.display = 'none';
    if (dayBreakdown) dayBreakdown.style.display = 'none';

    dayScreen.style.display = 'block';
    titleEl.textContent = `Detalle del día: ${formatoDiaLargoES(dateStr)}`;
    subtitleEl.textContent = 'Cargando tareas del día...';
    contentEl.innerHTML = '';

    const tasks = await obtenerTareasParaDia(dateStr);
    const total = tasks.length;
    subtitleEl.textContent = total === 0 ? 'No hay tareas para este día.' : `${total} tarea(s) para este día.`;

    if (total === 0) {
        contentEl.innerHTML = `
          <div style="padding:0.75rem; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; color:#6b7280; font-size:0.9rem;">
            <div style="margin-bottom:0.6rem;">Ninguna tarea para este día.</div>
            <button type="button" class="btn btn-primary" id="staffAddTaskForDayBtn" data-day="${escaparHtml(dateStr)}">
              Agregar tarea para este día
            </button>
          </div>
        `;
        return;
    }

    contentEl.innerHTML = tasks.map(t => {
        const priority = t.priority || 'medium';
        const status = t.status || 'pending';
        const color = prioridadColor(priority);
        const statusLabel = status === 'completed' ? 'Completada' : status === 'in_progress' ? 'En progreso' : 'Pendiente';
        const horario = formatearHorarioTarea(t.due_date);
        const desc = limpiarDescripcionInternaParaMostrar(t.description);
        return `
          <div class="staff-today-detail-task-item" data-task-id="${escaparHtml(t.id)}" role="button" style="cursor:pointer; padding:0.8rem; border:1px solid #e5e7eb; border-left:4px solid ${color}; border-radius:10px; margin-bottom:0.65rem;">
            <div style="display:flex; justify-content:space-between; gap:0.75rem; align-items:flex-start; flex-wrap:wrap;">
              <div style="min-width:0;">
                <div style="font-weight:700; color:#111827; word-break:break-word;">${escaparHtml(t.title || 'Tarea')}</div>
                <div style="font-size:0.82rem; color:#6b7280; margin-top:0.2rem;">Horario: ${escaparHtml(horario)} · Estado: ${escaparHtml(statusLabel)}</div>
                ${desc ? `<div style="font-size:0.88rem; color:#4b5563; margin-top:0.35rem; white-space:pre-wrap; word-break:break-word;">${escaparHtml(desc)}</div>` : ''}
              </div>
              <button type="button" class="btn btn-secondary staff-today-detail-edit-btn" data-task-id="${escaparHtml(t.id)}" style="padding:0.35rem 0.7rem;">Editar</button>
            </div>
          </div>
        `;
    }).join('') + `
      <div style="margin-top:0.75rem; padding:0.75rem; background:#f8fafc; border:1px solid #e5e7eb; border-radius:10px; color:#6b7280; font-size:0.9rem;">
        <button type="button" class="btn btn-primary" id="staffAddTaskForDayBtn" data-day="${escaparHtml(dateStr)}">
          Agregar tarea para este día
        </button>
      </div>
    `;
}

function cerrarVistaDetalleDiaCompleta() {
    const calEl = document.getElementById('staffCalendar');
    const dayScreen = document.getElementById('staffTodayDetailScreen');
    if (calEl) calEl.style.display = '';
    if (dayScreen) dayScreen.style.display = 'none';
}

function abrirFormularioTareaParaDia(dateStr) {
    const day = String(dateStr || '').slice(0, 10);
    if (!day) return;
    mostrarSeccionStaff('tasks');
    const taskForm = document.getElementById('staffTaskForm');
    if (taskForm) taskForm.reset();
    const taskIdEl = document.getElementById('taskId');
    if (taskIdEl) taskIdEl.value = '';
    const dueInput = document.getElementById('taskDueDate');
    if (dueInput) dueInput.value = day;
    const statusEl = document.getElementById('taskFormStatus');
    if (statusEl) statusEl.textContent = '';
}

function mostrarDetalleEventoCalendario(t) {
    // Nuevo comportamiento: abrir pop-up (no panel debajo del calendario).
    const box = document.getElementById('staffCalendarEventDetail');
    if (box) box.style.display = 'none';
    if (typeof abrirModalDetalleTarea === 'function' && t) {
        abrirModalDetalleTarea(t);
        return;
    }

    const titleEl = document.getElementById('staffCalendarEventTitle');
    const metaEl = document.getElementById('staffCalendarEventMeta');
    const descEl = document.getElementById('staffCalendarEventDescription');
    if (!box || !titleEl || !metaEl || !descEl) return;

    // Ocultar pantallas alternativas si estaban visibles.
    const dayScreen = document.getElementById('staffTodayDetailScreen');
    const dayBreakdown = document.getElementById('staffDayBreakdown');
    if (dayScreen) dayScreen.style.display = 'none';
    if (dayBreakdown) dayBreakdown.style.display = 'none';

    const priority = t.priority || 'medium';
    const status = t.status || 'pending';
    const badgeColor = prioridadColor(priority);
    const statusLabel = status === 'completed' ? 'Completada' : status === 'in_progress' ? 'En progreso' : 'Pendiente';
    const fecha = t.due_date ? formatearFechaCorta(t.due_date) : 'Sin fecha';

    titleEl.textContent = t.title || 'Tarea';
    metaEl.innerHTML = `
      <span style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.75rem; font-weight:700; color:#fff; padding:0.15rem 0.5rem; border-radius:999px; background:${badgeColor}; margin-right:0.5rem;">
        ${escaparHtml(priority.toUpperCase())}
      </span>
      <span style="font-size:0.78rem; color:#374151; margin-right:0.5rem;">${escaparHtml(statusLabel)}</span>
      <span style="font-size:0.78rem; color:#6b7280;">${escaparHtml(fecha)}</span>
    `;

    const desc = limpiarDescripcionInternaParaMostrar(t.description);
    const nextCompleteLabel = status === 'completed' ? 'Marcar pendiente' : 'Marcar completada';
    descEl.innerHTML = `
      <div style="white-space:pre-wrap; color:#4b5563; font-size:0.9rem;">
        ${escaparHtml(desc || 'Sin descripción.')}
      </div>
      <div style="margin-top:0.85rem;">
        <label for="staffCalendarEventCommentInput" style="display:block; font-size:0.8rem; color:#6b7280; margin-bottom:0.25rem;">
          Comentarios
        </label>
        <textarea id="staffCalendarEventCommentInput" rows="3" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.95rem;">${escaparHtml(desc)}</textarea>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.6rem;">
          <button type="button" class="btn btn-primary" id="staffCalendarEventSaveCommentBtn" data-task-id="${escaparHtml(t.id)}" style="padding:0.45rem 0.8rem;">
            Guardar comentario
          </button>
          <button type="button" class="btn btn-secondary" id="staffCalendarEventToggleCompleteBtn"
            data-task-id="${escaparHtml(t.id)}"
            data-current-status="${escaparHtml(status)}"
            style="padding:0.45rem 0.8rem;">
            ${escaparHtml(nextCompleteLabel)}
          </button>
        </div>
      </div>
    `;

    const editBtn = document.getElementById('staffCalendarEventEditBtn');
    if (editBtn) editBtn.setAttribute('data-task-id', t.id);

    box.style.display = 'block';
}

async function abrirDetalleTareaPorId(taskId) {
    if (!taskId || !supabaseClient) return;
    let t = staffTasksCache.find(x => x.id === taskId);
    if (!t) {
        const { data } = await supabaseClient
            .from('tasks')
            .select('id, title, description, due_date, priority, status')
            .eq('id', taskId)
            .maybeSingle();
        if (data) t = data;
    }
    if (t) mostrarDetalleEventoCalendario(t);
}

// Resolver ID de staff a partir de email (admin / secretaria u otros miembros)
async function resolverStaffIdPorEmail(email) {
    if (!supabaseClient || !email) return null;
    const emailNorm = email.toLowerCase().trim();
    try {
        // 1) staff_members: fuente principal
        const { data: staff, error: staffError } = await supabaseClient
            .from('staff_members')
            .select('id, email')
            .ilike('email', emailNorm)
            .limit(1);
        if (!staffError && staff && staff.length > 0) {
            return staff[0].id;
        }
    } catch (_) { /* tabla puede no existir; seguimos */ }

    try {
        // 2) profiles: fallback
        const { data: profiles, error: profError } = await supabaseClient
            .from('profiles')
            .select('id, email')
            .ilike('email', emailNorm)
            .limit(1);
        if (!profError && profiles && profiles.length > 0) {
            return profiles[0].id;
        }
    } catch (_) { /* ignorar */ }

    return null;
}

// Enriquecer tareas con label legible para `assigned_to`
async function enriquecerAssignedToLabels(tareas) {
    if (!supabaseClient || !Array.isArray(tareas) || tareas.length === 0) return;
    const ids = Array.from(new Set(tareas.map(t => t?.assigned_to).filter(Boolean)));
    if (ids.length === 0) return;

    const roleToLabel = { admin: 'Admin', secretary: 'Secretaria' };
    const idToInfo = new Map(); // id -> { label, role, email }

    // 1) staff_members (fuente principal)
    try {
        const { data: staffRows, error } = await supabaseClient
            .from('staff_members')
            .select('id, role, display_name, email')
            .in('id', ids);
        if (!error && Array.isArray(staffRows) && staffRows.length > 0) {
            staffRows.forEach(r => {
                const label = r.display_name || roleToLabel[r.role] || r.role || ('Usuario ' + String(r.id).slice(0, 8));
                idToInfo.set(r.id, { label, role: r.role || null, email: r.email || null });
            });
        }
    } catch (_) { /* si falla, hacemos fallback */ }

    // 2) profiles (fallback)
    try {
        const missing = ids.filter(id => !idToInfo.has(id));
        if (missing.length > 0) {
            const { data: profRows } = await supabaseClient
                .from('profiles')
                .select('id, role')
                .in('id', missing);
            (profRows || []).forEach(r => {
                if (!idToInfo.has(r.id)) {
                    const label = roleToLabel[r.role] || r.role || ('Usuario ' + String(r.id).slice(0, 8));
                    idToInfo.set(r.id, { label, role: r.role || null });
                }
            });
        }
    } catch (_) { /* ignorar */ }

    tareas.forEach(t => {
        if (!t?.assigned_to) return;
        const info = idToInfo.get(t.assigned_to);
        t.assigned_to_role = info?.role || null;
        t.assigned_to_label = info?.label || null;
        t.assigned_to_email = info?.email || null;
    });
}

async function cargarTareasStaff() {
    const listEl = document.getElementById('staffTasksList');
    if (!listEl || !supabaseClient || !currentStaffSession) return;
    const uid = currentStaffSession.user.id;
    try {
        const { data, error } = await supabaseClient
            .from('tasks')
            .select('*')
            .or(`created_by.eq.${uid},assigned_to.eq.${uid}`)
            .order('due_date', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false });
        if (error) throw error;
        staffTasksCache = await filtrarTareasReferidosStale(data || []);
        await enriquecerAssignedToLabels(staffTasksCache);
        renderizarTareasStaff(staffTasksCache);
    } catch (e) {
        console.error('Error cargando tareas:', e);
        listEl.innerHTML = '<p style="color:#b91c1c; font-size:0.9rem;">Error al cargar las tareas.</p>';
    }
}

function prioridadColor(priority) {
    if (priority === 'high') return '#FF9B4E';   /* --orange */
    if (priority === 'medium') return '#00CCC0'; /* --turquoise */
    return '#5a5a5a';                            /* --gray-medium */
}

function prioridadTexto(priority) {
    if (priority === 'high') return 'Alta';
    if (priority === 'medium') return 'Media';
    return 'Baja';
}

function renderizarTareasStaff(tareas) {
    const listEl = document.getElementById('staffTasksList');
    if (!listEl) return;
    const pending = tareas.filter(t => (t.status || 'pending') === 'pending');
    const inProgress = tareas.filter(t => t.status === 'in_progress');
    const completed = tareas.filter(t => t.status === 'completed');

    function renderColumn(title, items, status) {
        const frag = items.map(t => {
            const due = t.due_date ? formatearFechaCorta(t.due_date) : '—';
            const color = prioridadColor(t.priority || 'medium');
            const checked = status === 'completed';
            const desc = limpiarDescripcionInternaParaMostrar(t.description);
            return `
              <div class="staff-task-card" data-task-id="${t.id}" style="border-left:4px solid ${color};">
                <div class="staff-task-open-area" data-open-task="${t.id}" style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer;">
                  <input type="checkbox" ${checked ? 'checked' : ''} data-status="${status}" data-task-id="${t.id}" class="staff-task-checkbox">
                  <div style="flex:1;">
                    <strong>${escapeHtml(t.title || '')}</strong>
                    ${t.assigned_to ? `<p style="font-size:0.8rem; color:#6b7280; margin:0.15rem 0 0 0;">Asignado a: ${escapeHtml(t.assigned_to_label || '—')}</p>` : ''}
                    ${desc ? `<p style="font-size:0.85rem; color:#6b7280; margin:0.25rem 0 0 0;">${escapeHtml(desc)}</p>` : ''}
                    <p style="font-size:0.8rem; color:#6b7280; margin-top:0.35rem;">
                      <span class="staff-task-priority-badge staff-task-priority-${t.priority || 'medium'}">
                        ${prioridadTexto(t.priority || 'medium')}
                      </span>
                      · Fecha: ${due}
                    </p>
                  </div>
                </div>
                <div style="margin-top:0.35rem; display:flex; gap:0.35rem; flex-wrap:wrap;">
                  <button type="button" class="btn btn-secondary" style="font-size:0.8rem; padding:0.25rem 0.5rem;" data-edit-task="${t.id}">Editar</button>
                  <button type="button" class="btn btn-secondary" style="font-size:0.8rem; padding:0.25rem 0.5rem; background:#f97373; border-color:#f97373; color:#fff;" data-delete-task="${t.id}">Eliminar</button>
                  ${status === 'pending' ? `<button type="button" class="btn btn-primary" style="font-size:0.8rem; padding:0.25rem 0.5rem;" data-status-task="${t.id}" data-status-value="in_progress">En progreso</button>` : ''}
                  ${status === 'in_progress' ? `<button type="button" class="btn btn-secondary" style="font-size:0.8rem; padding:0.25rem 0.5rem;" data-status-task="${t.id}" data-status-value="completed">Marcar completada</button>` : ''}
                </div>
              </div>`;
        }).join('');
        return `<div class="staff-tasks-column"><h5 style="margin:0 0 0.5rem 0; font-size:0.9rem;">${title}</h5>${frag || '<p style="font-size:0.85rem; color:#999;">Ninguna</p>'}</div>`;
    }

    listEl.innerHTML = `
      <div class="staff-tasks-columns">
        ${renderColumn('Pendientes', pending, 'pending')}
        ${renderColumn('En progreso', inProgress, 'in_progress')}
        ${renderColumn('Completadas', completed, 'completed')}
      </div>`;

    listEl.querySelectorAll('.staff-task-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            const id = this.getAttribute('data-task-id');
            const status = this.checked ? 'completed' : 'pending';
            actualizarEstadoTarea(id, status);
        });
    });
    listEl.querySelectorAll('[data-open-task]').forEach(el => {
        el.addEventListener('click', function(ev) {
            if (ev.target?.closest?.('.staff-task-checkbox')) return;
            const id = this.getAttribute('data-open-task');
            const t = staffTasksCache.find(x => x.id === id);
            if (t) abrirModalDetalleTarea(t);
        });
    });
    listEl.querySelectorAll('[data-edit-task]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-edit-task');
            const t = staffTasksCache.find(x => x.id === id);
            if (t) cargarTareaEnFormulario(t);
        });
    });
    listEl.querySelectorAll('[data-delete-task]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-delete-task');
            if (id) eliminarTareaStaff(id);
        });
    });
    listEl.querySelectorAll('[data-status-task]').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = this.getAttribute('data-status-task');
            const status = this.getAttribute('data-status-value');
            if (id && status) actualizarEstadoTarea(id, status);
        });
    });
}

function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function asegurarModalDetalleTarea() {
    let modal = document.getElementById('staffTaskQuickModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'staffTaskQuickModal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:2000; background:rgba(15,23,42,0.45); padding:1rem; overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:680px; margin:3rem auto; background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:0.95rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
          <div>
            <h4 id="staffTaskModalTitle" style="margin:0; font-size:1.05rem;">Detalle de tarea</h4>
            <p id="staffTaskModalMeta" style="margin:0.25rem 0 0 0; font-size:0.85rem; color:#6b7280;"></p>
          </div>
          <button type="button" class="btn btn-secondary" id="staffTaskModalCloseBtn" style="padding:0.35rem 0.7rem;">Cerrar</button>
        </div>
        <div style="margin-top:0.85rem;">
          <label for="staffTaskModalCommentInput" style="display:block; font-size:0.82rem; color:#6b7280; margin-bottom:0.25rem;">Comentarios / detalles</label>
          <textarea id="staffTaskModalCommentInput" rows="4" style="width:100%; padding:0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.95rem;"></textarea>
        </div>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.75rem;">
          <button type="button" class="btn btn-primary" id="staffTaskModalSaveCommentBtn">Guardar comentario</button>
          <button type="button" class="btn btn-secondary" id="staffTaskModalToggleCompleteBtn">Marcar completada</button>
          <button type="button" class="btn btn-secondary" id="staffTaskModalInProgressBtn">En progreso</button>
          <button type="button" class="btn btn-secondary" id="staffTaskModalEditBtn">Editar tarea</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function cerrarModalDetalleTarea() {
    const modal = document.getElementById('staffTaskQuickModal');
    if (modal) modal.style.display = 'none';
}

function asegurarModalDetalleReservaEvento() {
    let modal = document.getElementById('staffReservationQuickModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'staffReservationQuickModal';
    modal.style.cssText = 'display:none; position:fixed; inset:0; z-index:2100; background:rgba(15,23,42,0.45); padding:1rem; overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:720px; margin:3rem auto; background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:0.95rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.75rem; flex-wrap:wrap;">
          <div>
            <h4 id="staffReservationModalTitle" style="margin:0; font-size:1.05rem;">Detalle de reserva</h4>
            <p id="staffReservationModalMeta" style="margin:0.25rem 0 0 0; font-size:0.85rem; color:#6b7280;"></p>
          </div>
          <button type="button" class="btn btn-secondary" id="staffReservationModalCloseBtn" style="padding:0.35rem 0.7rem;">Cerrar</button>
        </div>
        <div style="margin-top:0.85rem;">
          <p id="staffReservationModalChild" style="margin:0.25rem 0; font-size:0.95rem;"></p>
          <p id="staffReservationModalParent" style="margin:0.25rem 0; font-size:0.95rem;"></p>
          <p id="staffReservationModalContact" style="margin:0.25rem 0; font-size:0.95rem;"></p>
          <p id="staffReservationModalDays" style="margin:0.25rem 0; font-size:0.95rem;"></p>
          <p id="staffReservationModalTotal" style="margin:0.25rem 0; font-size:0.95rem;"></p>
          <p id="staffReservationModalPaid" style="margin:0.25rem 0; font-size:0.95rem;"></p>
          <div style="margin-top:0.75rem; color:#4b5563; font-size:0.92rem;">
            <strong>Comentarios (admin):</strong>
            <div id="staffReservationModalCommentsBox" style="margin-top:0.25rem; white-space:pre-wrap;"></div>
          </div>
          <div id="staffReservationTodoSection" style="margin-top:1rem; border-top:1px solid #e5e7eb; padding-top:0.85rem;">
            <div style="font-weight:800; margin-bottom:0.55rem;">To-dos de la reserva</div>
            <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:0.75rem;">
              <input type="text" id="staffReservationTodoTitleInput" placeholder="Ej: comprar vasos, enviar invitaciones..." style="flex:1; min-width:220px; padding:0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.95rem;" />
              <button type="button" class="btn btn-primary" id="staffReservationTodoAddBtn">Agregar</button>
            </div>
            <div id="staffReservationTodoList" style="display:grid; gap:0.55rem;"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function cerrarModalDetalleReservaEvento() {
    const modal = document.getElementById('staffReservationQuickModal');
    if (modal) modal.style.display = 'none';
}

function abrirModalDetalleReservaEvento({ reservation, evento, startDateISO }) {
    if (!reservation) return;
    const modal = asegurarModalDetalleReservaEvento();
    modal.style.display = 'block';
    modal.setAttribute('data-reservation-id', reservation.id || '');
    modal.setAttribute('data-reservation-type', 'evento');
    modal.setAttribute('data-reservation-date-iso', startDateISO || '');

    const metaEl = document.getElementById('staffReservationModalMeta');
    const titleEl = document.getElementById('staffReservationModalTitle');
    const childEl = document.getElementById('staffReservationModalChild');
    const parentEl = document.getElementById('staffReservationModalParent');
    const contactEl = document.getElementById('staffReservationModalContact');
    const daysEl = document.getElementById('staffReservationModalDays');
    const totalEl = document.getElementById('staffReservationModalTotal');
    const paidEl = document.getElementById('staffReservationModalPaid');
    const commentsBox = document.getElementById('staffReservationModalCommentsBox');

    if (titleEl) titleEl.textContent = `Reserva de evento`;
    const displayDate = startDateISO ? formatearFechaCorta(startDateISO) : '—';
    if (metaEl) metaEl.textContent = `${evento?.nombre || 'Evento'} · ${displayDate}`;

    if (childEl) childEl.textContent = `Niño/a: ${reservation.nombre_nino || '—'}${reservation.edad_nino != null ? ` (${reservation.edad_nino} años)` : ''}`;
    if (parentEl) parentEl.textContent = `Padre/Madre: ${reservation.nombre_padre || '—'}`;
    if (contactEl) contactEl.textContent = `Tel: ${reservation.telefono || '—'} · Email: ${reservation.email || '—'}`;
    if (daysEl) daysEl.textContent = `Días reservados: ${reservation.dias ?? 1}`;
    if (totalEl) totalEl.textContent = `Total: $${reservation.total ?? '—'}`;
    if (paidEl) paidEl.textContent = `Estado: ${reservation.pagado ? 'Pagado' : 'Pendiente'}`;
    if (commentsBox) commentsBox.textContent = reservation.comentarios_admin || '';

    const todoSection = document.getElementById('staffReservationTodoSection');
    if (todoSection) todoSection.style.display = 'none';
}

async function abrirModalDetalleReservaEventoPorId(reservationId) {
    if (!reservationId || !supabaseClient) return;
    const { data: reservation, error: resErr } = await supabaseClient
        .from('reservas_eventos')
        .select('id, evento_id, nombre_nino, edad_nino, nombre_padre, email, telefono, dias, total, pagado, comentarios_admin')
        .eq('id', reservationId)
        .maybeSingle();
    if (resErr || !reservation) return;

    const { data: evento, error: evErr } = await supabaseClient
        .from('eventos')
        .select('id, nombre, fecha, horario')
        .eq('id', reservation.evento_id)
        .maybeSingle();
    if (evErr || !evento) return;

    const fechas = typeof parsearFechasEvento === 'function' ? parsearFechasEvento(evento.fecha) : [{ fecha: evento.fecha, display: evento.fecha }];
    const startDateISO = fechas?.[0]?.fecha ? normalizarFechaISO(fechas[0].fecha) : null;
    abrirModalDetalleReservaEvento({ reservation, evento, startDateISO });
}

function getReservationTodoPrefix(reservationType, reservationId) {
    return `reservation_type=${reservationType}|reservation_id=${reservationId}`;
}

async function cargarToDosReservaEnModal() {
    const modal = document.getElementById('staffReservationQuickModal');
    if (!modal || modal.style.display === 'none') return;
    if (!supabaseClient || !currentStaffSession) return;

    const reservationType = modal.getAttribute('data-reservation-type') || '';
    const reservationId = modal.getAttribute('data-reservation-id') || '';
    if (!reservationType || !reservationId) return;

    const uid = currentStaffSession.user.id;
    const todoPrefix = getReservationTodoPrefix(reservationType, reservationId);

    const todoListEl = document.getElementById('staffReservationTodoList');
    if (todoListEl) todoListEl.innerHTML = '<p style="color:#6b7280; font-size:0.9rem;">Cargando...</p>';

    try {
        const { data: tareasRes, error } = await supabaseClient
            .from('tasks')
            .select('id, title, description, due_date, priority, status')
            .or(`assigned_to.eq.${uid},created_by.eq.${uid}`)
            .ilike('description', `%${todoPrefix}%`);

        if (error) throw error;
        const tareas = Array.isArray(tareasRes) ? tareasRes : [];

        if (todoListEl) {
            if (tareas.length === 0) {
                todoListEl.innerHTML = '<p style="color:#6b7280; font-size:0.9rem;">Todavía no hay to-dos para esta reserva.</p>';
            } else {
                todoListEl.innerHTML = tareas.map(t => {
                    const dueISO = normalizarFechaISO(t.due_date);
                    const due = dueISO ? formatearFechaCorta(dueISO) : '—';
                    const status = t.status || 'pending';
                    const checked = status === 'completed';
                    const statusLabel = status === 'completed' ? 'Completada' : status === 'in_progress' ? 'En progreso' : 'Pendiente';
                    return `
                      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:0.6rem; display:flex; justify-content:space-between; gap:0.6rem; align-items:flex-start;">
                        <div style="min-width:0;">
                          <div style="font-weight:800; word-break:break-word; ${checked ? 'text-decoration:line-through; color:#6b7280;' : ''}">${escaparHtml(t.title || 'Tarea')}</div>
                          <div style="font-size:0.82rem; color:#6b7280; margin-top:0.25rem;">
                            Estado: ${escaparHtml(statusLabel)} · Fecha: ${escaparHtml(due)}
                          </div>
                        </div>
                        <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center; justify-content:flex-end;">
                          <label class="staffReservationTodoCheckboxLabel" data-todo-task-id="${escaparHtml(t.id)}" style="display:inline-flex; align-items:center; gap:0.35rem; font-size:0.85rem; color:#374151; cursor:pointer;">
                            <input type="checkbox" class="staffReservationTodoCheckbox" data-todo-task-id="${escaparHtml(t.id)}" ${checked ? 'checked' : ''} />
                            <span>${checked ? 'Hecho' : 'Pendiente'}</span>
                          </label>
                          <button type="button" class="btn btn-secondary" style="font-size:0.8rem; padding:0.25rem 0.5rem; background:#f97373; border-color:#f97373; color:#fff;" data-delete-todo-task-id="${escaparHtml(t.id)}">
                            Borrar
                          </button>
                        </div>
                      </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.error('Error cargando to-dos reserva:', err);
        if (todoListEl) todoListEl.innerHTML = '<p style="color:#b91c1c; font-size:0.9rem;">No se pudieron cargar los to-dos.</p>';
    }
}

async function crearTodoEnModal() {
    const modal = document.getElementById('staffReservationQuickModal');
    if (!modal || modal.style.display === 'none') return;
    if (!supabaseClient || !currentStaffSession) return;

    const isAdmin = String(currentStaffSession?.user?.email || '').toLowerCase() === 'centroyouandme@gmail.com';
    if (!isAdmin) return;

    const reservationType = modal.getAttribute('data-reservation-type') || '';
    const reservationId = modal.getAttribute('data-reservation-id') || '';
    const reservationDateISO = modal.getAttribute('data-reservation-date-iso') || '';
    if (!reservationType || !reservationId || !reservationDateISO) return;

    const todoPrefix = getReservationTodoPrefix(reservationType, reservationId);
    const title = document.getElementById('staffReservationTodoTitleInput')?.value?.trim() || '';
    if (!title) {
        alert('Escribe el título del to-do.');
        return;
    }

    const uid = currentStaffSession.user.id;
    const dueDateUTC = `${reservationDateISO}T12:00:00.000Z`;

    try {
        const payload = {
            title,
            description: `${todoPrefix}`,
            priority: 'low',
            due_date: dueDateUTC,
            status: 'pending',
            created_by: uid,
            assigned_to: uid,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabaseClient.from('tasks').insert([payload]);
        if (error) throw error;

        const inputEl = document.getElementById('staffReservationTodoTitleInput');
        if (inputEl) inputEl.value = '';

        await cargarToDosReservaEnModal();
        if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
        cargarResumenDashboardStaff();
    } catch (err) {
        console.error('Error creando to-do reserva:', err);
        alert('No se pudo crear el to-do.');
    }
}

function abrirModalDetalleReservaCumple({ reservation, startDateISO }) {
    if (!reservation) return;
    const modal = asegurarModalDetalleReservaEvento();
    modal.style.display = 'block';
    modal.setAttribute('data-reservation-id', reservation.id || '');
    modal.setAttribute('data-reservation-type', 'cumple');
    modal.setAttribute('data-reservation-date-iso', startDateISO || '');

    const metaEl = document.getElementById('staffReservationModalMeta');
    const titleEl = document.getElementById('staffReservationModalTitle');
    const childEl = document.getElementById('staffReservationModalChild');
    const parentEl = document.getElementById('staffReservationModalParent');
    const contactEl = document.getElementById('staffReservationModalContact');
    const daysEl = document.getElementById('staffReservationModalDays');
    const totalEl = document.getElementById('staffReservationModalTotal');
    const paidEl = document.getElementById('staffReservationModalPaid');
    const commentsBox = document.getElementById('staffReservationModalCommentsBox');

    if (titleEl) titleEl.textContent = 'Detalle de cumpleaños';
    const displayDate = startDateISO ? formatearFechaCorta(startDateISO) : '—';
    if (metaEl) metaEl.textContent = `Cumpleaños · ${displayDate}`;

    if (childEl) childEl.textContent = `Niño/a: ${reservation.nombre_nino || '—'}`;
    if (parentEl) parentEl.textContent = `Contacto: ${reservation.contacto || '—'}`;
    if (contactEl) contactEl.textContent = `Tel: ${reservation.telefono || '—'} · Email: ${reservation.email || '—'}`;

    if (daysEl) {
        const actividad = reservation.actividad ? String(reservation.actividad) : '';
        const horas = reservation.horas ? String(reservation.horas) : '';
        const extra = [horas ? `Horas: ${horas}` : '', actividad ? `Actividad: ${actividad}` : ''].filter(Boolean).join(' · ');
        daysEl.textContent = extra || '—';
    }

    if (totalEl) totalEl.textContent = `Total: $${reservation.total ?? '—'}`;
    if (paidEl) paidEl.textContent = `Estado: ${reservation.pagado ? 'Pagado' : 'Pendiente'}`;
    if (commentsBox) commentsBox.textContent = reservation.comentarios_admin || '';

    const todoSection = document.getElementById('staffReservationTodoSection');
    if (todoSection) todoSection.style.display = '';

    cargarToDosReservaEnModal().catch(() => { /* ignore */ });
}

async function abrirModalDetalleReservaCumplePorId(reservationId) {
    if (!reservationId || !supabaseClient) return;
    const { data: reservation, error: resErr } = await supabaseClient
        .from('reservas_cumple')
        .select('id, nombre_nino, fecha, pagado')
        .eq('id', reservationId)
        .maybeSingle();
    if (resErr || !reservation) return;

    const startDateISO = reservation.fecha ? normalizarFechaISO(reservation.fecha) : null;
    abrirModalDetalleReservaCumple({ reservation, startDateISO });
}

function abrirModalDetalleTarea(task) {
    if (!task) return;
    const modal = asegurarModalDetalleTarea();
    modal.style.display = 'block';
    modal.setAttribute('data-task-id', task.id || '');
    modal.setAttribute('data-current-status', task.status || 'pending');
    const originalDesc = task.description || '';
    const reminderPrefixMatch = originalDesc.match(/reminder_type=reminder\|referral_patient_id=[^\n]*/);
    const reminderPrefix = reminderPrefixMatch ? reminderPrefixMatch[0] : '';
    const reservationPrefixMatch = originalDesc.match(/reservation_type=(cumple|evento)\|reservation_id=[^\n]*/);
    const reservationPrefix = reservationPrefixMatch ? reservationPrefixMatch[0] : '';
    const internalPrefix = reminderPrefix || reservationPrefix;
    modal.setAttribute('data-original-description', originalDesc);
    modal.setAttribute('data-internal-prefix', internalPrefix);

    const titleEl = document.getElementById('staffTaskModalTitle');
    const metaEl = document.getElementById('staffTaskModalMeta');
    const commentEl = document.getElementById('staffTaskModalCommentInput');
    const toggleBtn = document.getElementById('staffTaskModalToggleCompleteBtn');
    const progressBtn = document.getElementById('staffTaskModalInProgressBtn');
    if (titleEl) titleEl.textContent = task.title || 'Detalle de tarea';
    if (metaEl) {
        const due = task.due_date ? formatearFechaCorta(task.due_date) : 'Sin fecha';
        const statusLabel = task.status === 'completed' ? 'Completada' : task.status === 'in_progress' ? 'En progreso' : 'Pendiente';
        metaEl.textContent = `${statusLabel} · Fecha: ${due}`;
    }
    if (commentEl) {
        if (internalPrefix) commentEl.value = originalDesc.replace(internalPrefix, '').trim();
        else commentEl.value = originalDesc;
    }
    if (toggleBtn) toggleBtn.textContent = task.status === 'completed' ? 'Marcar pendiente' : 'Marcar completada';
    if (progressBtn) progressBtn.style.display = task.status === 'pending' ? '' : 'none';
}

async function refrescarTareaYReabrirModal(taskId) {
    await cargarTareasStaff();
    await cargarResumenDashboardStaff();
    if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
    const t = staffTasksCache.find(x => x.id === taskId);
    if (t) abrirModalDetalleTarea(t);
}

function cargarTareaEnFormulario(t) {
    document.getElementById('taskId').value = t.id || '';
    document.getElementById('taskTitle').value = t.title || '';
    document.getElementById('taskDescription').value = t.description || '';
    document.getElementById('taskPriority').value = t.priority || 'medium';
    document.getElementById('taskDueDate').value = t.due_date ? t.due_date.slice(0, 10) : '';
    const assigneeSelect = document.getElementById('taskAssigneeSelect');
    if (assigneeSelect) assigneeSelect.value = t.assigned_to_email || '';
    document.getElementById('taskAssignedEmail').value = '';
    const statusEl = document.getElementById('taskFormStatus');
    if (statusEl) statusEl.textContent = 'Editando. Guarde para aplicar cambios.';
}

async function actualizarEstadoTarea(id, status) {
    if (!supabaseClient || !id) return;
    try {
        const { error } = await supabaseClient.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        cargarTareasStaff();
        cargarResumenDashboardStaff();
        if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
    } catch (e) {
        console.error('Error actualizando tarea:', e);
    }
}

async function eliminarTareaStaff(id) {
    if (!supabaseClient || !id) return;
    const confirmar = window.confirm('¿Eliminar esta tarea? Esta acción no se puede deshacer.');
    if (!confirmar) return;
    try {
        const { error } = await supabaseClient.from('tasks').delete().eq('id', id);
        if (error) throw error;
        await cargarTareasStaff();
        await cargarResumenDashboardStaff();
        if (typeof staffCalendar !== 'undefined' && staffCalendar) {
            staffCalendar.refetchEvents();
        }
    } catch (e) {
        console.error('Error eliminando tarea:', e);
        alert('No se pudo eliminar la tarea. Inténtalo de nuevo.');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const taskForm = document.getElementById('staffTaskForm');
    const taskCancelBtn = document.getElementById('taskFormCancelBtn');
    if (taskForm) {
        taskForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient || !currentStaffSession) return;
            const id = document.getElementById('taskId').value.trim() || null;
            const title = document.getElementById('taskTitle').value.trim();
            const description = document.getElementById('taskDescription').value.trim();
            const priority = document.getElementById('taskPriority').value || 'medium';
            const dueDate = document.getElementById('taskDueDate').value || null;
            const assigneeSelect = document.getElementById('taskAssigneeSelect');
            let assignedEmail = assigneeSelect?.value?.trim()?.toLowerCase() || null;
            const hiddenEmailInput = document.getElementById('taskAssignedEmail');
            if (hiddenEmailInput) hiddenEmailInput.value = assignedEmail || '';
            const statusEl = document.getElementById('taskFormStatus');
            const payload = {
                title,
                description: description || null,
                priority,
                // Guardar al mediodía UTC evita corrimientos de fecha por zona horaria.
                due_date: dueDate ? `${dueDate}T12:00:00.000Z` : null,
                updated_at: new Date().toISOString()
            };
            if (!id) {
                payload.created_by = currentStaffSession.user.id;
                payload.status = 'pending';
            }
            // Asignación opcional: si se pone un email, resolver ID de staff y guardar assigned_to
            if (assignedEmail) {
                const resolvedId = await resolverStaffIdPorEmail(assignedEmail);
                if (resolvedId) {
                    payload.assigned_to = resolvedId;
                } else {
                    // Si no se encontró el email en staff_members/profiles, dejamos la tarea solo para el creador
                    payload.assigned_to = null;
                }
            } else {
                payload.assigned_to = null;
            }
            try {
                if (id) {
                    const { error } = await supabaseClient.from('tasks').update(payload).eq('id', id);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('tasks').insert([payload]);
                    if (error) throw error;
                }
                if (statusEl) statusEl.textContent = 'Guardado.';
                taskForm.reset();
                document.getElementById('taskId').value = '';
                cargarTareasStaff();
                cargarResumenDashboardStaff();
                if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            } catch (err) {
                console.error('Error guardando tarea:', err);
                if (statusEl) statusEl.textContent = 'Error al guardar.';
            }
        });
    }
    if (taskCancelBtn) {
        taskCancelBtn.addEventListener('click', () => {
            document.getElementById('staffTaskForm')?.reset();
            document.getElementById('taskId').value = '';
            document.getElementById('taskFormStatus').textContent = '';
        });
    }
});

// Referidos: formulario (alta/edicion)
document.addEventListener('DOMContentLoaded', () => {
    const referralForm = document.getElementById('referralPatientForm');
    const cancelBtn = document.getElementById('referralFormCancelBtn');

    if (referralForm) {
        const patientSelect = document.getElementById('referralPatientSelect');
        const customGroup = document.getElementById('referralPatientCustomGroup');
        const customInput = document.getElementById('referralPatientNameCustom');
        const idEl = document.getElementById('referralPatientId');

        if (patientSelect) {
            patientSelect.addEventListener('change', () => {
                const sel = patientSelect.value;
                const showNew = sel === REFERRAL_PATIENT_NEW_OPTION_VALUE;
                if (customGroup) customGroup.style.display = showNew ? '' : 'none';
                if (customInput && !showNew) customInput.value = '';
                if (idEl) idEl.value = showNew ? '' : sel;
            });
        }

        referralForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!supabaseClient || !currentStaffSession) return;

            const patientSelectValue = document.getElementById('referralPatientSelect')?.value?.trim() || '';
            const isNew = patientSelectValue === REFERRAL_PATIENT_NEW_OPTION_VALUE;
            const selectedId = isNew ? '' : patientSelectValue;
            const selectedPatient = selectedId ? (staffReferralsCache || []).find(x => x.id === selectedId) : null;
            const patientName = isNew
                ? (document.getElementById('referralPatientNameCustom')?.value?.trim() || '')
                : (selectedPatient?.patient_name || '');

            const id = selectedId;
            const expiresOn = document.getElementById('referralExpiresOn')?.value || '';
            const statusEl = document.getElementById('referralFormStatus');

            if (!patientName || !expiresOn) return;
            const expiresISO = normalizarFechaISO(expiresOn);
            if (!expiresISO) return;

            try {
                if (id) {
                    const { error } = await supabaseClient
                        .from('referral_patients')
                        .update({
                            patient_name: patientName,
                            referral_expires_on: expiresISO
                        })
                        .eq('id', id);
                    if (error) throw error;
                    if (statusEl) statusEl.textContent = 'Referido actualizado.';
                } else {
                    const { error } = await supabaseClient
                        .from('referral_patients')
                        .insert([{
                            patient_name: patientName,
                            referral_expires_on: expiresISO,
                            created_by: currentStaffSession.user.id
                        }]);
                    if (error) throw error;
                    if (statusEl) statusEl.textContent = 'Referido guardado.';
                }

                limpiarFormularioReferidos();
                await cargarPacientesReferidos();
                if (staffReferralsCalendar) staffReferralsCalendar.refetchEvents();
            } catch (err) {
                console.error('Error guardando referido:', err);
                if (statusEl) statusEl.textContent = 'Error al guardar referido.';
            }
        });
    }

    const addBtn = document.getElementById('staffReferralsAddPatientBtn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            limpiarFormularioReferidos();
            const patientSelect = document.getElementById('referralPatientSelect');
            const customGroup = document.getElementById('referralPatientCustomGroup');
            const customInput = document.getElementById('referralPatientNameCustom');
            const idEl = document.getElementById('referralPatientId');
            if (patientSelect) patientSelect.value = REFERRAL_PATIENT_NEW_OPTION_VALUE;
            if (customGroup) customGroup.style.display = '';
            if (customInput) customInput.value = '';
            if (idEl) idEl.value = '';
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            limpiarFormularioReferidos();
        });
    }
});

function inicializarStaffCalendar() {
    const el = document.getElementById('staffCalendar');
    if (!el || typeof FullCalendar === 'undefined') return;
    if (staffCalendar) {
        staffCalendar.refetchEvents();
        return;
    }
    staffCalendar = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        headerToolbar: { left: 'prev,next', center: 'title', right: '' },
        locale: 'es',
        selectable: true,
        events: async (info, successCallback) => {
            if (!supabaseClient) return successCallback([]);
            try {
                const uid = currentStaffSession?.user?.id;
                if (!uid) return successCallback([]);
                const isAdminCalendar = String(currentStaffSession?.user?.email || '').toLowerCase() === 'centroyouandme@gmail.com';
                const startISO = normalizarFechaISO(info.startStr) || info.startStr;
                const endISOExclusive = normalizarFechaISO(info.endStr) || info.endStr; // `endStr` es fin exclusivo
                if (!startISO || !endISOExclusive) return successCallback([]);
                const { data } = await supabaseClient
                    .from('tasks')
                    .select('id, title, description, due_date, priority, status')
                    .not('due_date', 'is', null)
                    .neq('status', 'completed')
                    .or(`assigned_to.eq.${uid},created_by.eq.${uid}`);

                const tareas = await filtrarTareasReferidosStale(data || []);

                // Mostrar cada tarea pendiente solo en un "día activo":
                // due_date (si aún no vence) o hoy (si ya está vencida).
                const events = [];
                const todayISO = obtenerHoyISO();
                (tareas || []).forEach(t => {
                    const dueISO = normalizarFechaISO(t.due_date);
                    if (!dueISO) return;
                    const activeISO = dueISO > todayISO ? dueISO : todayISO;
                    if (activeISO < startISO || activeISO >= endISOExclusive) return;
                    events.push({
                        id: `${t.id}|${activeISO}`,
                        title: t.title || 'Tarea',
                        start: activeISO,
                        allDay: true,
                        backgroundColor: prioridadColor(t.priority || 'medium'),
                        extendedProps: { taskId: t.id }
                    });
                });

                // ADMIN (solo centroyouandme@gmail.com): pintar reservas de eventos desde el website.
                if (isAdminCalendar) {
                    // ADMIN: Reservas de cumpleaños (reservas_cumple)
                    try {
                        const { data: reservasCumpleRows, error: reservasCumpleErr } = await supabaseClient
                            .from('reservas_cumple')
                            .select('id, nombre_nino, fecha, pagado');

                        if (!reservasCumpleErr && Array.isArray(reservasCumpleRows)) {
                            reservasCumpleRows.forEach(r => {
                                const fechaISO = normalizarFechaISO(r.fecha);
                                if (!fechaISO) return;
                                if (fechaISO < startISO || fechaISO >= endISOExclusive) return;
                                const paidColor = r.pagado ? '#16a34a' : '#f59e0b';
                                events.push({
                                    id: `reservaCumple:${r.id}`,
                                    title: `Cumpleaños - ${r.nombre_nino || 'Paciente'}`,
                                    start: fechaISO,
                                    allDay: true,
                                    backgroundColor: paidColor,
                                    extendedProps: { reservationType: 'cumple', reservationId: r.id }
                                });
                            });
                        }
                    } catch (err) {
                        console.warn('Error cargando reservas_cumple para calendario staff:', err);
                    }

                    const { data: eventosRows, error: eventosErr } = await supabaseClient
                        .from('eventos')
                        .select('id, nombre, fecha, horario')
                        .order('created_at', { ascending: false });
                    if (!eventosErr && Array.isArray(eventosRows)) {
                        const eventoIdToStartISO = new Map();
                        const eventoIdsInRange = [];

                        eventosRows.forEach(ev => {
                            const fechas = typeof parsearFechasEvento === 'function' ? parsearFechasEvento(ev.fecha) : [{ fecha: ev.fecha, display: ev.fecha }];
                            let startDateISO = null;
                            if (Array.isArray(fechas)) {
                                for (const f of fechas) {
                                    const iso = normalizarFechaISO(f?.fecha);
                                    if (iso && iso >= startISO && iso < endISOExclusive) {
                                        startDateISO = iso;
                                        break;
                                    }
                                }
                            }
                            if (!startDateISO) return;
                            eventoIdToStartISO.set(String(ev.id), startDateISO);
                            eventoIdsInRange.push(ev.id);
                        });

                        const uniqueEventoIds = Array.from(new Set(eventoIdsInRange)).filter(Boolean);
                        if (uniqueEventoIds.length > 0) {
                            const { data: reservasRows, error: reservasErr } = await supabaseClient
                                .from('reservas_eventos')
                                .select('id, evento_id, nombre_nino, nombre_padre, email, telefono, dias, total, pagado, comentarios_admin')
                                .in('evento_id', uniqueEventoIds);

                            if (!reservasErr && Array.isArray(reservasRows)) {
                                const eventoIdToInfo = new Map((eventosRows || []).map(ev => [String(ev.id), ev]));
                                reservasRows.forEach(r => {
                                    const eventoInfo = eventoIdToInfo.get(String(r.evento_id));
                                    const startDateISO = eventoIdToStartISO.get(String(r.evento_id));
                                    if (!eventoInfo || !startDateISO) return;
                                    const diasVal = r.dias ?? 1;
                                    const paidColor = r.pagado ? '#16a34a' : '#f59e0b';
                                    const diasSuffix = Number(diasVal) > 1 ? ` (+${diasVal - 1} días)` : '';

                                    events.push({
                                        id: `reservaEvento:${r.id}`,
                                        title: `Reserva: ${eventoInfo.nombre || 'Evento'}${diasSuffix}`,
                                        start: startDateISO,
                                        allDay: true,
                                        backgroundColor: paidColor,
                                        extendedProps: {
                                            reservationType: 'evento',
                                            reservationId: r.id
                                        }
                                    });
                                });
                            }
                        }
                    } else {
                        console.warn('Error cargando eventos para reservas calendario staff:', eventosErr?.message || eventosErr);
                    }
                }

                successCallback(events);
            } catch (e) {
                successCallback([]);
            }
        },
        eventClick: async (arg) => {
            const reservationType = arg.event.extendedProps?.reservationType;
            if (reservationType === 'evento') {
                const reservationId = arg.event.extendedProps?.reservationId;
                await abrirModalDetalleReservaEventoPorId(reservationId).catch(() => { /* ignore */ });
                return;
            }
            if (reservationType === 'cumple') {
                const reservationId = arg.event.extendedProps?.reservationId;
                await abrirModalDetalleReservaCumplePorId(reservationId).catch(() => { /* ignore */ });
                return;
            }
            const taskId = arg.event.extendedProps?.taskId || arg.event.id;
            const t = staffTasksCache.find(x => x.id === taskId);
            if (t) return mostrarDetalleEventoCalendario(t);

            // Fallback: si la caché está vacía, traemos el task por id.
            try {
                const { data } = await supabaseClient
                    .from('tasks')
                    .select('id, title, description, due_date, priority, status')
                    .eq('id', taskId)
                    .maybeSingle();
                if (data) mostrarDetalleEventoCalendario(data);
            } catch (_) { /* ignore */ }
        },
        dateClick: async (info) => {
            await mostrarDesgloseParaFecha(info.dateStr);
        }
    });
    staffCalendar.render();
}

document.addEventListener('click', (e) => {
    const addTaskForDayBtn = e.target?.closest?.('#staffAddTaskForDayBtn');
    if (addTaskForDayBtn) {
        const day = addTaskForDayBtn.getAttribute('data-day') || '';
        abrirFormularioTareaParaDia(day);
        return;
    }

    const calTodayBtn = e.target?.closest?.('#staffCalendarTodayBtn');
    const calMonthBtn = e.target?.closest?.('#staffCalendarMonthBtn');
    const calListBtn = e.target?.closest?.('#staffCalendarListBtn');

    if (calTodayBtn && typeof staffCalendar !== 'undefined' && staffCalendar) {
        staffCalendar.today();
        abrirVistaDetalleDiaCompleta(obtenerHoyISO());
        return;
    }
    if (calMonthBtn && typeof staffCalendar !== 'undefined' && staffCalendar) {
        cerrarVistaDetalleDiaCompleta();
        staffCalendar.changeView('dayGridMonth');
        return;
    }
    if (calListBtn && typeof staffCalendar !== 'undefined' && staffCalendar) {
        cerrarVistaDetalleDiaCompleta();
        staffCalendar.changeView('listWeek');
        return;
    }

    const backBtn = e.target?.closest?.('#staffTodayBackToCalendarBtn');
    if (backBtn) {
        cerrarVistaDetalleDiaCompleta();
        return;
    }

    const editTodayBtn = e.target?.closest?.('.staff-today-detail-edit-btn');
    if (editTodayBtn) {
        const taskId = editTodayBtn.getAttribute('data-task-id');
        const t = staffTasksCache.find(x => x.id === taskId);
        if (t) {
            cargarTareaEnFormulario(t);
            const navItems = document.querySelectorAll('.staff-nav-item');
            navItems.forEach(b => b.classList.toggle('active', b.getAttribute('data-section') === 'tasks'));
            mostrarSeccionStaff('tasks');
        }
        return;
    }

    const closeBtn = e.target?.closest?.('#staffDayBreakdownCloseBtn');
    if (closeBtn) {
        cerrarDesgloseDia();
        return;
    }

    const editBtn = e.target?.closest?.('.staff-day-edit-btn');
    if (editBtn) {
        const taskId = editBtn.getAttribute('data-task-id');
        const t = staffTasksCache.find(x => x.id === taskId);
        if (t) {
            cargarTareaEnFormulario(t);
            const navItems = document.querySelectorAll('.staff-nav-item');
            navItems.forEach(b => b.classList.toggle('active', b.getAttribute('data-section') === 'tasks'));
            mostrarSeccionStaff('tasks');
        }
        return;
    }

    // Clic sobre una tarea del "desglose del día": abrir detalle
    const dayTaskItem = e.target?.closest?.('.staff-day-task-item');
    if (dayTaskItem) {
        const taskId = dayTaskItem.getAttribute('data-task-id');
        abrirDetalleTareaPorId(taskId).catch(() => { /* ignore */ });
        return;
    }

    // Clic sobre una tarea del "detalle del día" (cuando se abre con Today): abrir detalle
    const todayDetailTaskItem = e.target?.closest?.('.staff-today-detail-task-item');
    if (todayDetailTaskItem) {
        const taskId = todayDetailTaskItem.getAttribute('data-task-id');
        abrirDetalleTareaPorId(taskId).catch(() => { /* ignore */ });
        return;
    }
});

document.addEventListener('click', async (e) => {
    const closeDetailBtn = e.target?.closest?.('#staffCalendarEventCloseBtn');
    if (closeDetailBtn) {
        const box = document.getElementById('staffCalendarEventDetail');
        if (box) box.style.display = 'none';
        return;
    }

    const editFromDetailBtn = e.target?.closest?.('#staffCalendarEventEditBtn');
    if (editFromDetailBtn) {
        const taskId = editFromDetailBtn.getAttribute('data-task-id');
        const t = staffTasksCache.find(x => x.id === taskId);
        if (t) {
            cargarTareaEnFormulario(t);
            const navItems = document.querySelectorAll('.staff-nav-item');
            navItems.forEach(b => b.classList.toggle('active', b.getAttribute('data-section') === 'tasks'));
            mostrarSeccionStaff('tasks');
        }
    }

    const saveCommentBtn = e.target?.closest?.('#staffCalendarEventSaveCommentBtn');
    if (saveCommentBtn) {
        const taskId = saveCommentBtn.getAttribute('data-task-id');
        const textarea = document.getElementById('staffCalendarEventCommentInput');
        const texto = textarea?.value?.trim() ?? '';
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .update({ description: texto, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            await cargarTareasStaff();
            await cargarResumenDashboardStaff();
            if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            const t = staffTasksCache.find(x => x.id === taskId) || null;
            if (t) mostrarDetalleEventoCalendario(t);
        } catch (err) {
            console.error('Error guardando comentario:', err);
        }
        return;
    }

    const toggleCompleteBtn = e.target?.closest?.('#staffCalendarEventToggleCompleteBtn');
    if (toggleCompleteBtn) {
        const taskId = toggleCompleteBtn.getAttribute('data-task-id');
        const currentStatus = toggleCompleteBtn.getAttribute('data-current-status') || '';
        const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            await cargarTareasStaff();
            await cargarResumenDashboardStaff();
            if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            const t = staffTasksCache.find(x => x.id === taskId) || null;
            if (t) {
                mostrarDetalleEventoCalendario(t);
            } else {
                const { data } = await supabaseClient
                    .from('tasks')
                    .select('id, title, description, due_date, priority, status')
                    .eq('id', taskId)
                    .maybeSingle();
                if (data) mostrarDetalleEventoCalendario(data);
            }
        } catch (err) {
            console.error('Error cambiando estado:', err);
        }
        return;
    }
});

document.addEventListener('click', async (e) => {
    const modal = document.getElementById('staffTaskQuickModal');
    if (!modal || modal.style.display === 'none') return;

    if (e.target === modal || e.target?.closest?.('#staffTaskModalCloseBtn')) {
        cerrarModalDetalleTarea();
        return;
    }

    const taskId = modal.getAttribute('data-task-id');
    if (!taskId) return;

    const saveBtn = e.target?.closest?.('#staffTaskModalSaveCommentBtn');
    if (saveBtn) {
        const txt = document.getElementById('staffTaskModalCommentInput')?.value?.trim() ?? '';
        try {
            const internalPrefix = modal.getAttribute('data-internal-prefix') || '';
            const newDescription = internalPrefix
                ? `${internalPrefix}${txt ? '\n' + txt : ''}`
                : txt;
            const { error } = await supabaseClient
                .from('tasks')
                .update({ description: newDescription, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            await refrescarTareaYReabrirModal(taskId);
        } catch (err) {
            console.error('Error guardando comentario de tarea:', err);
        }
        return;
    }

    const toggleBtn = e.target?.closest?.('#staffTaskModalToggleCompleteBtn');
    if (toggleBtn) {
        const current = modal.getAttribute('data-current-status') || 'pending';
        const next = current === 'completed' ? 'pending' : 'completed';
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .update({ status: next, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            await refrescarTareaYReabrirModal(taskId);
        } catch (err) {
            console.error('Error cambiando estado de tarea:', err);
        }
        return;
    }

    const progressBtn = e.target?.closest?.('#staffTaskModalInProgressBtn');
    if (progressBtn) {
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            await refrescarTareaYReabrirModal(taskId);
        } catch (err) {
            console.error('Error marcando tarea en progreso:', err);
        }
        return;
    }

    const editBtn = e.target?.closest?.('#staffTaskModalEditBtn');
    if (editBtn) {
        const t = staffTasksCache.find(x => x.id === taskId);
        if (t) cargarTareaEnFormulario(t);
        cerrarModalDetalleTarea();
        return;
    }
});

document.addEventListener('click', async (e) => {
    const modal = document.getElementById('staffReservationQuickModal');
    if (!modal || modal.style.display === 'none') return;
    if (e.target === modal || e.target?.closest?.('#staffReservationModalCloseBtn')) {
        cerrarModalDetalleReservaEvento();
        return;
    }

    const addTodoBtn = e.target?.closest?.('#staffReservationTodoAddBtn');
    if (addTodoBtn) {
        await crearTodoEnModal();
        return;
    }

    const todoCheckboxLabel = e.target?.closest?.('.staffReservationTodoCheckboxLabel');
    if (todoCheckboxLabel) {
        const taskId = todoCheckboxLabel.getAttribute('data-todo-task-id') || '';
        if (!taskId) return;
        const inputEl = todoCheckboxLabel.querySelector?.('.staffReservationTodoCheckbox');
        const nextStatus = inputEl?.checked ? 'completed' : 'pending';
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .update({ status: nextStatus, updated_at: new Date().toISOString() })
                .eq('id', taskId);
            if (error) throw error;
            await cargarToDosReservaEnModal();
            if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            cargarResumenDashboardStaff();
        } catch (err) {
            console.error('Error actualizando to-do:', err);
            alert('No se pudo actualizar el to-do.');
        }
        return;
    }

    const deleteTodoBtn = e.target?.closest?.('[data-delete-todo-task-id]');
    if (deleteTodoBtn) {
        const taskId = deleteTodoBtn.getAttribute('data-delete-todo-task-id') || '';
        if (!taskId) return;
        const ok = window.confirm('¿Borrar este to-do? Esta acción no se puede deshacer.');
        if (!ok) return;
        try {
            const { error } = await supabaseClient
                .from('tasks')
                .delete()
                .eq('id', taskId);
            if (error) throw error;
            await cargarToDosReservaEnModal();
            if (typeof staffCalendar !== 'undefined' && staffCalendar) staffCalendar.refetchEvents();
            cargarResumenDashboardStaff();
        } catch (err) {
            console.error('Error borrando to-do:', err);
            alert('No se pudo borrar el to-do.');
        }
        return;
    }
});

// Configuración escalable para contactos de staff (admin ↔ secretaria)
const STAFF_COUNTERPART_LABELS = { admin: 'Admin', secretary: 'Secretaria' };

async function obtenerContraparteStaff(uid) {
    const role = currentStaffRole || 'secretary';
    const counterpartRole = role === 'admin' ? 'secretary' : 'admin';
    const label = STAFF_COUNTERPART_LABELS[counterpartRole] || counterpartRole;

    // 1. Intentar staff_members (tabla escalable para múltiples staff)
    try {
        const { data: staff } = await supabaseClient
            .from('staff_members')
            .select('id, role, display_name')
            .eq('role', counterpartRole)
            .neq('id', uid)
            ;
        if (staff && Array.isArray(staff) && staff.length > 0) {
            return staff.map(s => ({
                id: s.id,
                label: s.display_name || STAFF_COUNTERPART_LABELS[s.role] || label || ('Usuario ' + String(s.id).slice(0, 8))
            }));
        }
    } catch (_) { /* staff_members puede no existir */ }

    // 2. Intentar profiles (id, role)
    try {
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, role')
            .eq('role', counterpartRole)
            .neq('id', uid)
            ;
        if (profiles && Array.isArray(profiles) && profiles.length > 0) {
            return profiles.map(p => ({
                id: p.id,
                label: STAFF_COUNTERPART_LABELS[p.role] || label || ('Usuario ' + String(p.id).slice(0, 8))
            }));
        }
    } catch (_) { /* fallback */ }

    // 3. Config manual (window.STAFF_COUNTERPART_IDS = { admin: 'uuid', secretary: 'uuid' })
    const manual = typeof window.STAFF_COUNTERPART_IDS === 'object' && window.STAFF_COUNTERPART_IDS[counterpartRole];
    if (manual) {
        const ids = Array.isArray(manual) ? manual : [manual];
        return ids
            .filter(Boolean)
            .map(idVal => ({ id: idVal, label }));
    }

    return [];
}

async function enriquecerContactosConStaff(contactMap, uid) {
    if (!supabaseClient || !contactMap || contactMap.size === 0) return;
    const ids = Array.from(contactMap.keys());

    // 1) staff_members con display_name / role
    try {
        const { data: staff } = await supabaseClient
            .from('staff_members')
            .select('id, role, display_name')
            .in('id', ids);
        (staff || []).forEach(row => {
            const baseLabel =
                row.display_name ||
                STAFF_COUNTERPART_LABELS[row.role] ||
                ('Usuario ' + String(row.id).slice(0, 8));
            contactMap.set(row.id, { label: baseLabel });
        });
        if (staff && staff.length) return;
    } catch (_) { /* si falla, seguimos con profiles */ }

    // 2) profiles con role, por si aún no existe staff_members
    try {
        const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, role')
            .in('id', ids);
        (profiles || []).forEach(row => {
            const baseLabel =
                STAFF_COUNTERPART_LABELS[row.role] ||
                ('Usuario ' + String(row.id).slice(0, 8));
            contactMap.set(row.id, { label: baseLabel });
        });
    } catch (_) { /* último fallback: dejar labels existentes */ }
}

async function cargarConversacionesStaff() {
    const listEl = document.getElementById('staffConversationsList');
    if (!listEl || !supabaseClient || !currentStaffSession) return;
    const uid = currentStaffSession.user.id;
    try {
        const { data: messages } = await supabaseClient.from('messages').select('*').or(`sender_id.eq.${uid},receiver_id.eq.${uid}`).order('created_at', { ascending: false });
        const contactMap = new Map(); // id -> { label }

        // 1) Mostrar TODAS las cuentas del staff portal (menos la actual), aunque no haya historial.
        try {
            const staffRows = await cargarContactosStaffPortal();
            (staffRows || []).forEach(s => {
                if (!s?.id || s.id === uid) return;
                contactMap.set(s.id, { label: s.label || String(s.id).slice(0, 8) });
            });
        } catch (_) { /* fallback */ }

        // 2) Asegurar que cualquier ID presente en mensajes también aparezca
        (messages || []).forEach(m => {
            const otherId = m.sender_id === uid ? m.receiver_id : m.sender_id;
            if (otherId && !contactMap.has(otherId)) {
                contactMap.set(otherId, { label: 'Usuario ' + String(otherId).slice(0, 8) });
            }
        });

        // 3) Enriquecer labels con información de staff (display_name / role)
        await enriquecerContactosConStaff(contactMap, uid);

        // 4) Si seguimos sin contactos, fallback a contrapartes
        if (contactMap.size === 0) {
            const counterparts = await obtenerContraparteStaff(uid);
            (counterparts || []).forEach(c => {
                if (c?.id) contactMap.set(c.id, { label: c.label });
            });
        }

        if (contactMap.size === 0) {
            listEl.innerHTML = '<p style="font-size:0.9rem; color:#6b7280;">No hay contactos de staff configurados. Crea la tabla staff_members o profiles con role.</p>';
            return;
        }

        listEl.innerHTML = Array.from(contactMap.entries()).map(([id, { label }]) => {
            const unreadCount = (messages || []).filter(m => m.sender_id === id && m.receiver_id === uid && !m.read_status).length;
            return `<div class="staff-conv-item" data-receiver-id="${escapeHtml(id)}" data-receiver-label="${escapeHtml(label)}">${escapeHtml(label)}${unreadCount ? ` <span class="staff-unread-badge">${unreadCount}</span>` : ''}</div>`;
        }).join('');
        listEl.querySelectorAll('.staff-conv-item').forEach(item => {
            item.addEventListener('click', () => seleccionarConversacionStaff(item.getAttribute('data-receiver-id'), item.getAttribute('data-receiver-label') || item.getAttribute('data-receiver-id')));
        });
    } catch (e) {
        console.error('Error cargando conversaciones:', e);
        listEl.innerHTML = '<p style="color:#b91c1c;">Error al cargar.</p>';
    }
}

async function seleccionarConversacionStaff(otherUserId, otherLabel) {
    const uid = currentStaffSession?.user?.id;
    if (!uid || !supabaseClient) return;
    document.getElementById('staffCurrentReceiverId').value = otherUserId;
    document.getElementById('staffConversationTitle').textContent = otherLabel || otherUserId;
    const historyEl = document.getElementById('staffMessagesHistory');
    const { data } = await supabaseClient.from('messages').select('*').or(`and(sender_id.eq.${uid},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${uid})`).order('created_at', { ascending: true });
    historyEl.innerHTML = (data || []).map(m => {
        const isMe = m.sender_id === uid;
        const time = new Date(m.created_at).toLocaleString('es-PR', { timeStyle: 'short', dateStyle: 'short' });
        return `<div class="staff-msg ${isMe ? 'staff-msg-me' : 'staff-msg-them'}"><div>${escapeHtml(m.message)}</div><small>${time}</small></div>`;
    }).join('');
    historyEl.scrollTop = historyEl.scrollHeight;
    await supabaseClient.from('messages').update({ read_status: true }).eq('receiver_id', uid).eq('sender_id', otherUserId);
    cargarConversacionesStaff();
    cargarResumenDashboardStaff();
}

document.addEventListener('DOMContentLoaded', () => {
    const msgForm = document.getElementById('staffMessageForm');
    if (msgForm) {
        msgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const receiverId = document.getElementById('staffCurrentReceiverId').value;
            const input = document.getElementById('staffMessageInput');
            const text = input?.value?.trim();
            if (!text || !receiverId || !supabaseClient || !currentStaffSession) return;
            try {
                const { error } = await supabaseClient.from('messages').insert([{ sender_id: currentStaffSession.user.id, receiver_id: receiverId, message: text }]);
                if (error) throw error;
                input.value = '';
                seleccionarConversacionStaff(receiverId, document.getElementById('staffConversationTitle').textContent);
            } catch (err) {
                console.error('Error enviando mensaje:', err);
            }
        });
    }
});

// Cargar bloques de disponibilidad para un servicio concreto
async function cargarSlotsServicio(nombreServicio) {
    const slotSelect = document.getElementById('servicioSlot');
    const contCalendario = document.getElementById('servicioCalendario');
    if (!slotSelect) return;
    if (!supabaseClient) {
        slotSelect.innerHTML = '<option value="">Calendario no disponible en este momento</option>';
        slotSelect.required = false;
        if (contCalendario) {
            contCalendario.innerHTML = '<p style="color:#666; font-size:0.8rem;">Calendario no disponible.</p>';
        }
        return;
    }
    try {
        const hoyISO = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseClient
            .from('disponibilidad_servicios')
            .select('*')
            .eq('servicio', nombreServicio)
            .eq('disponible', true)
            .gte('fecha', hoyISO)
            .order('fecha', { ascending: true })
            .order('hora', { ascending: true });
        if (error) throw error;
        const filas = data || [];
        if (filas.length === 0) {
            slotSelect.innerHTML = '<option value="">No hay espacios disponibles para este servicio</option>';
            slotSelect.required = false;
            if (contCalendario) {
                contCalendario.innerHTML = '<p style="color:#666; font-size:0.8rem;">No hay fechas con disponibilidad para este servicio.</p>';
            }
            return;
        }
        slotSelect.required = true;
        slotSelect.innerHTML = '<option value="">Selecciona fecha y hora disponible</option>' +
            filas.map(f => {
                const texto = formatearFechaHoraSlot(f.fecha, f.hora);
                return `<option value="${f.id}">${texto}</option>`;
            }).join('');

        // Renderizar mini-calendario indicador para este servicio
        if (contCalendario) {
            renderizarCalendarioServicio(filas, contCalendario);
        }
    } catch (e) {
        console.error('Error cargando slots de servicio:', e);
        slotSelect.innerHTML = '<option value="">No se pudo cargar la disponibilidad</option>';
        slotSelect.required = false;
        if (contCalendario) {
            contCalendario.innerHTML = '<p style="color:#666; font-size:0.8rem;">Error al cargar el calendario.</p>';
        }
    }
}

// Cargar horarios disponibles para cumpleaños en una fecha dada
async function cargarSlotsCumpleParaFecha(fechaISO) {
    const grupo = document.getElementById('cumpleHoraGroup');
    const select = document.getElementById('cumpleHoraSlot');
    const aviso = document.getElementById('cumpleHoraNoSlots');
    if (!grupo || !select || !aviso) return;
    if (!fechaISO) {
        grupo.style.display = 'none';
        aviso.style.display = 'none';
        return;
    }
    if (!supabaseClient) {
        grupo.style.display = 'none';
        aviso.style.display = 'block';
        aviso.textContent = 'El calendario no está disponible en este momento. Por favor contáctanos para coordinar.';
        return;
    }
    try {
        const { data, error } = await supabaseClient
            .from('disponibilidad_cumple')
            .select('*')
            .eq('fecha', fechaISO)
            .eq('disponible', true)
            .order('hora', { ascending: true });
        if (error) throw error;
        const filas = data || [];
        if (filas.length === 0) {
            grupo.style.display = 'none';
            select.innerHTML = '<option value="">Sin horarios</option>';
            aviso.style.display = 'block';
            aviso.textContent = 'No hay horarios disponibles para esta fecha. Por favor elige otra fecha o contáctanos directamente.';
            return;
        }
        aviso.style.display = 'none';
        grupo.style.display = 'block';
        select.innerHTML = '<option value="">Selecciona un horario disponible</option>' +
            filas.map(f => {
                const hora = f.hora ? f.hora.substring(0,5) : '';
                return `<option value="${hora}">${hora}</option>`;
            }).join('');
    } catch (e) {
        console.error('Error cargando horarios de cumpleaños:', e);
        grupo.style.display = 'none';
        aviso.style.display = 'block';
        aviso.textContent = 'Error al cargar los horarios disponibles.';
    }
}

// ==================== CALENDARIO PERSONALIZADO CUMPLEAÑOS ====================

function renderizarCalendarioCumple() {
    const cont = document.getElementById('cumpleCalendario');
    const inputFecha = document.getElementById('cumpleFecha');
    if (!cont || !inputFecha) return;

    // Fecha base: mes actual o fecha seleccionada
    const hoy = new Date();
    const fechaSel = inputFecha.value ? new Date(inputFecha.value) : hoy;
    let year = fechaSel.getFullYear();
    let month = fechaSel.getMonth(); // 0-11

    function actualizar() {
        if (!supabaseClient) {
            cont.innerHTML = '<p style="color:#666; font-size:0.85rem;">Calendario no disponible. Por favor elige cualquier fecha y te contactaremos para coordinar.</p>';
            return;
        }
        const primerDiaMes = new Date(year, month, 1);
        const ultimoDiaMes = new Date(year, month + 1, 0);
        const inicioISO = primerDiaMes.toISOString().split('T')[0];
        const finISO = ultimoDiaMes.toISOString().split('T')[0];

        supabaseClient
            .from('disponibilidad_cumple')
            .select('fecha, disponible')
            .eq('disponible', true)
            .gte('fecha', inicioISO)
            .lte('fecha', finISO)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error cargando disponibilidad para calendario:', error);
                    cont.innerHTML = '<p style="color:#666; font-size:0.85rem;">Error al cargar el calendario.</p>';
                    return;
                }
                const fechasDisponibles = new Set((data || []).map(f => f.fecha));

                const nombresMes = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
                const header = `
                    <div class="calendario-header">
                        <button type="button" class="calendario-nav-btn" data-dir="-1">‹</button>
                        <span>${nombresMes[month]} ${year}</span>
                        <button type="button" class="calendario-nav-btn" data-dir="1">›</button>
                    </div>
                `;
                const diasSemana = ['L','M','X','J','V','S','D'];
                let grid = '<div class="calendario-grid">';
                diasSemana.forEach(d => {
                    grid += `<div class="calendario-dia-header">${d}</div>`;
                });
                const offset = (primerDiaMes.getDay() + 6) % 7; // Lunes=0
                for (let i = 0; i < offset; i++) {
                    grid += '<div class="calendario-dia vacio"></div>';
                }
                const hoyISO = hoy.toISOString().split('T')[0];
                // Calcular fecha mínima según decoración seleccionada
                const decoracionSel = document.getElementById('cumpleDecoracion');
                let minISO = null;
                if (decoracionSel && decoracionSel.value) {
                    let diasMinimos;
                    if (decoracionSel.value === '0') {
                        diasMinimos = 14;
                    } else if (decoracionSel.value === '175') {
                        diasMinimos = 21;
                    } else if (decoracionSel.value === '350') {
                        diasMinimos = 28;
                    } else {
                        diasMinimos = 14;
                    }
                    const fechaMin = new Date(hoy.getTime() + diasMinimos * 24 * 60 * 60 * 1000);
                    minISO = fechaMin.toISOString().split('T')[0];
                }
                for (let d = 1; d <= ultimoDiaMes.getDate(); d++) {
                    const fechaActual = new Date(year, month, d);
                    const iso = fechaActual.toISOString().split('T')[0];
                    const esFuturo = iso >= hoyISO;
                    const cumpleMin = !minISO || iso >= minISO;
                    const tieneSlots = fechasDisponibles.has(iso) && cumpleMin;
                    let clases = 'calendario-dia';
                    if (tieneSlots && esFuturo) {
                        clases += ' disponible';
                        if (inputFecha.value === iso) clases += ' seleccionado';
                    } else {
                        clases += ' no-disponible';
                    }
                    grid += `<div class="${clases}" data-fecha="${iso}">${d}</div>`;
                }
                grid += '</div>';
                cont.innerHTML = header + grid;

                // Navegación de mes
                cont.querySelectorAll('.calendario-nav-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const dir = parseInt(btn.dataset.dir, 10);
                        month += dir;
                        if (month < 0) { month = 11; year--; }
                        if (month > 11) { month = 0; year++; }
                        actualizar();
                    });
                });

                // Selección de día
                cont.querySelectorAll('.calendario-dia.disponible').forEach(diaEl => {
                    diaEl.addEventListener('click', () => {
                        const iso = diaEl.dataset.fecha;
                        const decoracionSel = document.getElementById('cumpleDecoracion');
                        if (!decoracionSel || !decoracionSel.value) {
                            alert('Primero selecciona el tipo de decoración para ver desde cuándo puedes reservar.');
                            return;
                        }
                        inputFecha.value = iso;
                        cont.querySelectorAll('.calendario-dia.disponible').forEach(el => el.classList.remove('seleccionado'));
                        diaEl.classList.add('seleccionado');
                        cargarSlotsCumpleParaFecha(iso);
                    });
                });
            });
    }

    actualizar();
}

// Formatear fecha y hora para mostrar en selects
function formatearFechaHoraSlot(fechaISO, horaStr) {
    if (!fechaISO || !horaStr) return `${fechaISO} ${horaStr}`;
    try {
        const [h, m] = horaStr.split(':').map(n => parseInt(n, 10));
        const fecha = new Date(fechaISO + 'T' + horaStr);
        const opcionesFecha = { weekday: 'short', month: 'short', day: 'numeric' };
        const opcionesHora = { hour: 'numeric', minute: '2-digit' };
        const textoFecha = fecha.toLocaleDateString('es-PR', opcionesFecha);
        const textoHora = new Date(0, 0, 0, h, m).toLocaleTimeString('es-PR', opcionesHora);
        return `${textoFecha} - ${textoHora}`;
    } catch {
        return `${fechaISO} ${horaStr}`;
    }
}

// Variables globales para navegación
let navMenu = null;

// Page Navigation System
function navigateToPage(pageName) {
    if (!pageName) {
        return;
    }
    
    // Ocultar TODAS las páginas primero
    const allPages = document.querySelectorAll('.page-content');
    allPages.forEach(page => {
        page.classList.remove('active');
        // Usar setProperty con important flag
        page.style.setProperty('display', 'none', 'important');
    });
    
    // Mostrar la página seleccionada
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.classList.add('active');
        // Usar setProperty con important flag
        targetPage.style.setProperty('display', 'block', 'important');
        
        // Scroll al inicio
        setTimeout(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 50);
    }
    
    // Actualizar enlaces de navegación
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });
    
    // Cerrar menú móvil si está abierto
    if (navMenu) {
        navMenu.classList.remove('active');
    }
    
    // Actualizar URL para poder compartir enlaces (ej. sitio.com/#eventos)
    if (pageName) {
        history.replaceState(null, '', '#' + pageName);
    }
}

// Leer página y parámetros desde la URL (#eventos, ?reservar=san-valentin#eventos)
function leerUrlActual() {
    const hash = (window.location.hash || '').replace(/^#/, '');
    const pageName = hash.split('?')[0].trim();
    const params = new URLSearchParams(window.location.search || (hash.indexOf('?') >= 0 ? hash.split('?')[1] || '' : ''));
    const reservar = params.get('reservar');
    return { pageName: pageName || null, reservar: reservar || null };
}

// Aplicar URL al cargar: ir a la página del hash y, si aplica, marcar reserva pendiente
function aplicarUrlInicial() {
    const { pageName, reservar } = leerUrlActual();
    if (pageName && document.getElementById(pageName) && typeof navigateToPage === 'function') {
        navigateToPage(pageName);
    }
    if (pageName === 'eventos' && reservar) {
        window.pendingReservarSlug = reservar;
    }
}

// Flag para evitar agregar listeners múltiples veces
let navegacionInicializada = false;

// Inicializar navegación cuando el DOM esté listo
function inicializarNavegacion() {
    if (navegacionInicializada) {
        return; // Ya se inicializó
    }
    
    // Mobile Navigation
    const hamburger = document.getElementById('hamburger');
    navMenu = document.getElementById('navMenu'); // Asignar a variable global
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }

    // Nav link click handlers
    const navLinks = document.querySelectorAll('.nav-link');
    console.log('🔗 Enlaces de navegación encontrados:', navLinks.length);
    
    navLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const page = link.dataset.page;
            console.log('🖱️ Click en enlace:', link.textContent, 'Página:', page);
            if (page) {
                navigateToPage(page);
            } else {
                console.error('❌ Enlace sin data-page:', link);
            }
        });
    });

    const goToAdminBtn = document.getElementById('goToAdminBtn');
    const goToStaffBtn = document.getElementById('goToStaffBtn');
    if (goToAdminBtn) goToAdminBtn.addEventListener('click', () => navigateToPage('admin'));
    if (goToStaffBtn) goToStaffBtn.addEventListener('click', () => navigateToPage('staff'));

    // Button navigation handlers - Solo se agrega UNA VEZ
    document.addEventListener('click', function botonClickHandler(e) {
        // Buscar el botón o elemento con data-page en el target o sus padres
        let target = e.target;
        let element = null;
        
        // Verificar si el target tiene data-page
        if (target.hasAttribute && target.hasAttribute('data-page')) {
            element = target;
        } else {
            // Buscar en los padres
            target = target.closest('[data-page]');
            if (target) {
                element = target;
            }
        }
        
        // Si encontramos un elemento con data-page y es un botón o tiene la clase btn
        if (element && (element.tagName === 'BUTTON' || element.classList.contains('btn'))) {
            e.preventDefault();
            e.stopPropagation();
            const page = element.dataset.page;
            console.log('🖱️ Click en botón:', element.textContent?.trim() || element.className, 'Página:', page);
            if (page) {
                navigateToPage(page);
            } else {
                console.error('❌ Botón sin data-page:', element);
            }
        }
    });
    
    console.log('✅ Event listeners de navegación configurados');
    
    // Footer links
    document.querySelectorAll('.footer-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                const page = href.substring(1);
                navigateToPage(page);
            }
        });
    });
    
    navegacionInicializada = true;
    console.log('✅ Navegación inicializada');
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarNavegacion);
} else {
    inicializarNavegacion();
}

// ==================== EVENTOS ====================

// Cargar eventos solo desde Supabase (sin mock / eventos.json)
async function cargarEventos() {
    try {
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('eventos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error cargando eventos desde Supabase:', error);
                mostrarEventos([]);
                return;
            }

            const eventos = (data || []).map(e => ({
                id: e.id,
                nombre: e.nombre,
                descripcion: e.descripcion,
                fecha: e.fecha,
                horario: e.horario || '',
                edad: e.edad || '',
                precio: parseFloat(e.precio),
                cupos: parseInt(e.cupos),
                imagen: e.imagen || ''
            }));

            mostrarEventos(eventos);
            return;
        }

        // Sin Supabase: no mostrar datos mock, solo vacío
        mostrarEventos([]);
    } catch (error) {
        console.error('Error cargando eventos:', error);
        mostrarEventos([]);
    }
}

// Mostrar eventos en la página
function mostrarEventos(eventos) {
    const container = document.getElementById('eventosContainer');
    const noEventos = document.getElementById('noEventos');
    
    if (!container || !noEventos) return;
    
    if (!eventos || eventos.length === 0) {
        container.innerHTML = '';
        noEventos.style.display = 'block';
        return;
    }
    
    noEventos.style.display = 'none';
    container.innerHTML = '';
    
    eventos.forEach(evento => {
        const card = crearEventoCard(evento);
        container.appendChild(card);
    });
    
    // Si se abrió el sitio con ?reservar=san-valentin#eventos, abrir el modal de ese evento
    const slug = window.pendingReservarSlug;
    if (slug && eventos.length > 0) {
        window.pendingReservarSlug = null;
        const slugToName = { 'san-valentin': 'San Valentín', 'san valentin': 'San Valentín' };
        const nombreBuscar = slugToName[slug.toLowerCase()] || slug.replace(/-/g, ' ');
        const evento = eventos.find(e => e.nombre && e.nombre.toLowerCase().includes(nombreBuscar.toLowerCase()));
        if (evento) {
            setTimeout(() => abrirModalEvento(evento.id), 300);
        }
    }
}

// Crear tarjeta de evento
function crearEventoCard(evento) {
    const card = document.createElement('div');
    card.className = 'evento-card' + (evento.imagen ? ' evento-card-con-flyer' : '');
    
    const cuposClase = evento.cupos <= 5 ? 'pocos' : evento.cupos === 0 ? 'agotado' : '';
    const cuposTexto = evento.cupos === 0 ? 'Agotado' : `${evento.cupos} cupos disponibles`;
    
    card.innerHTML = `
        <div class="evento-content">
            <h3 class="evento-title">${evento.nombre}</h3>
            <p class="evento-description">${evento.descripcion}</p>
            <div class="evento-info">
                <div class="evento-info-item">
                    <span><strong>Fecha:</strong> ${evento.fecha}</span>
                </div>
                ${evento.horario ? `
                <div class="evento-info-item">
                    <span><strong>Horario:</strong> ${evento.horario}</span>
                </div>
                ` : ''}
                ${evento.edad ? `
                <div class="evento-info-item">
                    <span><strong>Edad:</strong> ${evento.edad}</span>
                </div>
                ` : ''}
            </div>
            <div class="evento-precio">$${evento.precio}</div>
            <div class="evento-cupos ${cuposClase}">${cuposTexto}</div>
            ${evento.cupos > 0 ? '<button class="btn btn-primary" onclick="abrirModalEvento(\'' + evento.id + '\')">Reservar Ahora</button>' : ''}
        </div>
        ${evento.imagen ? `
        <div class="evento-flyer-col">
            <img src="${evento.imagen}" alt="Flyer ${evento.nombre}" class="evento-flyer-img">
        </div>
        ` : ''}
    `;
    
    return card;
}

// Abrir modal de evento
async function abrirModalEvento(eventoId) {
    try {
        let evento = null;

        // Prefer Supabase when available (same source as the activity list)
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('eventos')
                .select('*')
                .eq('id', eventoId)
                .maybeSingle();

            if (!error && data) {
                evento = {
                    id: data.id,
                    nombre: data.nombre,
                    descripcion: data.descripcion,
                    fecha: data.fecha,
                    horario: data.horario || '',
                    edad: data.edad || '',
                    precio: parseFloat(data.precio),
                    cupos: parseInt(data.cupos),
                    imagen: data.imagen || ''
                };
            }
        }

        // Fallback: localStorage or eventos.json
        if (!evento) {
            const eventosGuardados = localStorage.getItem('youme_eventos');
            let eventos = [];
            if (eventosGuardados) {
                eventos = JSON.parse(eventosGuardados);
            } else {
                try {
                    const response = await fetch('eventos.json');
                    const data = await response.json();
                    eventos = data.eventos || [];
                } catch (_) {
                    eventos = [];
                }
            }
            evento = eventos.find(e => String(e.id) === String(eventoId));
        }

        if (!evento) {
            alert('Evento no encontrado');
            return;
        }
        
        const modal = document.getElementById('eventoModal');
        const modalContent = document.getElementById('eventoModalContent');
        
        // Detectar si es un campamento de varios días
        const esMultiDia = evento.nombre.toLowerCase().includes('campamento') || 
                          evento.descripcion.toLowerCase().includes('campamento') ||
                          evento.fecha.includes('-');
        
        // Guardar datos del evento temporalmente para las funciones
        window.currentEventoData = {
            fecha: evento.fecha,
            precio: evento.precio
        };
        
        modalContent.innerHTML = `
            <h2>${evento.nombre}</h2>
            <div class="modal-evento-layout">
                ${evento.imagen ? `
                <div class="modal-evento-flyer-col">
                    <img src="${evento.imagen}" alt="Flyer ${evento.nombre}" class="modal-evento-flyer">
                </div>
                ` : ''}
                <div class="modal-evento-details">
                    <p><strong>Descripción:</strong> ${evento.descripcion}</p>
                    <p><strong>Fecha:</strong> ${evento.fecha}</p>
                    ${evento.horario ? `<p><strong>Horario:</strong> ${evento.horario}</p>` : ''}
                    ${evento.edad ? `<p><strong>Edad:</strong> ${evento.edad}</p>` : ''}
                    <p><strong>Precio base:</strong> $${evento.precio}${esMultiDia ? ' por día' : ''}</p>
                    <p><strong>Cupos disponibles:</strong> ${evento.cupos}</p>
                    
                    <form id="eventoRsvpForm" style="margin-top: 2rem;">
                    <div class="form-group">
                        <label>Nombre del niño/a:</label>
                        <input type="text" id="eventoNombreNino" required>
                    </div>
                    <div class="form-group">
                        <label>Edad del niño/a:</label>
                        <input type="number" id="eventoEdadNino" min="1" required>
                    </div>
                    ${esMultiDia ? `
                    <div class="form-group">
                        <label>¿Cuántos días asistirá?</label>
                        <select id="eventoDias" onchange="mostrarSelectorFechasActual()">
                            <option value="1">1 día - $${evento.precio}</option>
                            <option value="2" selected>2 días - $${evento.precio * 2}</option>
                            <option value="3">3 días - $${evento.precio * 3}</option>
                            <option value="4">4 días - $${evento.precio * 4}</option>
                            <option value="5">5 días - $${evento.precio * 5}</option>
                        </select>
                    </div>
                    <div id="selectorFechas" class="form-group" style="display: none;">
                        <!-- Las fechas se generarán aquí dinámicamente -->
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <label>Nombre del padre/madre:</label>
                        <input type="text" id="eventoNombrePadre" required>
                    </div>
                    <div class="form-group">
                        <label>Email:</label>
                        <input type="email" id="eventoEmail" required>
                    </div>
                    <div class="form-group">
                        <label>Teléfono:</label>
                        <input type="tel" id="eventoTelefono" required>
                    </div>
                    <div id="totalEventoDisplay" style="background: var(--turquoise); color: white; padding: 1.5rem; border-radius: 10px; text-align: center; margin: 1rem 0;">
                        <h4 style="margin-bottom: 0.5rem;">Total a Pagar:</h4>
                        <div style="font-size: 2.5rem; font-weight: bold;" id="totalEventoMonto">$${esMultiDia ? evento.precio * 2 : evento.precio}</div>
                    </div>
                    <button type="button" class="btn btn-primary btn-large" onclick="procesarRsvpEvento('${String(evento.id).replace(/'/g, "\\'")}', ${evento.precio}, ${esMultiDia}, '${String(evento.nombre || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">
                        Confirmar y Pagar
                    </button>
                </form>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
        // Inicializar selector de fechas si es multi-día
        if (esMultiDia) {
            setTimeout(() => mostrarSelectorFechasActual(), 100);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar el evento. Por favor intenta de nuevo.');
    }
}

// Parsear rango de fechas del evento
function parsearFechasEvento(fechaStr) {
    if (!fechaStr) return [];

    const meses = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
        'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    // Detectar formato rango: "15-20 de julio, 2025" o "18-22 de diciembre, 2025"
    const matchRange = fechaStr.match(/(\d+)\s*-\s*(\d+)\s+de\s+(\w+),?\s+(\d+)/i);
    if (matchRange) {
        const [_, diaInicio, diaFin, mes, año] = matchRange;
        const mesNum = meses[mes.toLowerCase()];
        if (mesNum == null) return [{ fecha: fechaStr, display: fechaStr }];
        const fechas = [];

        for (let dia = parseInt(diaInicio); dia <= parseInt(diaFin); dia++) {
            const fecha = new Date(parseInt(año), mesNum, dia);
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const diaSemana = diasSemana[fecha.getDay()];
            fechas.push({
                fecha: `${año}-${String(mesNum + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
                display: `${diaSemana} ${dia} de ${mes}`,
                dia: dia
            });
        }

        return fechas;
    }

    // Detectar formato fecha única: "5 de noviembre, 2025"
    const matchSingle = fechaStr.match(/(\d{1,2})\s+de\s+(\w+),?\s+(\d{4})/i);
    if (matchSingle) {
        const [_, dia, mes, año] = matchSingle;
        const mesNum = meses[String(mes).toLowerCase()];
        if (mesNum == null) return [{ fecha: fechaStr, display: fechaStr }];
        const fecha = new Date(parseInt(año), mesNum, parseInt(dia));
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diaSemana = diasSemana[fecha.getDay()];
        const iso = `${año}-${String(mesNum + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        return [{
            fecha: iso,
            display: `${diaSemana} ${dia} de ${mes}`,
            dia: parseInt(dia)
        }];
    }

    // Fallback: no se pudo parsear
    return [{ fecha: fechaStr, display: fechaStr }];
}

// Wrapper para usar datos del evento actual
function mostrarSelectorFechasActual() {
    if (window.currentEventoData) {
        mostrarSelectorFechas(window.currentEventoData.fecha, window.currentEventoData.precio);
    }
}

// Mostrar selector de fechas según días seleccionados
function mostrarSelectorFechas(fechaEvento, precioBase) {
    console.log('=== DEBUG Selector Fechas ===');
    console.log('fechaEvento:', fechaEvento);
    console.log('precioBase:', precioBase);
    
    const diasSelect = document.getElementById('eventoDias');
    const selectorFechas = document.getElementById('selectorFechas');
    const totalDisplay = document.getElementById('totalEventoMonto');
    
    console.log('diasSelect:', diasSelect);
    console.log('selectorFechas:', selectorFechas);
    
    if (!diasSelect || !selectorFechas) {
        console.log('ERROR: No se encontraron los elementos');
        return;
    }
    
    const diasSeleccionados = parseInt(diasSelect.value);
    console.log('diasSeleccionados:', diasSeleccionados);
    
    const fechasDisponibles = parsearFechasEvento(fechaEvento);
    console.log('fechasDisponibles:', fechasDisponibles);
    
    // Actualizar precio
    if (totalDisplay) {
        const total = precioBase * diasSeleccionados;
        totalDisplay.textContent = `$${total}`;
    }
    
    // Si solo hay una fecha disponible o es un evento de un día
    if (fechasDisponibles.length <= 1) {
        console.log('Solo 1 fecha disponible, ocultando selector');
        selectorFechas.style.display = 'none';
        return;
    }
    
    console.log('Generando checkboxes...');
    
    // Generar checkboxes para cada fecha
    selectorFechas.innerHTML = `
        <label style="font-weight: 600; margin-bottom: 0.5rem; display: block;">
            Selecciona ${diasSeleccionados === 1 ? 'el día' : 'los días'} que asistirá:
        </label>
        <div style="background: var(--gray-light); padding: 1rem; border-radius: 10px;">
            ${fechasDisponibles.map((f, index) => `
                <div style="margin: 0.5rem 0;">
                    <label style="display: flex; align-items: center; cursor: pointer; font-weight: normal;">
                        <input type="checkbox" 
                               class="fecha-checkbox" 
                               value="${f.fecha}" 
                               data-display="${f.display}"
                               onchange="validarSeleccionFechas(${diasSeleccionados})"
                               style="margin-right: 0.5rem; width: 18px; height: 18px; cursor: pointer;">
                        <span>${f.display}</span>
                    </label>
                </div>
            `).join('')}
        </div>
        <small style="color: var(--orange); display: block; margin-top: 0.5rem;" id="mensajeFechas">
            Por favor selecciona ${diasSeleccionados} ${diasSeleccionados === 1 ? 'día' : 'días'}
        </small>
    `;
    
    selectorFechas.style.display = 'block';
    console.log('Selector de fechas visible!');
    console.log('HTML generado:', selectorFechas.innerHTML.substring(0, 200));
}

// Validar que se seleccione la cantidad correcta de fechas
function validarSeleccionFechas(diasRequeridos) {
    const checkboxes = document.querySelectorAll('.fecha-checkbox:checked');
    const mensaje = document.getElementById('mensajeFechas');
    
    if (!mensaje) return;
    
    if (checkboxes.length === diasRequeridos) {
        mensaje.style.color = 'var(--yellow-green)';
        mensaje.textContent = `✓ ${diasRequeridos} ${diasRequeridos === 1 ? 'día seleccionado' : 'días seleccionados'}`;
    } else if (checkboxes.length > diasRequeridos) {
        mensaje.style.color = 'var(--orange)';
        mensaje.textContent = `⚠ Has seleccionado ${checkboxes.length} días. Solo debes seleccionar ${diasRequeridos}`;
        
        // Desmarcar el último checkbox seleccionado
        const ultimos = Array.from(document.querySelectorAll('.fecha-checkbox'));
        const ultimoChecked = ultimos.reverse().find(cb => cb.checked);
        if (ultimoChecked) {
            ultimoChecked.checked = false;
        }
    } else {
        mensaje.style.color = 'var(--orange)';
        mensaje.textContent = `Por favor selecciona ${diasRequeridos} ${diasRequeridos === 1 ? 'día' : 'días'} (${checkboxes.length}/${diasRequeridos})`;
    }
}

// Evitar doble envío en reservas de actividades
let procesandoRsvpEvento = false;

// Procesar RSVP de evento
async function procesarRsvpEvento(eventoId, precioBase, esMultiDia, nombreActividad) {
    if (procesandoRsvpEvento) return;
    procesandoRsvpEvento = true;

    const btnConfirmar = document.querySelector('#eventoModal button[onclick*="procesarRsvpEvento"]');
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Enviando...';
    }

    const nombreNino = document.getElementById('eventoNombreNino').value;
    const edadNino = document.getElementById('eventoEdadNino').value;
    const nombrePadre = document.getElementById('eventoNombrePadre').value;
    const email = document.getElementById('eventoEmail').value;
    const telefono = document.getElementById('eventoTelefono').value;
    
    if (!nombreNino || !edadNino || !nombrePadre || !email || !telefono) {
        alert('Por favor completa todos los campos.');
        procesandoRsvpEvento = false;
        if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = 'Confirmar y Pagar'; }
        return;
    }
    
    // Calcular precio total según días y validar fechas seleccionadas
    let dias = 1;
    let precioTotal = precioBase;
    let fechasSeleccionadas = [];
    
    if (esMultiDia) {
        const diasSelect = document.getElementById('eventoDias');
        dias = parseInt(diasSelect.value);
        precioTotal = precioBase * dias;
        
        // Obtener fechas seleccionadas
        const checkboxes = document.querySelectorAll('.fecha-checkbox:checked');
        
        if (checkboxes.length > 0 && checkboxes.length !== dias) {
            alert(`Por favor selecciona exactamente ${dias} ${dias === 1 ? 'día' : 'días'} de asistencia.`);
            procesandoRsvpEvento = false;
            if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = 'Confirmar y Pagar'; }
            return;
        }
        
        fechasSeleccionadas = Array.from(checkboxes).map(cb => cb.dataset.display);
    }
    
    const detallesDias = esMultiDia ? `\n${dias} día${dias > 1 ? 's' : ''}` : '';
    const detallesFechas = fechasSeleccionadas.length > 0 
        ? `\nFechas: ${fechasSeleccionadas.join(', ')}` 
        : '';
    
    const mensajePago = 'Realiza el pago a través de ATH Móvil: Pay a business → YouandMeCenter';

    try {
        let guardadoEnSupabase = false;
        if (supabaseClient) {
            const { error: errReserva } = await supabaseClient
                .from('reservas_eventos')
                .insert([{
                    evento_id: String(eventoId),
                    nombre_nino: nombreNino,
                    edad_nino: parseInt(edadNino) || null,
                    nombre_padre: nombrePadre,
                    email,
                    telefono,
                    dias,
                    total: precioTotal,
                    pagado: false
                }]);
            if (errReserva) {
                console.error('Error Supabase reservas_eventos:', errReserva.message, errReserva.details, errReserva);
                // Fallback: guardar en localStorage para no perder la reserva
                const reservasLocales = JSON.parse(localStorage.getItem('youme_reservas_eventos') || '[]');
                reservasLocales.push({
                    id: Date.now().toString(),
                    evento_id: String(eventoId),
                    nombre_nino: nombreNino,
                    edad_nino: edadNino,
                    nombre_padre: nombrePadre,
                    email,
                    telefono,
                    dias,
                    total: precioTotal,
                    fecha_registro: new Date().toISOString()
                });
                localStorage.setItem('youme_reservas_eventos', JSON.stringify(reservasLocales));
                // Enviar email de confirmación al cliente y notificaciones aunque Supabase falle
                await enviarEmailConfirmacionActividad(email, nombreNino, nombreActividad || 'Actividad', precioTotal);
                alert(
                    '¡Reservación exitosa!\n\n' +
                    'Para completarla, por favor envía el monto de $' + precioTotal + ' a través de ATH Móvil: Pay a business → YouandMeCenter\n\n' +
                    'Te contactaremos para confirmar tu reserva.'
                );
                cerrarModal();
                cargarEventos();
                procesandoRsvpEvento = false;
                return;
            }
            guardadoEnSupabase = true;
            // Reducir cupos del evento
            const { data: eventoActual } = await supabaseClient
                .from('eventos')
                .select('cupos')
                .eq('id', eventoId)
                .single();
            if (eventoActual && eventoActual.cupos != null) {
                const nuevoCupos = Math.max(0, (eventoActual.cupos || 0) - (esMultiDia ? dias : 1));
                await supabaseClient.from('eventos').update({ cupos: nuevoCupos }).eq('id', eventoId);
            }
        }
        await enviarEmailConfirmacionActividad(email, nombreNino, nombreActividad || 'Actividad', precioTotal);
        alert(`Reserva registrada para ${nombreNino}.${detallesDias}${detallesFechas}\n\nTotal: $${precioTotal}\n\n${mensajePago}`);
    } catch (e) {
        console.error(e);
        alert(`Reserva registrada localmente.\n\nTotal: $${precioTotal}\n\n${mensajePago}`);
    } finally {
        procesandoRsvpEvento = false;
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = 'Confirmar y Pagar';
        }
    }

    cerrarModal();
    cargarEventos();
}

// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('eventoModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Inicializar event listeners del modal cuando el DOM esté listo
function inicializarModales() {
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', cerrarModal);
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('eventoModal');
        if (modal && e.target === modal) {
            cerrarModal();
        }
    });
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarModales);
} else {
    inicializarModales();
}

// ==================== CUMPLEAÑOS ====================

// Calculadora de cumpleaños - Referencia global
let cumpleForm = null;

// Calcular total
function calcularTotalCumpleanos() {
    if (!cumpleForm || !cumpleForm.totalAmount) return 0;
    
    let total = 0;
    
    // Espacio base: 3 hrs $250 + fee fijo limpieza $45 = $295; hora adicional $50
    const ESPACIO_3HR = 250;
    const FEE_LIMPIEZA = 45;
    const PRECIO_HORA_ADICIONAL = 50;
    const horas = parseInt(cumpleForm.horas?.value) || 3;
    if (horas <= 3) {
        total += ESPACIO_3HR + FEE_LIMPIEZA;
    } else {
        total += ESPACIO_3HR + FEE_LIMPIEZA + ((horas - 3) * PRECIO_HORA_ADICIONAL);
    }
    
    // Decoración: básica $175, elaborada $350
    const decoracion = parseInt(cumpleForm.decoracion?.value) || 0;
    total += decoracion;
    
    // Equipo para toddlers $125
    if (cumpleForm.equipo?.checked) {
        total += 125;
    }
    
    // Actividad extra: precio por 15 niños; plasticina $50, resto $200; niño adicional $15
    const PRECIOS_ACTIVIDAD_BASE = {
        plasticina: 50,
        slime: 200,
        friendship_bracelets: 200,
        canvas: 200,
        gafas: 200,
        gorras: 200,
        carteras: 200,
        jackets: 200
    };
    const NIÑOS_INCLUIDOS = 15;
    const PRECIO_NIÑO_ADICIONAL = 15;
    const actividad = cumpleForm.actividad?.value;
    if (actividad && actividad !== 'none') {
        const numNinos = parseInt(cumpleForm.numNinos?.value) || NIÑOS_INCLUIDOS;
        const precioBase = PRECIOS_ACTIVIDAD_BASE[actividad] || 200;
        if (numNinos <= NIÑOS_INCLUIDOS) {
            total += precioBase;
        } else {
            total += precioBase + (numNinos - NIÑOS_INCLUIDOS) * PRECIO_NIÑO_ADICIONAL;
        }
    }
    
    if (cumpleForm.totalAmount) {
        cumpleForm.totalAmount.textContent = `$${total}`;
    }
    return total;
}

// Inicializar calculadora de cumpleaños cuando el DOM esté listo
function inicializarCalculadoraCumpleanos() {
    const horas = document.getElementById('cumpleHoras');
    const decoracion = document.getElementById('cumpleDecoracion');
    const equipo = document.getElementById('cumpleEquipo');
    const actividad = document.getElementById('cumpleActividad');
    const numNinos = document.getElementById('cumpleNumNinos');
    const totalAmount = document.getElementById('totalAmount');
    const fechaCumple = document.getElementById('cumpleFecha');
    const horaSlot = document.getElementById('cumpleHoraSlot');
    
    // Solo inicializar si todos los elementos existen
    if (horas && decoracion && equipo && actividad && numNinos && totalAmount) {
        cumpleForm = {
            horas: horas,
            decoracion: decoracion,
            equipo: equipo,
            actividad: actividad,
            numNinos: numNinos,
            totalAmount: totalAmount
        };
        
        // Event listeners para calculadora
        cumpleForm.horas.addEventListener('input', calcularTotalCumpleanos);
        cumpleForm.decoracion.addEventListener('change', function() {
            // Recalcular total
            calcularTotalCumpleanos();
            // Controlar desde cuándo se puede reservar según decoración
            if (!fechaCumple) return;
            const val = this.value;
            if (!val) {
                fechaCumple.value = '';
                fechaCumple.disabled = true;
                fechaCumple.removeAttribute('min');
                return;
            }
            const hoy = new Date();
            let diasMinimos;
            if (val === '0') {
                diasMinimos = 14; // 2 semanas
            } else if (val === '175') {
                diasMinimos = 21; // 3 semanas
            } else if (val === '350') {
                diasMinimos = 28; // 4 semanas
            } else {
                diasMinimos = 14;
            }
            const fechaMinima = new Date(hoy.getTime() + diasMinimos * 24 * 60 * 60 * 1000);
            const isoMin = fechaMinima.toISOString().split('T')[0];
            fechaCumple.disabled = false;
            fechaCumple.min = isoMin;
            // Si la fecha seleccionada actual se queda corta, limpiarla
            if (fechaCumple.value && fechaCumple.value < isoMin) {
                fechaCumple.value = '';
            }
        });
        cumpleForm.equipo.addEventListener('change', calcularTotalCumpleanos);
        cumpleForm.actividad.addEventListener('change', function() {
            const numNinosGroup = document.getElementById('numNinosGroup');
            if (numNinosGroup) {
                if (this.value !== 'none') {
                    numNinosGroup.style.display = 'block';
                } else {
                    numNinosGroup.style.display = 'none';
                }
            }
            calcularTotalCumpleanos();
        });
        cumpleForm.numNinos.addEventListener('input', calcularTotalCumpleanos);

        // Inicialmente deshabilitar fecha hasta que elijan decoración
        if (fechaCumple) {
            fechaCumple.disabled = true;
        }

        // Cargar horarios disponibles cuando cambie la fecha
        if (fechaCumple && horaSlot && supabaseClient) {
            fechaCumple.addEventListener('change', () => {
                cargarSlotsCumpleParaFecha(fechaCumple.value);
            });
        }
        
        // Calcular total inicial
        calcularTotalCumpleanos();
    }
}

// Carrusel / Galería - Celebra en You&Me
function inicializarGaleriaCelebra() {
    const track = document.getElementById('galeriaTrack');
    const viewport = track ? track.closest('.galeria-viewport') : null;
    const prevBtn = document.getElementById('galeriaPrev');
    const nextBtn = document.getElementById('galeriaNext');
    const dotsContainer = document.getElementById('galeriaDots');
    if (!track || !prevBtn || !nextBtn) return;

    const slides = track.querySelectorAll('.galeria-slide');
    const total = slides.length;
    if (total === 0) return;

    let index = 0;

    function goTo(i) {
        index = ((i % total) + total) % total;
        track.style.transform = `translateX(-${index * 100}%)`;
        dotsContainer.querySelectorAll('.galeria-dot').forEach((dot, j) => {
            dot.classList.toggle('active', j === index);
        });
    }

    // Dots
    for (let i = 0; i < total; i++) {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'galeria-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', 'Ir a imagen ' + (i + 1));
        dot.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(dot);
    }

    prevBtn.addEventListener('click', () => goTo(index - 1));
    nextBtn.addEventListener('click', () => goTo(index + 1));

    // Autoplay opcional (cada 5 segundos)
    let autoplay = setInterval(() => goTo(index + 1), 5000);
    track.closest('.celebra-galeria').addEventListener('mouseenter', () => clearInterval(autoplay));
    track.closest('.celebra-galeria').addEventListener('mouseleave', () => {
        autoplay = setInterval(() => goTo(index + 1), 5000);
    });
}

// Mini carruseles en cada área de Celebra (Espacio, Decoración, Equipo, Actividades Extras)
function inicializarMiniCarouseles() {
    document.querySelectorAll('.cumple-mini-carousel').forEach(carousel => {
        const track = carousel.querySelector('.cumple-carousel-track');
        const prevBtn = carousel.querySelector('.cumple-carousel-prev');
        const nextBtn = carousel.querySelector('.cumple-carousel-next');
        if (!track || !prevBtn || !nextBtn) return;

        const slides = track.querySelectorAll('.cumple-carousel-slide');
        const total = slides.length;
        if (total <= 1) return;

        let index = 0;

        function goTo(i) {
            index = ((i % total) + total) % total;
            track.style.transform = `translateX(-${index * 100}%)`;
            // Pausar videos al cambiar de slide
            slides.forEach((s, j) => {
                const video = s.querySelector('video');
                if (video && j !== index) video.pause();
            });
        }

        prevBtn.addEventListener('click', () => goTo(index - 1));
        nextBtn.addEventListener('click', () => goTo(index + 1));
    });
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCalculadoraCumpleanos);
} else {
    inicializarCalculadoraCumpleanos();
}

// Inicializar formularios cuando el DOM esté listo
function inicializarFormularios() {
    // Procesar reserva de cumpleaños (solo un listener para evitar reservas dobles)
    const reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn && !reservarBtn.dataset.reservaCumpleHandler) {
        reservarBtn.dataset.reservaCumpleHandler = 'true';
        reservarBtn.addEventListener('click', async function() {
    const nombre = document.getElementById('cumpleNombre').value.trim();
    const fecha = document.getElementById('cumpleFecha').value;
    const requestDateFecha = document.getElementById('requestDateFecha')?.value?.trim() || '';
    const requestDateMensaje = (document.getElementById('requestDateMensaje')?.value || '').trim();
    const contacto = document.getElementById('cumpleContacto').value.trim();
    const telefono = document.getElementById('cumpleTelefono').value.trim();
    const email = document.getElementById('cumpleEmail').value.trim();
    const decoracionSelect = document.getElementById('cumpleDecoracion');

    const esSolicitudSoloFecha = !fecha && requestDateFecha;

    if (esSolicitudSoloFecha) {
        if (!nombre || !contacto || !telefono || !email) {
            alert('Para solicitar una fecha indica tu nombre, contacto, teléfono y email.');
            return;
        }
        try {
            if (supabaseClient) {
                const { error } = await supabaseClient
                    .from('solicitudes_fecha_celebracion')
                    .insert([{ fecha_solicitada: requestDateFecha, nombre_contacto: nombre, email, telefono, mensaje: requestDateMensaje || null }]);
                if (error) throw error;
            }
            // Email de confirmación al cliente + notificación interna
            await enviarEmailRelay({
                type: 'solicitud_fecha',
                to_email: email,
                nombre_contacto: nombre,
                fecha_solicitada: requestDateFecha,
                mensaje: requestDateMensaje || ''
            });
            mostrarExitoSolicitudFecha();
        } catch (e) {
            console.error(e);
            alert('No se pudo enviar la solicitud. Intenta de nuevo.');
        }
        return;
    }

    if (!fecha) {
        alert('Selecciona una fecha en el calendario (día en verde) o indica una fecha en "¿No ves la fecha que buscas?" para solicitar.');
        return;
    }
    
    if (!nombre || !contacto || !telefono || !email || !decoracionSelect || !decoracionSelect.value) {
        alert('Por favor completa todos los campos requeridos.');
        return;
    }
    
    // Validar fecha mínima según tipo de decoración
    const fechaSeleccionada = new Date(fecha);
    const hoy = new Date();
    const decoracionValor = parseInt(document.getElementById('cumpleDecoracion')?.value || '0', 10) || 0;
    let diasMinimos;
    let semanasTexto;
    if (decoracionValor === 0) {          // Lleva su propia decoración
        diasMinimos = 14;                // 2 semanas
        semanasTexto = '2 semanas';
    } else if (decoracionValor === 250) { // Mini Setup
        diasMinimos = 21;                // 3 semanas
        semanasTexto = '3 semanas';
    } else if (decoracionValor === 300) { // Basic Setup
        diasMinimos = 28;                // 4 semanas
        semanasTexto = '4 semanas';
    } else if (decoracionValor === 575) { // Signature Setup
        diasMinimos = 28;                // 4 semanas (o más si lo prefieres)
        semanasTexto = '4 semanas';
    } else {
        diasMinimos = 14;
        semanasTexto = '2 semanas';
    }
    const fechaMinima = new Date(hoy.getTime() + (diasMinimos * 24 * 60 * 60 * 1000));
    
    if (fechaSeleccionada < fechaMinima) {
        alert(`Según el tipo de decoración seleccionado, la fecha debe ser al menos ${semanasTexto} a partir de hoy para poder procesar tu reserva.`);
        return;
    }
    
    const total = calcularTotalCumpleanos();
    
    const detalles = {
        nombreNino: nombre,
        fecha,
        horaSlot: document.getElementById('cumpleHoraSlot') ? document.getElementById('cumpleHoraSlot').value : '',
        contacto,
        telefono,
        email,
        horas: cumpleForm.horas.value,
        decoracion: cumpleForm.decoracion.options[cumpleForm.decoracion.selectedIndex].text,
        equipo: cumpleForm.equipo.checked,
        actividad: cumpleForm.actividad.value !== 'none' ? cumpleForm.actividad.options[cumpleForm.actividad.selectedIndex].text : 'Ninguna',
        numNinos: cumpleForm.actividad.value !== 'none' ? cumpleForm.numNinos.value : 0,
        total
    };

    // Validar que se haya escogido un horario si hay disponibilidad
    if (document.getElementById('cumpleHoraGroup') && document.getElementById('cumpleHoraGroup').style.display !== 'none') {
        if (!detalles.horaSlot) {
            alert('Por favor selecciona un horario disponible para el cumpleaños.');
            return;
        }
    }
    
    try {
        if (supabaseClient) {
            const { error: errReserva } = await supabaseClient
                .from('reservas_cumple')
                .insert([{
                    nombre_nino: detalles.nombreNino,
                    fecha: detalles.fecha,
                    contacto: detalles.contacto,
                    telefono: detalles.telefono,
                    email: detalles.email,
                    horas: detalles.horaSlot ? `${detalles.horas} (inicio: ${detalles.horaSlot})` : detalles.horas,
                    decoracion: detalles.decoracion,
                    equipo: detalles.equipo,
                    pretend_play: false,
                    actividad: detalles.actividad,
                    num_ninos: detalles.numNinos || 0,
                    total: detalles.total,
                    pagado: false
                }]);
            if (errReserva) {
                console.error('Error guardando reserva cumple:', errReserva);
            }
        }
        await enviarEmailConfirmacionCumple(detalles);
        mostrarExitoReservaCumple(total, nombre);
    } catch (e) {
        console.error(e);
        alert(`Reserva registrada.\n\nTotal: $${total}\n\nNos comunicaremos contigo para confirmar que la fecha esté disponible.`);
        mostrarExitoReservaCumple(total, nombre);
    }
    console.log('Detalles de reserva:', detalles);
        });
    }

    function mostrarExitoCumpleBox(titulo, mensaje, mostrarLineaPago) {
        const form = document.getElementById('cumpleForm');
        const successEl = document.getElementById('cumpleReservaSuccess');
        const otraReservaBtn = document.getElementById('cumpleOtraReservaBtn');
        const titleEl = document.getElementById('cumpleSuccessTitle');
        const messageEl = document.getElementById('cumpleSuccessMessage');
        const pagoEl = document.getElementById('cumpleSuccessPago');
        if (titleEl) titleEl.textContent = titulo;
        if (messageEl) messageEl.textContent = mensaje;
        if (pagoEl) pagoEl.style.display = mostrarLineaPago ? '' : 'none';
        if (form) form.reset();
        if (document.getElementById('cumpleFecha')) document.getElementById('cumpleFecha').removeAttribute('value');
        if (document.getElementById('cumpleDecoracion') && document.getElementById('cumpleFecha')) {
            document.getElementById('cumpleFecha').disabled = true;
        }
        if (document.getElementById('cumpleHoraGroup')) document.getElementById('cumpleHoraGroup').style.display = 'none';
        if (document.getElementById('cumpleHoraNoSlots')) document.getElementById('cumpleHoraNoSlots').style.display = 'none';
        if (form) form.style.display = 'none';
        if (successEl) {
            successEl.style.display = 'block';
            successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (otraReservaBtn && !otraReservaBtn.dataset.listener) {
            otraReservaBtn.dataset.listener = 'true';
            otraReservaBtn.addEventListener('click', function() {
                if (successEl) successEl.style.display = 'none';
                if (form) form.style.display = '';
                if (pagoEl) pagoEl.style.display = '';
                renderizarCalendarioCumple();
                if (typeof calcularTotalCumpleanos === 'function') calcularTotalCumpleanos();
            });
        }
    }

    function mostrarExitoReservaCumple(total, nombre) {
        mostrarExitoCumpleBox(
            '¡Reserva enviada!',
            'Gracias por reservar. Te hemos enviado un correo de confirmación y nos comunicaremos contigo para confirmar la fecha.',
            true
        );
    }

    function mostrarExitoSolicitudFecha() {
        mostrarExitoCumpleBox(
            '¡Solicitud enviada!',
            'Solicitud de fecha enviada. Nos comunicaremos contigo pronto.',
            false
        );
    }
    
    // Fecha mínima para "solicitar fecha" (parte del form completo)
    const reqDateInput = document.getElementById('requestDateFecha');
    if (reqDateInput) {
        const today = new Date().toISOString().split('T')[0];
        reqDateInput.setAttribute('min', today);
    }

    // ==================== FORMULARIO DE CONTACTO ====================
    const contactoForm = document.getElementById('contactoForm');
    if (contactoForm) {
        contactoForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Aquí integrarías con tu servicio de email (EmailJS, etc.)
            alert('¡Gracias por contactarnos! Te responderemos pronto.\n\nPara consultas inmediatas, llámanos al (787) 204-9041');
            
            this.reset();
        });
    }
}

// Calendario indicador para servicios (muestra en verde días con al menos un bloque)
function renderizarCalendarioServicio(filas, cont) {
    if (!cont) return;
    if (!filas || filas.length === 0) {
        cont.innerHTML = '<p style="color:#666; font-size:0.8rem;">No hay disponibilidad cargada.</p>';
        return;
    }
    // Obtener mes/año base desde la primera fila
    const primera = filas[0];
    const baseFecha = new Date(primera.fecha);
    let year = baseFecha.getFullYear();
    let month = baseFecha.getMonth();

    const fechasSet = new Set(filas.map(f => f.fecha));

    const nombresMes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const diasSemana = ['L','M','X','J','V','S','D'];

    function actualizar() {
        const primerDiaMes = new Date(year, month, 1);
        const ultimoDiaMes = new Date(year, month + 1, 0);
        const hoyISO = new Date().toISOString().split('T')[0];

        const header = `
            <div class="calendario-header">
                <button type="button" class="calendario-nav-btn" data-dir="-1">‹</button>
                <span>${nombresMes[month]} ${year}</span>
                <button type="button" class="calendario-nav-btn" data-dir="1">›</button>
            </div>
        `;
        let grid = '<div class="calendario-grid">';
        diasSemana.forEach(d => {
            grid += `<div class="calendario-dia-header">${d}</div>`;
        });
        const offset = (primerDiaMes.getDay() + 6) % 7;
        for (let i = 0; i < offset; i++) {
            grid += '<div class="calendario-dia vacio"></div>';
        }
        for (let d = 1; d <= ultimoDiaMes.getDate(); d++) {
            const fechaActual = new Date(year, month, d);
            const iso = fechaActual.toISOString().split('T')[0];
            const esFuturo = iso >= hoyISO;
            const tiene = fechasSet.has(iso) && esFuturo;
            let clases = 'calendario-dia';
            if (tiene) {
                clases += ' disponible';
            } else {
                clases += ' no-disponible';
            }
            grid += `<div class="${clases}">${d}</div>`;
        }
        grid += '</div>';
        cont.innerHTML = header + grid;

        cont.querySelectorAll('.calendario-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = parseInt(btn.dataset.dir, 10);
                month += dir;
                if (month < 0) { month = 11; year--; }
                if (month > 11) { month = 0; year++; }
                actualizar();
            });
        });
    }

    actualizar();
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarFormularios);
} else {
    inicializarFormularios();
}

// ==================== SOLICITUD DE SERVICIOS ====================

// Abrir modal de servicio
function abrirModalServicio(nombreServicio) {
    const modal = document.getElementById('servicioModal');
    const servicioInput = document.getElementById('servicioNombre');
    const titulo = document.getElementById('servicioTitulo');
    const emailSubject = document.getElementById('emailSubject');
    const tipoCoberturaSelect = document.getElementById('servicioTipoCobertura');
    const prefTextarea = document.getElementById('servicioPreferencia');
    
    servicioInput.value = nombreServicio;
    titulo.textContent = `Solicitar ${nombreServicio}`;
    emailSubject.value = `Nueva Solicitud: ${nombreServicio}`;
    
    // Opciones de tipo de cobertura: Terapia Ocupacional incluye Plan Medico (Triple S Vital); el resto no
    const opts = [
        { value: '', text: 'Selecciona una opción' },
        { value: 'Remedio provisional', text: 'Remedio provisional' },
        { value: 'Servicio privado', text: 'Servicio privado' }
    ];
    if (nombreServicio === 'Terapia Ocupacional') {
        opts.splice(2, 0, { value: 'Plan Medico (Triple S Vital)', text: 'Plan Medico (Triple S Vital)' });
    }
    if (tipoCoberturaSelect) {
        tipoCoberturaSelect.innerHTML = opts.map(o => `<option value="${o.value}">${o.text}</option>`).join('');
    }
    if (prefTextarea) {
        prefTextarea.value = '';
    }
    
    modal.style.display = 'block';
}

// Cerrar modal de servicio
function cerrarModalServicio() {
    document.getElementById('servicioModal').style.display = 'none';
    document.getElementById('servicioForm').reset();
}

// Inicializar modal de servicios cuando el DOM esté listo
function inicializarModalServicios() {
    // Event listener para cerrar modal
    const closeServicioBtn = document.querySelector('.close-servicio');
    if (closeServicioBtn) {
        closeServicioBtn.addEventListener('click', cerrarModalServicio);
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('servicioModal');
        if (modal && e.target === modal) {
            cerrarModalServicio();
        }
    });

    // Procesar formulario de servicio con Web3Forms (solo una vez para no duplicar el mensaje)
    const servicioForm = document.getElementById('servicioForm');
    if (servicioForm && !servicioForm.dataset.servicioHandler) {
        servicioForm.dataset.servicioHandler = 'true';
        servicioForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Mostrar indicador de carga
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(e.target);
        const prefTextarea = document.getElementById('servicioPreferencia');
        const textoPreferencia = prefTextarea ? prefTextarea.value : '';
        
        // Guardar una copia en Supabase o localStorage
        const solicitudData = {
            servicio: formData.get('servicio'),
            paciente: formData.get('nombre_paciente'),
            edad: parseInt(formData.get('edad_paciente')),
            tutor: formData.get('nombre_tutor'),
            email: formData.get('email'),
            telefono: formData.get('telefono'),
            tipo_cobertura: formData.get('tipo_cobertura'),
            motivo: textoPreferencia
                ? `Preferencia de días/horarios:\n${textoPreferencia}\n\nMotivo de consulta:\n${formData.get('motivo_consulta') || ''}`
                : formData.get('motivo_consulta'),
            contacto_preferido: formData.get('contacto_preferido'),
            contactado: false,
            agendado: false
        };
        
        // Guardar en Supabase si está configurado; si falla, guardar en localStorage
        let guardadoEnServidor = false;
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .insert([solicitudData]);
            
            if (error) {
                console.error('Error guardando solicitud en Supabase (se guarda localmente):', error);
            } else {
                guardadoEnServidor = true;
            }
        }
        // Siempre guardar copia en localStorage si no se guardó en Supabase (fallback o respaldo)
        if (!guardadoEnServidor) {
            const solicitudLocal = {
                id: Date.now().toString(),
                fecha: new Date().toLocaleString('es-PR'),
                ...solicitudData,
                contactoPreferido: solicitudData.contacto_preferido
            };
            let solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
            solicitudes.unshift(solicitudLocal);
            localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudes));
        }
        
        // Enviar formulario a Web3Forms
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            const email = formData.get('email');
            const nombrePaciente = formData.get('nombre_paciente');
            const servicio = formData.get('servicio');
            const tutor = formData.get('nombre_tutor');
            await enviarEmailConfirmacionSolicitud(email, nombrePaciente, servicio, tutor);
            await enviarEmailNotificacionAdminSolicitud(solicitudData);
            if (guardadoEnServidor) {
                alert('¡Solicitud enviada exitosamente!\n\nTe hemos enviado un email de confirmación.\n\nNos pondremos en contacto contigo pronto.\n\nPara consultas inmediatas, llámanos al (787) 204-9041');
            } else {
                alert('Solicitud enviada por email, pero NO se pudo guardar en el panel admin (Supabase).\n\nTu solicitud fue recibida por correo. Para que aparezca en el panel, hay que habilitar la tabla/políticas de solicitudes en Supabase.');
            }
            cerrarModalServicio();
        } else {
            throw new Error('Error en el envío');
        }
    } catch (error) {
        console.error('Error al enviar solicitud:', error);
        alert('Hubo un error al enviar tu solicitud.\n\nPor favor intenta nuevamente o contáctanos directamente al (787) 204-9041');
    } finally {
        submitBtn.textContent = textoOriginal;
        submitBtn.disabled = false;
    }
        });
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarModalServicios);
} else {
    inicializarModalServicios();
}

// ==================== PANEL DE ADMINISTRACIÓN ====================

// Verificar si hay sesión activa
async function verificarSesionAdmin() {
    if (supabaseClient) {
        // Verificar sesión de Supabase
        const { data: { session } } = await supabaseClient.auth.getSession();
        return !!session;
    } else {
        // Fallback a localStorage
        const sesion = localStorage.getItem('youme_admin_sesion');
        return sesion === 'activa';
    }
}

// Login de administrador: mismo usuario Supabase que staff, así puede ir al portal de equipo sin volver a loguearse
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('adminLoginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value;
            const password = document.getElementById('adminPassword').value;
            const errorDiv = document.getElementById('loginError');
            try {
                if (supabaseClient) {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    currentStaffSession = data.session;
                    const normalized = (data.user.email || '').toLowerCase().trim();
                    currentStaffRole = rolePorEmailStaff(normalized) || 'staff';
                } else {
                    // Fallback sin Supabase: permitir solo contactos de staff portal con clave temporal.
                    const normalized = (email || '').toLowerCase().trim();
                    const isKnownStaff = STAFF_PORTAL_CONTACTS.some(c => c.email === normalized);
                    if (!isKnownStaff || password !== 'You@2023!') {
                        if (errorDiv) errorDiv.style.display = 'block';
                        return;
                    }
                    localStorage.setItem('youme_admin_sesion', 'activa');
                    currentStaffRole = rolePorEmailStaff(normalized) || 'staff';
                }
                document.getElementById('adminLogin').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
                cargarEventosAdmin();
                cargarSolicitudesAdmin();
                mostrarTabAdmin('reservas');
            } catch (err) {
                console.error('Error en login admin:', err);
                errorDiv.style.display = 'block';
            }
        });
    }
});

async function cerrarSesionAdmin() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    else localStorage.removeItem('youme_admin_sesion');
    currentStaffSession = null;
    currentStaffRole = null;
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    const form = document.getElementById('adminLoginForm');
    if (form) form.reset();
    const err = document.getElementById('loginError');
    if (err) err.style.display = 'none';
}

const originalNavigateToPage = navigateToPage;
window.navigateToPage = async function(pageName) {
    originalNavigateToPage(pageName);
    if (pageName === 'admin') {
        const tieneSesion = await verificarSesionAdmin();
        if (tieneSesion) {
            if (supabaseClient) {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (session) {
                    currentStaffSession = session;
                    const email = (session.user.email || '').toLowerCase().trim();
                    currentStaffRole = rolePorEmailStaff(email) || currentStaffRole;
                }
            }
            const email = currentStaffSession?.user?.email?.toLowerCase?.() || '';
            if (email === 'centroyouandme@gmail.com') {
                document.getElementById('adminLogin').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
                mostrarTabAdmin('reservas');
            } else {
                document.getElementById('adminLogin').style.display = 'block';
                document.getElementById('adminDashboard').style.display = 'none';
            }
        } else {
            document.getElementById('adminLogin').style.display = 'block';
            document.getElementById('adminDashboard').style.display = 'none';
        }
    }
};

// Cambiar entre tabs del admin
function mostrarTabAdmin(tabName) {
    // Ocultar todos los tabs
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tabId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    const tabEl = document.getElementById(tabId);
    if (tabEl) tabEl.classList.add('active');
    const btn = document.querySelector('.admin-tab-btn[data-tab="' + tabName + '"]');
    if (btn) btn.classList.add('active');
    
    // Recargar datos si es necesario
    if (tabName === 'actividades') {
        cargarEventosAdmin();
    } else if (tabName === 'reservas') {
        cargarReservasAdmin();
    } else if (tabName === 'disponibilidad') {
        cargarDisponibilidadesAdmin();
        cargarSolicitudesFechaAdmin();
    } else if (tabName === 'solicitudes') {
        cargarSolicitudesAdmin();
    }
}

// ========== GESTIÓN DE ACTIVIDADES ==========

// Mostrar/ocultar formulario de evento
function mostrarFormularioEvento() {
    document.getElementById('formularioEvento').style.display = 'block';
    document.getElementById('tituloFormularioEvento').textContent = 'Agregar Nueva Actividad';
    document.getElementById('eventoAdminForm').reset();
    document.getElementById('eventoEditId').value = '';
}

function cancelarFormularioEvento() {
    document.getElementById('formularioEvento').style.display = 'none';
    document.getElementById('eventoAdminForm').reset();
}

// Guardar evento (crear o editar)
document.addEventListener('DOMContentLoaded', () => {
    const eventoForm = document.getElementById('eventoAdminForm');
    if (eventoForm) {
        eventoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const editId = document.getElementById('eventoEditId').value;
            
            const eventoData = {
                nombre: document.getElementById('eventoNombreAdmin').value,
                descripcion: document.getElementById('eventoDescripcionAdmin').value,
                fecha: document.getElementById('eventoFechaAdmin').value,
                horario: document.getElementById('eventoHorarioAdmin').value || null,
                edad: document.getElementById('eventoEdadAdmin').value || null,
                precio: parseFloat(document.getElementById('eventoPrecioAdmin').value),
                cupos: parseInt(document.getElementById('eventoCuposAdmin').value),
                imagen: document.getElementById('eventoImagenAdmin').value || null
            };
            
            try {
                if (supabaseClient && editId) {
                    // Editar evento existente en Supabase
                    const { error } = await supabaseClient
                        .from('eventos')
                        .update(eventoData)
                        .eq('id', editId);
                    
                    if (error) throw error;
                } else if (supabaseClient) {
                    // Agregar nuevo evento en Supabase
                    const { error } = await supabaseClient
                        .from('eventos')
                        .insert([eventoData]);
                    
                    if (error) throw error;
                } else {
                    // Fallback a localStorage si Supabase no está configurado
                    let eventos = JSON.parse(localStorage.getItem('youme_eventos') || '[]');
                    const eventoLocal = {
                        id: editId || Date.now().toString(),
                        ...eventoData
                    };
                    
                    if (editId) {
                        const index = eventos.findIndex(e => e.id === editId);
                        if (index !== -1) {
                            eventos[index] = eventoLocal;
                        }
                    } else {
                        eventos.push(eventoLocal);
                    }
                    localStorage.setItem('youme_eventos', JSON.stringify(eventos));
                }
                
                cancelarFormularioEvento();
                cargarEventosAdmin();
                cargarEventos(); // Actualizar vista pública también
                
                alert(editId ? 'Actividad actualizada correctamente' : 'Actividad agregada correctamente');
            } catch (error) {
                console.error('Error guardando evento:', error);
                alert('Error al guardar la actividad. Por favor intenta de nuevo.');
            }
        });
    }
});

// Cargar eventos en el panel admin
async function cargarEventosAdmin() {
    const container = document.getElementById('listaEventosAdmin');
    
    if (!container) return;
    
    try {
        let eventos = [];
        
        if (supabaseClient) {
            // Cargar desde Supabase
            const { data, error } = await supabaseClient
                .from('eventos')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            eventos = data || [];
        } else {
            // Fallback a localStorage
            eventos = JSON.parse(localStorage.getItem('youme_eventos') || '[]');
        }
        
        if (eventos.length === 0) {
            container.innerHTML = '<div class="no-data">No hay actividades creadas aún. Haz clic en "Agregar Nueva Actividad" para comenzar.</div>';
            return;
        }
        
        container.innerHTML = eventos.map(evento => `
            <div class="evento-admin-item">
                <div class="evento-admin-info">
                    <h4>${evento.nombre}</h4>
                    <p><strong>Fecha:</strong> ${evento.fecha}</p>
                    <p><strong>Precio:</strong> $${evento.precio} | <strong>Cupos:</strong> ${evento.cupos}</p>
                    ${evento.horario ? `<p><strong>Horario:</strong> ${evento.horario}</p>` : ''}
                </div>
                <div class="evento-admin-actions">
                    <button class="btn-edit" onclick="editarEvento('${evento.id}')">Editar</button>
                    <button class="btn-delete" onclick="eliminarEvento('${evento.id}')">Eliminar</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error cargando eventos:', error);
        container.innerHTML = '<div class="no-data">Error al cargar actividades. Por favor recarga la página.</div>';
    }
}

// Editar evento
async function editarEvento(eventoId) {
    try {
        let evento;
        
        if (supabaseClient) {
            // Cargar desde Supabase
            const { data, error } = await supabaseClient
                .from('eventos')
                .select('*')
                .eq('id', eventoId)
                .single();
            
            if (error) throw error;
            evento = data;
        } else {
            // Fallback a localStorage
            const eventos = JSON.parse(localStorage.getItem('youme_eventos') || '[]');
            evento = eventos.find(e => e.id === eventoId);
        }
        
        if (!evento) {
            alert('Evento no encontrado');
            return;
        }
        
        document.getElementById('eventoEditId').value = evento.id;
        document.getElementById('eventoNombreAdmin').value = evento.nombre;
        document.getElementById('eventoDescripcionAdmin').value = evento.descripcion;
        document.getElementById('eventoFechaAdmin').value = evento.fecha;
        document.getElementById('eventoHorarioAdmin').value = evento.horario || '';
        document.getElementById('eventoEdadAdmin').value = evento.edad || '';
        document.getElementById('eventoPrecioAdmin').value = evento.precio;
        document.getElementById('eventoCuposAdmin').value = evento.cupos;
        document.getElementById('eventoImagenAdmin').value = evento.imagen || '';
        
        document.getElementById('tituloFormularioEvento').textContent = 'Editar Actividad';
        document.getElementById('formularioEvento').style.display = 'block';
        
        // Scroll al formulario
        document.getElementById('formularioEvento').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error cargando evento:', error);
        alert('Error al cargar el evento. Por favor intenta de nuevo.');
    }
}

// Eliminar evento
async function eliminarEvento(eventoId) {
    if (!confirm('¿Estás seguro de que deseas eliminar esta actividad?')) return;
    
    try {
        if (supabaseClient) {
            // Eliminar de Supabase
            const { error } = await supabaseClient
                .from('eventos')
                .delete()
                .eq('id', eventoId);
            
            if (error) throw error;
        } else {
            // Fallback a localStorage
            let eventos = JSON.parse(localStorage.getItem('youme_eventos') || '[]');
            eventos = eventos.filter(e => e.id !== eventoId);
            localStorage.setItem('youme_eventos', JSON.stringify(eventos));
        }
        
        cargarEventosAdmin();
        cargarEventos(); // Actualizar vista pública también
        
        alert('Actividad eliminada correctamente');
    } catch (error) {
        console.error('Error eliminando evento:', error);
        alert('Error al eliminar la actividad. Por favor intenta de nuevo.');
    }
}

// ========== GESTIÓN DE RESERVAS ==========

// Sincronizar reservas guardadas en localStorage hacia Supabase (cuando ya existan las tablas)
// IMPORTANTE: esta migración se usó solo al principio. Para evitar duplicados,
// ya no subimos automáticamente las reservas locales; simplemente limpiamos el storage.
async function syncReservasLocalesASupabase() {
    if (!supabaseClient) return;
    const pendientes = JSON.parse(localStorage.getItem('youme_reservas_eventos') || '[]');
    if (pendientes.length > 0) {
        console.log('Sync de reservas locales desactivado. Eliminando youme_reservas_eventos de localStorage para evitar duplicados.');
        localStorage.removeItem('youme_reservas_eventos');
    }
}

async function cargarReservasAdmin() {
    const container = document.getElementById('listaReservasAdmin');
    if (!container) return;

    try {
        if (!supabaseClient) {
            container.innerHTML = '<div class="no-data">Las reservas se guardan en Supabase. Configura el proyecto para verlas aquí.</div>';
            return;
        }

        await syncReservasLocalesASupabase();

        const [resEventos, resCumple, resSolicitudesFecha, eventosData] = await Promise.all([
            supabaseClient.from('reservas_eventos').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('reservas_cumple').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('solicitudes_fecha_celebracion').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('eventos').select('id, nombre')
        ]);

        const eventosMap = (eventosData.data || []).reduce((acc, e) => { acc[String(e.id)] = e.nombre; return acc; }, {});

        let html = '';

        if (resEventos.error) {
            const locales = JSON.parse(localStorage.getItem('youme_reservas_eventos') || '[]');
            html += '<div class="no-data" style="margin-bottom: 1.5rem; padding: 1rem; background: #fff3cd; border-radius: 8px;">';
            html += '<strong>Para que las reservas se guarden en el servidor:</strong> entra en Supabase → SQL Editor → New query, copia y ejecuta todo el contenido del archivo <strong>supabase-tablas-reservas.sql</strong> del proyecto. Así se crean las tablas y las reservas se guardarán aquí y se restarán de los cupos.';
            html += '</div>';
            if (locales.length > 0) {
                html += '<h4 style="margin-bottom: 1rem; color: var(--turquoise);">Reservas locales (pendientes de subir al servidor)</h4>';
                locales.forEach(r => {
                    const eventoIdEsc = String(r.evento_id || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const diasVal = r.dias ?? 1;
                    html += `<div class="evento-admin-item" style="margin-bottom: 1rem;">
                        <div class="evento-admin-info"><p><strong>Actividad ID: ${r.evento_id}</strong></p><p>Niño/a: ${r.nombre_nino || '-'} | Padre: ${r.nombre_padre || '-'}</p><p>Tel: ${r.telefono || '-'} | Email: ${r.email || '-'}</p><p>Total: $${r.total ?? '-'} | Días: ${diasVal}</p></div>
                        <div class="evento-admin-actions" style="display: flex;"><button type="button" class="btn-delete" onclick="window.eliminarReservaEventoLocal('${r.id}', '${eventoIdEsc}', ${diasVal})" style="background: #dc3545; color: white; padding: 0.5rem 1rem; border: none; border-radius: 5px; cursor: pointer;">Eliminar</button></div>
                    </div>`;
                });
            }
            container.innerHTML = html || '<div class="no-data">No hay reservas. Ejecuta supabase-tablas-reservas.sql en Supabase para poder guardar.</div>';
            return;
        }

        const reservasEventos = (resEventos.data || []);
        if (reservasEventos.length > 0) {
            html += '<h4 style="margin-bottom: 1rem; color: var(--turquoise);">Reservas de actividades</h4>';
            reservasEventos.forEach(r => {
                const nombreActividad = eventosMap[r.evento_id] || 'Actividad';
                const eventoIdEsc = String(r.evento_id || '').replace(/'/g, "\\'");
                const diasVal = r.dias ?? 1;
                const comentario = r.comentarios_admin || '';
                html += `
                    <div class="evento-admin-item" style="margin-bottom: 1rem;">
                        <div class="evento-admin-info">
                            <p><strong>${nombreActividad}</strong></p>
                            <p>Niño/a: ${r.nombre_nino || '-'} | Padre: ${r.nombre_padre || '-'}</p>
                            <p>Tel: ${r.telefono || '-'} | Email: ${r.email || '-'}</p>
                            <p><strong>Días reservados:</strong> ${diasVal}</p>
                            <p><strong>Total:</strong> $${r.total ?? '-'}</p>
                            <p><strong>Comentarios (solo admin):</strong></p>
                            <textarea class="reserva-comentario-admin" data-reserva-id="${r.id}" data-reserva-tipo="evento" rows="2" style="width:100%; padding:0.35rem 0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.9rem;" placeholder="Notas internas sobre esta reserva (no se envían al cliente).">${comentario}</textarea>
                        </div>
                        <div class="evento-admin-actions" style="align-items: center; gap: 0.5rem; display: flex; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" ${r.pagado ? 'checked' : ''} onchange="marcarPagadoReservaEvento('${r.id}', this.checked)">
                                Pagado
                            </label>
                            <button type="button" class="btn-delete" onclick="window.eliminarReservaEvento('${r.id}', '${eventoIdEsc}', ${diasVal})" style="background: #dc3545; color: white; padding: 0.5rem 1rem; border: none; border-radius: 5px; cursor: pointer;">Eliminar</button>
                        </div>
                    </div>
                `;
            });
        }

        const reservasCumple = (resCumple.data || []);
        const solicitudesFecha = (resSolicitudesFecha.data || []);
        const hayCumpleOSolicitudes = reservasCumple.length > 0 || solicitudesFecha.length > 0;
        if (hayCumpleOSolicitudes) {
            html += '<h4 style="margin: 2rem 0 1rem; color: var(--orange);">Reservas de cumpleaños</h4>';
            reservasCumple.forEach(r => {
                const decorTexto = r.decoracion || 'Llevaré mi propia decoración';
                const matchDec = decorTexto.match(/\$([0-9]+)/);
                const precioDecor = matchDec ? `$${matchDec[1]}` : '$0';
                const actTexto = r.actividad || 'Ninguna';
                const matchAct = actTexto.match(/\$([0-9]+)/);
                const precioAct = matchAct ? `$${matchAct[1]}` : '$0';
                const precioEquipo = r.equipo ? '$125' : '$0';
                const comentario = r.comentarios_admin || '';

                html += `
                    <div class="evento-admin-item" style="margin-bottom: 1rem;">
                        <div class="evento-admin-info">
                            <p><strong>Cumpleaños - ${r.nombre_nino || '-'}</strong></p>
                            <p>Fecha: ${r.fecha || '-'} | Contacto: ${r.contacto || '-'}</p>
                            <p>Tel: ${r.telefono || '-'} | Email: ${r.email || '-'}</p>
                            <p><strong>Horas de espacio:</strong> ${r.horas ?? '-'}</p>
                            <p><strong>Decoración:</strong> ${decorTexto} ( ${precioDecor} )</p>
                            <p><strong>Equipo para Toddlers:</strong> ${r.equipo ? `Sí (${precioEquipo})` : 'No ($0)'}</p>
                            <p><strong>Actividad extra:</strong> ${actTexto}${r.num_ninos != null ? ` (niños: ${r.num_ninos})` : ''}${precioAct ? ` - ${precioAct}` : ''}</p>
                            <p><strong>Total:</strong> $${r.total ?? '-'}</p>
                            <p><strong>Comentarios (solo admin):</strong></p>
                            <textarea class="reserva-comentario-admin" data-reserva-id="${r.id}" data-reserva-tipo="cumple" rows="2" style="width:100%; padding:0.35rem 0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.9rem;" placeholder="Notas internas sobre esta reserva (no se envían al cliente).">${comentario}</textarea>
                        </div>
                        <div class="evento-admin-actions" style="align-items: center; gap: 0.5rem; display: flex; flex-wrap: wrap;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" ${r.pagado ? 'checked' : ''} onchange="marcarPagadoReservaCumple('${r.id}', this.checked)">
                                Pagado
                            </label>
                            <button type="button" class="btn-delete" onclick="eliminarReservaCumple('${r.id}')" style="background: #dc3545; color: white; padding: 0.5rem 1rem; border: none; border-radius: 5px; cursor: pointer;">Eliminar</button>
                        </div>
                    </div>
                `;
            });
            solicitudesFecha.forEach(s => {
                const fechaStr = s.fecha_solicitada ? String(s.fecha_solicitada).split('T')[0] : '-';
                const created = s.created_at ? new Date(s.created_at).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' }) : '';
                const msgHtml = (s.mensaje || '').trim() ? `<p><strong>Mensaje:</strong> ${escapeHtml(String(s.mensaje))}</p>` : '';
                const estado = ((s.estado || 'pendiente') + '').trim().toLowerCase();
                let estadoColor = '#f97316';
                let estadoBg = '#ffedd5';
                let estadoText = 'Pendiente';
                if (estado === 'aprobada') {
                    estadoColor = '#16a34a';
                    estadoBg = '#dcfce7';
                    estadoText = 'Aprobada';
                } else if (estado === 'rechazada') {
                    estadoColor = '#b91c1c';
                    estadoBg = '#fee2e2';
                    estadoText = 'Rechazada';
                }
                const decisionInfo = s.resuelta_en
                    ? `<p style="font-size:0.8rem; color:#666;">Resuelta: ${new Date(s.resuelta_en).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}</p>`
                    : '';
                const esPendiente = estado === 'pendiente';
                html += `
                    <div class="evento-admin-item" style="margin-bottom: 1rem; border-left: 4px solid #0ea5e9;">
                        <div class="evento-admin-info">
                            <p>
                                <strong>Solicitud de fecha</strong>
                                <span style="background:#e0f2fe; color:#0369a1; padding:0.2rem 0.5rem; border-radius:4px; font-size:0.85rem; margin-left:0.25rem;">Requesting this date</span>
                                <span style="background:${estadoBg}; color:${estadoColor}; padding:0.15rem 0.45rem; border-radius:999px; font-size:0.8rem; margin-left:0.35rem;">${estadoText}</span>
                            </p>
                            <p><strong>Fecha solicitada:</strong> ${fechaStr}</p>
                            <p>Contacto: ${escapeHtml(s.nombre_contacto || '-')} | Tel: ${escapeHtml(s.telefono || '-')} | Email: ${escapeHtml(s.email || '-')}</p>
                            ${msgHtml}
                            <p style="font-size:0.8rem; color:#666;">Enviado: ${created}</p>
                            ${decisionInfo}
                        </div>
                        <div class="evento-admin-actions" style="align-items:flex-start; gap:0.5rem; display:flex; flex-wrap:wrap; margin-top:0.5rem;">
                            ${esPendiente ? `
                                <button type="button" class="btn-edit" onclick="aprobarSolicitudFecha('${s.id}')">Aprobar y crear reserva</button>
                                <button type="button" class="btn-edit" onclick="rechazarSolicitudFecha('${s.id}')" style="background:#fee2e2; color:#b91c1c; border-color:#fecaca;">Rechazar</button>
                            ` : `
                                <span style="padding:0.35rem 0.75rem; border-radius:999px; font-size:0.8rem; background:${estadoBg}; color:${estadoColor}; border:1px solid ${estadoColor};">
                                    ${estadoText}
                                </span>
                            `}
                            <button type="button" class="btn-delete" onclick="eliminarSolicitudFecha('${s.id}')">Borrar</button>
                        </div>
                    </div>
                `;
            });
        }

        if (!html) {
            container.innerHTML = '<div class="no-data">No hay reservas registradas aún.</div>';
            return;
        }
        container.innerHTML = html;

        // Guardar comentarios de admin para reservas en Supabase
        if (supabaseClient) {
            const reservaTextareas = container.querySelectorAll('.reserva-comentario-admin');
            reservaTextareas.forEach(textarea => {
                textarea.addEventListener('input', async () => {
                    const id = textarea.dataset.reservaId;
                    const tipo = textarea.dataset.reservaTipo;
                    const texto = textarea.value;
                    const tabla = tipo === 'cumple' ? 'reservas_cumple' : 'reservas_eventos';
                    try {
                        await supabaseClient
                            .from(tabla)
                            .update({ comentarios_admin: texto })
                            .eq('id', id);
                    } catch (e) {
                        console.error('Error guardando comentarios_admin de reserva:', e);
                    }
                });
            });
        }
    } catch (error) {
        console.error('Error cargando reservas:', error);
        container.innerHTML = '<div class="no-data">Error al cargar reservas. Si acabas de añadir las tablas en Supabase, ejecuta el SQL de reservas_eventos y reservas_cumple.</div>';
    }
}

// ========== GESTIÓN DE DISPONIBILIDAD ==========

async function cargarDisponibilidadesAdmin() {
    const listaCumple = document.getElementById('listaDisponibilidadCumple');
    if (!supabaseClient || !listaCumple) return;

    try {
        const { data, error } = await supabaseClient
            .from('disponibilidad_cumple')
            .select('*')
            .order('fecha', { ascending: true })
            .order('hora', { ascending: true });

        if (error) throw error;
        const filas = data || [];

        if (filas.length === 0) {
            listaCumple.innerHTML = '<div class="no-data">Aún no hay bloques de disponibilidad para celebraciones.</div>';
        } else {
            listaCumple.innerHTML = filas.map(d => {
                const isoFecha = d.fecha ? String(d.fecha).split('T')[0] : '';
                // Formatear fecha en local sin cambios de día por zona horaria
                let fechaLegible = '-';
                if (d.fecha) {
                    const [y, m, dia] = isoFecha.split('-').map(Number);
                    const fechaLocal = new Date(y, (m || 1) - 1, dia || 1);
                    fechaLegible = fechaLocal.toLocaleDateString('es-PR', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                }
                const hora = d.hora ? d.hora.substring(0,5) : '';
                const horasDuracion = d.duracion_min ? (d.duracion_min / 60) : 1;
                return `
                    <div class="evento-admin-item" style="margin-bottom:0.5rem;">
                        <div class="evento-admin-info">
                            <p><strong>${fechaLegible}</strong></p>
                            <p id="dispResumen-${d.id}">
                                Fecha: ${isoFecha || '-'} |
                                Hora: ${hora || '-'} |
                                Duración: ${horasDuracion} horas
                            </p>
                            <div id="dispEditor-${d.id}" style="display:none; margin-top:0.25rem;">
                                <p>
                                    Fecha:
                                    <input type="date"
                                           value="${isoFecha}"
                                           data-disp-id="${d.id}-fecha"
                                           style="margin-left:0.25rem; padding:0.1rem 0.25rem; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                                </p>
                                <p>
                                    Hora:
                                    <input type="time"
                                           value="${hora}"
                                           step="1800"
                                           data-disp-id="${d.id}-hora"
                                           style="margin-left:0.25rem; padding:0.1rem 0.25rem; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                                </p>
                                <p>
                                    Duración:
                                    <input type="number"
                                           min="0.5"
                                           step="0.5"
                                           value="${horasDuracion}"
                                           data-disp-id="${d.id}-duracion"
                                           style="width:4rem; margin:0 0.25rem; padding:0.1rem 0.25rem; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                                    horas
                                </p>
                            </div>
                            <p>Disponible: ${d.disponible ? 'Sí' : 'No'}</p>
                        </div>
                        <div class="evento-admin-actions">
                            <button class="btn-edit" onclick="toggleDisponibilidadCumple('${d.id}', ${!d.disponible})">
                                ${d.disponible ? 'Marcar como no disponible' : 'Marcar como disponible'}
                            </button>
                            <button class="btn-edit" onclick="mostrarEditorDisponibilidadCumple('${d.id}')">
                                Editar
                            </button>
                            <button class="btn-edit" onclick="guardarCambiosDisponibilidadCumple('${d.id}')" style="display:none;" id="dispGuardarBtn-${d.id}">
                                Guardar
                            </button>
                            <button class="btn-edit" onclick="cancelarEditorDisponibilidadCumple('${d.id}')" style="display:none;" id="dispCancelarBtn-${d.id}">
                                Cancelar
                            </button>
                            <button class="btn-delete" onclick="eliminarDisponibilidadCumple('${d.id}')">Eliminar</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error cargando disponibilidad de celebraciones:', error);
        listaCumple.innerHTML = '<div class="no-data">Error al cargar disponibilidad de celebraciones.</div>';
    }
}

async function cargarSolicitudesFechaAdmin() {
    const container = document.getElementById('listaSolicitudesFechaAdmin');
    if (!container) return;
    if (!supabaseClient) {
        container.innerHTML = '<div class="no-data">No disponible sin Supabase.</div>';
        return;
    }
    try {
        const { data, error } = await supabaseClient
            .from('solicitudes_fecha_celebracion')
            .select('*')
            .order('fecha_solicitada', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) throw error;
        const list = data || [];
        if (list.length === 0) {
            container.innerHTML = '<div class="no-data">Aún no hay solicitudes de fecha.</div>';
            return;
        }
        container.innerHTML = list.map(s => {
            const fechaStr = s.fecha_solicitada ? String(s.fecha_solicitada).split('T')[0] : '-';
            const created = s.created_at ? new Date(s.created_at).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' }) : '';
            const msg = (s.mensaje || '').trim() ? `<p><strong>Mensaje:</strong> ${escapeHtml(s.mensaje)}</p>` : '';
            const estado = ((s.estado || 'pendiente') + '').trim().toLowerCase();
            let estadoColor = '#f97316';
            let estadoBg = '#ffedd5';
            let estadoText = 'Pendiente';
            if (estado === 'aprobada') {
                estadoColor = '#16a34a';
                estadoBg = '#dcfce7';
                estadoText = 'Aprobada';
            } else if (estado === 'rechazada') {
                estadoColor = '#b91c1c';
                estadoBg = '#fee2e2';
                estadoText = 'Rechazada';
            }
            const decisionInfo = s.resuelta_en
                ? `<p style="font-size:0.8rem; color:#666;">Resuelta: ${new Date(s.resuelta_en).toLocaleString('es-PR', { dateStyle: 'short', timeStyle: 'short' })}</p>`
                : '';
            return `
                <div class="evento-admin-item" style="margin-bottom:0.75rem;">
                    <div class="evento-admin-info">
                        <p>
                            <strong>Fecha solicitada:</strong> ${fechaStr}
                            <span style="background:${estadoBg}; color:${estadoColor}; padding:0.15rem 0.45rem; border-radius:999px; font-size:0.8rem; margin-left:0.5rem;">${estadoText}</span>
                        </p>
                        <p><strong>Contacto:</strong> ${escapeHtml(s.nombre_contacto || '')} | ${escapeHtml(s.email || '')} | ${escapeHtml(s.telefono || '')}</p>
                        ${msg}
                        <p style="font-size:0.8rem; color:#666;">Enviado: ${created}</p>
                        ${decisionInfo}
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('Error cargando solicitudes de fecha:', e);
        container.innerHTML = '<div class="no-data">Error al cargar. ¿Ejecutaste supabase-solicitudes-fecha-celebracion.sql?</div>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function guardarDisponibilidadServicio(e) {
    // Función mantenida solo para compatibilidad; ya no se muestra el formulario de servicios.
    e.preventDefault();
}

async function aprobarSolicitudFecha(id) {
    if (!supabaseClient) {
        alert('Supabase no está configurado. No se puede aprobar la solicitud.');
        return;
    }
    const confirmAprobar = confirm('¿Aprobar esta solicitud de fecha y crear una reserva de cumpleaños básica?');
    if (!confirmAprobar) return;
    const comentario = '';
    try {
        const { data: s, error } = await supabaseClient
            .from('solicitudes_fecha_celebracion')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error || !s) {
            console.error('Error obteniendo solicitud de fecha:', error);
            alert('No se pudo obtener la solicitud. Intenta de nuevo.');
            return;
        }
        const fechaStr = s.fecha_solicitada ? String(s.fecha_solicitada).split('T')[0] : null;
        // Crear una reserva básica de cumpleaños para tenerla en el sistema
        if (fechaStr) {
            try {
                await supabaseClient
                    .from('reservas_cumple')
                    .insert([{
                        nombre_nino: null,
                        fecha: fechaStr,
                        contacto: s.nombre_contacto || '',
                        telefono: s.telefono || '',
                        email: s.email || '',
                        horas: null,
                        decoracion: 'Pendiente definir (creada desde solicitud de fecha)',
                        equipo: false,
                        pretend_play: false,
                        actividad: 'Pendiente definir',
                        num_ninos: 0,
                        total: null,
                        pagado: false,
                        comentarios_admin: `Creado desde solicitud de fecha (ID: ${id}). Revisar detalles con el cliente.`
                    }]);
            } catch (e) {
                console.error('Error creando reserva_cumple desde solicitud:', e);
            }
        }
        await supabaseClient
            .from('solicitudes_fecha_celebracion')
            .update({
                estado: 'aprobada',
                decision_comentario: comentario || null,
                resuelta_en: new Date().toISOString()
            })
            .eq('id', id);
        await enviarEmailDecisionSolicitudFecha(s.email, s.nombre_contacto, fechaStr || '', 'aprobada', comentario);
        await cargarReservasAdmin();
        await cargarSolicitudesFechaAdmin();
        alert('Solicitud aprobada. Se creó una reserva básica y se envió un email al cliente (si no hubo errores).');
    } catch (e) {
        console.error('Error aprobando solicitud de fecha:', e);
        alert('Ocurrió un error al aprobar la solicitud.');
    }
}

async function rechazarSolicitudFecha(id) {
    if (!supabaseClient) {
        alert('Supabase no está configurado. No se puede rechazar la solicitud.');
        return;
    }
    const confirmRechazar = confirm('¿Rechazar esta solicitud de fecha?');
    if (!confirmRechazar) return;
    const comentario = '';
    try {
        const { data: s, error } = await supabaseClient
            .from('solicitudes_fecha_celebracion')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error || !s) {
            console.error('Error obteniendo solicitud de fecha:', error);
            alert('No se pudo obtener la solicitud. Intenta de nuevo.');
            return;
        }
        const fechaStr = s.fecha_solicitada ? String(s.fecha_solicitada).split('T')[0] : '';
        await supabaseClient
            .from('solicitudes_fecha_celebracion')
            .update({
                estado: 'rechazada',
                decision_comentario: comentario || null,
                resuelta_en: new Date().toISOString()
            })
            .eq('id', id);
        await enviarEmailDecisionSolicitudFecha(s.email, s.nombre_contacto, fechaStr, 'rechazada', comentario);
        await cargarReservasAdmin();
        await cargarSolicitudesFechaAdmin();
        alert('Solicitud rechazada y email de notificación enviado al cliente (si no hubo errores).');
    } catch (e) {
        console.error('Error rechazando solicitud de fecha:', e);
        alert('Ocurrió un error al rechazar la solicitud.');
    }
}

async function eliminarSolicitudFecha(id) {
    if (!supabaseClient) {
        alert('Supabase no está configurado. No se puede borrar la solicitud.');
        return;
    }
    const confirmBorrar = confirm('¿Borrar esta solicitud de fecha? Esta acción no se puede deshacer.');
    if (!confirmBorrar) return;
    try {
        await supabaseClient
            .from('solicitudes_fecha_celebracion')
            .delete()
            .eq('id', id);
        await cargarReservasAdmin();
        await cargarSolicitudesFechaAdmin();
    } catch (e) {
        console.error('Error borrando solicitud de fecha:', e);
        alert('Ocurrió un error al borrar la solicitud.');
    }
}

async function guardarCambiosDisponibilidadCumple(id) {
    if (!supabaseClient) return;
    const inputFecha = document.querySelector(`input[data-disp-id="${id}-fecha"]`);
    const inputHora = document.querySelector(`input[data-disp-id="${id}-hora"]`);
    const inputDur = document.querySelector(`input[data-disp-id="${id}-duracion"]`);
    if (!inputFecha || !inputHora || !inputDur) return;

    const fechaTrim = (inputFecha.value || '').trim();
    const horaTrim = (inputHora.value || '').trim();
    const durStr = (inputDur.value || '').trim();

    const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexFecha.test(fechaTrim)) {
        alert('Por favor ingresa una fecha válida en formato AAAA-MM-DD (por ejemplo 2026-04-15).');
        return;
    }

    const regexHora = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!regexHora.test(horaTrim)) {
        alert('Por favor ingresa una hora válida en formato HH:MM (por ejemplo 15:30).');
        return;
    }

    const horas = parseFloat(durStr);
    if (!horas || horas <= 0) {
        alert('Por favor ingresa una duración válida en horas (por ejemplo 1.5).');
        return;
    }
    const duracionMin = Math.round(horas * 60);

    try {
        await supabaseClient
            .from('disponibilidad_cumple')
            .update({ fecha: fechaTrim, hora: horaTrim, duracion_min: duracionMin })
            .eq('id', id);
        await cargarDisponibilidadesAdmin();
    } catch (e) {
        console.error('Error actualizando disponibilidad de cumpleaños:', e);
        alert('Error al actualizar el bloque de celebración.');
    }
}

function mostrarEditorDisponibilidadCumple(id) {
    const editor = document.getElementById(`dispEditor-${id}`);
    const guardarBtn = document.getElementById(`dispGuardarBtn-${id}`);
    const cancelarBtn = document.getElementById(`dispCancelarBtn-${id}`);
    if (editor && guardarBtn && cancelarBtn) {
        editor.style.display = 'block';
        guardarBtn.style.display = 'inline-block';
        cancelarBtn.style.display = 'inline-block';
    }
}

function cancelarEditorDisponibilidadCumple(id) {
    const editor = document.getElementById(`dispEditor-${id}`);
    const guardarBtn = document.getElementById(`dispGuardarBtn-${id}`);
    const cancelarBtn = document.getElementById(`dispCancelarBtn-${id}`);
    if (editor && guardarBtn && cancelarBtn) {
        editor.style.display = 'none';
        guardarBtn.style.display = 'none';
        cancelarBtn.style.display = 'none';
    }
}

let fechasDisponibilidadSeleccionadas = [];

function renderFechasDisponibilidadSeleccionadas() {
    const cont = document.getElementById('dispFechasSeleccionadas');
    if (!cont) return;
    if (!fechasDisponibilidadSeleccionadas.length) {
        cont.textContent = 'Ninguna fecha seleccionada aún.';
        return;
    }
    // Renderizar como chips con icono de zafacón
    cont.innerHTML = fechasDisponibilidadSeleccionadas.map(f => `
        <span class="fecha-chip" data-fecha="${f}" style="display:inline-flex; align-items:center; padding:0.2rem 0.4rem; margin:0.1rem; border-radius:999px; background:#f0f0f0; font-size:0.85rem;">
            <span>${f}</span>
            <button type="button" class="fecha-chip-remove" data-fecha="${f}" style="margin-left:0.3rem; border:none; background:none; cursor:pointer; font-size:0.8rem; color:#dc3545; text-decoration:underline;" aria-label="Eliminar fecha ${f}">Eliminar</button>
        </span>
    `).join('');

    cont.querySelectorAll('.fecha-chip-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const f = btn.getAttribute('data-fecha');
            const idx = fechasDisponibilidadSeleccionadas.indexOf(f);
            if (idx !== -1) {
                fechasDisponibilidadSeleccionadas.splice(idx, 1);
                fechasDisponibilidadSeleccionadas.sort();
                renderFechasDisponibilidadSeleccionadas();
            }
        });
    });
}

async function guardarDisponibilidadCumple(e) {
    e.preventDefault();
    if (!supabaseClient) return;
    const fechaInicio = document.getElementById('dispFechaCumple').value;
    const hora1 = document.getElementById('dispHoraCumple1').value;
    const duracionHoras1 = parseFloat(document.getElementById('dispDuracionCumple1').value) || 1;

    if (!hora1) return;

    try {
        const fechasAInsertar = [];

        if (fechasDisponibilidadSeleccionadas.length) {
            fechasDisponibilidadSeleccionadas.forEach(f => fechasAInsertar.push(f));
        } else {
            if (!fechaInicio) {
                alert('Selecciona al menos una fecha y pulsa "Agregar fecha" antes de guardar.');
                return;
            }
            fechasAInsertar.push(fechaInicio);
        }

        const registros = [];
        fechasAInsertar.forEach(f => {
            registros.push({
                fecha: f,
                hora: hora1,
                duracion_min: Math.round(duracionHoras1 * 60),
                disponible: true
            });
        });

        console.log('Guardando disponibilidad_cumple', { fechasAInsertar, registros });
        await supabaseClient.from('disponibilidad_cumple').insert(registros);
        (document.getElementById('formDisponibilidadCumple') || {}).reset?.();
        fechasDisponibilidadSeleccionadas = [];
        renderFechasDisponibilidadSeleccionadas();
        await cargarDisponibilidadesAdmin();
    } catch (e) {
        console.error('Error guardando disponibilidad de cumpleaños:', e);
        const detalle = e?.message || e?.code || JSON.stringify(e);
        alert('Error al guardar el bloque de celebración.\n\nDetalle: ' + detalle);
    }
}

async function toggleDisponibilidadServicio(id, disponible) {
    // Ya no se gestiona disponibilidad de servicios desde el panel; función vacía para evitar errores si se llama.
    return;
}

async function toggleDisponibilidadCumple(id, disponible) {
    if (!supabaseClient) return;
    try {
        await supabaseClient.from('disponibilidad_cumple').update({ disponible }).eq('id', id);
        await cargarDisponibilidadesAdmin();
    } catch (e) {
        console.error('Error actualizando disponibilidad de cumpleaños:', e);
    }
}

async function eliminarDisponibilidadServicio(id) {
    // Ya no se gestiona disponibilidad de servicios desde el panel; función vacía para evitar errores si se llama.
    return;
}

async function eliminarDisponibilidadCumple(id) {
    if (!supabaseClient) return;
    if (!confirm('¿Eliminar este bloque de celebración?')) return;
    try {
        await supabaseClient.from('disponibilidad_cumple').delete().eq('id', id);
        await cargarDisponibilidadesAdmin();
    } catch (e) {
        console.error('Error eliminando bloque de celebración:', e);
    }
}

async function eliminarReservaEvento(reservaId, eventoId, dias) {
    if (!confirm('¿Eliminar esta reservación? Se devolverá el cupo a la actividad.')) return;
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('reservas_eventos')
                .delete()
                .eq('id', reservaId);
            if (error) throw error;
            const { data: ev } = await supabaseClient.from('eventos').select('cupos').eq('id', eventoId).single();
            if (ev && ev.cupos != null) {
                const nuevoCupos = (ev.cupos || 0) + (dias || 1);
                await supabaseClient.from('eventos').update({ cupos: nuevoCupos }).eq('id', eventoId);
            }
        } else {
            eliminarReservaEventoLocal(reservaId, eventoId, dias);
            return;
        }
        cargarReservasAdmin();
        cargarEventos();
        alert('Reservación eliminada. Se devolvió el cupo a la actividad.');
    } catch (e) {
        console.error(e);
        alert('Error al eliminar la reservación.');
    }
}

function eliminarReservaEventoLocal(reservaId, eventoId, dias) {
    if (!confirm('¿Eliminar esta reservación? Se devolverá el cupo a la actividad.')) return;
    try {
        let reservas = JSON.parse(localStorage.getItem('youme_reservas_eventos') || '[]');
        reservas = reservas.filter(r => String(r.id) !== String(reservaId));
        localStorage.setItem('youme_reservas_eventos', JSON.stringify(reservas));
        if (supabaseClient) {
            supabaseClient.from('eventos').select('cupos').eq('id', eventoId).single().then(({ data: ev }) => {
                if (ev && ev.cupos != null) {
                    const nuevoCupos = (ev.cupos || 0) + (dias || 1);
                    supabaseClient.from('eventos').update({ cupos: nuevoCupos }).eq('id', eventoId).then(() => {
                        cargarReservasAdmin();
                        cargarEventos();
                        alert('Reservación eliminada. Se devolvió el cupo a la actividad.');
                    });
                } else {
                    cargarReservasAdmin();
                    cargarEventos();
                    alert('Reservación eliminada.');
                }
            });
        } else {
            const eventos = JSON.parse(localStorage.getItem('youme_eventos') || '[]');
            const idx = eventos.findIndex(e => String(e.id) === String(eventoId));
            if (idx >= 0 && eventos[idx].cupos != null) {
                eventos[idx].cupos = (eventos[idx].cupos || 0) + (dias || 1);
                localStorage.setItem('youme_eventos', JSON.stringify(eventos));
            }
            cargarReservasAdmin();
            cargarEventos();
            alert('Reservación eliminada. Se devolvió el cupo a la actividad.');
        }
    } catch (e) {
        console.error(e);
        alert('Error al eliminar la reservación.');
    }
}

async function marcarPagadoReservaEvento(reservaId, pagado) {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('reservas_eventos')
            .update({ pagado: !!pagado })
            .eq('id', reservaId);
        if (error) throw error;
    } catch (e) {
        console.error(e);
        alert('Error al actualizar estado de pago.');
    }
}

async function marcarPagadoReservaCumple(reservaId, pagado) {
    if (!supabaseClient) return;
    try {
        const { error } = await supabaseClient
            .from('reservas_cumple')
            .update({ pagado: !!pagado })
            .eq('id', reservaId);
        if (error) throw error;
    } catch (e) {
        console.error(e);
        alert('Error al actualizar estado de pago.');
    }
}

async function eliminarReservaCumple(reservaId) {
    if (!confirm('¿Eliminar esta reserva de cumpleaños?')) return;
    try {
        if (supabaseClient) {
            // 1) Obtener la fecha de la reserva antes de borrarla
            const { data: reservaData, error: errSelect } = await supabaseClient
                .from('reservas_cumple')
                .select('fecha')
                .eq('id', reservaId)
                .maybeSingle();
            if (errSelect) throw errSelect;

            // 2) Borrar la reserva
            const { error: errDelete } = await supabaseClient
                .from('reservas_cumple')
                .delete()
                .eq('id', reservaId);
            if (errDelete) throw errDelete;

            // 3) Si tenemos fecha, desbloquear el día, el anterior y el siguiente
            if (reservaData && reservaData.fecha) {
                const fechaStr = String(reservaData.fecha).split('T')[0];
                const base = new Date(fechaStr);
                if (!isNaN(base.getTime())) {
                    const fechasADesbloquear = [];
                    const fPrev = new Date(base); fPrev.setDate(fPrev.getDate() - 1);
                    const fCurr = new Date(base);
                    const fNext = new Date(base); fNext.setDate(fNext.getDate() + 1);
                    [fPrev, fCurr, fNext].forEach(d => {
                        fechasADesbloquear.push(d.toISOString().split('T')[0]);
                    });

                    const { error: errUpdate } = await supabaseClient
                        .from('disponibilidad_cumple')
                        .update({ disponible: true })
                        .in('fecha', fechasADesbloquear);
                    if (errUpdate) {
                        console.error('Error desbloqueando fechas de disponibilidad tras eliminar reserva de cumple:', errUpdate);
                    }
                }
            }
        } else {
            let reservas = JSON.parse(localStorage.getItem('youme_reservas_cumple') || '[]');
            reservas = reservas.filter(r => String(r.id) !== String(reservaId));
            localStorage.setItem('youme_reservas_cumple', JSON.stringify(reservas));
        }
        cargarReservasAdmin();
        alert('Reserva de cumpleaños eliminada.');
    } catch (e) {
        console.error(e);
        alert('Error al eliminar la reserva.');
    }
}

// ========== GESTIÓN DE SOLICITUDES ==========

// Variable global para el filtro actual
let filtroActualSolicitudes = 'todas';

// Cargar solicitudes de servicio
async function cargarSolicitudesAdmin(filtro = null) {
    if (filtro) filtroActualSolicitudes = filtro;
    
    const container = document.getElementById('listaSolicitudesAdmin');
    if (!container) return;
    
    let solicitudes = [];
    let desdeSupabase = [];
    let supabaseReadErrorMsg = '';
    
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('solicitudes')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data && Array.isArray(data)) {
                desdeSupabase = data.map(s => {
                    const tipoCobRaw = s.tipo_cobertura ?? s['tipo_cobertura'] ?? s.tipoCobertura;
                    const tipoCob = (tipoCobRaw != null && String(tipoCobRaw).trim() !== '') ? String(tipoCobRaw).trim() : null;
                    return {
                        id: s.id,
                        fecha: s.created_at ? new Date(s.created_at).toLocaleString('es-PR') : '',
                        servicio: s.servicio,
                        paciente: s.paciente,
                        edad: s.edad,
                        tutor: s.tutor,
                        email: s.email,
                        telefono: s.telefono,
                        tipo_cobertura: tipoCob,
                        tipoCobertura: tipoCob,
                        motivo: s.motivo,
                        contactoPreferido: s.contacto_preferido,
                        comentariosAdmin: s.comentarios_admin || '',
                        contactado: s.contactado || false,
                        agendado: s.agendado || false
                    };
                });
            } else if (error) {
                supabaseReadErrorMsg = error?.message || 'Permiso denegado al leer solicitudes.';
                console.warn('Cargar solicitudes desde Supabase (error):', error);
            }
        } catch (err) {
            supabaseReadErrorMsg = err?.message || 'Error de conexión al leer solicitudes.';
            console.warn('Cargar solicitudes desde Supabase:', err);
        }
    }
    
    let desdeLocal = [];
    try {
        desdeLocal = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
    } catch (e) {
        desdeLocal = [];
    }
    // Mostrar primero las de Supabase, luego las de localStorage
    solicitudes = [...desdeSupabase, ...desdeLocal];
    // Normalizar tipo_cobertura para que siempre se muestre en el admin (cualquier clave posible)
    solicitudes = solicitudes.map(sol => {
        const raw = sol.tipo_cobertura ?? sol.tipoCobertura ?? sol['tipo_cobertura'];
        const tipoCob = (raw != null && String(raw).trim() !== '') ? String(raw).trim() : null;
        return { ...sol, tipo_cobertura: tipoCob ?? sol.tipo_cobertura, tipoCobertura: tipoCob ?? sol.tipoCobertura };
    });

    try {
        // Aplicar filtro
        if (filtroActualSolicitudes === 'pendientes') {
            solicitudes = solicitudes.filter(s => !s.contactado);
        } else if (filtroActualSolicitudes === 'contactadas') {
            solicitudes = solicitudes.filter(s => s.contactado && !s.agendado);
        } else if (filtroActualSolicitudes === 'agendadas') {
            solicitudes = solicitudes.filter(s => s.agendado);
        }
        
        if (solicitudes.length === 0) {
            const mensajes = {
                'todas': 'No hay solicitudes recibidas aún.',
                'pendientes': 'No hay solicitudes pendientes.',
                'contactadas': 'No hay solicitudes contactadas.',
                'agendadas': 'No hay solicitudes agendadas.'
            };
            let htmlMsg = `<div class="no-data">${mensajes[filtroActualSolicitudes]}</div>`;
            if (filtroActualSolicitudes === 'todas') {
                htmlMsg += '<p style="margin-top: 1rem; font-size: 0.9rem; color: #666;">Si enviaste una solicitud y no aparece aquí, ejecuta en Supabase (SQL Editor) el archivo <strong>supabase-tabla-solicitudes.sql</strong> del proyecto y vuelve a intentar. Las solicitudes se guardan también en este navegador hasta que el servidor esté listo.</p>';
                if (supabaseReadErrorMsg) {
                    htmlMsg += `<p style="margin-top: 0.5rem; font-size: 0.85rem; color: #b45309;"><strong>Detalle:</strong> ${escapeHtml(String(supabaseReadErrorMsg))}</p>`;
                }
            }
            container.innerHTML = htmlMsg;
            return;
        }
        
        container.innerHTML = solicitudes.map(sol => {
            const contactado = sol.contactado || false;
            const agendado = sol.agendado || false;
            const comentario = sol.comentariosAdmin || sol.comentarios_admin || '';
            
            return `
            <div class="solicitud-item" style="border-left-color: ${agendado ? '#28a745' : (contactado ? '#ffc107' : '#00d4aa')}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
                    <h4 style="margin: 0;">${sol.servicio}</h4>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${agendado ? 
                            '<span style="background: #28a745; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">✓ Agendado</span>' : 
                            contactado ? 
                                '<span style="background: #ffc107; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">✓ Contactado</span>' : 
                                '<span style="background: #dc3545; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.85rem; font-weight: 500;">Pendiente</span>'
                        }
                    </div>
                </div>
                <div class="info-row">
                    <strong>Fecha de solicitud:</strong>
                    <span>${sol.fecha}</span>
                </div>
                <div class="info-row">
                    <strong>Paciente:</strong>
                    <span>${sol.paciente} (${sol.edad} años)</span>
                </div>
                <div class="info-row">
                    <strong>Tutor/Responsable:</strong>
                    <span>${sol.tutor}</span>
                </div>
                <div class="info-row">
                    <strong>Email:</strong>
                    <span><a href="mailto:${sol.email}">${sol.email}</a></span>
                </div>
                <div class="info-row">
                    <strong>Teléfono:</strong>
                    <span><a href="tel:${sol.telefono}">${sol.telefono}</a></span>
                </div>
                <div class="info-row">
                    <strong>Contacto preferido:</strong>
                    <span>${sol.contactoPreferido}</span>
                </div>
                <div class="info-row">
                    <strong>Tipo de cobertura / pago:</strong>
                    <span>${(() => { const v = sol.tipo_cobertura || sol.tipoCobertura; return (v != null && String(v).trim()) ? String(v).trim() : 'No indicado'; })()}</span>
                </div>
                <div class="info-row">
                    <strong>Motivo:</strong>
                    <span>${sol.motivo}</span>
                </div>
                <div class="info-row">
                    <strong>Comentarios (solo admin):</strong>
                    <span>
                        <textarea class="solicitud-comentario-admin" data-solicitud-id="${sol.id}" rows="2" style="width:100%; padding:0.35rem 0.5rem; border-radius:6px; border:1px solid #ddd; font-size:0.9rem;" placeholder="Notas internas sobre esta solicitud (no se envían al cliente).">${comentario}</textarea>
                    </span>
                </div>
                <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    ${!contactado ? `
                        <button onclick="marcarContactado('${sol.id}')" class="btn-edit" style="background: #ffc107;">
                            ✓ Marcar como Contactado
                        </button>
                    ` : !agendado ? `
                        <button onclick="marcarAgendado('${sol.id}')" class="btn-edit" style="background: #28a745;">
                            ✓ Marcar como Agendado
                        </button>
                        <button onclick="desmarcarContactado('${sol.id}')" class="btn-delete" style="background: #6c757d; font-size: 0.85rem;">
                            Desmarcar Contactado
                        </button>
                    ` : `
                        <button onclick="desmarcarAgendado('${sol.id}')" class="btn-delete" style="background: #6c757d; font-size: 0.85rem;">
                            Desmarcar Agendado
                        </button>
                    `}
                    <button type="button" class="btn-delete" onclick="window.eliminarSolicitud('${String(sol.id).replace(/'/g, "\\'")}')" style="margin-left: auto; background: #dc3545; color: white; padding: 0.5rem 1rem; border: none; border-radius: 5px; cursor: pointer;">Eliminar</button>
                </div>
            </div>
        `;
        }).join('');

        // Guardar comentarios de admin en Supabase (o localStorage como fallback)
        const textareaElems = container.querySelectorAll('.solicitud-comentario-admin');
        textareaElems.forEach(textarea => {
            textarea.addEventListener('input', async () => {
                const id = textarea.dataset.solicitudId;
                const nuevoTexto = textarea.value;
                if (supabaseClient) {
                    try {
                        await supabaseClient
                            .from('solicitudes')
                            .update({ comentarios_admin: nuevoTexto })
                            .eq('id', id);
                    } catch (e) {
                        console.error('Error guardando comentarios_admin en Supabase:', e);
                    }
                } else {
                    // Fallback: guardar en localStorage si no hay Supabase
                    try {
                        let solicitudesLocales = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
                        const idx = solicitudesLocales.findIndex(s => String(s.id) === String(id));
                        if (idx !== -1) {
                            solicitudesLocales[idx].comentarios_admin = nuevoTexto;
                            localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudesLocales));
                        }
                    } catch (e) {
                        console.error('Error guardando comentarios_admin en localStorage:', e);
                    }
                }
            });
        });
    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        container.innerHTML = '<div class="no-data">Error al cargar solicitudes. Por favor recarga la página.</div>';
    }
}

// Eliminar solicitud de servicio
async function eliminarSolicitud(solicitudId) {
    if (!confirm('¿Eliminar esta solicitud de servicio? Esta acción no se puede deshacer.')) return;
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .delete()
                .eq('id', solicitudId);
            if (error) throw error;
        } else {
            let solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
            solicitudes = solicitudes.filter(s => String(s.id) !== String(solicitudId));
            localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudes));
        }
        cargarSolicitudesAdmin();
        alert('Solicitud eliminada.');
    } catch (error) {
        console.error('Error eliminando solicitud:', error);
        alert('Error al eliminar. Si usas Supabase, asegúrate de tener política DELETE en la tabla solicitudes.');
    }
}

// Marcar solicitud como contactada
async function marcarContactado(solicitudId) {
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .update({ contactado: true })
                .eq('id', solicitudId);
            
            if (error) throw error;
        } else {
            // Fallback a localStorage
            let solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
            const index = solicitudes.findIndex(s => s.id === solicitudId);
            if (index !== -1) {
                solicitudes[index].contactado = true;
                localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudes));
            }
        }
        cargarSolicitudesAdmin();
    } catch (error) {
        console.error('Error marcando como contactado:', error);
        alert('Error al actualizar. Por favor intenta de nuevo.');
    }
}

// Marcar solicitud como agendada
async function marcarAgendado(solicitudId) {
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .update({ agendado: true, contactado: true })
                .eq('id', solicitudId);
            
            if (error) throw error;
        } else {
            // Fallback a localStorage
            let solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
            const index = solicitudes.findIndex(s => s.id === solicitudId);
            if (index !== -1) {
                solicitudes[index].agendado = true;
                solicitudes[index].contactado = true;
                localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudes));
            }
        }
        cargarSolicitudesAdmin();
    } catch (error) {
        console.error('Error marcando como agendado:', error);
        alert('Error al actualizar. Por favor intenta de nuevo.');
    }
}

// Desmarcar contactado
async function desmarcarContactado(solicitudId) {
    if (!confirm('¿Desmarcar como contactado?')) return;
    
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .update({ contactado: false })
                .eq('id', solicitudId);
            
            if (error) throw error;
        } else {
            // Fallback a localStorage
            let solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
            const index = solicitudes.findIndex(s => s.id === solicitudId);
            if (index !== -1) {
                solicitudes[index].contactado = false;
                localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudes));
            }
        }
        cargarSolicitudesAdmin();
    } catch (error) {
        console.error('Error desmarcando contactado:', error);
        alert('Error al actualizar. Por favor intenta de nuevo.');
    }
}

// Desmarcar agendado
async function desmarcarAgendado(solicitudId) {
    if (!confirm('¿Desmarcar como agendado?')) return;
    
    try {
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .update({ agendado: false })
                .eq('id', solicitudId);
            
            if (error) throw error;
        } else {
            // Fallback a localStorage
            let solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
            const index = solicitudes.findIndex(s => s.id === solicitudId);
            if (index !== -1) {
                solicitudes[index].agendado = false;
                localStorage.setItem('youme_solicitudes', JSON.stringify(solicitudes));
            }
        }
        cargarSolicitudesAdmin();
    } catch (error) {
        console.error('Error desmarcando agendado:', error);
        alert('Error al actualizar. Por favor intenta de nuevo.');
    }
}

// Filtrar solicitudes
function filtrarSolicitudes(filtro) {
    // Actualizar botones activos
    document.querySelectorAll('.filtro-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const btnMap = {
        'todas': 'filtroTodas',
        'pendientes': 'filtroPendientes',
        'contactadas': 'filtroContactadas',
        'agendadas': 'filtroAgendadas'
    };
    
    const btnId = btnMap[filtro];
    if (btnId) {
        const btn = document.getElementById(btnId);
        if (btn) btn.classList.add('active');
    }
    
    // Recargar solicitudes con el filtro
    cargarSolicitudesAdmin(filtro);
}

// ==================== INICIALIZACIÓN ====================

// Cargar eventos al cargar la página
function inicializarTodo() {
    try {
        // Leer URL antes de mostrar nada (en móvil el hash a veces llega con la URL)
        const { pageName: urlPage, reservar: urlReservar } = leerUrlActual();
        const paginasValidas = ['inicio', 'servicios', 'eventos', 'cumpleanos', 'contacto'];
        const paginaInicial = (urlPage && paginasValidas.indexOf(urlPage) >= 0 && document.getElementById(urlPage)) ? urlPage : 'inicio';
        if (urlPage === 'eventos' && urlReservar) {
            window.pendingReservarSlug = urlReservar;
        }

        // Mostrar solo la página que corresponde a la URL (o inicio)
        const allPages = document.querySelectorAll('.page-content');
        allPages.forEach(page => {
            page.classList.remove('active');
            page.style.setProperty('display', 'none', 'important');
        });
        const paginaAMostrar = document.getElementById(paginaInicial);
        if (paginaAMostrar) {
            paginaAMostrar.classList.add('active');
            paginaAMostrar.style.setProperty('display', 'block', 'important');
        }

        // Inicializar navegación PRIMERO (esto es crítico para que los botones funcionen)
        inicializarNavegacion();

        // Actualizar qué enlace del menú está activo según la página mostrada
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.page === paginaInicial) link.classList.add('active');
        });
        
        // Inicializar Supabase y portal de staff
        inicializarSupabase();
        inicializarStaffPortal();

        // Inicializar modales
        inicializarModales();
        inicializarModalServicios();
        
        // Inicializar formularios
        inicializarFormularios();
        
        // Inicializar calculadora de cumpleaños
        inicializarCalculadoraCumpleanos();
        
        // Inicializar carrusel de galería (Celebra)
        inicializarGaleriaCelebra();
        // Inicializar mini carruseles de cada área (Espacio, Decoración, Equipo, Actividades Extras)
        inicializarMiniCarouseles();
        // Inicializar calendario personalizado de cumpleaños
        renderizarCalendarioCumple();
        
        // Cargar eventos (usa Supabase si está configurado, si no eventos.json)
        cargarEventos();

        // Listeners para formularios de disponibilidad en el admin
        const formDispCumple = document.getElementById('formDisponibilidadCumple');
        if (formDispCumple && !formDispCumple.dataset.handler) {
            formDispCumple.dataset.handler = 'true';
            formDispCumple.addEventListener('submit', guardarDisponibilidadCumple);

            // Inicializar selección múltiple de fechas para disponibilidad
            const inputFechaDisp = document.getElementById('dispFechaCumple');

            fechasDisponibilidadSeleccionadas = [];
            renderFechasDisponibilidadSeleccionadas();

            if (inputFechaDisp) {
                inputFechaDisp.addEventListener('change', () => {
                    const valor = inputFechaDisp.value;
                    if (!valor) return;
                    const idx = fechasDisponibilidadSeleccionadas.indexOf(valor);
                    if (idx === -1) {
                        fechasDisponibilidadSeleccionadas.push(valor);
                    } else {
                        fechasDisponibilidadSeleccionadas.splice(idx, 1);
                    }
                    fechasDisponibilidadSeleccionadas.sort();
                    renderFechasDisponibilidadSeleccionadas();
                });
            }
        }
        
        // Aplicar URL por si el hash llegó después (común en móvil)
        aplicarUrlInicial();
        setTimeout(aplicarUrlInicial, 0);
        setTimeout(aplicarUrlInicial, 100);
        window.addEventListener('load', function onLoad() {
            aplicarUrlInicial();
            window.removeEventListener('load', onLoad);
        });

        // Si el usuario cambia el hash (p. ej. al tocar un enlace o volver atrás), navegar
        window.addEventListener('hashchange', function() {
            const { pageName } = leerUrlActual();
            if (pageName && document.getElementById(pageName)) {
                navigateToPage(pageName);
            }
        });
        
        // Configurar fecha mínima para el input de fecha
        const fechaInput = document.getElementById('cumpleFecha');
        if (fechaInput) {
            const hoy = new Date();
            const tresDias = new Date(hoy.getTime() + (3 * 24 * 60 * 60 * 1000));
            fechaInput.min = tresDias.toISOString().split('T')[0];
        }
        
        console.log('✅ Todos los componentes inicializados correctamente');
    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
    }
}

// Exponer funciones en window para que los onclick del admin las encuentren
window.eliminarReservaEvento = eliminarReservaEvento;
window.eliminarReservaEventoLocal = eliminarReservaEventoLocal;
window.eliminarReservaCumple = eliminarReservaCumple;
window.eliminarSolicitud = eliminarSolicitud;
window.aprobarSolicitudFecha = aprobarSolicitudFecha;
window.rechazarSolicitudFecha = rechazarSolicitudFecha;
window.eliminarSolicitudFecha = eliminarSolicitudFecha;

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTodo);
} else {
    // DOM ya está listo
    inicializarTodo();
}

// ==================== PWA: SERVICE WORKER REGISTRATION ====================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
            console.error('Error registrando service worker:', err);
        });
    });
}
