/**
 * @fileoverview Notification System Controller
 * 
 * This controller provides endpoints for the notification system, including re-engagement campaigns
 * and other notification-related functionality.
 * 
 * Current endpoints:
 * - GET /api/notification-system/inactive-users/:nDays - Get users registered exactly N days ago who are inactive
 * - GET /api/notification-system/inactive-users?startDays=X&endDays=Y - Get users registered between X and Y days ago who are inactive
 * - GET /api/notification-system/users-without-evaluations/:nDays? - Get users who don't have any evaluations configured
 * - GET /api/notification-system/users-with-optimized-prompts - Get users who have optimized prompts and send notification emails
 * 
 * Inactive users are defined as users whose companies have no agents created.
 * Users without evaluations are users whose models don't have any entries in ModelEvaluationPrompts table.
 * 
 * Example usage:
 * - GET /api/notification-system/inactive-users/5 - Get users registered exactly 5 days ago with no agents
 * - GET /api/notification-system/inactive-users?startDays=3&endDays=7 - Get users registered between 3-7 days ago with no agents
 * - GET /api/notification-system/users-without-evaluations - Get all users without evaluations
 * - GET /api/notification-system/users-without-evaluations/7 - Get users without evaluations registered in the last 7 days
 * - GET /api/notification-system/users-with-optimized-prompts - Get all users with optimized prompts and send notification emails
 * 
 * Response format includes:
 * - List of users with company information
 * - Metrics about total users vs target users
 * - Adoption/inactivity rate percentages
 * 
 * Future endpoints can be added here for:
 * - Email notifications
 * - Push notifications
 * - SMS notifications
 * - Webhook notifications
 * - etc.
 */

import db from '../../models/index.js';
import { Op } from 'sequelize';
import { sendBulkReEngagementEmails, sendBulkEvaluationStepEmails, sendBulkOptimizationAvailableEmails } from '../services/emailService.js';

const { User, Company, Agent, sequelize, Email } = db;

/**
 * Get completely inactive users (users without any agents or logs) registered in the last N days
 * Uses GET with URL parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getInactiveUsers = async (req, res) => {
  try {
    const { nDays } = req.params;
    
    // Validate nDays parameter
    const days = parseInt(nDays);
    if (isNaN(days) || days < 0) {
      return res.status(400).json({ 
        error: 'Invalid nDays parameter. Must be a positive number.' 
      });
    }

    // Calculate date range for users registered from N days ago until now
    const endDate = new Date(); // Now
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0); // Start of day N days ago

    console.log('Finding inactive users for date range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysRange: days,
      description: `From ${days} days ago until now`
    });

    // Get all users registered from N days ago until now
    const usersRegisteredInRange = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        deletedAt: null // Only active users
      },
      include: [
        {
          model: Company,
          required: true,
          where: {
            deletedAt: null // Only active companies
          },
          attributes: ['id', 'name', 'testMode']
        }
      ],
      attributes: [
        'id', 
        'firstName', 
        'lastName', 
        'email', 
        'createdAt', 
        'lastLoginAt',
        'companyId'
      ]
    });

    if (usersRegisteredInRange.length === 0) {
      return res.status(200).json({
        message: `No users found registered in the last ${days} days`,
        inactiveUsers: [],
        totalCount: 0,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0],
          days: days
        }
      });
    }

    console.log(`Found ${usersRegisteredInRange.length} users registered in the last ${days} days`);

    // Extract company IDs from the users
    const companyIds = [...new Set(usersRegisteredInRange.map(user => user.companyId))];

    // 1. Find companies that have agents (any agents = activity)
    const companiesWithAgents = await Agent.findAll({
      where: {
        companyId: {
          [Op.in]: companyIds
        },
        deletedAt: null
      },
      attributes: ['companyId'],
      group: ['companyId'],
      raw: true
    });

    const companyIdsWithAgents = new Set(
      companiesWithAgents.map(agent => agent.companyId)
    );

    console.log(`Found ${companyIdsWithAgents.size} companies with agents`);

    // 2. Find companies that have agent logs (any agent activity = not inactive)
    const companiesWithAgentLogs = await sequelize.query(`
      SELECT DISTINCT a.company_id as companyId
      FROM "Agents" a
      INNER JOIN "AgentLogs" al ON a.id = al.agent_id
      WHERE a.company_id IN (:companyIds)
        AND a.deleted_at IS NULL
        AND al.deleted_at IS NULL
    `, {
      replacements: { companyIds: companyIds },
      type: sequelize.QueryTypes.SELECT
    });

    const companyIdsWithAgentLogs = new Set(
      companiesWithAgentLogs.map(item => item.companyid || item.companyId)
    );

    console.log(`Found ${companyIdsWithAgentLogs.size} companies with agent logs`);

    // 3. Find companies that have model logs (any model activity = not inactive)
    const companiesWithModelLogs = await sequelize.query(`
      SELECT DISTINCT mg.company_id as companyId
      FROM "ModelGroups" mg
      INNER JOIN "Models" m ON mg.id = m.model_group_id
      INNER JOIN "ModelLogs" ml ON m.id = ml.model_id
      WHERE mg.company_id IN (:companyIds)
        AND mg.deleted_at IS NULL
        AND m.deleted_at IS NULL
        AND ml.deleted_at IS NULL
    `, {
      replacements: { companyIds: companyIds },
      type: sequelize.QueryTypes.SELECT
    });

    const companyIdsWithModelLogs = new Set(
      companiesWithModelLogs.map(item => item.companyid || item.companyId)
    );

    console.log(`Found ${companyIdsWithModelLogs.size} companies with model logs`);

    // 4. Combine all active company IDs (companies with ANY activity)
    const allActiveCompanyIds = new Set([
      ...companyIdsWithAgents,
      ...companyIdsWithAgentLogs,
      ...companyIdsWithModelLogs
    ]);

    console.log(`Total companies with any activity: ${allActiveCompanyIds.size}`);

    // 5. Filter users whose companies have NO activity at all
    const completelyInactiveUsers = usersRegisteredInRange.filter(user => 
      !allActiveCompanyIds.has(user.companyId)
    );

    console.log(`Found ${completelyInactiveUsers.length} completely inactive users`);

    // Format the response
    const formattedInactiveUsers = completelyInactiveUsers.map(user => {
      const daysSinceRegistration = Math.floor(
        (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        registeredAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.Company.id,
          name: user.Company.name,
          testMode: user.Company.testMode
        },
        daysSinceRegistration: daysSinceRegistration,
        activityStatus: 'completely_inactive' // No agents, no logs, no activity at all
      };
    });

    // Send re-engagement emails to all inactive users
    let emailResults = {
      sent: 0,
      failed: 0,
      errors: []
    };

    if (completelyInactiveUsers.length > 0) {
      try {
        console.log(`📧 Sending re-engagement emails to ${completelyInactiveUsers.length} inactive users`);
        
        // Prepare user data for email sending
        const emailCandidates = formattedInactiveUsers.map(user => ({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          daysSinceRegistration: user.daysSinceRegistration
        }));

        // Send bulk re-engagement emails
        emailResults = await sendBulkReEngagementEmails({
          inactiveUsers: emailCandidates,
          quickstartUrl: 'https://docs.handit.ai/quickstart',
          Email,
          User,
          notificationSource: 'inactive_users_notification'
        });

        console.log(`✅ Email campaign completed: ${emailResults.sent} sent, ${emailResults.failed} failed`);
      } catch (emailError) {
        console.error('❌ Error sending re-engagement emails:', emailError);
        emailResults.failed = completelyInactiveUsers.length;
        emailResults.errors.push({
          message: 'Failed to send bulk emails',
          error: emailError.message
        });
      }
    }

    return res.status(200).json({
      message: `Found ${completelyInactiveUsers.length} completely inactive users registered in the last ${days} days`,
      description: 'These users have no agents, no agent logs, and no model logs - zero platform activity',
      inactiveUsers: formattedInactiveUsers,
      totalCount: completelyInactiveUsers.length,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: days,
        description: `From ${days} days ago until now`
      },
      totalUsersRegisteredInRange: usersRegisteredInRange.length,
      activityBreakdown: {
        companiesWithAgents: companyIdsWithAgents.size,
        companiesWithAgentLogs: companyIdsWithAgentLogs.size,
        companiesWithModelLogs: companyIdsWithModelLogs.size,
        totalActiveCompanies: allActiveCompanyIds.size,
        totalCompanies: companyIds.length
      },
      metrics: {
        totalRegistered: usersRegisteredInRange.length,
        completelyInactive: completelyInactiveUsers.length,
        hasAnyActivity: usersRegisteredInRange.length - completelyInactiveUsers.length,
        completeInactivityRate: ((completelyInactiveUsers.length / usersRegisteredInRange.length) * 100).toFixed(2) + '%'
      },
      emailCampaign: {
        sent: emailResults.sent,
        failed: emailResults.failed,
        errors: emailResults.errors,
        campaignExecuted: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error in getInactiveUsers:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Get inactive users within a date range for bulk re-engagement campaigns
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getInactiveUsersRange = async (req, res) => {
  try {
    const { startDays, endDays } = req.query;
    
    // Validate parameters
    const start = parseInt(startDays) || 1;
    const end = parseInt(endDays) || 7;
    
    if (start < 0 || end < 0 || start > end) {
      return res.status(400).json({ 
        error: 'Invalid date range. startDays and endDays must be positive and startDays <= endDays.' 
      });
    }

    // Calculate date range
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - start);
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - end);
    startDate.setHours(0, 0, 0, 0);

    // Get all users registered in the date range
    const usersInRange = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        deletedAt: null
      },
      include: [
        {
          model: Company,
          required: true,
          where: {
            deletedAt: null
          },
          attributes: ['id', 'name', 'testMode']
        }
      ],
      attributes: [
        'id', 
        'firstName', 
        'lastName', 
        'email', 
        'createdAt', 
        'lastLoginAt',
        'companyId'
      ],
      order: [['createdAt', 'DESC']]
    });

    if (usersInRange.length === 0) {
      return res.status(200).json({
        message: `No users found registered between ${start} and ${end} days ago`,
        inactiveUsers: [],
        totalCount: 0,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      });
    }

    // Extract company IDs
    const companyIds = [...new Set(usersInRange.map(user => user.companyId))];

    // Find companies with agents
    const companiesWithAgents = await Agent.findAll({
      where: {
        companyId: {
          [Op.in]: companyIds
        },
        deletedAt: null
      },
      attributes: ['companyId'],
      group: ['companyId'],
      raw: true
    });

    const companyIdsWithAgents = new Set(
      companiesWithAgents.map(agent => agent.companyId)
    );

    // Filter inactive users
    const inactiveUsers = usersInRange.filter(user => 
      !companyIdsWithAgents.has(user.companyId)
    );

    // Format response with additional metrics
    const formattedInactiveUsers = inactiveUsers.map(user => {
      const daysSinceRegistration = Math.floor(
        (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        registeredAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.Company.id,
          name: user.Company.name,
          testMode: user.Company.testMode
        },
        daysSinceRegistration
      };
    });

    return res.status(200).json({
      message: `Found ${inactiveUsers.length} inactive users registered between ${start} and ${end} days ago`,
      inactiveUsers: formattedInactiveUsers,
      totalCount: inactiveUsers.length,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        startDays: start,
        endDays: end
      },
      metrics: {
        totalRegistered: usersInRange.length,
        inactive: inactiveUsers.length,
        active: usersInRange.length - inactiveUsers.length,
        inactivityRate: ((inactiveUsers.length / usersInRange.length) * 100).toFixed(2) + '%'
      }
    });

  } catch (error) {
    console.error('Error in getInactiveUsersRange:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}; 

/**
 * Debug endpoint to check what users exist in the database
 * Uses GET with URL parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const debugUsers = async (req, res) => {
  try {
    const { nDays } = req.params;
    const days = parseInt(nDays) || 5;

    // Calculate date range for users registered exactly N days ago
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    
    // Start of the target day (00:00:00)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    // End of the target day (23:59:59.999)
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('Debug - Date Range:', {
      targetDate: targetDate.toISOString(),
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
      daysAgo: days
    });

    // Check total users in database
    const totalUsers = await User.count();
    
    // Check users created in the last 30 days
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    const recentUsers = await User.findAll({
      where: {
        createdAt: {
          [Op.gte]: last30Days
        },
        deletedAt: null
      },
      attributes: ['id', 'email', 'createdAt', 'companyId'],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Get users for specific date
    const usersOnTargetDate = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [startOfDay, endOfDay]
        },
        deletedAt: null
      },
      include: [
        {
          model: Company,
          required: false, // Changed to left join to see users without companies
          attributes: ['id', 'name', 'testMode']
        }
      ],
      attributes: ['id', 'email', 'firstName', 'lastName', 'createdAt', 'companyId']
    });

    return res.status(200).json({
      debug: true,
      dateRange: {
        targetDate: targetDate.toISOString().split('T')[0],
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
        daysAgo: days
      },
      statistics: {
        totalUsersInDatabase: totalUsers,
        recentUsersCount: recentUsers.length,
        usersOnTargetDate: usersOnTargetDate.length
      },
      recentUsers: recentUsers.map(user => ({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        companyId: user.companyId,
        daysAgo: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24))
      })),
      usersOnTargetDate: usersOnTargetDate.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt,
        companyId: user.companyId,
        company: user.Company
      }))
    });

  } catch (error) {
    console.error('Error in debugUsers:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: error.stack
    });
  }
}; 

/**
 * Test endpoint - Get inactive users from the last N days (not exact day)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getInactiveUsersTest = async (req, res) => {
  try {
    const { nDays } = req.params;
    
    // Validate nDays parameter
    const days = parseInt(nDays);
    if (isNaN(days) || days < 0) {
      return res.status(400).json({ 
        error: 'Invalid nDays parameter. Must be a positive number.' 
      });
    }

    // Calculate date range for users registered in the last N days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    console.log('Test - Date Range:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      daysRange: days
    });

    // Get all users registered in the last N days
    const usersInRange = await User.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
        deletedAt: null
      },
      include: [
        {
          model: Company,
          required: true,
          where: {
            deletedAt: null
          },
          attributes: ['id', 'name', 'testMode']
        }
      ],
      attributes: [
        'id', 
        'firstName', 
        'lastName', 
        'email', 
        'createdAt', 
        'lastLoginAt',
        'companyId'
      ]
    });

    if (usersInRange.length === 0) {
      return res.status(200).json({
        message: `No users found registered in the last ${days} days`,
        inactiveUsers: [],
        totalCount: 0,
        dateRange: {
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }
      });
    }

    // Extract company IDs from the users
    const companyIds = [...new Set(usersInRange.map(user => user.companyId))];

    // Find companies that have agents
    const companiesWithAgents = await Agent.findAll({
      where: {
        companyId: {
          [Op.in]: companyIds
        },
        deletedAt: null
      },
      attributes: ['companyId'],
      group: ['companyId'],
      raw: true
    });

    // Extract company IDs that have agents
    const companyIdsWithAgents = new Set(
      companiesWithAgents.map(agent => agent.companyId)
    );

    // Filter users whose companies don't have agents (inactive users)
    const inactiveUsers = usersInRange.filter(user => 
      !companyIdsWithAgents.has(user.companyId)
    );

    // Format the response
    const formattedInactiveUsers = inactiveUsers.map(user => {
      const daysSinceRegistration = Math.floor(
        (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        registeredAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.Company.id,
          name: user.Company.name,
          testMode: user.Company.testMode
        },
        daysSinceRegistration
      };
    });

    return res.status(200).json({
      message: `Found ${inactiveUsers.length} inactive users registered in the last ${days} days`,
      inactiveUsers: formattedInactiveUsers,
      totalCount: inactiveUsers.length,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        daysRange: days
      },
      totalUsersInRange: usersInRange.length,
      metrics: {
        totalRegistered: usersInRange.length,
        inactive: inactiveUsers.length,
        active: usersInRange.length - inactiveUsers.length,
        inactivityRate: ((inactiveUsers.length / usersInRange.length) * 100).toFixed(2) + '%'
      }
    });

  } catch (error) {
    console.error('Error in getInactiveUsersTest:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
};

/**
 * Get users who don't have any evaluations configured
 * Returns users whose models don't have any entries in ModelEvaluationPrompts table
 * Optionally filter by registration date range (N days ago until now)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUsersWithoutEvaluations = async (req, res) => {
  try {
    const { nDays } = req.params;
    
    // Build date filter if nDays is provided
    let dateFilter = { deletedAt: null };
    let dateRangeInfo = null;
    
    if (nDays) {
      const days = parseInt(nDays);
      if (isNaN(days) || days < 0) {
        return res.status(400).json({ 
          error: 'Invalid nDays parameter. Must be a positive number.' 
        });
      }
      
      // Calculate date range for users registered from N days ago until now
      const endDate = new Date(); // Now
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0); // Start of day N days ago
      
      dateFilter.createdAt = {
        [Op.between]: [startDate, endDate]
      };
      
      dateRangeInfo = {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days: days,
        description: `From ${days} days ago until now`
      };
      
      console.log(`🔍 Finding users without evaluations registered in the last ${days} days...`);
    } else {
      console.log('🔍 Finding all users without evaluations...');
    }

    // Get users with optional date filtering
    const allUsers = await User.findAll({
      where: dateFilter,
      include: [
        {
          model: Company,
          required: true,
          where: {
            deletedAt: null
          },
          attributes: ['id', 'name', 'testMode']
        }
      ],
      attributes: [
        'id', 
        'firstName', 
        'lastName', 
        'email', 
        'createdAt', 
        'lastLoginAt',
        'companyId'
      ],
      order: [['createdAt', 'DESC']]
    });

    if (allUsers.length === 0) {
      const message = nDays 
        ? `No users found registered in the last ${nDays} days`
        : 'No users found in the database';
      
      return res.status(200).json({
        message,
        usersWithoutEvaluations: [],
        totalCount: 0,
        ...(dateRangeInfo && { dateRange: dateRangeInfo })
      });
    }

    console.log(`📊 Found ${allUsers.length} total users`);

    // Extract company IDs from all users
    const companyIds = [...new Set(allUsers.map(user => user.companyId))];
    console.log(`🏢 Found ${companyIds.length} unique companies`);

    // Find companies that have models with evaluations using raw SQL for better performance
    const companiesWithEvaluations = await sequelize.query(`
      SELECT DISTINCT mg.company_id as companyId
      FROM "ModelGroups" mg
      INNER JOIN "Models" m ON mg.id = m.model_group_id
      INNER JOIN "ModelEvaluationPrompts" mep ON m.id = mep.model_id
      WHERE mg.company_id IN (:companyIds)
        AND mg.deleted_at IS NULL
        AND m.deleted_at IS NULL
    `, {
      replacements: { companyIds: companyIds },
      type: sequelize.QueryTypes.SELECT
    });

    const companyIdsWithEvaluations = new Set(
      companiesWithEvaluations.map(item => item.companyid || item.companyId)
    );

    console.log(`✅ Found ${companyIdsWithEvaluations.size} companies with evaluations`);

    // Filter users whose companies don't have any evaluations
    const usersWithoutEvaluations = allUsers.filter(user => 
      !companyIdsWithEvaluations.has(user.companyId)
    );

    console.log(`🎯 Found ${usersWithoutEvaluations.length} users without evaluations`);

    // Format the response with additional information
    const formattedUsers = usersWithoutEvaluations.map(user => {
      const daysSinceRegistration = Math.floor(
        (new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)
      );
      
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        registeredAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        company: {
          id: user.Company.id,
          name: user.Company.name,
          testMode: user.Company.testMode
        },
        daysSinceRegistration,
        evaluationStatus: 'no_evaluations'
      };
    });

    // Calculate additional metrics
    const usersWithEvaluations = allUsers.length - usersWithoutEvaluations.length;
    const evaluationAdoptionRate = ((usersWithEvaluations / allUsers.length) * 100).toFixed(2);

    // Send evaluation setup emails to all users without evaluations
    let emailResults = {
      sent: 0,
      failed: 0,
      errors: []
    };

    if (usersWithoutEvaluations.length > 0) {
      try {
        console.log(`📧 Sending evaluation setup emails to ${usersWithoutEvaluations.length} users without evaluations`);
        
        // Send bulk evaluation setup emails
        emailResults = await sendBulkEvaluationStepEmails({
          usersWithoutEvaluations: formattedUsers,
          Email,
          User,
          notificationSource: 'users_without_evaluations_notification'
        });

        console.log(`✅ Email campaign completed: ${emailResults.sent} sent, ${emailResults.failed} failed`);
      } catch (emailError) {
        console.error('❌ Error sending evaluation setup emails:', emailError);
        emailResults.failed = usersWithoutEvaluations.length;
        emailResults.errors.push({
          message: 'Failed to send bulk emails',
          error: emailError.message
        });
      }
    }

    // Build dynamic message based on date filtering
    const message = nDays 
      ? `Found ${usersWithoutEvaluations.length} users without evaluations registered in the last ${nDays} days`
      : `Found ${usersWithoutEvaluations.length} users without any evaluations configured`;
    
    const description = nDays
      ? `These users registered in the last ${nDays} days and have no models with evaluations in the ModelEvaluationPrompts table`
      : 'These users have no models with evaluations in the ModelEvaluationPrompts table';

    return res.status(200).json({
      message,
      description,
      usersWithoutEvaluations: formattedUsers,
      totalCount: usersWithoutEvaluations.length,
      ...(dateRangeInfo && { dateRange: dateRangeInfo }),
      metrics: {
        totalUsers: allUsers.length,
        usersWithoutEvaluations: usersWithoutEvaluations.length,
        usersWithEvaluations: usersWithEvaluations,
        evaluationAdoptionRate: evaluationAdoptionRate + '%',
        companiesWithEvaluations: companyIdsWithEvaluations.size,
        totalCompanies: companyIds.length
      },
      emailCampaign: {
        sent: emailResults.sent,
        failed: emailResults.failed,
        errors: emailResults.errors,
        campaignExecuted: true,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in getUsersWithoutEvaluations:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}; 

/**
 * Get users who have optimized prompts with full details and send notification emails
 * Returns details of optimized prompts including all parameters from ModelVersions
 * Also sends optimization available emails to all users with optimized prompts
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUsersWithOptimizedPrompts = async (req, res) => {
  try {
    console.log('🔍 Getting users with optimized prompts...');

    // Get all ABTestModels that have optimized_model_version_id
    const usersWithOptimizedPrompts = await sequelize.query(`
      SELECT DISTINCT
        u.id as user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.created_at as user_registered_at,
        u.last_login_at as user_last_login_at,
        c.id as company_id,
        c.name as company_name,
        c.test_mode as company_test_mode,
        m.id as model_id,
        m.name as model_name,
        m.type as model_type,
        om.id as optimized_model_id,
        om.name as optimized_model_name,
        mv.id as optimized_version_id,
        mv.version as optimized_version_number,
        mv.parameters::text as optimized_parameters,
        mv.active_version as is_active_optimized_version,
        mv.created_at as optimized_version_created_at,
        ab.id as ab_test_id,
        ab.principal as is_principal_test,
        ab.percentage as test_percentage,
        ab.created_at as ab_test_created_at
      FROM "ABTestModels" ab
      INNER JOIN "Models" m ON ab.model_id = m.id
      INNER JOIN "Models" om ON ab.optimized_model_id = om.id
      INNER JOIN "ModelVersions" mv ON ab.optimized_model_version_id = mv.id
      INNER JOIN "ModelGroups" mg ON m.model_group_id = mg.id
      INNER JOIN "Companies" c ON mg.company_id = c.id
      INNER JOIN "Users" u ON c.id = u.company_id
      WHERE ab.optimized_model_version_id IS NOT NULL
        AND ab.deleted_at IS NULL
        AND m.deleted_at IS NULL
        AND om.deleted_at IS NULL
        AND mv.deleted_at IS NULL
        AND mg.deleted_at IS NULL
        AND c.deleted_at IS NULL
        AND u.deleted_at IS NULL
      ORDER BY ab.created_at DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`✅ Found ${usersWithOptimizedPrompts.length} records with optimized prompts`);

    // Group by user to avoid duplicates and structure the response
    const userMap = new Map();
    
    usersWithOptimizedPrompts.forEach(record => {
      const userId = record.user_id;
      
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          user: {
            id: record.user_id,
            name: record.user_name,
            firstName: record.user_first_name,
            lastName: record.user_last_name,
            email: record.user_email,
            registeredAt: record.user_registered_at,
            lastLoginAt: record.user_last_login_at
          },
          company: {
            id: record.company_id,
            name: record.company_name,
            testMode: record.company_test_mode
          },
          optimizedPrompts: []
        });
      }
      
      const userData = userMap.get(userId);
      
      // Parse the parameters JSON if it exists
      let parsedParameters = null;
      try {
        parsedParameters = record.optimized_parameters ? JSON.parse(record.optimized_parameters) : null;
      } catch (e) {
        console.warn(`⚠️ Failed to parse parameters for version ${record.optimized_version_id}:`, e);
        parsedParameters = record.optimized_parameters;
      }
      
      userData.optimizedPrompts.push({
        abTest: {
          id: record.ab_test_id,
          isPrincipal: record.is_principal_test,
          percentage: record.test_percentage,
          createdAt: record.ab_test_created_at
        },
        originalModel: {
          id: record.model_id,
          name: record.model_name,
          type: record.model_type
        },
        optimizedModel: {
          id: record.optimized_model_id,
          name: record.optimized_model_name
        },
        optimizedVersion: {
          id: record.optimized_version_id,
          versionNumber: record.optimized_version_number,
          isActive: record.is_active_optimized_version,
          createdAt: record.optimized_version_created_at,
          parameters: parsedParameters,
          // Extract specific fields from parameters for easy access
          optimizedPrompt: parsedParameters?.prompt || null,
          allParameters: parsedParameters
        }
      });
    });

    const result = Array.from(userMap.values());

    // Create a simplified users list similar to usersWithoutEvaluations format
    const usersWithOptimizedPromptsList = result.map(userData => {
      const registrationDate = userData.user.registeredAt ? new Date(userData.user.registeredAt) : null;
      const daysSinceRegistration = registrationDate ? 
        Math.floor((new Date() - registrationDate) / (1000 * 60 * 60 * 24)) : 0;

      return {
        id: userData.user.id,
        firstName: userData.user.firstName || '',
        lastName: userData.user.lastName || '',
        email: userData.user.email,
        registeredAt: userData.user.registeredAt,
        lastLoginAt: userData.user.lastLoginAt,
        company: {
          id: userData.company.id,
          name: userData.company.name,
          testMode: userData.company.testMode || false
        },
        daysSinceRegistration,
        evaluationStatus: "has_optimized_prompts",
        totalOptimizedPrompts: userData.optimizedPrompts.length,
        activeOptimizedPrompts: userData.optimizedPrompts.filter(p => p.optimizedVersion.isActive).length
      };
    });

    // Generate summary statistics
    const summary = {
      totalUsers: result.length,
      totalOptimizedPrompts: usersWithOptimizedPrompts.length,
      uniqueCompanies: new Set(result.map(r => r.company.id)).size,
      activeOptimizedVersions: usersWithOptimizedPrompts.filter(r => r.is_active_optimized_version).length,
      principalTests: usersWithOptimizedPrompts.filter(r => r.is_principal_test).length
    };

    console.log('📊 Summary:', summary);

    // Send optimization available emails to all users
    let emailResults = null;
    try {
      console.log('📧 Sending optimization available emails...');
      emailResults = await sendBulkOptimizationAvailableEmails({
        usersWithOptimizedPrompts: usersWithOptimizedPromptsList,
        Email,
        User,
        notificationSource: 'optimization_available_bulk'
      });
      console.log(`✅ Email campaign completed: ${emailResults.sent} sent, ${emailResults.failed} failed`);
    } catch (emailError) {
      console.error('❌ Error sending optimization emails:', emailError);
      emailResults = {
        sent: 0,
        failed: usersWithOptimizedPromptsList.length,
        errors: [{ error: emailError.message }]
      };
    }

    return res.status(200).json({
      success: true,
      message: `Found ${result.length} users with optimized prompts`,
      summary,
      usersWithOptimizedPrompts: usersWithOptimizedPromptsList,
      emailResults,
      data: result
    });

  } catch (error) {
    console.error('❌ Error in getUsersWithOptimizedPrompts:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}; 