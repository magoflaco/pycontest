const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM || "PyContest <noreply@pycontest.app>";

async function sendOTPEmail({ to, name, code, type }) {
  const subjects = {
    verify_email: "Verifica tu correo — PyContest",
    reset_password: "Restablecer contraseña — PyContest",
    change_email: "Verificación de nuevo email — PyContest",
  };

  const intros = {
    verify_email: "Usa este código para verificar tu correo electrónico.",
    reset_password: "Usa este código para restablecer tu contraseña.",
    change_email: "Usa este código para confirmar tu nuevo correo electrónico.",
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 480px; margin: 40px auto; background: #111118; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 800; color: white; letter-spacing: -1px; }
    .body { padding: 32px; }
    .body p { color: #94a3b8; line-height: 1.7; margin-bottom: 24px; }
    .otp-box { background: #0a0a0f; border: 2px solid #7c3aed; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #a78bfa; }
    .expiry { font-size: 13px; color: #64748b; margin-top: 8px; }
    .footer { padding: 20px 32px; border-top: 1px solid #2a2a3a; font-size: 12px; color: #64748b; text-align: center; }
    .warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #fbbf24; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🐍 PyContest</h1>
    </div>
    <div class="body">
      <p>Hola <strong>${name}</strong>,</p>
      <p>${intros[type] || "Tu código de verificación es:"}</p>
      <div class="otp-box">
        <div class="otp-code">${code}</div>
        <div class="expiry">Expira en ${process.env.OTP_EXPIRES_MIN || 10} minutos</div>
      </div>
      <div class="warning">⚠️ Nunca compartas este código con nadie. PyContest jamás te lo pedirá.</div>
    </div>
    <div class="footer">
      PyContest — Plataforma de concursos de Python con IA<br>
      Si no solicitaste esto, ignora este correo.
    </div>
  </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: subjects[type] || "Código PyContest",
    html,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

async function sendContestInviteEmail({ to, name, contestName, inviteUrl }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0f; color: #e2e8f0; margin:0; padding:0; }
    .container { max-width: 480px; margin: 40px auto; background: #111118; border: 1px solid #2a2a3a; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c3aed, #06b6d4); padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 800; color: white; letter-spacing: -1px; }
    .body { padding: 32px; }
    .body p { color: #94a3b8; line-height: 1.7; }
    .cta { display: block; background: linear-gradient(135deg, #7c3aed, #5b21b6); color: white; text-decoration: none; padding: 16px 32px; border-radius: 10px; text-align: center; font-weight: 700; font-size: 16px; margin: 24px 0; }
    .url { word-break: break-all; font-size: 12px; color: #64748b; font-family: monospace; }
    .footer { padding: 20px 32px; border-top: 1px solid #2a2a3a; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🐍 PyContest</h1></div>
    <div class="body">
      <p>Hola <strong>${name}</strong>,</p>
      <p>Has sido invitado a participar en el concurso de Python:</p>
      <h2 style="color:#a78bfa;margin:16px 0">${contestName}</h2>
      <p>Haz clic en el botón para unirte al concurso:</p>
      <a href="${inviteUrl}" class="cta">Unirme al concurso →</a>
      <p class="url">O copia este enlace: ${inviteUrl}</p>
    </div>
    <div class="footer">PyContest — Plataforma de concursos de Python con IA</div>
  </div>
</body>
</html>`;

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Invitación al concurso: ${contestName}`,
    html,
  });

  if (error) throw new Error(`Email send failed: ${error.message}`);
  return data;
}

module.exports = { sendOTPEmail, sendContestInviteEmail };
