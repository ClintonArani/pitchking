import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt.js';
import prisma from '../config/database.js';
import { MatchEngine } from './matchEngine.js';
import logger from '../utils/logger.js';

const activeMatches = new Map(); // matchId -> MatchEngine instance
const userSockets = new Map(); // userId -> socket.id

export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true
    }
  });
  
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      
      const decoded = verifyToken(token);
      if (!decoded) return next(new Error('Invalid token'));
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true }
      });
      
      if (!user) return next(new Error('User not found'));
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });
  
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.user.id} (${socket.user.role})`);
    userSockets.set(socket.user.id, socket.id);
    
    // Join match as player or observer
    socket.on('join-match', async (data) => {
      const { matchId, role } = data; // role: 'player1', 'player2', 'fan'
      
      const match = await prisma.match.findUnique({
        where: { id: matchId }
      });
      
      if (!match) {
        socket.emit('error', { message: 'Match not found' });
        return;
      }
      
      socket.join(`match:${matchId}`);
      
      if (role === 'player1' && match.player1Id === socket.user.id) {
        socket.emit('match-joined', { matchId, side: 'left', role: 'player' });
        
        // Initialize match engine if both players ready
        if (!activeMatches.has(matchId)) {
          const matchEngine = new MatchEngine(matchId, io);
          activeMatches.set(matchId, matchEngine);
          
          // Check if second player is connected
          const player2Socket = userSockets.get(match.player2Id);
          if (player2Socket) {
            matchEngine.start();
          }
        } else {
          const matchEngine = activeMatches.get(matchId);
          if (matchEngine && match.player2Id) {
            const player2Socket = userSockets.get(match.player2Id);
            if (player2Socket) matchEngine.start();
          }
        }
      } 
      else if (role === 'player2' && match.player2Id === socket.user.id) {
        socket.emit('match-joined', { matchId, side: 'right', role: 'player' });
        
        if (!activeMatches.has(matchId)) {
          const matchEngine = new MatchEngine(matchId, io);
          activeMatches.set(matchId, matchEngine);
          
          const player1Socket = userSockets.get(match.player1Id);
          if (player1Socket) matchEngine.start();
        }
      } 
      else {
        // Fan/observer
        socket.emit('match-joined', { matchId, role: 'observer' });
        
        // If match engine exists, send current state
        const matchEngine = activeMatches.get(matchId);
        if (matchEngine) {
          socket.emit('game-state', matchEngine.getState());
        }
      }
    });
    
    // Handle player input
    socket.on('player-input', (data) => {
      const { matchId, input } = data;
      const matchEngine = activeMatches.get(matchId);
      
      if (matchEngine) {
        matchEngine.handleInput(socket.user.id, input);
      }
    });
    
    // Leave match
    socket.on('leave-match', (matchId) => {
      socket.leave(`match:${matchId}`);
    });
    
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.user.id}`);
      userSockets.delete(socket.user.id);
      
      // Clean up matches where player disconnected
      for (const [matchId, engine] of activeMatches.entries()) {
        if (engine.player1Id === socket.user.id || engine.player2Id === socket.user.id) {
          engine.handleDisconnect(socket.user.id);
          activeMatches.delete(matchId);
        }
      }
    });
  });
  
  return io;
};