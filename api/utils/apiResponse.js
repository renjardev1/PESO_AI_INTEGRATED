export const sendSuccess = (res, data = {}, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message, errors: [] });

export const sendError = (res, status = 500, message = 'Request failed', errors = []) =>
  res.status(status).json({
    success: false, data: {},  message,
    errors: Array.isArray(errors) ? errors : [errors],
  });
