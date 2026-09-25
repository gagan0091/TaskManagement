const express = require("express");
const { apiRequest } = require("../apiClient");
const { webAuth, webAuthorize } = require("../middleware/webAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { ROLES } = require("../../config/constants");

const router = express.Router();

router.use(webAuth);

router.get("/tasks", asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const status = req.query.status || "";
    const qs = `page=${page}&limit=10${status ? `&status=${status}` : ""}`;

    const result = await apiRequest(req, "GET", `/api/tasks?${qs}`);

    res.render("tasks/list", {
        title: "Tasks",
        tasks: result.data,
        pagination: result.pagination,
        status
    });
}));

router.get("/tasks/new", webAuthorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
    const [productsResult, usersResult] = await Promise.all([
        apiRequest(req, "GET", "/api/products?isActive=true&limit=100"),
        apiRequest(req, "GET", "/api/users?role=user&limit=100")
    ]);

    res.render("tasks/form", {
        title: "New Task",
        task: null,
        products: productsResult.data,
        users: usersResult.data
    });
}));

router.post("/tasks", webAuthorize(ROLES.ADMIN), async (req, res) => {
    try {
        const { title, description, priority, dueDate, product, quantity, assignedTo } = req.body;
        await apiRequest(req, "POST", "/api/tasks", {
            title, description, priority, dueDate, product, quantity, assignedTo
        });
        console.log("success", "Task created and raw material allocated");
        res.redirect("/tasks");
    } catch (error) {
        console.log("error", [error.message, ...(error.errors || [])].join(" | "));
        res.redirect("/tasks/new");
    }
});

router.get("/tasks/:id", asyncHandler(async (req, res) => {
    const result = await apiRequest(req, "GET", `/api/tasks/${req.params.id}`);
    res.render("tasks/detail", { title: result.data.title, task: result.data });
}));

router.get("/tasks/:id/edit", webAuthorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
    const [taskResult, usersResult] = await Promise.all([
        apiRequest(req, "GET", `/api/tasks/${req.params.id}`),
        apiRequest(req, "GET", "/api/users?role=user&limit=100")
    ]);

    res.render("tasks/form", {
        title: "Edit Task",
        task: taskResult.data,
        products: null,
        users: usersResult.data
    });
}));

router.put("/tasks/:id", webAuthorize(ROLES.ADMIN), async (req, res) => {
    try {
        const { title, description, priority, dueDate, assignedTo } = req.body;
        await apiRequest(req, "PUT", `/api/tasks/${req.params.id}`, {
            title, description, priority, dueDate, assignedTo
        });
        console.log("success", "Task updated successfully");
        res.redirect(`/tasks/${req.params.id}`);
    } catch (error) {
        console.log("error", error.message);
        res.redirect(`/tasks/${req.params.id}/edit`);
    }
});

router.post("/tasks/:id/status", async (req, res) => {
    try {
        await apiRequest(req, "PATCH", `/api/tasks/${req.params.id}/status`, {
            status: req.body.status
        });
        console.log("success", `Task marked as ${req.body.status}`);
    } catch (error) {
        console.log("error", error.message);
    }
    res.redirect(`/tasks/${req.params.id}`);
});

router.delete("/tasks/:id", webAuthorize(ROLES.ADMIN), async (req, res) => {
    try {
        await apiRequest(req, "DELETE", `/api/tasks/${req.params.id}`);
        console.log("success", "Task deleted and raw material reverted to inventory");
    } catch (error) {
        console.log("error", error.message);
    }
    res.redirect("/tasks");
});

module.exports = router;
