import { StatusCodes } from 'http-status-codes';

// Express catches any error passed to next(err) and routes it here.
// All thrown/custom errors surface as a single { msg } JSON shape so the
// frontend never sees raw stack traces or DB internals.
export const errorHandler = (err, req, res, next) => {
  let customError = {
    // Use a status code set by the throwing code, or fall back to 500.
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    msg: err.message || 'Something went wrong try again later',
  };

  // MySQL duplicate-key violations (e.g. duplicate email, duplicate answer)
  // are a client mistake, not a server fault — remap to 400.
  if (err?.code === 'ER_DUP_ENTRY') {
    customError.statusCode = StatusCodes.BAD_REQUEST;
    customError.msg = 'Duplicate value entered for a unique field';
  }

  return res.status(customError.statusCode).json({ msg: customError.msg });
};
