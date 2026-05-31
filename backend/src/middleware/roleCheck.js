export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }
    
    next();
  };
};

export const requireAdmin = restrictTo('ADMIN');
export const requirePlayer = restrictTo('PLAYER', 'ADMIN');
export const requireFan = restrictTo('FAN', 'ADMIN');