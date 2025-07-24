import express from 'express';
import { 
  getInactiveUsers, 
  getInactiveUsersRange,
  debugUsers,
  getInactiveUsersTest,
  getUsersWithoutEvaluations,
  getUsersWithOptimizedPrompts
} from '../controllers/notificationSystemController.js';

const router = express.Router();

// Debug endpoint to troubleshoot user queries
router.get('/debug-users/:nDays', debugUsers);

// Test endpoint - Get inactive users from the last N days (broader range)
router.get('/test-inactive-users/:nDays', getInactiveUsersTest);

// Get completely inactive users registered exactly N days ago
router.get('/inactive-users/:nDays', getInactiveUsers);

// Get inactive users registered within a date range
router.get('/inactive-users', getInactiveUsersRange);

// Get users who don't have any evaluations configured
router.get('/users-without-evaluations/:nDays?', getUsersWithoutEvaluations);

// Get users who have optimized prompts with full details
router.get('/users-with-optimized-prompts', getUsersWithOptimizedPrompts);

export default router; 