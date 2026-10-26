export function sendOk(res, data = null, message = 'OK', status = 200) {
  res.status(status).json({
    success: true,
    message,
    data,
  });
}

export function sendError(res, message, status = 400, errors = null) {
  const body = {
    success: false,
    message,
  };

  if (errors !== null) {
    body.errors = errors;
  }

  res.status(status).json(body);
}
