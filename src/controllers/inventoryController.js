const RawMaterial = require("../models/RawMaterial");
const InventoryTransaction = require("../models/InventoryTransaction");
const Product = require("../models/Product");
const AppError = require("../utils/AppError");
const withTransaction = require("../utils/withTransaction");
const escapeRegex = require("../utils/escapeRegex");
const { changeStock } = require("../services/inventoryService");
const { INVENTORY_TX } = require("../config/constants");
const { getPagination, buildPagination } = require("../utils/pagination");

const createMaterial = async (req, res, next) => {
    try {
        const { name, sku, unit, quantity = 0, minStockLevel, costPerUnit } = req.body;

        if (!name || !sku || !unit) {
            throw new AppError("Name, sku and unit are required", 400);
        }

        const initialQty = Number(quantity);

        if (!Number.isFinite(initialQty) || initialQty < 0) {
            throw new AppError("Quantity must be 0 or more", 400);
        }

        const material = await withTransaction(async (session) => {
            const [created] = await RawMaterial.create(
                [{ name, sku, unit, minStockLevel, costPerUnit, createdBy: req.user.userId, organization: req.user.organization }],
                { session }
            );

            if (initialQty > 0) {
                return changeStock({
                    materialId: created._id,
                    delta: initialQty,
                    type: INVENTORY_TX.STOCK_IN,
                    performedBy: req.user.userId,
                    note: "Opening stock",
                    session
                });
            }

            return created;
        });

        res.status(201).json({
            success: true,
            message: "Raw material created successfully",
            data: material
        });
    } catch (error) {
        next(error);
    }
};

const getMaterials = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = {};
        filter.organization = req.user.organization

        if (req.query.search) {
            const rx = new RegExp(escapeRegex(req.query.search), "i");
            filter.$or = [{ name: rx }, { sku: rx }];
        }

        if (req.query.lowStock === "true") {
            filter.$expr = { $lte: ["$quantity", "$minStockLevel"] };
        }

        const [materials, total] = await Promise.all([
            RawMaterial.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            RawMaterial.countDocuments(filter)
        ]);
        console.log("Materials fetched:", materials.length, "Total:", total);

        res.status(200).json({
            success: true,
            data: materials,
            pagination: buildPagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

const getMaterialById = async (req, res, next) => {
    try {
        const material = await RawMaterial.findOne({ _id: req.params.id, organization: req.user.organization })

        if (!material) {
            throw new AppError("Raw material not found", 404);
        }

        res.status(200).json({ success: true, data: material });
    } catch (error) {
        next(error);
    }
};

// Stock quantity is NOT editable here - use add-stock / adjust-stock so history stays correct
const updateMaterial = async (req, res, next) => {
    try {
        const allowedFields = ["name", "sku", "minStockLevel", "costPerUnit"];
        const updates = {};

        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        const material = await RawMaterial.findOneAndUpdate(
            { _id: req.params.id, organization: req.user.organization },
            updates,
            {
                new: true,
                runValidators: true
            }
        );

        if (!material) {
            throw new AppError("Raw material not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Raw material updated successfully",
            data: material
        });
    } catch (error) {
        next(error);
    }
};

const addStock = async (req, res, next) => {
    try {
        const qty = Number(req.body.quantity);

        if (!Number.isFinite(qty) || qty <= 0) {
            throw new AppError("Quantity must be greater than 0", 400);
        }

        const material = await withTransaction((session) =>
            changeStock({
                materialId: req.params.id,
                delta: qty,
                type: INVENTORY_TX.STOCK_IN,
                performedBy: req.user.userId,
                note: req.body.note || "Stock added",
                session,
                organization: req.user.organization
            })
        );

        res.status(200).json({
            success: true,
            message: "Stock added successfully",
            data: material
        });
    } catch (error) {
        next(error);
    }
};

// Signed correction (wastage, recount...). Negative = remove stock. Note is mandatory.
const adjustStock = async (req, res, next) => {
    try {
        const qty = Number(req.body.quantity);

        if (!Number.isFinite(qty) || qty === 0) {
            throw new AppError("Quantity must be a non-zero number (negative to reduce)", 400);
        }

        if (!req.body.note) {
            throw new AppError("Note is required for stock adjustment", 400);
        }

        const material = await withTransaction((session) =>
            changeStock({
                materialId: req.params.id,
                delta: qty,
                type: INVENTORY_TX.ADJUSTMENT,
                performedBy: req.user.userId,
                note: req.body.note,
                session,
                organization: req.user.organization
            })
        );

        res.status(200).json({
            success: true,
            message: "Stock adjusted successfully",
            data: material
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/inventory/history            -> all movements (filters: material, task, type, from, to)
// GET /api/inventory/:id/history        -> movements of one material
const getHistory = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPagination(req.query);
        const filter = {};
        filter.organization = req.user.organization;

        if (req.params.id) filter.material = req.params.id;
        else if (req.query.material) filter.material = String(req.query.material);

        if (req.query.task) filter.task = String(req.query.task);
        if (req.query.type) filter.type = String(req.query.type);

        if (req.query.from || req.query.to) {
            filter.createdAt = {};
            if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
            if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
        }

        const [history, total] = await Promise.all([
            InventoryTransaction.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("material", "name sku unit")
                .populate("task", "title status")
                .populate("product", "name sku")
                .populate("performedBy", "name email"),
            InventoryTransaction.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: history,
            pagination: buildPagination(page, limit, total)
        });
    } catch (error) {
        next(error);
    }
};

const deleteMaterial = async (req, res, next) => {
    try {
        const usedInProduct = await Product.exists({ "materials.material": req.params.id });

        if (usedInProduct) {
            throw new AppError("Material is used in a product recipe. Remove it from the product first", 409);
        }

        const material = await RawMaterial.findOneAndDelete({
            _id: req.params.id,
            organization: req.user.organization
        });

        if (!material) {
            throw new AppError("Raw material not found", 404);
        }

        res.status(200).json({
            success: true,
            message: "Raw material deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createMaterial,
    getMaterials,
    getMaterialById,
    updateMaterial,
    addStock,
    adjustStock,
    getHistory,
    deleteMaterial
};
