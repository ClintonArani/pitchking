import { z } from 'zod';

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors
      });
    }
  };
};

// Validation schemas
export const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  phoneNumber: z.string().regex(/^254[0-9]{9}$/),
  password: z.string().min(6),
  role: z.enum(['PLAYER', 'FAN']).optional().default('FAN')
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const depositSchema = z.object({
  amount: z.number().positive().min(10)
});

export const withdrawSchema = z.object({
  amount: z.number().positive().min(10)
});

export const createMatchSchema = z.object({
  opponentEmail: z.string().email().optional(),
  player1BetAmount: z.number().positive().min(10),
  player1TeamId: z.string().uuid(),
  player1Formation: z.string().optional()
});

export const placeBetSchema = z.object({
  matchId: z.string().uuid(),
  amount: z.number().positive().min(10)
});

export const fanBetSchema = z.object({
  matchId: z.string().uuid(),
  amount: z.number().positive().min(10),
  pickedPlayerId: z.string().uuid()
});