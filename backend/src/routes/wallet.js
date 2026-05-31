import express from 'express';
import { protect } from '../middleware/auth.js';
import { getBalance, deposit, requestWithdrawal, getTransactions } from '../controllers/walletController.js';
import { validate, depositSchema, withdrawSchema } from '../middleware/validation.js';

const router = express.Router();

router.use(protect);

router.get('/balance', getBalance);
router.post('/deposit', validate(depositSchema), deposit);
router.post('/withdraw', validate(withdrawSchema), requestWithdrawal);
router.get('/transactions', getTransactions);

export default router;