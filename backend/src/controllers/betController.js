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
        include: { player: { select: { name: true } } }
      }),
      prisma.fanBet.findMany({
        where: { matchId },
        include: { fan: { select: { name: true } } },
        take: 50
      })
    ]);
    
    res.json({
      success: true,
      data: { playerBets, fanBets, totalFanPool: fanBets.reduce((sum, b) => sum + b.amount, 0) }
    });
  } catch (error) {
    next(error);
  }
};