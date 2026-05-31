import prisma from '../config/database.js';
import logger from '../utils/logger.js';
import { TransactionStatus, TransactionType } from '@prisma/client';

export class WalletService {
  static async getBalance(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalance: true }
    });
    return user?.walletBalance || 0;
  }
  
  static async credit(userId, amount, type, reference, description = '') {
    if (amount <= 0) throw new Error('Amount must be positive');
    
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true }
      });
      
      const newBalance = user.walletBalance + amount;
      
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: newBalance }
      });
      
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount,
          type,
          reference,
          description,
          status: TransactionStatus.COMPLETED,
          completedAt: new Date()
        }
      });
      
      logger.info(`Credited ${amount} to user ${userId}. New balance: ${newBalance}`);
      return transaction;
    });
  }
  
  static async debit(userId, amount, type, reference, description = '') {
    if (amount <= 0) throw new Error('Amount must be positive');
    
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { walletBalance: true }
      });
      
      if (user.walletBalance < amount) {
        throw new Error('Insufficient funds');
      }
      
      const newBalance = user.walletBalance - amount;
      
      await tx.user.update({
        where: { id: userId },
        data: { walletBalance: newBalance }
      });
      
      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: -amount,
          type,
          reference,
          description,
          status: TransactionStatus.COMPLETED,
          completedAt: new Date()
        }
      });
      
      logger.info(`Debited ${amount} from user ${userId}. New balance: ${newBalance}`);
      return transaction;
    });
  }
  
  static async transfer(fromUserId, toUserId, amount, type, reference, description = '') {
    if (amount <= 0) throw new Error('Amount must be positive');
    
    return await prisma.$transaction(async (tx) => {
      // Debit from sender
      const fromUser = await tx.user.findUnique({
        where: { id: fromUserId },
        select: { walletBalance: true }
      });
      
      if (fromUser.walletBalance < amount) {
        throw new Error('Insufficient funds');
      }
      
      await tx.user.update({
        where: { id: fromUserId },
        data: { walletBalance: { decrement: amount } }
      });
      
      // Credit to receiver
      await tx.user.update({
        where: { id: toUserId },
        data: { walletBalance: { increment: amount } }
      });
      
      // Record transactions
      const debitTransaction = await tx.transaction.create({
        data: {
          userId: fromUserId,
          amount: -amount,
          type,
          reference: `${reference}_debit`,
          description,
          status: TransactionStatus.COMPLETED,
          completedAt: new Date()
        }
      });
      
      const creditTransaction = await tx.transaction.create({
        data: {
          userId: toUserId,
          amount,
          type,
          reference: `${reference}_credit`,
          description,
          status: TransactionStatus.COMPLETED,
          completedAt: new Date()
        }
      });
      
      logger.info(`Transferred ${amount} from ${fromUserId} to ${toUserId}`);
      return { debitTransaction, creditTransaction };
    });
  }
}