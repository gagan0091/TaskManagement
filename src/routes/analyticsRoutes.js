const express = require("express");

const {
    getInventoryAnalytics,
    getProductionAnalytics,
    getMaterialUsageByProduct,
    getTaskAnalytics
} = require("../controllers/analyticsController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get("/inventory", getInventoryAnalytics);

router.get("/production", getProductionAnalytics);

router.get("/material-usage", getMaterialUsageByProduct);

router.get("/tasks", getTaskAnalytics);

module.exports = router;
