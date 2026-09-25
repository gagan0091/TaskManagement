const express = require("express");

const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct
} = require("../controllers/productController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

router.get("/", getProducts);

router.get("/:id", getProductById);

router.post("/", authorize(ROLES.ADMIN), createProduct);

router.put("/:id", authorize(ROLES.ADMIN), updateProduct);

router.delete("/:id", authorize(ROLES.ADMIN), deleteProduct);

module.exports = router;
