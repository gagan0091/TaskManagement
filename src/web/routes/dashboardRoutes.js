const express = require("express");
const { apiRequest } = require("../apiClient");
const { webAuth } = require("../middleware/webAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { ROLES } = require("../../config/constants");

const router = express.Router();

router.get("/dashboard", webAuth, asyncHandler(async (req, res) => {
    const isAdmin = req.user.role === ROLES.ADMIN;

    const tasksResult = await apiRequest(req, "GET", "/api/tasks?limit=5");

    let lowStock = [];
    let taskAnalytics = null;

    if (isAdmin) {
        const [materialsResult, analyticsResult] = await Promise.all([
            apiRequest(req, "GET", "/api/inventory?lowStock=true&limit=5"),
            apiRequest(req, "GET", "/api/analytics/tasks")
        ]);

        lowStock = materialsResult.data;
        taskAnalytics = analyticsResult.data;
    }

    res.render("dashboard", {
        title: "Dashboard",
        tasks: tasksResult.data,
        lowStock,
        taskAnalytics,
        isAdmin
    });
}));

module.exports = router;
