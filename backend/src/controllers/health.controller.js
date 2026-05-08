import mongoose from 'mongoose';

export function health(_req, res) {
  const dbReady = mongoose.connection.readyState === 1;

  if (!dbReady) {
    return res.status(503).json({
      success: false,
      status: 'unavailable',
      service: 'marketsync-backend',
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    success: true,
    status: 'ok',
    service: 'marketsync-backend',
    timestamp: new Date().toISOString(),
  });
}
