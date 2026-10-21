import { badRequest } from '../utils/httpError.js';

/**
 * Validates body, query and route params with shared Zod schemas.
 * Parsed values replace the raw input, so handlers only see clean data.
 *
 * @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (!result.success) {
        const details = result.error.issues.map((i) => ({
          field: [part, ...i.path].join('.'),
          message: i.message,
        }));
        return next(badRequest('Some fields are not valid', details));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}
