import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import User from '../../models/User.js';
import OAuthLoginCode from '../../models/OAuthLoginCode.js';
import { generateAccessToken, generateRefreshToken, hashToken, REFRESH_TOKEN_MAX_AGE_MS } from './token.service.js';
import { BadRequestError, ConflictError, UnauthorizedError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { env } from '../../config/env.js';
import { sendWelcomeEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from '../email/sendgrid.service.js';

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 60 minuti
const OAUTH_LOGIN_CODE_TTL_MS = 2 * 60 * 1000; // 2 minuti
const OAUTH_LOGIN_CODE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const OAUTH_LOGIN_CODE_ERROR = 'Accesso Google non valido o scaduto. Riprova dal login.';

/**
 * Serializza un documento User per le risposte API.
 * Non include mai passwordHash o refreshTokenHash.
 */
function serializeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    nickname: user.nickname ?? null,
    email: user.email,
    bio: user.bio ?? null,
    avatarUrl: user.avatarUrl ?? null,
    avatarSource: user.avatarSource ?? null,
    role: user.role,
    loginProvider: user.loginProvider ?? inferLoginProvider(user),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };
}

function inferLoginProvider(user) {
  if (user.passwordHash && user.googleId) return 'mixed';
  if (user.googleId) return 'google';
  return 'local';
}

function syncGoogleAvatar(user, googleAvatarUrl) {
  // Non sovrascrivere se l'utente ha caricato un avatar personalizzato via Cloudinary.
  if (!googleAvatarUrl || user.avatarSource === 'upload') return;
  user.avatarUrl = googleAvatarUrl;
  user.avatarSource = 'google';
}

// ── Registrazione ─────────────────────────────────────────────────────────────

export async function registerUser({ name, email, password }) {
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw new ConflictError('Esiste già un account con questa email.', { scope: 'auth' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const refreshToken = generateRefreshToken();

  const user = await User.create({
    name,
    email,
    passwordHash,
    loginProvider: 'local',
    refreshTokenHash: hashToken(refreshToken),
    refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS),
    role: 'marketer',
  });

  // Fire-and-forget: failure email non blocca la registrazione
  sendWelcomeEmail({ to: user.email, name: user.name }).catch(() => {});

  return {
    accessToken: generateAccessToken(user),
    refreshToken,
    user: serializeUser(user),
  };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email });

  // Stesso messaggio per utente mancante e password errata: evita l'enumerazione email.
  const credentialError = new UnauthorizedError('Email o password non corretti.', { scope: 'auth' });

  if (!user || !user.passwordHash) throw credentialError;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw credentialError;

  const refreshToken = generateRefreshToken();
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  user.loginProvider = inferLoginProvider(user);
  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken: generateAccessToken(user),
    refreshToken,
    user: serializeUser(user),
  };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export async function refreshTokens(incomingRefreshToken) {
  if (!incomingRefreshToken) {
    throw new UnauthorizedError('Sessione non valida. Accedi di nuovo.', { scope: 'auth' });
  }

  const user = await User.findOne({ refreshTokenHash: hashToken(incomingRefreshToken) });

  if (!user) {
    // Token non trovato: già revocato, cookie scaduto o token falsificato.
    throw new UnauthorizedError('La sessione è scaduta. Accedi di nuovo per continuare.', { scope: 'auth' });
  }

  if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt < new Date()) {
    // Token trovato ma scaduto lato server: invalida e rifiuta.
    user.refreshTokenHash = null;
    user.refreshTokenExpiresAt = null;
    await user.save();
    throw new UnauthorizedError('La sessione è scaduta. Accedi di nuovo per continuare.', { scope: 'auth' });
  }

  // Rotazione: sostituisce il vecchio token con uno nuovo ed estende la scadenza.
  const newRefreshToken = generateRefreshToken();
  user.refreshTokenHash = hashToken(newRefreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  await user.save();

  return {
    accessToken: generateAccessToken(user),
    refreshToken: newRefreshToken,
  };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function revokeRefreshToken(refreshToken) {
  // Idempotente: nessun errore se il token non viene trovato (già revocato o scaduto).
  await User.findOneAndUpdate(
    { refreshTokenHash: hashToken(refreshToken) },
    { refreshTokenHash: null, refreshTokenExpiresAt: null }
  );
}

// ── Google OAuth ──────────────────────────────────────────────────────────────

function getGoogleAvatarUrl(profile) {
  const candidates = [
    profile._json?.picture,
    profile.photos?.[0]?.value,
  ];

  for (const url of candidates) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url.trim())) {
      return url.trim();
    }
  }

  return null;
}

export async function findOrCreateGoogleUser(profile) {
  const googleId = profile.id;
  const email = profile.emails?.[0]?.value?.toLowerCase() ?? null;
  const avatarUrl = getGoogleAvatarUrl(profile);

  if (!email) {
    throw new ValidationError("Non è stato possibile recuperare l'email dall'account Google. Verifica che l'account abbia un'email verificata.", { scope: 'auth' });
  }

  // 1. Account già collegato a questo googleId: mantiene allineata la foto Google.
  let user = await User.findOne({ googleId });
  if (user) {
    user.loginProvider = inferLoginProvider(user);
    syncGoogleAvatar(user, avatarUrl);
    await user.save();
    return user;
  }

  // 2. Account email esistente: collega googleId (unisce Google all'account esistente).
  user = await User.findOne({ email });
  if (user) {
    user.googleId = googleId;
    user.loginProvider = inferLoginProvider(user);
    syncGoogleAvatar(user, avatarUrl);
    await user.save();
    return user;
  }

  // 3. Utente completamente nuovo: nessuna password (account solo Google).
  const newGoogleUser = await User.create({
    name: profile.displayName ?? email,
    email,
    googleId,
    avatarUrl: avatarUrl ?? null,
    avatarSource: avatarUrl ? 'google' : null,
    loginProvider: 'google',
    role: 'marketer',
  });

  // Fire-and-forget: failure email non blocca la registrazione Google
  sendWelcomeEmail({ to: newGoogleUser.email, name: newGoogleUser.name }).catch(() => {});

  return newGoogleUser;
}

export async function completeGoogleAuth(user) {
  const refreshToken = generateRefreshToken();
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  user.loginProvider = inferLoginProvider(user);
  user.lastLoginAt = new Date();
  await user.save();

  return {
    accessToken: generateAccessToken(user),
    refreshToken,
    user: serializeUser(user),
  };
}

export async function createOAuthLoginCode(userId) {
  const code = crypto.randomBytes(32).toString('base64url');

  await OAuthLoginCode.create({
    userId,
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + OAUTH_LOGIN_CODE_TTL_MS),
  });

  return code;
}

export async function exchangeOAuthLoginCode(code) {
  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  if (!OAUTH_LOGIN_CODE_PATTERN.test(normalizedCode)) {
    throw new UnauthorizedError(OAUTH_LOGIN_CODE_ERROR, { scope: 'auth' });
  }

  const now = new Date();
  const loginCode = await OAuthLoginCode.findOneAndUpdate(
    {
      codeHash: hashToken(normalizedCode),
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } },
    { new: true }
  );

  if (!loginCode) {
    throw new UnauthorizedError(OAUTH_LOGIN_CODE_ERROR, { scope: 'auth' });
  }

  const user = await User.findById(loginCode.userId);
  if (!user) {
    throw new UnauthorizedError(OAUTH_LOGIN_CODE_ERROR, { scope: 'auth' });
  }

  const refreshToken = generateRefreshToken();
  user.refreshTokenHash = hashToken(refreshToken);
  user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  user.loginProvider = inferLoginProvider(user);
  user.lastLoginAt = now;
  await user.save();

  return {
    accessToken: generateAccessToken(user),
    refreshToken,
    user: serializeUser(user),
  };
}

// ── Me ────────────────────────────────────────────────────────────────────────

export async function getMe(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new NotFoundError('Account non trovato.', { scope: 'auth' });
  }
  return serializeUser(user);
}

// ── Forgot password ───────────────────────────────────────────────────────────

const FORGOT_GENERIC = "Se l'email è registrata, riceverai le istruzioni per reimpostare la password.";

export async function forgotPassword(email) {
  const user = await User.findOne({ email });

  // Risposta generica per utenti inesistenti e Google-only (anti-enumeration).
  // Non rivela se l'email è registrata o se l'account è Google.
  if (!user || !user.passwordHash) {
    return { message: FORGOT_GENERIC };
  }

  const token = crypto.randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  await user.save();

  const resetUrl = `${env.frontend.url}/reset-password?token=${token}`;

  // Fire-and-forget: failure email non deve rivelare l'esistenza dell'utente
  sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch(() => {});

  return { message: FORGOT_GENERIC };
}

// ── Reset password ────────────────────────────────────────────────────────────

const INVALID_TOKEN_MESSAGE = 'Link non valido o scaduto.';

export async function resetPassword({ token, password }) {
  if (!token) {
    throw new BadRequestError(INVALID_TOKEN_MESSAGE, { scope: 'auth' });
  }

  const tokenHash = hashToken(token);
  const user = await User.findOne({ passwordResetTokenHash: tokenHash });

  // Token non trovato, già usato, o account Google-only
  if (!user || !user.passwordHash) {
    throw new BadRequestError(INVALID_TOKEN_MESSAGE, { scope: 'auth' });
  }

  if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    // Pulisce il token scaduto
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    throw new BadRequestError(INVALID_TOKEN_MESSAGE, { scope: 'auth' });
  }

  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  // Invalida le sessioni attive: vecchi refresh token non possono più rigenerare access token.
  user.refreshTokenHash = null;
  user.refreshTokenExpiresAt = null;
  await user.save();

  // Best-effort: failure email non blocca il reset già riuscito
  sendPasswordChangedEmail({ to: user.email, name: user.name }).catch(() => {});

  return { message: 'Password aggiornata correttamente.' };
}
