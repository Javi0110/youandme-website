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
        }
    } catch (error) {
        console.log('⚠️ Supabase no disponible (continuando sin él):', error);
        // No bloquear la ejecución si Supabase falla
    }
}

// Intentar inicializar Supabase cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarSupabase);
} else {
    // DOM ya está listo, intentar inicializar después de un pequeño delay
    setTimeout(inicializarSupabase, 100);
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

// Cargar eventos desde Supabase o JSON (fallback)
async function cargarEventos() {
    try {
        // Intentar cargar desde Supabase si está configurado
        if (supabaseClient) {
            const { data, error } = await supabaseClient
                .from('eventos')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (!error && data && data.length > 0) {
                // Convertir formato de Supabase al formato esperado
                const eventos = data.map(e => ({
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
        }
        
        // Fallback: cargar desde JSON si Supabase no está configurado o no hay datos
        const response = await fetch('eventos.json');
        const data = await response.json();
        mostrarEventos(data.eventos);
    } catch (error) {
        console.error('Error cargando eventos:', error);
        document.getElementById('noEventos').style.display = 'block';
    }
}

// Mostrar eventos en la página
function mostrarEventos(eventos) {
    const container = document.getElementById('eventosContainer');
    const noEventos = document.getElementById('noEventos');
    
    if (!eventos || eventos.length === 0) {
        noEventos.style.display = 'block';
        return;
    }
    
    container.innerHTML = '';
    
    eventos.forEach(evento => {
        const card = crearEventoCard(evento);
        container.appendChild(card);
    });
}

// Crear tarjeta de evento
function crearEventoCard(evento) {
    const card = document.createElement('div');
    card.className = 'evento-card';
    
    const cuposClase = evento.cupos <= 5 ? 'pocos' : evento.cupos === 0 ? 'agotado' : '';
    const cuposTexto = evento.cupos === 0 ? 'Agotado' : `${evento.cupos} cupos disponibles`;
    
    card.innerHTML = `
        ${evento.imagen ? `<img src="${evento.imagen}" alt="${evento.nombre}" class="evento-image">` : ''}
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
    `;
    
    return card;
}

// Abrir modal de evento
async function abrirModalEvento(eventoId) {
    try {
        // Cargar desde localStorage
        const eventosGuardados = localStorage.getItem('youme_eventos');
        let eventos = [];
        
        if (eventosGuardados) {
            eventos = JSON.parse(eventosGuardados);
        } else {
            // Fallback: cargar desde JSON
            const response = await fetch('eventos.json');
            const data = await response.json();
            eventos = data.eventos;
        }
        
        const evento = eventos.find(e => e.id === eventoId);
        
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
                    <button type="button" class="btn btn-primary btn-large" onclick="procesarRsvpEvento('${evento.id}', ${evento.precio}, ${esMultiDia})">
                        Confirmar y Pagar
                    </button>
                </form>
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
    // Detectar formato: "15-20 de julio, 2025" o "18-22 de diciembre, 2025"
    const match = fechaStr.match(/(\d+)-(\d+)\s+de\s+(\w+),?\s+(\d+)/i);
    
    if (!match) {
        // Si no es un rango, devolver fecha única
        return [{ fecha: fechaStr, display: fechaStr }];
    }
    
    const [_, diaInicio, diaFin, mes, año] = match;
    const meses = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
        'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };
    
    const mesNum = meses[mes.toLowerCase()];
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

// Procesar RSVP de evento
async function procesarRsvpEvento(eventoId, precioBase, esMultiDia) {
    const nombreNino = document.getElementById('eventoNombreNino').value;
    const edadNino = document.getElementById('eventoEdadNino').value;
    const nombrePadre = document.getElementById('eventoNombrePadre').value;
    const email = document.getElementById('eventoEmail').value;
    const telefono = document.getElementById('eventoTelefono').value;
    
    if (!nombreNino || !edadNino || !nombrePadre || !email || !telefono) {
        alert('Por favor completa todos los campos.');
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
            return;
        }
        
        fechasSeleccionadas = Array.from(checkboxes).map(cb => cb.dataset.display);
    }
    
    const detallesDias = esMultiDia ? `\n${dias} día${dias > 1 ? 's' : ''}` : '';
    const detallesFechas = fechasSeleccionadas.length > 0 
        ? `\nFechas: ${fechasSeleccionadas.join(', ')}` 
        : '';
    
    // Aquí integrarías con tu backend para procesar el pago
    // Por ahora, simulamos el proceso
    alert(`Procesando reserva para ${nombreNino}...${detallesDias}${detallesFechas}\n\nTotal: $${precioTotal}\n\nEn un ambiente de producción, esto te redigiría a Stripe para completar el pago.\n\nContacta al centro para completar tu reserva: (787) 204-9041`);
    
    cerrarModal();
    
    // En producción, aquí llamarías a Stripe
    /*
    const response = await fetch('/api/crear-checkout-evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            eventoId,
            nombreNino,
            edadNino,
            nombrePadre,
            email,
            telefono,
            precio
        })
    });
    const session = await response.json();
    await stripe.redirectToCheckout({ sessionId: session.id });
    */
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
    
    // Espacio base
    const horas = parseInt(cumpleForm.horas?.value) || 3;
    if (horas <= 3) {
        total += 350; // Precio base 3 horas
    } else {
        total += 350 + ((horas - 3) * 100); // 3 horas base + adicionales a $100/hora
    }
    
    // Decoración
    const decoracion = parseInt(cumpleForm.decoracion?.value) || 0;
    total += decoracion;
    
    // Equipo para toddlers
    if (cumpleForm.equipo?.checked) {
        total += 150;
    }
    
    // Actividad extra
    const actividad = cumpleForm.actividad?.value;
    if (actividad && actividad !== 'none') {
        const numNinos = parseInt(cumpleForm.numNinos?.value) || 1;
        total += numNinos * 15; // $15 por cada niño
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
        cumpleForm.decoracion.addEventListener('change', calcularTotalCumpleanos);
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
        
        // Calcular total inicial
        calcularTotalCumpleanos();
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCalculadoraCumpleanos);
} else {
    inicializarCalculadoraCumpleanos();
}

// Inicializar formularios cuando el DOM esté listo
function inicializarFormularios() {
    // Procesar reserva de cumpleaños
    const reservarBtn = document.getElementById('reservarBtn');
    if (reservarBtn) {
        reservarBtn.addEventListener('click', async function() {
    const nombre = document.getElementById('cumpleNombre').value;
    const fecha = document.getElementById('cumpleFecha').value;
    const contacto = document.getElementById('cumpleContacto').value;
    const telefono = document.getElementById('cumpleTelefono').value;
    const email = document.getElementById('cumpleEmail').value;
    
    if (!nombre || !fecha || !contacto || !telefono || !email) {
        alert('Por favor completa todos los campos requeridos.');
        return;
    }
    
    // Validar fecha mínima (debe ser al menos 3 días en el futuro)
    const fechaSeleccionada = new Date(fecha);
    const hoy = new Date();
    const tresDias = new Date(hoy.getTime() + (3 * 24 * 60 * 60 * 1000));
    
    if (fechaSeleccionada < tresDias) {
        alert('La fecha debe ser al menos 3 días en el futuro para poder procesar tu reserva.');
        return;
    }
    
    const total = calcularTotalCumpleanos();
    
    const detalles = {
        nombreNino: nombre,
        fecha,
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
    
    // En producción, aquí llamarías a tu backend para crear una sesión de Stripe
    alert(`Procesando reserva para el cumpleaños de ${nombre}...\n\nTotal: $${total}\n\nEn un ambiente de producción, esto te redigiría a Stripe para completar el pago.\n\nContacta al centro para completar tu reserva: (787) 204-9041`);
    
    console.log('Detalles de reserva:', detalles);
    
    /*
    // Código para producción con Stripe:
    const response = await fetch('/api/crear-checkout-cumpleanos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detalles)
    });
    const session = await response.json();
    await stripe.redirectToCheckout({ sessionId: session.id });
    */
        });
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
    
    servicioInput.value = nombreServicio;
    titulo.textContent = `Solicitar ${nombreServicio}`;
    emailSubject.value = `Nueva Solicitud: ${nombreServicio}`;
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

    // Procesar formulario de servicio con Web3Forms
    const servicioForm = document.getElementById('servicioForm');
    if (servicioForm) {
        servicioForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Mostrar indicador de carga
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const textoOriginal = submitBtn.textContent;
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;
    
    try {
        const formData = new FormData(e.target);
        
        // Guardar una copia en Supabase o localStorage
        const solicitudData = {
            servicio: formData.get('servicio'),
            paciente: formData.get('nombre_paciente'),
            edad: parseInt(formData.get('edad_paciente')),
            tutor: formData.get('nombre_tutor'),
            email: formData.get('email'),
            telefono: formData.get('telefono'),
            motivo: formData.get('motivo_consulta'),
            contacto_preferido: formData.get('contacto_preferido'),
            contactado: false,
            agendado: false
        };
        
        // Guardar en Supabase si está configurado
        if (supabaseClient) {
            const { error } = await supabaseClient
                .from('solicitudes')
                .insert([solicitudData]);
            
            if (error) console.error('Error guardando en Supabase:', error);
        } else {
            // Fallback a localStorage
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
            alert('¡Solicitud enviada exitosamente!\n\nNos pondremos en contacto contigo pronto.\n\nPara consultas inmediatas, llámanos al (787) 204-9041');
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

// Credenciales de administrador (fallback si Supabase no está configurado)
const ADMIN_CREDENTIALS = {
    email: 'centroyouandme@gmail.com',
    password: 'You@2023!'
};

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

// Login de administrador
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
                    // Login con Supabase
                    const { data, error } = await supabaseClient.auth.signInWithPassword({
                        email: email,
                        password: password
                    });
                    
                    if (error) throw error;
                    
                    // Verificar que el email sea el correcto
                    if (data.user.email !== ADMIN_CREDENTIALS.email) {
                        await supabaseClient.auth.signOut();
                        throw new Error('Acceso no autorizado');
                    }
                } else {
                    // Fallback a credenciales locales
                    if (email !== ADMIN_CREDENTIALS.email || password !== ADMIN_CREDENTIALS.password) {
                        errorDiv.style.display = 'block';
                        return;
                    }
                    localStorage.setItem('youme_admin_sesion', 'activa');
                }
                
                document.getElementById('adminLogin').style.display = 'none';
                document.getElementById('adminDashboard').style.display = 'block';
                cargarEventosAdmin();
                cargarSolicitudesAdmin();
            } catch (error) {
                console.error('Error en login:', error);
                errorDiv.style.display = 'block';
            }
        });
    }
});

// Cerrar sesión
async function cerrarSesionAdmin() {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    } else {
        localStorage.removeItem('youme_admin_sesion');
    }
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLoginForm').reset();
    document.getElementById('loginError').style.display = 'none';
}

// Verificar sesión al cambiar a página admin
const originalNavigateToPage = navigateToPage;
window.navigateToPage = async function(pageName) {
    originalNavigateToPage(pageName);
    
    if (pageName === 'admin') {
        const tieneSesion = await verificarSesionAdmin();
        if (tieneSesion) {
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            cargarEventosAdmin();
            cargarSolicitudesAdmin();
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
    
    // Mostrar tab seleccionado
    document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
    event.target.classList.add('active');
    
    // Recargar datos si es necesario
    if (tabName === 'actividades') {
        cargarEventosAdmin();
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

// ========== GESTIÓN DE SOLICITUDES ==========

// Variable global para el filtro actual
let filtroActualSolicitudes = 'todas';

// Cargar solicitudes de servicio
async function cargarSolicitudesAdmin(filtro = null) {
    if (filtro) filtroActualSolicitudes = filtro;
    
    const container = document.getElementById('listaSolicitudesAdmin');
    if (!container) return;
    
    try {
        let solicitudes = [];
        
        if (supabaseClient) {
            // Cargar desde Supabase
            const { data, error } = await supabaseClient
                .from('solicitudes')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // Convertir formato de Supabase
            solicitudes = (data || []).map(s => ({
                id: s.id,
                fecha: new Date(s.created_at).toLocaleString('es-PR'),
                servicio: s.servicio,
                paciente: s.paciente,
                edad: s.edad,
                tutor: s.tutor,
                email: s.email,
                telefono: s.telefono,
                motivo: s.motivo,
                contactoPreferido: s.contacto_preferido,
                contactado: s.contactado || false,
                agendado: s.agendado || false
            }));
        } else {
            // Fallback a localStorage
            solicitudes = JSON.parse(localStorage.getItem('youme_solicitudes') || '[]');
        }
        
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
            container.innerHTML = `<div class="no-data">${mensajes[filtroActualSolicitudes]}</div>`;
            return;
        }
        
        container.innerHTML = solicitudes.map(sol => {
            const contactado = sol.contactado || false;
            const agendado = sol.agendado || false;
            
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
                    <strong>Motivo:</strong>
                    <span>${sol.motivo}</span>
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
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        console.error('Error cargando solicitudes:', error);
        container.innerHTML = '<div class="no-data">Error al cargar solicitudes. Por favor recarga la página.</div>';
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
        // Asegurar que solo la página de inicio esté activa al inicio
        const allPages = document.querySelectorAll('.page-content');
        allPages.forEach(page => {
            page.classList.remove('active');
            page.style.setProperty('display', 'none', 'important');
        });
        const inicioPage = document.getElementById('inicio');
        if (inicioPage) {
            inicioPage.classList.add('active');
            inicioPage.style.setProperty('display', 'block', 'important');
        }
        
        // Inicializar navegación PRIMERO (esto es crítico para que los botones funcionen)
        inicializarNavegacion();
        
        // Inicializar modales
        inicializarModales();
        inicializarModalServicios();
        
        // Inicializar formularios
        inicializarFormularios();
        
        // Inicializar calculadora de cumpleaños
        inicializarCalculadoraCumpleanos();
        
        // Cargar eventos
        cargarEventos();
        
        // Configurar fecha mínima para el input de fecha
        const fechaInput = document.getElementById('cumpleFecha');
        if (fechaInput) {
            const hoy = new Date();
            const tresDias = new Date(hoy.getTime() + (3 * 24 * 60 * 60 * 1000));
            fechaInput.min = tresDias.toISOString().split('T')[0];
        }
        
        // Asegurar que Supabase esté inicializado
        inicializarSupabase();
        
        console.log('✅ Todos los componentes inicializados correctamente');
    } catch (error) {
        console.error('❌ Error durante la inicialización:', error);
    }
}

// Ejecutar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarTodo);
} else {
    // DOM ya está listo
    inicializarTodo();
}


