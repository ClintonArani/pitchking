import prisma from '../config/database.js';
import { WalletService } from './walletService.js';
import { generateInviteCode } from '../utils/helpers.js';
import { TransactionType, MatchStatus } from '@prisma/client';
import logger from '../utils/logger.js';

export class MatchService {
  static async createChallenge(player1Id, player1BetAmount, player1TeamId, opponentEmail = null) {
    return await prisma.$transaction(async (tx) => {
      // Check player1 balance
      const player1 = await tx.user.findUnique({
        where: { id: player1Id },
        select: { walletBalance: true, role: true }
      });
      
      if (player1.role !== 'PLAYER') throw new Error('Only players can create matches');
      if (player1.walletBalance < 10) throw new Error('Insufficient funds for entry fee (KES 10)');
      
      // Deduct entry fee (KES 10)
      await WalletService.debit(
        player1Id,
        10,
        TransactionType.ENTRY_FEE,
        `ENTRY_FEE_${Date.now()}`,
        'Match entry fee'
      );
      
      // Create match
      const match = await tx.match.create({
        data: {
          player1Id,
          player1TeamId,
          player1BetAmount,
          entryFee: 10,
          status: opponentEmail ? MatchStatus.PENDING : MatchStatus.READY,
          scheduledStart: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
        }
      });
      
      // Generate invite code
      const inviteCode = await tx.inviteCode.create({
        data: {
          code: generateInviteCode(),
          matchId: match.id,
          createdBy: player1Id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes expiry
        }
      });
      
      // If opponent specified, send notification (would use email/socket in production)
      if (opponentEmail) {
        logger.info(`Challenge created for ${opponentEmail} with code ${inviteCode.code}`);
        // TODO: Send email or push notification
      }
      
      return { match, inviteCode: inviteCode.code };
    });
  }
  
  static async joinMatch(inviteCode, player2Id, player2TeamId, player2BetAmount) {
    return await prisma.$transaction(async (tx) => {
      const invite = await tx.inviteCode.findUnique({
        where: { code: inviteCode },
        include: { match: true }
      });
      
      if (!invite) throw new Error('Invalid invite code');
      if (invite.expiresAt < new Date()) throw new Error('Invite code expired');
      if (invite.usedBy) throw new Error('Invite code already used');
      if (invite.match.player2Id) throw new Error('Match already has second player');
      if (invite.match.status !== MatchStatus.PENDING) throw new Error('Match is not available');
      
      // Check player2 balance for entry fee
      const player2 = await tx.user.findUnique({
        where: { id: player2Id },
        select: { walletBalance: true, role: true }
      });
      
      if (player2.role !== 'PLAYER') throw new Error('Only players can join matches');
      if (player2.walletBalance < 10) throw new Error('Insufficient funds for entry fee (KES 10)');
      
      // Deduct entry fee
      await WalletService.debit(
        player2Id,
        10,
        TransactionType.ENTRY_FEE,
        `ENTRY_FEE_${Date.now()}`,
        'Match entry fee'
      );
      
      // Credit entry fees to admin wallet
      const admin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
      if (admin) {
        await WalletService.credit(
          admin.id,
          20, // KES 10 from each player
          TransactionType.ADMIN_REVENUE,
          `ENTRY_FEES_${invite.match.id}`,
          `Entry fees for match ${invite.match.id}`
        );
      }
      
      // Update match
      const match = await tx.match.update({
        where: { id: invite.match.id },
        data: {
          player2Id,
          player2TeamId,
          player2BetAmount,
          status: MatchStatus.BETTING,
          scheduledStart: new Date(Date.now() + 2 * 60 * 1000) // 2 minutes for betting
        }
      });
      
      // Mark invite as used
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { usedBy: player2Id }
      });
      
      logger.info(`Player ${player2Id} joined match ${match.id}`);
      return match;
    });
  }
  
  static async startMatch(matchId) {
    const match = await prisma.match.update({
      where: { id: matchId, status: MatchStatus.BETTING },
      data: {
        status: MatchStatus.STARTED,
        startedAt: new Date()
      }
    });
    
    logger.info(`Match ${matchId} started`);
    return match;
  }
  
  static async endMatch(matchId, score, winnerId) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { player1: true, player2: true }
    });
    
    if (!match) throw new Error('Match not found');
    if (match.status !== MatchStatus.STARTED) throw new Error('Match not in progress');
    
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.FINISHED,
        finishedAt: new Date(),
        score,
        winnerId
      }
    });
    
    logger.info(`Match ${matchId} ended. Winner: ${winnerId}, Score: ${score}`);
    return updatedMatch;
  }
}