// Edge Function: envía emails con Resend
// Requiere: RESEND_API_KEY en secrets. Opcional: EMAIL_FROM (ej: "You&Me Center <hola@tudominio.com>")

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTIFICATION_EMAILS = ['centroyouandme@gmail.com', 'magaribyelena@gmail.com'];
const REPLY_TO = 'centroyouandme@gmail.com';
const TELEFONO = '(787) 204-9041';

function htmlSolicitud(p: { nombre_paciente: string; servicio: string; tutor: string }) {
  return `
    <p>Hola ${escapeHtml(p.nombre_paciente || '')},</p>
    <p>Gracias por contactarnos. Hemos recibido tu solicitud de ${escapeHtml(p.servicio || '')}.</p>
    <p>Nos pondremos en contacto contigo pronto. Si tienes alguna pregunta, llámanos al ${TELEFONO}.</p>
    <p>Saludos,<br>You&amp;Me Development Center<br>510 Ave Hostos, Vista Verde Shopping Center, Suite 112<br>Mayagüez, Puerto Rico 00682<br>${TELEFONO}<br>centroyouandme@gmail.com</p>
  `.trim();
}

function htmlActividad(p: { nombre_nino: string; nombre_actividad: string; total: string; mensaje_pago: string }) {
  return `
    <p>Hola,</p>
    <p>Confirmamos la reserva para ${escapeHtml(p.nombre_nino || '')} en la actividad:</p>
    <p><strong>${escapeHtml(p.nombre_actividad || '')}</strong></p>
    <p>Total a pagar: <strong>${escapeHtml(p.total || '$0')}</strong></p>
    <p>Para completar tu reserva: ${escapeHtml(p.mensaje_pago || '')}</p>
    <p>Teléfono del centro: ${TELEFONO}</p>
    <p>Cualquier duda, contáctanos al ${TELEFONO} o a centroyouandme@gmail.com.</p>
    <p>Saludos,<br>You&amp;Me Development Center<br>510 Ave Hostos, Vista Verde Shopping Center, Suite 112<br>Mayagüez, Puerto Rico 00682</p>
  `.trim();
}

function htmlSolicitudFechaDecision(p: { nombre_contacto: string; fecha_solicitada: string; estado: string; decision_mensaje?: string }) {
  const nombre = escapeHtml(p.nombre_contacto || '');
  const fecha = escapeHtml(p.fecha_solicitada || '');
  const comentario = (p.decision_mensaje || '').trim()
    ? `<p>${escapeHtml(p.decision_mensaje || '')}</p>`
    : '';

  if (p.estado === 'aprobada') {
    return `
      <p>Hola ${nombre},</p>
      <p>Hemos revisado tu solicitud de fecha para celebración con fecha deseada <strong>${fecha}</strong> y ha sido <strong>APROBADA</strong>.</p>
      <p>Nos comunicaremos contigo para coordinar los detalles de la reserva y confirmar horario, decoración y demás.</p>
      ${comentario}
      <p>Si tienes preguntas, puedes escribirnos o llamar al ${TELEFONO}.</p>
      <p>Saludos,<br>You&amp;Me Development Center<br>510 Ave Hostos, Vista Verde Shopping Center, Suite 112<br>Mayagüez, Puerto Rico 00682<br>${TELEFONO}<br>centroyouandme@gmail.com</p>
    `.trim();
  }

  return `
    <p>Hola ${nombre},</p>
    <p>Hemos revisado tu solicitud de fecha para celebración con fecha deseada <strong>${fecha}</strong>, pero lamentablemente en esta ocasión <strong>no podemos ofrecer esa fecha</strong>.</p>
    ${comentario || '<p>Te invitamos a escribirnos o llamarnos para explorar otras fechas y alternativas.</p>'}
    <p>Si deseas, podemos ayudarte a buscar otra fecha disponible que se ajuste a tus necesidades.</p>
    <p>Saludos,<br>You&amp;Me Development Center<br>510 Ave Hostos, Vista Verde Shopping Center, Suite 112<br>Mayagüez, Puerto Rico 00682<br>${TELEFONO}<br>centroyouandme@gmail.com</p>
  `.trim();
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendResend(
  apiKey: string,
  from: string,
  to: string | string[],
  subject: string,
  html: string
) {
  const toArray = Array.isArray(to) ? to : [to];
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: toArray,
      subject,
      html,
      reply_to: REPLY_TO,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend ${res.status}: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromEnv = Deno.env.get('EMAIL_FROM') || 'You&Me Center <onboarding@resend.dev>';

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY no configurado en Supabase secrets' }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  try {
    const body = await req.json();
    const type = body.type; // 'solicitud' | 'actividad' | 'cumple' | 'solicitud_fecha_decision'
    const toEmail = body.to_email;

    if (!type || !toEmail) {
      return new Response(
        JSON.stringify({ error: 'Faltan type o to_email' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let subject = '';
    let html = '';

    if (type === 'solicitud') {
      subject = 'Confirmación - Recibimos tu solicitud - You&Me Development Center';
      html = htmlSolicitud({
        nombre_paciente: body.nombre_paciente,
        servicio: body.servicio,
        tutor: body.tutor,
      });
    } else if (type === 'solicitud_fecha_decision') {
      const estado = body.estado === 'aprobada' ? 'aprobada' : 'rechazada';
      subject = estado === 'aprobada'
        ? 'Actualización de tu solicitud de fecha - Aprobada'
        : 'Actualización de tu solicitud de fecha - No disponible';
      html = htmlSolicitudFechaDecision({
        nombre_contacto: body.nombre_contacto,
        fecha_solicitada: body.fecha_solicitada,
        estado,
        decision_mensaje: body.decision_mensaje,
      });
    } else if (type === 'actividad' || type === 'cumple') {
      subject = type === 'cumple'
        ? 'Confirmación - Reserva de cumpleaños - You&Me Development Center'
        : `Confirmación de reserva - ${body.nombre_actividad || 'Actividad'} - You&Me Development Center`;
      html = htmlActividad({
        nombre_nino: body.nombre_nino,
        nombre_actividad: body.nombre_actividad || 'Actividad',
        total: body.total || '$0',
        mensaje_pago: body.mensaje_pago || 'Realiza el pago a través de ATH Móvil: Pay a business → YouandMeCenter',
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Tipo de email no válido' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1) Email al cliente + copias de notificación en UNA sola llamada (evita 429 rate-limit)
    const allRecipients = [toEmail, ...NOTIFICATION_EMAILS];
    await sendResend(apiKey, fromEnv, allRecipients, subject, html);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('send-email error:', e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
