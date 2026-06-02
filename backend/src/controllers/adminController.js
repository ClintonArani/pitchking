import prisma from '../config/database.js';
import { WalletService } from '../services/walletService.js';
import { MpesaService } from '../services/mpesaService.js';
import { TransactionStatus, TransactionType } from '@prisma/client';
import logger from '../utils/logger.js';

export const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        role: true,
        walletBalance: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const getAllMatches = async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      include: {
        player1: { select: { name: true } },
        player2: { select: { name: true } },
        winner: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};

export const getWithdrawalRequests = async (req, res, next) => {
  try {
    const requests = await prisma.withdrawalRequest.findMany({
      where: { status: TransactionStatus.PENDING },
      include: { user: { select: { name: true, email: true, walletBalance: true } } },
      orderBy: { createdAt: 'asc' }
    });
    
    res.json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

export const approveWithdrawal = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    
    const request = await prisma.withdrawalRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    
    if (request.status !== TransactionStatus.PENDING) {
      return res.status(400).json({ success: false, message: 'Request already processed' });
    }
    
    if (request.user.walletBalance < request.amount) {
      await prisma.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: TransactionStatus.FAILED,
          rejectedReason: 'Insufficient balance'
        }
      });
      return res.status(400).json({ success: false, message: 'Insufficient user balance' });
    }
    
    // Process B2C payment - COMMENTED OUT FOR MOCK TESTING
    // try {
    //   const b2cResponse = await MpesaService.b2c(request.phoneNumber, request.amount);
      
      // Debit user wallet (still happens)
      await WalletService.debit(
        request.userId,
        request.amount,
        TransactionType.WITHDRAWAL,
        `WITHDRAWAL_${requestId}`,
        'Admin approved withdrawal (MOCK - no actual M-Pesa sent)'
      );
      
      // Update request as completed (without real B2C)
      await prisma.withdrawalRequest.update({
        where: { id: requestId },
        data: {
          status: TransactionStatus.COMPLETED,
          approvedBy: req.user.id,
          approvedAt: new Date(),
          // mpesaResponse: b2cResponse, // commented out
          completedAt: new Date()
        }
      });
      
      logger.info(`Withdrawal ${requestId} approved by admin ${req.user.id} (MOCK mode)`);
      res.json({ success: true, message: 'Withdrawal approved (MOCK - no money sent to M-Pesa)' });
    // } catch (error) {
    //   logger.error('B2C failed:', error);
    //   await prisma.withdrawalRequest.update({
    //     where: { id: requestId },
    //     data: {
    //       status: TransactionStatus.FAILED,
    //       rejectedReason: 'M-Pesa payment failed'
    //     }
    //   });
    //   throw error;
    // }
  } catch (error) {
    next(error);
  }
};

export const rejectWithdrawal = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    
    const request = await prisma.withdrawalRequest.update({
      where: { id: requestId },
      data: {
        status: TransactionStatus.FAILED,
        rejectedReason: reason || 'Rejected by admin',
        approvedAt: new Date()
      }
    });
    
    res.json({ success: true, message: 'Withdrawal rejected', data: request });
  } catch (error) {
    next(error);
  }
};

export const getRevenueStats = async (req, res, next) => {
  try {
    const [totalEntryFees, totalPlayerBetCut, totalFanBetCut, adminWallet] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: TransactionType.ADMIN_REVENUE, description: { contains: 'entry' } },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: { type: TransactionType.ADMIN_REVENUE, description: { contains: 'player bets' } },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: { type: TransactionType.ADMIN_REVENUE, description: { contains: 'fan bets' } },
        _sum: { amount: true }
      }),
      prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { walletBalance: true }
      })
    ]);
    
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    
    res.json({
      success: true,
      data: {
        totalEntryFees: totalEntryFees._sum.amount || 0,
        totalPlayerBetCut: totalPlayerBetCut._sum.amount || 0,
        totalFanBetCut: totalFanBetCut._sum.amount || 0,
        totalRevenue: (totalEntryFees._sum.amount || 0) + (totalPlayerBetCut._sum.amount || 0) + (totalFanBetCut._sum.amount || 0),
        adminWalletBalance: adminUser?.walletBalance || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

export const adminWithdraw = async (req, res, next) => {
  try {
    const { amount, phoneNumber } = req.body;
    
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (!admin) throw new Error('Admin not found');
    
    if (admin.walletBalance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient admin balance' });
    }
    
    // Process B2C to admin's personal M-Pesa - COMMENTED OUT FOR MOCK TESTING
    // const b2cResponse = await MpesaService.b2c(phoneNumber, amount);
    
    // Debit admin wallet (still happens)
    await WalletService.debit(
      admin.id,
      amount,
      TransactionType.WITHDRAWAL,
      `ADMIN_WITHDRAW_${Date.now()}`,
      'Admin withdrawal (MOCK - no actual M-Pesa sent)'
    );
    
    res.json({
      success: true,
      message: 'Admin withdrawal processed (MOCK - no money sent to M-Pesa)',
      // data: b2cResponse // removed
    });
  } catch (error) {
    next(error);
  }
};