// Edge Function: envía emails con Brevo (antes Sendinblue) - plan gratis 300/día
// Requiere: BREVO_API_KEY en secrets. Opcional: SENDER_EMAIL y SENDER_NAME (remitente registrado en Brevo)

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

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendBrevo(
  apiKey: string,
  sender: { name: string; email: string },
  to: string,
  subject: string,
  html: string
) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: sender.name, email: sender.email },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      replyTo: { email: REPLY_TO },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo ${res.status}: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const apiKey = Deno.env.get('BREVO_API_KEY');
  const senderEmail = Deno.env.get('SENDER_EMAIL') || 'centroyouandme@gmail.com';
  const senderName = Deno.env.get('SENDER_NAME') || 'You&Me Development Center';
  const sender = { name: senderName, email: senderEmail };

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'BREVO_API_KEY no configurado en Supabase secrets' }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  try {
    const body = await req.json();
    const type = body.type; // 'solicitud' | 'actividad' | 'cumple'
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

    // 1) Email al cliente
    await sendBrevo(apiKey, sender, toEmail, subject, html);

    // 2) Copias a notificaciones
    const notifSubject = `[Notificación] ${subject}`;
    for (const to of NOTIFICATION_EMAILS) {
      try {
        await sendBrevo(apiKey, sender, to, notifSubject, html);
      } catch (e) {
        console.error('Error enviando notificación a', to, e);
      }
    }

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
