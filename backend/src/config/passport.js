import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env.js';
import { findOrCreateGoogleUser } from '../services/auth/auth.service.js';

// Passport è usato esclusivamente per Google OAuth.
// L'autenticazione locale email/password è gestita direttamente in auth.service.js senza Passport.
passport.use(
  new GoogleStrategy(
    {
      clientID: env.google.clientId,
      clientSecret: env.google.clientSecret,
      callbackURL: env.google.callbackUrl,
    },
    async (_googleAccessToken, _googleRefreshToken, profile, done) => {
      try {
        const user = await findOrCreateGoogleUser(profile);
        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// serializeUser / deserializeUser sono omessi intenzionalmente.
// Usiamo session: false sulla callback: gli utenti non vengono mai persistiti in sessione.
// express-session è richiesta solo per lo state OAuth (protezione CSRF durante l'handshake).

export default passport;
