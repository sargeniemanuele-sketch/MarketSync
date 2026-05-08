import { sgMail, isSendGridConfigured } from '../../config/sendgrid.js';
import { AppError, BadRequestError } from '../../utils/errors.js';
import { HTTP_STATUS } from '../../config/app.constants.js';
import { env } from '../../config/env.js';

// ── Error builders ────────────────────────────────────────────────────────────

function buildSendGridNotConfiguredError() {
  return new AppError(
    'Invio email non configurato. Contatta il supporto.',
    HTTP_STATUS.INTERNAL_ERROR,
    'SENDGRID_NOT_CONFIGURED',
    { scope: 'email' }
  );
}

function buildEmailSendFailedError() {
  return new AppError(
    'Non è stato possibile inviare l’email. Riprova tra qualche minuto.',
    HTTP_STATUS.INTERNAL_ERROR,
    'EMAIL_SEND_FAILED',
    { scope: 'email' }
  );
}

function assertMessageInput({ to, subject, text, html }) {
  if (!to || (Array.isArray(to) && to.length === 0)) {
    throw new BadRequestError('Inserisci almeno un destinatario.', { scope: 'email' });
  }

  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    throw new BadRequestError('Inserisci l’oggetto dell’email.', { scope: 'email' });
  }

  if (!text && !html) {
    throw new BadRequestError('Inserisci il contenuto dell’email.', { scope: 'email' });
  }
}

function buildFromAddress(fromOverride) {
  if (fromOverride && typeof fromOverride === 'object' && fromOverride.email) {
    return {
      email: fromOverride.email,
      ...(fromOverride.name ? { name: fromOverride.name } : {}),
    };
  }

  if (env.sendgrid.fromName) {
    return { email: env.sendgrid.fromEmail, name: env.sendgrid.fromName };
  }

  return env.sendgrid.fromEmail;
}

function extractMessageId(response) {
  const headers = response?.headers;
  if (!headers) return null;

  if (typeof headers.get === 'function') {
    return headers.get('x-message-id') ?? null;
  }

  return headers['x-message-id'] ?? headers['X-Message-Id'] ?? null;
}

// ── Template helpers ──────────────────────────────────────────────────────────

const _FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

function _escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _buildGreeting(name) {
  const safe = name && typeof name === 'string' ? name.trim() : '';
  return safe ? `Ciao ${_escapeHtml(safe)},` : 'Ciao,';
}

function _buildLogoHtml() {
  const logoUrl = env.sendgrid.logoUrl;
  if (logoUrl) {
    return `<img src="${_escapeHtml(logoUrl)}" alt="MarketSync" width="140" style="display:block; border:0; outline:none; text-decoration:none; max-width:140px; height:auto;" />`;
  }
  return `<span style="font-family:${_FONT}; font-size:15px; font-weight:600; color:#0F172A; letter-spacing:-0.01em;">MarketSync</span>`;
}

function _buildHeader(sectionLabel) {
  return `
          <tr>
            <td style="padding: 24px 32px; border-bottom:1px solid #E5E7EB;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">${_buildLogoHtml()}</td>
                  <td align="right" style="font-family:${_FONT}; font-size:12px; color:#64748B; letter-spacing:0.04em; text-transform:uppercase;">${_escapeHtml(sectionLabel)}</td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function _buildFooter() {
  const year = new Date().getFullYear();
  const supportEmail = env.sendgrid.supportEmail;
  const hasSupportEmail = supportEmail && typeof supportEmail === 'string' && supportEmail.includes('@');
  const safeSupportEmail = hasSupportEmail ? _escapeHtml(supportEmail) : '';
  const assistanceHtml = hasSupportEmail
    ? `Per assistenza puoi rispondere direttamente a questa email o scriverci a <a href="mailto:${safeSupportEmail}" style="color:#0F172A; text-decoration:underline;">${safeSupportEmail}</a>.`
    : 'Per assistenza puoi rispondere direttamente a questa email.';

  return `
          <tr>
            <td style="padding: 20px 32px 24px 32px; border-top:1px solid #E5E7EB; background-color:#F8FAFC; border-radius: 0 0 12px 12px;">
              <p style="margin:0 0 4px 0; font-family:${_FONT}; font-size:12px; line-height:18px; color:#64748B;">${assistanceHtml}</p>
              <p style="margin:0; font-family:${_FONT}; font-size:12px; line-height:18px; color:#94A3B8;">© ${year} MarketSync</p>
            </td>
          </tr>`;
}

function _buildLayout({ title, preheader, sectionLabel, bodyHtml }) {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>${_escapeHtml(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: #F1F5F9; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; max-width: 100% !important; }
      .px-card { padding-left: 24px !important; padding-right: 24px !important; }
      .py-card { padding-top: 28px !important; padding-bottom: 28px !important; }
      .h1 { font-size: 22px !important; line-height: 30px !important; }
      .btn a { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .url-box { word-break: break-all !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9;">

  <div style="display:none; font-size:1px; color:#F1F5F9; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${_escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F5F9;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:#FFFFFF; border:1px solid #E5E7EB; border-radius:12px;">
          ${_buildHeader(sectionLabel)}
          <tr>
            <td class="px-card py-card" style="padding: 40px 32px 32px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          ${_buildFooter()}
        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

function _supportLine(supportEmail, prefix) {
  if (!supportEmail || typeof supportEmail !== 'string' || !supportEmail.includes('@')) return '';
  const safe = _escapeHtml(supportEmail);
  const pre = _escapeHtml(prefix || 'Per dubbi puoi scriverci a');
  return `<p style="margin: 24px 0 0 0; font-family:${_FONT}; font-size:13px; line-height:20px; color:#64748B;">${pre} <a href="mailto:${safe}" style="color:#0F172A; text-decoration:underline;">${safe}</a>.</p>`;
}

function _footerSupportTxt(supportEmail, prefix) {
  if (!supportEmail || typeof supportEmail !== 'string' || !supportEmail.includes('@')) return '';
  return `${prefix || 'Per dubbi scrivi a'} ${supportEmail}.`;
}

function _footerAssistanceTxt(supportEmail) {
  if (!supportEmail || typeof supportEmail !== 'string' || !supportEmail.includes('@')) {
    return 'Per assistenza puoi rispondere direttamente a questa email.';
  }

  return `Per assistenza puoi rispondere direttamente a questa email o scriverci a ${supportEmail}.`;
}

// ── Welcome email ─────────────────────────────────────────────────────────────

function _buildWelcomeHtml(name, appUrl) {
  const supportEmail = env.sendgrid.supportEmail;
  const greeting = _buildGreeting(name);

  const ctaBlock = appUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin: 0 0 0 0;">
        <tr>
          <td align="center" style="border-radius:8px; background-color:#0F172A;">
            <a href="${_escapeHtml(appUrl)}" target="_blank" style="display:inline-block; padding: 13px 22px; font-family:${_FONT}; font-size:14px; font-weight:600; line-height:20px; color:#FFFFFF; background-color:#0F172A; border-radius:8px; mso-padding-alt:0;">Accedi a MarketSync</a>
          </td>
        </tr>
      </table>`
    : '';

  const bodyHtml = `
    <h1 class="h1" style="margin:0 0 16px 0; font-family:${_FONT}; font-size:26px; line-height:34px; font-weight:600; color:#0F172A; letter-spacing:-0.02em;">${greeting} il tuo account è pronto.</h1>
    <p style="margin:0 0 16px 0; font-family:${_FONT}; font-size:15px; line-height:24px; color:#1F2937;">Abbiamo creato il tuo account MarketSync. Da ora puoi iniziare a creare i tuoi clienti e collegare le integrazioni con Shopify, Meta Ads e Google Ads per vedere i dati in un’unica dashboard.</p>
    <p style="margin:0 0 28px 0; font-family:${_FONT}; font-size:15px; line-height:24px; color:#1F2937;">Quando vuoi, accedi alla dashboard per configurare il primo cliente.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC; border:1px solid #E5E7EB; border-radius:8px; margin: 0 0 28px 0;">
      <tr>
        <td style="padding: 18px 20px; font-family:${_FONT};">
          <p style="margin:0 0 12px 0; font-size:12px; font-weight:600; color:#64748B; letter-spacing:0.06em; text-transform:uppercase;">Per iniziare</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="22" valign="top" style="font-family:${_FONT}; font-size:13px; font-weight:600; color:#10B981; padding: 4px 0;">1</td>
              <td valign="top" style="font-family:${_FONT}; font-size:14px; line-height:22px; color:#1F2937; padding: 4px 0;">Crea il tuo primo cliente</td>
            </tr>
            <tr>
              <td width="22" valign="top" style="font-family:${_FONT}; font-size:13px; font-weight:600; color:#10B981; padding: 4px 0;">2</td>
              <td valign="top" style="font-family:${_FONT}; font-size:14px; line-height:22px; color:#1F2937; padding: 4px 0;">Collega Shopify, Meta Ads o Google Ads</td>
            </tr>
            <tr>
              <td width="22" valign="top" style="font-family:${_FONT}; font-size:13px; font-weight:600; color:#10B981; padding: 4px 0;">3</td>
              <td valign="top" style="font-family:${_FONT}; font-size:14px; line-height:22px; color:#1F2937; padding: 4px 0;">Visualizza i KPI nella dashboard</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    ${ctaBlock}
    ${_supportLine(supportEmail, 'Se hai dubbi puoi scriverci a')}`;

  return _buildLayout({
    title: 'Benvenuto in MarketSync',
    preheader: 'Il tuo account MarketSync è pronto.',
    sectionLabel: 'Benvenuto',
    bodyHtml,
  });
}

function _buildWelcomeTxt(name, appUrl) {
  const supportEmail = env.sendgrid.supportEmail;
  const greeting = (name && typeof name === 'string' && name.trim()) ? `Ciao ${name.trim()},` : 'Ciao,';
  const year = new Date().getFullYear();

  const lines = [
    'MarketSync — Benvenuto',
    '',
    greeting,
    '',
    'abbiamo creato il tuo account MarketSync.',
    "Da ora puoi iniziare a creare i tuoi clienti e collegare le integrazioni con Shopify, Meta Ads e Google Ads per vedere i dati in un’unica dashboard.",
    '',
    'Quando vuoi, accedi alla dashboard per configurare il primo cliente.',
    '',
    'Per iniziare:',
    '1. Crea il tuo primo cliente',
    '2. Collega Shopify, Meta Ads o Google Ads',
    '3. Visualizza i KPI nella dashboard',
    '',
  ];

  if (appUrl) lines.push(`Accedi a MarketSync: ${appUrl}`, '');

  const supportLine = _footerSupportTxt(supportEmail, 'Per dubbi scrivi a');
  if (supportLine) lines.push(supportLine, '');

  lines.push('—', _footerAssistanceTxt(supportEmail), `© ${year} MarketSync`);

  return lines.join('\n');
}

// ── Password reset email ──────────────────────────────────────────────────────

function _buildPasswordResetHtml(name, resetUrl) {
  const supportEmail = env.sendgrid.supportEmail;
  const greeting = _buildGreeting(name);
  const safeResetUrl = _escapeHtml(resetUrl);

  const bodyHtml = `
    <h1 class="h1" style="margin:0 0 16px 0; font-family:${_FONT}; font-size:26px; line-height:34px; font-weight:600; color:#0F172A; letter-spacing:-0.02em;">Reimposta la tua password</h1>
    <p style="margin:0 0 16px 0; font-family:${_FONT}; font-size:15px; line-height:24px; color:#1F2937;">${greeting} abbiamo ricevuto una richiesta di reset della password per il tuo account MarketSync.</p>
    <p style="margin:0 0 28px 0; font-family:${_FONT}; font-size:15px; line-height:24px; color:#1F2937;">Per scegliere una nuova password clicca sul pulsante qui sotto.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn" style="margin: 0 0 24px 0;">
      <tr>
        <td align="center" style="border-radius:8px; background-color:#0F172A;">
          <a href="${safeResetUrl}" target="_blank" style="display:inline-block; padding: 13px 22px; font-family:${_FONT}; font-size:14px; font-weight:600; line-height:20px; color:#FFFFFF; background-color:#0F172A; border-radius:8px; mso-padding-alt:0;">Reimposta password</a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 8px 0; font-family:${_FONT}; font-size:13px; line-height:20px; color:#64748B;">Oppure copia e incolla questo link nel browser:</p>
    <p class="url-box" style="margin:0 0 28px 0; padding: 12px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Courier New', monospace; font-size:12px; line-height:18px; color:#0F172A; background-color:#F8FAFC; border:1px solid #E5E7EB; border-radius:6px; word-break:break-all;"><a href="${safeResetUrl}" style="color:#0F172A; text-decoration:none;">${safeResetUrl}</a></p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC; border:1px solid #E5E7EB; border-radius:8px;">
      <tr>
        <td style="padding: 16px 18px; font-family:${_FONT};">
          <p style="margin:0 0 6px 0; font-size:13px; line-height:20px; color:#1F2937;"><span style="font-weight:600; color:#0F172A;">Il link è valido per 60 minuti.</span></p>
          <p style="margin:0; font-size:13px; line-height:20px; color:#64748B;">Se non hai richiesto tu il reset, puoi ignorare questa email: la tua password resterà invariata.</p>
        </td>
      </tr>
    </table>
    ${_supportLine(supportEmail, 'Per dubbi sulla sicurezza scrivi a')}`;

  return _buildLayout({
    title: 'Reimposta la tua password — MarketSync',
    preheader: 'Usa questo link per reimpostare la password di MarketSync.',
    sectionLabel: 'Sicurezza',
    bodyHtml,
  });
}

function _buildPasswordResetTxt(name, resetUrl) {
  const supportEmail = env.sendgrid.supportEmail;
  const greeting = (name && typeof name === 'string' && name.trim()) ? `Ciao ${name.trim()},` : 'Ciao,';
  const year = new Date().getFullYear();

  const lines = [
    'MarketSync — Reimposta la tua password',
    '',
    greeting,
    '',
    'abbiamo ricevuto una richiesta di reset della password per il tuo account MarketSync.',
    '',
    'Per scegliere una nuova password apri questo link:',
    resetUrl,
    '',
    'Il link è valido per 60 minuti.',
    'Se non hai richiesto tu il reset puoi ignorare questa email: la tua password resterà invariata.',
    '',
  ];

  const supportLine = _footerSupportTxt(supportEmail, 'Per dubbi sulla sicurezza scrivi a');
  if (supportLine) lines.push(supportLine, '');

  lines.push('—', _footerAssistanceTxt(supportEmail), `© ${year} MarketSync`);

  return lines.join('\n');
}

// ── Password changed email ────────────────────────────────────────────────────

function _buildPasswordChangedHtml(name, appUrl) {
  const supportEmail = env.sendgrid.supportEmail;
  const greeting = _buildGreeting(name);
  const hasSupportEmail = supportEmail && typeof supportEmail === 'string' && supportEmail.includes('@');

  const securityNote = hasSupportEmail
    ? `Se non riconosci questa modifica, ti consigliamo di accedere al tuo account per controllare le impostazioni di sicurezza, oppure scrivici a <a href="mailto:${_escapeHtml(supportEmail)}" style="color:#0F172A; text-decoration:underline;">${_escapeHtml(supportEmail)}</a>.`
    : `Se non riconosci questa modifica, ti consigliamo di accedere al tuo account per controllare le impostazioni di sicurezza.`;

  const ctaBlock = appUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn">
        <tr>
          <td align="center" style="border-radius:8px; background-color:#FFFFFF; border:1px solid #0F172A;">
            <a href="${_escapeHtml(appUrl)}" target="_blank" style="display:inline-block; padding: 12px 22px; font-family:${_FONT}; font-size:14px; font-weight:600; line-height:20px; color:#0F172A; background-color:#FFFFFF; border-radius:8px;">Apri MarketSync</a>
          </td>
        </tr>
      </table>`
    : '';

  const bodyHtml = `
    <h1 class="h1" style="margin:0 0 16px 0; font-family:${_FONT}; font-size:26px; line-height:34px; font-weight:600; color:#0F172A; letter-spacing:-0.02em;">Password aggiornata</h1>
    <p style="margin:0 0 16px 0; font-family:${_FONT}; font-size:15px; line-height:24px; color:#1F2937;">${greeting} ti confermiamo che la password del tuo account MarketSync è stata aggiornata correttamente.</p>
    <p style="margin:0 0 24px 0; font-family:${_FONT}; font-size:15px; line-height:24px; color:#1F2937;">Se sei stato tu non devi fare nulla: puoi continuare a usare l’app come prima.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC; border:1px solid #E5E7EB; border-radius:8px; margin: 0 0 28px 0;">
      <tr>
        <td style="padding: 16px 18px; font-family:${_FONT};">
          <p style="margin:0 0 4px 0; font-size:12px; font-weight:600; color:#64748B; letter-spacing:0.06em; text-transform:uppercase;">Modifica</p>
          <p style="margin:0; font-size:14px; line-height:22px; color:#1F2937;">Password account aggiornata</p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 28px 0; font-family:${_FONT}; font-size:14px; line-height:22px; color:#1F2937;">${securityNote}</p>
    ${ctaBlock}`;

  return _buildLayout({
    title: 'Password aggiornata — MarketSync',
    preheader: 'La password del tuo account MarketSync è stata aggiornata.',
    sectionLabel: 'Account',
    bodyHtml,
  });
}

function _buildPasswordChangedTxt(name, appUrl) {
  const supportEmail = env.sendgrid.supportEmail;
  const greeting = (name && typeof name === 'string' && name.trim()) ? `Ciao ${name.trim()},` : 'Ciao,';
  const year = new Date().getFullYear();
  const hasSupportEmail = supportEmail && typeof supportEmail === 'string' && supportEmail.includes('@');

  const lines = [
    'MarketSync — Password aggiornata',
    '',
    greeting,
    '',
    'ti confermiamo che la password del tuo account MarketSync è stata aggiornata correttamente.',
    '',
    'Se sei stato tu non devi fare nulla: puoi continuare a usare l’app come prima.',
    '',
    'Modifica: password account aggiornata.',
    '',
    hasSupportEmail
      ? `Se non riconosci questa modifica, accedi al tuo account per controllare le impostazioni di sicurezza, oppure scrivici a ${supportEmail}.`
      : 'Se non riconosci questa modifica, accedi al tuo account per controllare le impostazioni di sicurezza.',
    '',
  ];

  if (appUrl) lines.push(`Apri MarketSync: ${appUrl}`, '');

  lines.push('—', _footerAssistanceTxt(supportEmail), `© ${year} MarketSync`);

  return lines.join('\n');
}

// ── Email transazionali ───────────────────────────────────────────────────────

/**
 * Invia la welcome email dopo la registrazione email/password.
 * NON usare per login Google.
 */
export async function sendWelcomeEmail({ to, name }) {
  const appUrl = env.frontend.url;
  return sendTransactionalEmail({
    to,
    subject: 'Benvenuto in MarketSync',
    text: _buildWelcomeTxt(name, appUrl),
    html: _buildWelcomeHtml(name, appUrl),
  });
}

/**
 * Invia il link di reset password. Valido 60 minuti.
 * Solo per utenti con passwordHash (local/mixed).
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!resetUrl || typeof resetUrl !== 'string' || resetUrl.trim() === '') {
    throw new AppError(
      'Reset URL mancante o non valido.',
      HTTP_STATUS.INTERNAL_ERROR,
      'EMAIL_RESET_URL_MISSING',
      { scope: 'email' }
    );
  }
  return sendTransactionalEmail({
    to,
    subject: 'Reimposta la password di MarketSync',
    text: _buildPasswordResetTxt(name, resetUrl),
    html: _buildPasswordResetHtml(name, resetUrl),
  });
}

/**
 * Notifica cambio password dopo reset riuscito.
 * Solo per utenti con passwordHash (local/mixed).
 */
export async function sendPasswordChangedEmail({ to, name }) {
  const appUrl = env.frontend.url;
  return sendTransactionalEmail({
    to,
    subject: 'La password del tuo account MarketSync è stata modificata',
    text: _buildPasswordChangedTxt(name, appUrl),
    html: _buildPasswordChangedHtml(name, appUrl),
  });
}

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Invia una email transazionale tramite SendGrid.
 *
 * @param {object} params
 * @param {string|string[]} params.to
 * @param {string} params.subject
 * @param {string} [params.text]
 * @param {string} [params.html]
 * @param {{email: string, name?: string}} [params.from]
 * @returns {Promise<{ accepted: boolean, messageId: string|null, statusCode: number }>}
 */
export async function sendTransactionalEmail({
  to,
  subject,
  text = null,
  html = null,
  from = null,
}) {
  if (!isSendGridConfigured()) {
    throw buildSendGridNotConfiguredError();
  }

  assertMessageInput({ to, subject, text, html });

  const message = {
    to,
    from: buildFromAddress(from),
    subject: subject.trim(),
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  };

  try {
    const [response] = await sgMail.send(message);

    return {
      accepted: response?.statusCode === 202,
      messageId: extractMessageId(response),
      statusCode: response?.statusCode ?? 0,
    };
  } catch {
    throw buildEmailSendFailedError();
  }
}
