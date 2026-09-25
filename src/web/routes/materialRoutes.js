const express = require("express");
const { apiRequest } = require("../apiClient");
const { webAuth, webAuthorize } = require("../middleware/webAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { ROLES, UNITS } = require("../../config/constants");

const router = express.Router();

router.use(webAuth, webAuthorize(ROLES.ADMIN));

router.get("/admin/materials", asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const lowStockOnly = req.query.lowStock === "true";
    const qs = `page=${page}&limit=10${lowStockOnly ? "&lowStock=true" : ""}`;

    const result = await apiRequest(req, "GET", `/api/inventory?${qs}`);

    res.render("materials/list", {
        title: "Inventory",
        materials: result.data,
        pagination: result.pagination,
        lowStockOnly
    });
}));

router.get("/admin/materials/new", (req, res) => {
    res.render("materials/form", { title: "New Raw Material", material: null, UNITS });
});

router.post("/admin/materials", async (req, res) => {
    try {
        const { name, sku, unit, quantity, minStockLevel, costPerUnit } = req.body;
        await apiRequest(req, "POST", "/api/inventory", {
            name, sku, unit, quantity, minStockLevel, costPerUnit
        });
        console.log("success", "Raw material created successfully");
        res.redirect("/admin/materials");
    } catch (error) {
        console.log("error", error.message);
        res.redirect("/admin/materials/new");
    }
});

router.get("/admin/materials/:id/edit", asyncHandler(async (req, res) => {
    const result = await apiRequest(req, "GET", `/api/inventory/${req.params.id}`);
    res.render("materials/form", { title: "Edit Raw Material", material: result.data, UNITS });
}));

router.put("/admin/materials/:id", async (req, res) => {
    try {
        const { name, sku, minStockLevel, costPerUnit } = req.body;
        await apiRequest(req, "PUT", `/api/inventory/${req.params.id}`, {
            name, sku, minStockLevel, costPerUnit
        });
        console.log("success", "Raw material updated successfully");
        res.redirect("/admin/materials");
    } catch (error) {
        console.log("error", error.message);
        res.redirect(`/admin/materials/${req.params.id}/edit`);
    }
});

router.get("/admin/materials/:id/add-stock", asyncHandler(async (req, res) => {
    const result = await apiRequest(req, "GET", `/api/inventory/${req.params.id}`);
    res.render("materials/add-stock", { title: "Add Stock", material: result.data });
}));

router.post("/admin/materials/:id/add-stock", async (req, res) => {
    try {
        await apiRequest(req, "POST", `/api/inventory/${req.params.id}/add-stock`, {
            quantity: req.body.quantity,
            note: req.body.note
        });
        console.log("success", "Stock added successfully");
        res.redirect("/admin/materials");
    } catch (error) {
        console.log("error", error.message);
        res.redirect(`/admin/materials/${req.params.id}/add-stock`);
    }
});

router.get("/admin/materials/:id/adjust-stock", asyncHandler(async (req, res) => {
    const result = await apiRequest(req, "GET", `/api/inventory/${req.params.id}`);
    res.render("materials/adjust-stock", { title: "Adjust Stock", material: result.data });
}));

router.post("/admin/materials/:id/adjust-stock", async (req, res) => {
    try {
        await apiRequest(req, "POST", `/api/inventory/${req.params.id}/adjust-stock`, {
            quantity: req.body.quantity,
            note: req.body.note
        });
        console.log("success", "Stock adjusted successfully");
        res.redirect("/admin/materials");
    } catch (error) {
        console.log("error", error.message);
        res.redirect(`/admin/materials/${req.params.id}/adjust-stock`);
    }
});

router.get("/admin/materials/:id/history", asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    const [materialResult, historyResult] = await Promise.all([
        apiRequest(req, "GET", `/api/inventory/${req.params.id}`),
        apiRequest(req, "GET", `/api/inventory/${req.params.id}/history?page=${page}&limit=15`)
    ]);

    res.render("materials/history", {
        title: "Stock History",
        material: materialResult.data,
        history: historyResult.data,
        pagination: historyResult.pagination
    });
}));

router.delete("/admin/materials/:id", async (req, res) => {
    try {
        await apiRequest(req, "DELETE", `/api/inventory/${req.params.id}`);
        console.log("success", "Raw material deleted successfully");
    } catch (error) {
        console.log("error", error.message);
    }
    res.redirect("/admin/materials");
});

module.exports = router;
