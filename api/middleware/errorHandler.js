export const errorHandler = (err, _req, res, _next) => {
  console.error('🔴 Unhandled error:', err.message);
  res.status(500).json({ message: 'Internal server error', detail: err.message });
};

export const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
};
