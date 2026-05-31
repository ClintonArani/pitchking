import { BettingService } from '../services/bettingService.js';
import logger from '../utils/logger.js';

export class MatchEngine {
  constructor(matchId, io) {
    this.matchId = matchId;
    this.io = io;
    this.room = `match:${matchId}`;
    
    // Game state
    this.state = {
      status: 'waiting', // waiting, playing, halftime, finished
      time: 0, // seconds elapsed
      half: 1,
      score: { home: 0, away: 0 },
      ball: { x: 50, y: 50, possession: null },
      players: {
        left: { positions: [], inputs: {} },
        right: { positions: [], inputs: {} }
      },
      events: []
    };
    
    this.gameLoop = null;
    this.matchDuration = 480; // 8 minutes total (4 min per half) in seconds
    this.halfDuration = 240;
    
    // Input queue for each player
    this.inputQueue = {
      left: [],
      right: []
    };
    
    this.player1Id = null;
    this.player2Id = null;
  }
  
  async start() {
    // Get match details
    const match = await prisma.match.findUnique({
      where: { id: this.matchId },
      include: { player1: true, player2: true }
    });
    
    if (!match || !match.player2Id) {
      logger.error(`Match ${this.matchId} cannot start: missing player2`);
      return;
    }
    
    this.player1Id = match.player1Id;
    this.player2Id = match.player2Id;
    
    // Update match status in DB
    await prisma.match.update({
      where: { id: this.matchId },
      data: { status: 'STARTED', startedAt: new Date() }
    });
    
    this.state.status = 'playing';
    this.state.time = 0;
    
    // Broadcast initial state
    this.broadcastState();
    
    // Start game loop (60 FPS)
    this.gameLoop = setInterval(() => this.update(), 1000 / 60);
    
    // End match after duration
    setTimeout(() => this.endMatch(), this.matchDuration * 1000);
    
    logger.info(`Match ${this.matchId} started: ${this.player1Id} vs ${this.player2Id}`);
  }
  
  update() {
    if (this.state.status !== 'playing') return;
    
    this.state.time += 1 / 60; // increment by frame time (seconds)
    
    // Check half time
    if (this.state.time >= this.halfDuration && this.state.half === 1) {
      this.state.half = 2;
      this.state.status = 'halftime';
      this.broadcastState();
      
      // Resume after 5 seconds
      setTimeout(() => {
        if (this.state.status === 'halftime') {
          this.state.status = 'playing';
          this.broadcastState();
        }
      }, 5000);
    }
    
    // Process inputs and update game logic
    this.processInputs();
    this.updateBallAndPlayers();
    
    // Broadcast state every frame
    this.broadcastState();
  }
  
  processInputs() {
    // Simplified input processing: move players based on queued inputs
    // In production, implement proper physics and collision
    const leftInput = this.inputQueue.left.pop();
    const rightInput = this.inputQueue.right.pop();
    
    if (leftInput) {
      // Update left team positions based on input
      // (Left team moves right-wards, right team moves left-wards)
    }
    
    if (rightInput) {
      // Update right team
    }
  }
  
  updateBallAndPlayers() {
    // Simplified ball physics and collision
    // In production, implement proper game logic with:
    // - Player-ball collision
    // - Goal detection
    // - Fouls and offsides
    // - AI for uncontrolled players
    
    // Random goal generation for demo (remove in production)
    if (Math.random() < 0.001) { // 0.1% chance per frame ~ 6 goals per match max
      const scoringSide = Math.random() < 0.5 ? 'home' : 'away';
      this.state.score[scoringSide]++;
      
      const event = {
        type: 'goal',
        scorer: scoringSide === 'home' ? 'left' : 'right',
        minute: Math.floor(this.state.time / 60),
        half: this.state.half
      };
      this.state.events.push(event);
      this.broadcastEvent(event);
    }
  }
  
  handleInput(playerId, input) {
    if (playerId === this.player1Id) {
      this.inputQueue.left.push(input);
    } else if (playerId === this.player2Id) {
      this.inputQueue.right.push(input);
    }
  }
  
  handleDisconnect(playerId) {
    logger.info(`Player ${playerId} disconnected from match ${this.matchId}`);
    
    // Declare the disconnected player as loser
    const winnerId = playerId === this.player1Id ? this.player2Id : this.player1Id;
    this.endMatch(winnerId);
  }
  
  async endMatch(winnerId = null) {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    
    this.state.status = 'finished';
    
    // Determine winner if not provided
    if (!winnerId) {
      if (this.state.score.home > this.state.score.away) {
        winnerId = this.player1Id;
      } else if (this.state.score.away > this.state.score.home) {
        winnerId = this.player2Id;
      } else {
        // Draw - no winner? For betting, maybe no one wins? Spec says winner gets pool.
        // We'll pick random for demo
        winnerId = Math.random() < 0.5 ? this.player1Id : this.player2Id;
      }
    }
    
    const scoreString = `${this.state.score.home}-${this.state.score.away}`;
    
    // Update match in database
    await prisma.match.update({
      where: { id: this.matchId },
      data: {
        status: 'FINISHED',
        finishedAt: new Date(),
        score: scoreString,
        winnerId
      }
    });
    
    // Process payouts
    try {
      await BettingService.processMatchPayouts(this.matchId, winnerId);
    } catch (error) {
      logger.error(`Payout error for match ${this.matchId}:`, error);
    }
    
    // Broadcast final state
    this.broadcastState();
    
    logger.info(`Match ${this.matchId} ended. Winner: ${winnerId}, Score: ${scoreString}`);
  }
  
  broadcastState() {
    this.io.to(this.room).emit('game-state', {
      matchId: this.matchId,
      ...this.state
    });
  }
  
  broadcastEvent(event) {
    this.io.to(this.room).emit('match-event', event);
  }
  
  getState() {
    return {
      matchId: this.matchId,
      ...this.state
    };
  }
}