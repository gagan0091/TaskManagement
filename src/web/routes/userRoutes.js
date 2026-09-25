const express = require("express");
const { apiRequest } = require("../apiClient");
const { webAuth, webAuthorize } = require("../middleware/webAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { ROLES } = require("../../config/constants");

const router = express.Router();

router.use(webAuth, webAuthorize(ROLES.ADMIN));

router.get("/admin/users", asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const result = await apiRequest(req, "GET", `/api/users?page=${page}&limit=10`);

    res.render("users/list", {
        title: "Users",
        users: result.data,
        pagination: result.pagination,
        ROLES
    });
}));

router.get("/admin/users/new", (req, res) => {
    res.render("users/new", { title: "New User", ROLES });
});

router.post("/admin/users", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        await apiRequest(req, "POST", "/api/users", { name, email, password, role });
        console.log("success", "User created successfully");
        res.redirect("/admin/users");
    } catch (error) {
        console.error("error", error.message);
        res.redirect("/admin/users/new");
    }
});

router.post("/admin/users/:id/role", async (req, res) => {
    try {
        await apiRequest(req, "PATCH", `/api/users/${req.params.id}/role`, { role: req.body.role });
        console.log("success", "Role updated successfully");
    } catch (error) {
        console.error("error", error.message);
    }
    res.redirect("/admin/users");
});

module.exports = router;
