import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePlayer } from '../middleware/roleCheck.js';
import { createMatch, joinMatch, placePlayerBet, getMatchDetails, getLiveMatches } from '../controllers/matchController.js';
import { validate, createMatchSchema, placeBetSchema } from '../middleware/validation.js';

const router = express.Router();

router.use(protect);

router.get('/live', getLiveMatches);
router.get('/:matchId', getMatchDetails);

// Player-only routes
router.post('/create', requirePlayer, validate(createMatchSchema), createMatch);
router.post('/join/:inviteCode', requirePlayer, joinMatch);
router.post('/:matchId/bet', requirePlayer, validate(placeBetSchema), placePlayerBet);

export default router;