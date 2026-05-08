import 'dotenv/config';

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optional = (key, fallback) => process.env[key] ?? fallback;

export const env = {
  NODE_ENV: optional('NODE_ENV', 'development'),
  PORT: parseInt(optional('PORT', '4000'), 10),
  isProduction: process.env.NODE_ENV === 'production',

  db: {
    uri: required('MONGODB_URI'),
  },

  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtAccessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    // cookieSecret viene passato a cookieParser per cookie firmati (uso futuro).
    // Il cookie del refresh token NON è firmato: viene validato tramite hash SHA-256 salvato in User.refreshTokenHash.
    cookieSecret: required('COOKIE_SECRET'),
  },

  google: {
    clientId: optional('GOOGLE_CLIENT_ID', ''),
    clientSecret: optional('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: optional(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:4000/api/v1/auth/google/callback'
    ),
  },

  shopify: {
    apiKey: optional('SHOPIFY_API_KEY', ''),
    apiSecret: optional('SHOPIFY_API_SECRET', ''),
    apiVersion: optional('SHOPIFY_API_VERSION', '2026-01'),
    scopes: optional('SHOPIFY_SCOPES', 'read_orders,read_products,read_analytics,read_all_orders'),
    callbackUrl: optional(
      'SHOPIFY_CALLBACK_URL',
      'http://localhost:4000/api/v1/integrations/shopify/callback'
    ),
  },

  meta: {
    appId: optional('META_APP_ID', ''),
    appSecret: optional('META_APP_SECRET', ''),
    redirectUri: optional(
      'META_REDIRECT_URI',
      'http://localhost:4000/api/v1/integrations/meta-ads/callback'
    ),
    scopes: optional('META_SCOPES', 'ads_read'),
  },

  googleAds: {
    apiVersion: optional('GOOGLE_ADS_API_VERSION', 'v24'),
    developerToken: optional('GOOGLE_ADS_DEVELOPER_TOKEN', ''),
    clientId: optional('GOOGLE_ADS_CLIENT_ID', ''),
    clientSecret: optional('GOOGLE_ADS_CLIENT_SECRET', ''),
    redirectUri: optional(
      'GOOGLE_ADS_REDIRECT_URI',
      'http://localhost:4000/api/v1/integrations/google-ads/callback'
    ),
    scopes: optional('GOOGLE_ADS_SCOPES', 'https://www.googleapis.com/auth/adwords'),
  },

  sendgrid: {
    apiKey: optional('SENDGRID_API_KEY', ''),
    fromEmail: optional('SENDGRID_FROM_EMAIL', ''),
    fromName: optional('SENDGRID_FROM_NAME', ''),
    logoUrl: optional('EMAIL_LOGO_URL', ''),
    supportEmail: optional('EMAIL_SUPPORT_EMAIL', ''),
  },

  cors: {
    allowedOrigins: optional(
      'ALLOWED_ORIGINS',
      'http://localhost:5173,http://127.0.0.1:5173'
    ).split(','),
  },

  frontend: {
    url: optional('FRONTEND_URL', 'http://localhost:5173'),
  },

  security: {
    // Chiave da 32 byte codificata in 64 caratteri esadecimali. Obbligatoria: senza, l'app non parte.
    // Genera: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    encryptionKey: required('ENCRYPTION_KEY'),
  },

  cloudinary: {
    cloudName: optional('CLOUDINARY_CLOUD_NAME', ''),
    apiKey: optional('CLOUDINARY_API_KEY', ''),
    apiSecret: optional('CLOUDINARY_API_SECRET', ''),
    profileAvatarFolder: optional('CLOUDINARY_PROFILE_AVATAR_FOLDER', 'marketsync/profile-avatars'),
  },

  backend: {
    // URL pubblico del backend, usato per costruire l'address dei webhook Shopify.
    // In produzione è obbligatorio (vedi check sotto). In locale cade in fallback su localhost.
    publicUrl: optional('BACKEND_PUBLIC_URL', 'http://localhost:4000'),
  },
};

if (env.isProduction && !process.env.ALLOWED_ORIGINS) {
  throw new Error('ALLOWED_ORIGINS is required in production');
}

if (env.isProduction && !process.env.BACKEND_PUBLIC_URL) {
  throw new Error('BACKEND_PUBLIC_URL is required in production');
}
