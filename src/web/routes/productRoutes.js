const express = require("express");
const { apiRequest } = require("../apiClient");
const { webAuth, webAuthorize } = require("../middleware/webAuth");
const asyncHandler = require("../middleware/asyncHandler");
const { ROLES } = require("../../config/constants");

const router = express.Router();

router.use(webAuth);

router.get("/products", asyncHandler(async (req, res) => {
    const page = req.query.page || 1;
    
    const result = await apiRequest(req, "GET", `/api/products?page=${page}&limit=10`);

    res.render("products/list", {
        title: "Products",
        products: result.data,
        pagination: result.pagination
    });
}));

router.get("/products/new", webAuthorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
    const materialsResult = await apiRequest(req, "GET", "/api/inventory?limit=100");
    res.render("products/form", { title: "New Product", product: null, materials: materialsResult.data });
}));

router.post("/products", webAuthorize(ROLES.ADMIN), async (req, res) => {
    try {
        const { name, sku, description } = req.body;
        const materials = buildMaterials(req.body);
        console.log("Creating product with data:", { name, sku, description, materials });

        await apiRequest(req, "POST", "/api/products", { name, sku, description, materials });
        console.log("success", "Product created successfully");
        res.redirect("/products");
    } catch (error) {
        console.log("error", error.message);
        // res.redirect("/products/new");
    }
});

router.get("/products/:id", asyncHandler(async (req, res) => {
    const result = await apiRequest(req, "GET", `/api/products/${req.params.id}`);
    res.render("products/detail", { title: result.data.name, product: result.data });
}));

router.get("/products/:id/edit", webAuthorize(ROLES.ADMIN), asyncHandler(async (req, res) => {
    const [productResult, materialsResult] = await Promise.all([
        apiRequest(req, "GET", `/api/products/${req.params.id}`),
        apiRequest(req, "GET", "/api/inventory?limit=100")
    ]);

    res.render("products/form", {
        title: "Edit Product",
        product: productResult.data,
        materials: materialsResult.data
    });
}));

router.put("/products/:id", webAuthorize(ROLES.ADMIN), async (req, res) => {
    try {
        const { name, sku, description, isActive } = req.body;
        const materials = buildMaterials(req.body);

        await apiRequest(req, "PUT", `/api/products/${req.params.id}`, {
            name, sku, description, materials, isActive: isActive === "on"
        });
        console.log("success", "Product updated successfully");
        res.redirect("/products");
    } catch (error) {
        console.log("error", error.message);
        res.redirect(`/products/${req.params.id}/edit`);
    }
});

router.delete("/products/:id", webAuthorize(ROLES.ADMIN), async (req, res) => {
    try {
        await apiRequest(req, "DELETE", `/api/products/${req.params.id}`);
        console.log("success", "Product deleted successfully");
    } catch (error) {
        console.log("error", error.message);
    }
    res.redirect("/products");
});

// form sends parallel arrays: material[]=id&quantityPerUnit[]=qty
function buildMaterials(body) {
    const ids = [].concat(body.material || []);
    const qtys = [].concat(body.quantityPerUnit || []);

    return ids
        .map((material, i) => ({ material, quantityPerUnit: qtys[i] }))
        .filter((m) => m.material);
}

module.exports = router;
