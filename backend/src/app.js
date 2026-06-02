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
import { WalletService } from './services/walletService.js';
import { TransactionType, TransactionStatus } from '@prisma/client';

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

// M-Pesa callback endpoint - complete implementation
app.post('/api/mpesa/stk-callback', async (req, res) => {
  try {
    const { Body } = req.body;
    
    // Safaricom sends the data inside Body.stkCallback
    const { ResultCode, CheckoutRequestID, ResultDesc, MpesaReceiptNumber } = Body.stkCallback;
    
    logger.info('M-Pesa callback received', { CheckoutRequestID, ResultCode });
    
    // Find the pending transaction by the checkoutRequestId stored in metadata
    const transaction = await prisma.transaction.findFirst({
      where: {
        metadata: { path: ['checkoutRequestId'], equals: CheckoutRequestID },
        status: 'PENDING'
      }
    });
    
    if (!transaction) {
      logger.warn(`Transaction not found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.status(404).json({ ResultCode: 1, ResultDesc: 'Transaction not found' });
    }
    
    if (ResultCode === 0) {
      // Payment successful – credit the user's wallet
      await WalletService.credit(
        transaction.userId,
        transaction.amount,
        TransactionType.DEPOSIT,
        transaction.reference,
        `M-Pesa deposit successful. Receipt: ${MpesaReceiptNumber}`
      );
      
      // Update transaction record
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          mpesaReceipt: MpesaReceiptNumber,
          completedAt: new Date()
        }
      });
      
      logger.info(`Deposit completed for user ${transaction.userId}, amount ${transaction.amount}`);
    } else {
      // Payment failed – mark transaction as failed
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.FAILED,
          description: ResultDesc,
          completedAt: new Date()
        }
      });
      
      logger.error(`Deposit failed for user ${transaction.userId}: ${ResultDesc}`);
    }
    
    // Always respond with success to Safaricom
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    logger.error('Callback processing error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Internal server error' });
  }
});

// Test endpoint
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