const express = require("express");

const {
    createMaterial,
    getMaterials,
    getMaterialById,
    updateMaterial,
    addStock,
    adjustStock,
    getHistory,
    deleteMaterial
} = require("../controllers/inventoryController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.post("/", createMaterial);

router.get("/", getMaterials);

// must stay above "/:id"
router.get("/history", getHistory);

router.get("/:id", getMaterialById);

router.put("/:id", updateMaterial);

router.post("/:id/add-stock", addStock);

router.post("/:id/adjust-stock", adjustStock);

router.get("/:id/history", getHistory);

router.delete("/:id", deleteMaterial);

module.exports = router;
