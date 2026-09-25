const express = require("express");
const { apiRequest } = require("../apiClient");
const { webAuth, webAuthorize } = require("../middleware/webAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { ROLES } = require("../../config/constants");

const router = express.Router();

router.use(webAuth, webAuthorize(ROLES.ADMIN));

router.get("/admin/analytics", asyncHandler(async (req, res) => {
    const [inventory, production, materialUsage, tasks] = await Promise.all([
        apiRequest(req, "GET", "/api/analytics/inventory"),
        apiRequest(req, "GET", "/api/analytics/production"),
        apiRequest(req, "GET", "/api/analytics/material-usage"),
        apiRequest(req, "GET", "/api/analytics/tasks")
    ]);

    res.render("analytics/dashboard", {
        title: "Analytics",
        inventory: inventory.data,
        production: production.data,
        materialUsage: materialUsage.data,
        tasks: tasks.data
    });
}));

module.exports = router;
