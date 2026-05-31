import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error(err.stack);
  
  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: `Duplicate field value: ${err.meta?.target?.join(', ')}`
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      message: 'Record not found'
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};