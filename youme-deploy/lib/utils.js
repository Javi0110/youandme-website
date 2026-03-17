/**
 * Utilidades puras para You&Me.
 */

export function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function prioridadColor(priority) {
    if (priority === 'high') return '#FF9B4E';
    if (priority === 'medium') return '#00CCC0';
    return '#5a5a5a';
}

export function prioridadTexto(priority) {
    if (priority === 'high') return 'Alta';
    if (priority === 'medium') return 'Media';
    return 'Baja';
}

export function formatearFechaHoraSlot(fechaISO, horaStr) {
    if (!fechaISO || !horaStr) return `${fechaISO || ''} ${horaStr || ''}`.trim();
    try {
        const [h, m] = horaStr.split(':').map((n) => parseInt(n, 10));
        const fecha = new Date(fechaISO + 'T' + horaStr);
        const textoFecha = fecha.toLocaleDateString('es-PR', { weekday: 'short', month: 'short', day: 'numeric' });
        const textoHora = new Date(0, 0, 0, h, m).toLocaleTimeString('es-PR', { hour: 'numeric', minute: '2-digit' });
        return `${textoFecha} - ${textoHora}`;
    } catch { return `${fechaISO} ${horaStr}`; }
}

export function parsearFechasEvento(fechaStr) {
    const match = fechaStr.match(/(\d+)-(\d+)\s+de\s+(\w+),?\s+(\d+)/i);
    if (!match) return [{ fecha: fechaStr, display: fechaStr }];
    const [, diaInicio, diaFin, mes, año] = match;
    const meses = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
    const mesNum = meses[mes.toLowerCase()];
    if (mesNum === undefined) return [{ fecha: fechaStr, display: fechaStr }];
    const fechas = [];
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    for (let dia = parseInt(diaInicio, 10); dia <= parseInt(diaFin, 10); dia++) {
        const fecha = new Date(parseInt(año, 10), mesNum, dia);
        fechas.push({
            fecha: `${año}-${String(mesNum + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
            display: `${diasSemana[fecha.getDay()]} ${dia} de ${mes}`,
            dia,
        });
    }
    return fechas;
}
