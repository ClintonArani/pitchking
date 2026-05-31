import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/roleCheck.js';
import {
  getAllUsers,
  getAllMatches,
  getWithdrawalRequests,
  approveWithdrawal,
  rejectWithdrawal,
  getRevenueStats,
  adminWithdraw
} from '../controllers/adminController.js';

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/users', getAllUsers);
router.get('/matches', getAllMatches);
router.get('/withdrawals', getWithdrawalRequests);
router.post('/withdrawals/:requestId/approve', approveWithdrawal);
router.post('/withdrawals/:requestId/reject', rejectWithdrawal);
router.get('/revenue', getRevenueStats);
router.post('/withdraw', adminWithdraw);

export default router;