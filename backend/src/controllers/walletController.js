import prisma from '../config/database.js';
import { WalletService } from '../services/walletService.js';
import { MpesaService } from '../services/mpesaService.js';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

export const getBalance = async (req, res, next) => {
  try {
    const balance = await WalletService.getBalance(req.user.id);
    res.json({ success: true, data: { balance } });
  } catch (error) {
    next(error);
  }
};

export const deposit = async (req, res, next) => {
  try {
    const { amount } = req.body;
    
    if (amount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum deposit is KES 10' });
    }
    
    const reference = `DEP_${uuidv4().slice(0, 8)}`;
    
    const stkResponse = await MpesaService.stkPush(
      req.user.phoneNumber,
      amount,
      reference,
      'Wallet Deposit'
    );
    
    // Create pending transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        amount,
        type: TransactionType.DEPOSIT,
        status: TransactionStatus.PENDING,
        reference,
        description: 'M-Pesa deposit',
        metadata: { checkoutRequestId: stkResponse.CheckoutRequestID }
      }
    });
    
    res.json({
      success: true,
      message: 'STK Push sent. Check your phone to complete payment.',
      data: { transactionId: transaction.id, checkoutRequestId: stkResponse.CheckoutRequestID }
    });
  } catch (error) {
    next(error);
  }
};

export const requestWithdrawal = async (req, res, next) => {
  try {
    const { amount } = req.body;
    
    if (amount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum withdrawal is KES 10' });
    }
    
    if (req.user.walletBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }
    
    console.log('User phone number:', req.user.phoneNumber); // Debug log
    
    const withdrawalRequest = await prisma.withdrawalRequest.create({
      data: {
        userId: req.user.id,
        amount,
        phoneNumber: req.user.phoneNumber,
        status: TransactionStatus.PENDING
      }
    });
    
    res.json({
      success: true,
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      data: { requestId: withdrawalRequest.id }
    });
  } catch (error) {
    next(error);
  }
};

export const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.transaction.count({ where: { userId: req.user.id } })
    ]);
    
    res.json({
      success: true,
      data: { transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }
    });
  } catch (error) {
    next(error);
  }
};