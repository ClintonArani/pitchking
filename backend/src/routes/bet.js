import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireFan } from '../middleware/roleCheck.js';
import { placeFanBet, getMatchBets } from '../controllers/betController.js';
import { validate, fanBetSchema } from '../middleware/validation.js';

const router = express.Router();

router.use(protect);

router.post('/fan', requireFan, validate(fanBetSchema), placeFanBet);
router.get('/match/:matchId', getMatchBets);

export default router;