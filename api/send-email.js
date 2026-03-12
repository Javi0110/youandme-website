// Relay de email solo con Gmail (Nodemailer + SMTP). Desplegar en Vercel.
// Variables de entorno en Vercel: GMAIL_USER, GMAIL_APP_PASSWORD, opcional SEND_EMAIL_API_KEY

const NOTIFICATION_EMAILS = ['centroyouandme@gmail.com', 'magaribyelena@gmail.com'];
const REPLY_TO = 'centroyouandme@gmail.com';
const TELEFONO = '(787) 204-9041';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlSolicitud(p) {
  return `
    <p>Hola ${escapeHtml(p.nombre_paciente || '')},</p>
    <p>Gracias por contactarnos. Hemos recibido tu solicitud de ${escapeHtml(p.servicio || '')}.</p>
    <p>Nos pondremos en contacto contigo pronto. Si tienes alguna pregunta, llámanos al ${TELEFONO}.</p>
    <p>Saludos,<br>You&amp;Me Development Center<br>510 Ave Hostos, Vista Verde Shopping Center, Suite 112<br>Mayagüez, Puerto Rico 00682<br>${TELEFONO}<br>centroyouandme@gmail.com</p>
  `.trim();
}

function htmlActividad(p) {
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

function sendOne(transporter, to, subject, html) {
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        from: `"You&Me Development Center" <${process.env.GMAIL_USER}>`,
        to,
        replyTo: REPLY_TO,
        subject,
        html,
      },
      (err, info) => {
        if (err) reject(err);
        else resolve(info);
      }
    );
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const apiKey = process.env.SEND_EMAIL_API_KEY;
  if (apiKey && req.body?.api_key !== apiKey) {
    return res.status(401).json({ error: 'API key inválida' });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return res.status(500).json({
      error: 'Configura GMAIL_USER y GMAIL_APP_PASSWORD en Vercel (Variables de entorno)',
    });
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
    tls: { rejectUnauthorized: true },
  });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const type = body.type;
  const toEmail = body.to_email;

  if (!type || !toEmail) {
    return res.status(400).json({ error: 'Faltan type o to_email' });
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
    subject =
      type === 'cumple'
        ? 'Confirmación - Reserva de cumpleaños - You&Me Development Center'
        : `Confirmación de reserva - ${body.nombre_actividad || 'Actividad'} - You&Me Development Center`;
    html = htmlActividad({
      nombre_nino: body.nombre_nino,
      nombre_actividad: body.nombre_actividad || 'Actividad',
      total: body.total || '$0',
      mensaje_pago:
        body.mensaje_pago ||
        'Realiza el pago a través de ATH Móvil: Pay a business → YouandMeCenter',
    });
  } else {
    return res.status(400).json({ error: 'Tipo de email no válido' });
  }

  try {
    await sendOne(transporter, toEmail, subject, html);
    const notifSubject = `[Notificación] ${subject}`;
    for (const to of NOTIFICATION_EMAILS) {
      try {
        await sendOne(transporter, to, notifSubject, html);
      } catch (e) {
        console.error('Error notificación a', to, e);
      }
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('send-email error:', e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
