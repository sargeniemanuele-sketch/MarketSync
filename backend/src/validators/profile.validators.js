import { z } from 'zod';
import { sanitizeText } from '../utils/sanitize.js';

const nicknamePattern = /^[A-Za-z0-9_.-]+$/;

const nameSchema = z
  .string({
    required_error: 'Name is required',
    invalid_type_error: 'Name must be a string',
  })
  .transform((value) => sanitizeText(value.trim()))
  .pipe(
    z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name must not exceed 80 characters')
  );

const nicknameSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const normalized = sanitizeText(value.trim());
    return normalized === '' ? null : normalized;
  })
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) return;

    if (value.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nickname must be at least 2 characters',
      });
    }

    if (value.length > 40) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nickname must not exceed 40 characters',
      });
    }

    if (!nicknamePattern.test(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nickname can only contain letters, numbers, underscore, dot and hyphen',
      });
    }
  });

const bioSchema = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const normalized = sanitizeText(value.trim());
    return normalized === '' ? null : normalized;
  })
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) return;

    if (value.length > 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bio must not exceed 500 characters',
      });
    }
  });

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  nickname: nicknameSchema,
  bio: bioSchema,
}).strict();
