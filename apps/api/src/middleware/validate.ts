/**
 * Centralized Zod validation middleware.
 *
 * Phase 9, Item 156: Request validation middleware
 *
 * Usage:
 *   router.post('/foo', validate(bodySchema), handler);
 *   router.get('/foo/:id', validateParams(paramsSchema), handler);
 *   router.get('/foo', validateQuery(querySchema), handler);
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validates `req.body` against a Zod schema.
 * On success, replaces req.body with the parsed (and stripped) output.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: 'Validation failed',
          details: err.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
        return;
      }
      next(err);
    }
  };
}

/**
 * Validates `req.params` against a Zod schema.
 * Useful for ensuring UUID or slug format on route params.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: 'Invalid route parameters',
          details: err.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
        return;
      }
      next(err);
    }
  };
}

/**
 * Validates `req.query` against a Zod schema.
 * On success, replaces req.query with the parsed output.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          error: 'Invalid query parameters',
          details: err.issues.map(issue => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
