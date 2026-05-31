import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config();

import authRoutes from './routes/auth.js';
import walletRoutes from './routes/wallet.js';
import matchRoutes from './routes/match.js';
import betRoutes from './routes/bet.js';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';

import prisma from './config/database.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
app.use('/api', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/admin', adminRoutes);

// M-Pesa callback endpoint
app.post('/api/mpesa/stk-callback', async (req, res) => {
  logger.info('M-Pesa STK Callback received', req.body);
  // Process callback and update transaction status
  // In production: verify signature, update transaction, credit wallet
  
  res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

app.get('/api/test/users', async (req, res) => {
  try {
    const count = await prisma.user.count();
    res.json({ success: true, userCount: count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);

export default app;