const { ZodError } = require("zod");

const { sanitizeValue } = require("../utils/sanitize");

const validateRequest = (schema) => (req, _res, next) => {
  try {
    const parsed = schema.parse({
      body: sanitizeValue(req.body),
      params: sanitizeValue(req.params),
      query: sanitizeValue(req.query)
    });

    req.body = parsed.body;
    req.params = parsed.params;
    req.query = parsed.query;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      error.statusCode = 400;
      error.code = "VALIDATION_ERROR";
    }

    next(error);
  }
};

module.exports = {
  validateRequest
};
