import prisma from '../config/database.js';
import logger from '../utils/logger.js';

export class TransactionService {
  static async createTransaction(userId, amount, type, reference, description, metadata = {}) {
    try {
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          amount,
          type,
          reference,
          description,
          metadata,
          status: 'PENDING'
        }
      });
      logger.info(`Transaction created: ${reference} for user ${userId}`);
      return transaction;
    } catch (error) {
      logger.error('Failed to create transaction:', error);
      throw error;
    }
  }

  static async updateTransactionStatus(reference, status, mpesaReceipt = null) {
    const transaction = await prisma.transaction.update({
      where: { reference },
      data: {
        status,
        mpesaReceipt,
        completedAt: status === 'COMPLETED' ? new Date() : null
      }
    });
    return transaction;
  }

  static async getUserTransactions(userId, limit = 50, offset = 0) {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  static async getTransactionByReference(reference) {
    return prisma.transaction.findUnique({
      where: { reference }
    });
  }
}