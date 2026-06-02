import prisma from '../config/database.js';
import { BettingService } from '../services/bettingService.js';

export const placeFanBet = async (req, res, next) => {
  try {
    const { matchId, amount, pickedPlayerId } = req.body;
    
    const bet = await BettingService.placeFanBet(matchId, req.user.id, amount, pickedPlayerId);
    
    res.json({
      success: true,
      message: 'Fan bet placed successfully',
      data: bet
    });
  } catch (error) {
    next(error);
  }
};

export const getMatchBets = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    
    const [playerBets, fanBets] = await Promise.all([
      prisma.playerBet.findMany({
        where: { matchId },
        include: { player: { select: { name: true, id: true } } }
      }),
      prisma.fanBet.findMany({
        where: { matchId },
        include: { fan: { select: { name: true, id: true } } },
        orderBy: { placedAt: 'desc' },
        take: 100
      })
    ]);
    
    const totalFanPool = fanBets.reduce((sum, bet) => sum + bet.amount, 0);
    
    res.json({
      success: true,
      data: {
        playerBets,
        fanBets,
        totalFanPool
      }
    });
  } catch (error) {
    next(error);
  }
};