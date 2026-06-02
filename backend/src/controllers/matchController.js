import prisma from '../config/database.js';
import { MatchService } from '../services/matchService.js';
import { BettingService } from '../services/bettingService.js';
import { MatchStatus } from '@prisma/client';

export const createMatch = async (req, res, next) => {
  try {
    const { opponentEmail, player1BetAmount, player1TeamId, player1Formation } = req.body;
    
    const result = await MatchService.createChallenge(
      req.user.id,
      player1BetAmount,
      player1TeamId,
      opponentEmail
    );
    
    res.status(201).json({
      success: true,
      message: 'Match created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const joinMatch = async (req, res, next) => {
  try {
    const { inviteCode } = req.params;
    const { player2TeamId, player2BetAmount, formation } = req.body;
    
    const match = await MatchService.joinMatch(
      inviteCode,
      req.user.id,
      player2TeamId,
      player2BetAmount
    );
    
    res.json({
      success: true,
      message: 'Joined match successfully',
      data: match
    });
  } catch (error) {
    next(error);
  }
};

export const placePlayerBet = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { amount } = req.body;
    
    const bet = await BettingService.placePlayerBet(matchId, req.user.id, amount);
    
    res.json({
      success: true,
      message: 'Bet placed successfully',
      data: bet
    });
  } catch (error) {
    // Send the actual error message
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getMatchDetails = async (req, res, next) => {
  try {
    const { matchId } = req.params;
    
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        player1: { select: { id: true, name: true, walletBalance: true } },
        player2: { select: { id: true, name: true, walletBalance: true } },
        player1Team: true,
        player2Team: true,
        playerBets: true,
        fanBets: { take: 100 },
        matchEvents: { orderBy: { minute: 'asc' } }
      }
    });
    
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    
    res.json({ success: true, data: match });
  } catch (error) {
    next(error);
  }
};

export const getLiveMatches = async (req, res, next) => {
  try {
    const matches = await prisma.match.findMany({
      where: {
        status: { in: [MatchStatus.STARTED, MatchStatus.BETTING] }
      },
      include: {
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        player1Team: true,
        player2Team: true
      },
      orderBy: { scheduledStart: 'asc' }
    });
    
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
};