import prisma from '../config/database.js';
import { WalletService } from './walletService.js';
import { calculateWinnings } from '../utils/helpers.js';
import { TransactionType, MatchStatus } from '@prisma/client';
import logger from '../utils/logger.js';

export class BettingService {
  static async placePlayerBet(matchId, playerId, amount) {
    return await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { playerBets: true }
      });
      
      if (!match) throw new Error('Match not found');
      if (match.status !== MatchStatus.BETTING) throw new Error('Betting is closed for this match');
      if (match.player1Id !== playerId && match.player2Id !== playerId) {
        throw new Error('You are not a participant in this match');
      }
      
      // Check if player already placed bet
      const existingBet = match.playerBets.find(bet => bet.playerId === playerId);
      if (existingBet) throw new Error('You have already placed a bet for this match');
      
      // Debit player wallet
      await WalletService.debit(
        playerId,
        amount,
        TransactionType.PLAYER_BET,
        `PLAYER_BET_${matchId}_${Date.now()}`,
        `Bet placed for match ${matchId}`
      );
      
      // Create bet record
      const bet = await tx.playerBet.create({
        data: {
          matchId,
          playerId,
          amount
        }
      });
      
      // Update match total
      const newTotal = (match.totalPlayerBet || 0) + amount;
      await tx.match.update({
        where: { id: matchId },
        data: { totalPlayerBet: newTotal }
      });
      
      // Update which player bet
      if (match.player1Id === playerId) {
        await tx.match.update({
          where: { id: matchId },
          data: { player1BetAmount: amount }
        });
      } else {
        await tx.match.update({
          where: { id: matchId },
          data: { player2BetAmount: amount }
        });
      }
      
      logger.info(`Player ${playerId} placed bet of ${amount} on match ${matchId}`);
      return bet;
    });
  }
  
  static async placeFanBet(matchId, fanId, amount, pickedPlayerId) {
    return await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: { fanBets: true }
      });
      
      if (!match) throw new Error('Match not found');
      if (match.status !== MatchStatus.BETTING) throw new Error('Betting is closed for this match');
      if (match.player1Id !== pickedPlayerId && match.player2Id !== pickedPlayerId) {
        throw new Error('Invalid player selection');
      }
      
      // Debit fan wallet
      await WalletService.debit(
        fanId,
        amount,
        TransactionType.FAN_BET,
        `FAN_BET_${matchId}_${Date.now()}`,
        `Fan bet on match ${matchId}`
      );
      
      // Create bet record
      const bet = await tx.fanBet.create({
        data: {
          matchId,
          fanId,
          amount,
          pickedPlayerId
        }
      });
      
      // Update match fan pool
      const newPool = (match.fanBetPool || 0) + amount;
      await tx.match.update({
        where: { id: matchId },
        data: { fanBetPool: newPool }
      });
      
      logger.info(`Fan ${fanId} placed bet of ${amount} on player ${pickedPlayerId} for match ${matchId}`);
      return bet;
    });
  }
  
  static async processMatchPayouts(matchId, winnerId) {
    return await prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          playerBets: true,
          fanBets: true,
          player1: true,
          player2: true
        }
      });
      
      if (!match) throw new Error('Match not found');
      if (match.winnerId) throw new Error('Payouts already processed');
      
      const adminUserId = await tx.user.findFirst({ where: { role: 'ADMIN' } });
      if (!adminUserId) throw new Error('Admin user not found');
      
      // 1. Player bets payout (80% to winner, 20% to admin)
      const totalPlayerBet = match.totalPlayerBet;
      if (totalPlayerBet > 0) {
        const { adminAmount, winnersPool } = calculateWinnings(totalPlayerBet, 20);
        
        // Winner gets 80% of total player bets
        if (winnersPool > 0) {
          await WalletService.credit(
            winnerId,
            winnersPool,
            TransactionType.PLAYER_WINNING,
            `PLAYER_WIN_${matchId}`,
            `Won player bet pool for match ${matchId}`
          );
        }
        
        // Admin gets 20%
        if (adminAmount > 0) {
          await WalletService.credit(
            adminUserId.id,
            adminAmount,
            TransactionType.ADMIN_REVENUE,
            `ADMIN_PLAYER_CUT_${matchId}`,
            `Admin cut from player bets for match ${matchId}`
          );
        }
      }
      
      // 2. Fan bets payout (80% to winning fans proportionally, 20% to admin)
      const totalFanPool = match.fanBetPool;
      if (totalFanPool > 0) {
        const winningFanBets = match.fanBets.filter(bet => bet.pickedPlayerId === winnerId);
        const totalWinningBets = winningFanBets.reduce((sum, bet) => sum + bet.amount, 0);
        
        const { adminAmount, winnersPool } = calculateWinnings(totalFanPool, 20);
        
        // Distribute winners pool proportionally
        if (totalWinningBets > 0 && winnersPool > 0) {
          for (const bet of winningFanBets) {
            const proportion = bet.amount / totalWinningBets;
            const winnings = winnersPool * proportion;
            
            await WalletService.credit(
              bet.fanId,
              winnings,
              TransactionType.FAN_WINNING,
              `FAN_WIN_${matchId}_${bet.id}`,
              `Won fan bet for match ${matchId}`
            );
            
            await tx.fanBet.update({
              where: { id: bet.id },
              data: { isWinner: true, winnings }
            });
          }
        }
        
        // Admin gets 20%
        if (adminAmount > 0) {
          await WalletService.credit(
            adminUserId.id,
            adminAmount,
            TransactionType.ADMIN_REVENUE,
            `ADMIN_FAN_CUT_${matchId}`,
            `Admin cut from fan bets for match ${matchId}`
          );
        }
      }
      
      // Mark match as finished with winner
      await tx.match.update({
        where: { id: matchId },
        data: {
          winnerId,
          status: MatchStatus.FINISHED,
          finishedAt: new Date()
        }
      });
      
      logger.info(`Payouts processed for match ${matchId}. Winner: ${winnerId}`);
      return { success: true, winnerId };
    });
  }
}