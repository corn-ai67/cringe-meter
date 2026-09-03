/**
 * CRINGE METER — Central Route Aggregator
 */

const express = require('express');
const router = express.Router();

const systemRoutes = require('./systemRoutes');
const authRoutes = require('./authRoutes');
const subscriptionRoutes = require('./subscriptionRoutes');
const leaderboardRoutes = require('./leaderboardRoutes');
const subscriberRoutes = require('./subscriberRoutes');
const safetyRoutes = require('./safetyRoutes');
const livekitRoutes = require('./livekitRoutes');

// Mount all feature route modules
router.use(systemRoutes);
router.use(authRoutes);
router.use(subscriptionRoutes);
router.use(leaderboardRoutes);
router.use(subscriberRoutes);
router.use(safetyRoutes);
router.use(livekitRoutes);

module.exports = router;
