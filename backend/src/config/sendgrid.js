import sgMail from '@sendgrid/mail';
import { env } from './env.js';

const hasSendGridConfig = Boolean(env.sendgrid.apiKey && env.sendgrid.fromEmail);

if (hasSendGridConfig) {
  sgMail.setApiKey(env.sendgrid.apiKey);
}

export function isSendGridConfigured() {
  return hasSendGridConfig;
}

export { sgMail };
