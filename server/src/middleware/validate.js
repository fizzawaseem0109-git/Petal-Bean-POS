// Usage: router.post('/', validate(schema), handler)  → parsed data in req.valid.body
// (Express 5 makes req.query read-only, so parsed query/params also go to req.valid.*)
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(result.error); // handled in errorHandler → 400
  req.valid = { ...(req.valid || {}), [source]: result.data };
  next();
};
