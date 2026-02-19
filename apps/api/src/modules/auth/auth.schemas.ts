import { z } from 'zod';

/**
 * Zod validation schemas for auth endpoints.
 * All user input is validated server-side, regardless of client-side validation.
 */

/** Username: 2–32 chars, lowercase only, alphanumeric + dots + underscores */
const usernameRegex = /^[a-z0-9._]{2,32}$/;

/** Password: 8–128 chars, at least 1 letter + 1 number */
const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d).{8,128}$/;

export const registerSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(
      usernameRegex,
      'Username must be lowercase and can only contain letters, numbers, dots, and underscores',
    ),
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(32, 'Display name must be at most 32 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(passwordRegex, 'Password must contain at least 1 letter and 1 number'),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine(
      (dob) => {
        const birthDate = new Date(dob);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        const dayDiff = today.getDate() - birthDate.getDate();
        const adjustedAge =
          monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
        return adjustedAge >= 16;
      },
      { message: 'You must be at least 16 years old to register' },
    ),
});

export const loginSchema = z.object({
  login: z.string().min(1, 'Username or email is required').max(255),
  password: z.string().min(1, 'Password is required').max(128),
  mfaCode: z
    .string()
    .length(6, 'MFA code must be 6 digits')
    .regex(/^\d{6}$/, 'MFA code must be numeric')
    .optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const usernameAvailabilitySchema = z.object({
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(usernameRegex, 'Invalid username format'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
