const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/apiResponse');

/**
 * Runs an array of express-validator chains, then throws a 422 ApiError
 * with a field-level error list if any of them failed.
 * Usage: router.post('/', validate([body('email').isEmail()]), handler)
 */
const validate = (validations) => async (req, res, next) => {
  await Promise.all(validations.map((v) => v.run(req)));

  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, 'Validation failed', errors));
};

module.exports = validate;
