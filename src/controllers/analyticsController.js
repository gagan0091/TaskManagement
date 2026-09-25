const Task = require("../models/Task");
const User = require("../models/User");
const Product = require("../models/Product");
const RawMaterial = require("../models/RawMaterial");
const InventoryTransaction = require("../models/InventoryTransaction");
const AppError = require("../utils/AppError");
const { TASK_STATUS, INVENTORY_TX } = require("../config/constants");
const mongoose = require("mongoose");

const parseDate = (value, name) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        throw new AppError(`Invalid date for "${name}"`, 400);
    }
    return d;
};

// Per raw material: current stock, total added / consumed / reverted (from ledger)
const getInventoryAnalytics = async (req, res, next) => {
    try {
        const sum = (type, expr) => ({
            $sum: { $cond: [{ $eq: ["$type", type] }, expr, 0] }
        });

        const data = await InventoryTransaction.aggregate([
            { $match: { organization: new mongoose.Types.ObjectId(req.user.organization) } },
            {
                $group: {
                    _id: "$material",
                    totalAdded: sum(INVENTORY_TX.STOCK_IN, "$quantityChange"),
                    totalConsumed: sum(INVENTORY_TX.TASK_CONSUMPTION, { $abs: "$quantityChange" }),
                    totalReverted: sum(INVENTORY_TX.TASK_REVERT, "$quantityChange"),
                    totalAdjusted: sum(INVENTORY_TX.ADJUSTMENT, "$quantityChange")
                }
            },
            {
                $lookup: {
                    from: RawMaterial.collection.name,
                    localField: "_id",
                    foreignField: "_id",
                    as: "material"
                }
            },
            { $unwind: "$material" },
            {
                $project: {
                    _id: 0,
                    materialId: "$_id",
                    name: "$material.name",
                    sku: "$material.sku",
                    unit: "$material.unit",
                    currentStock: "$material.quantity",
                    minStockLevel: "$material.minStockLevel",
                    isLowStock: { $lte: ["$material.quantity", "$material.minStockLevel"] },
                    totalAdded: 1,
                    totalConsumed: 1,
                    totalReverted: 1,
                    totalAdjusted: 1,
                    netConsumed: { $subtract: ["$totalConsumed", "$totalReverted"] }
                }
            },
            { $sort: { netConsumed: -1 } }
        ]);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// Completed tasks grouped by product (optional ?from=&to= on completedAt)
const getProductionAnalytics = async (req, res, next) => {
    try {
        const match = { status: TASK_STATUS.COMPLETED, organization: new mongoose.Types.ObjectId(req.user.organization) };

        if (req.query.from || req.query.to) {
            match.completedAt = {};
            if (req.query.from) match.completedAt.$gte = parseDate(req.query.from, "from");
            if (req.query.to) match.completedAt.$lte = parseDate(req.query.to, "to");
        }

        const data = await Task.aggregate([
            { $match: match },
            {
                $group: {
                    _id: "$product",
                    tasksCompleted: { $sum: 1 },
                    unitsProduced: { $sum: "$quantity" }
                }
            },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: "_id",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $project: {
                    _id: 0,
                    productId: "$_id",
                    name: "$product.name",
                    sku: "$product.sku",
                    currentProductStock: "$product.stockQuantity",
                    tasksCompleted: 1,
                    unitsProduced: 1
                }
            },
            { $sort: { unitsProduced: -1 } }
        ]);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// Which raw material went into which product (from task snapshots)
const getMaterialUsageByProduct = async (req, res, next) => {
    try {
        const data = await Task.aggregate([
            { $match: { organization: new mongoose.Types.ObjectId(req.user.organization) } },
            { $unwind: "$materialsUsed" },
            {
                $group: {
                    _id: { product: "$product", material: "$materialsUsed.material" },
                    materialName: { $first: "$materialsUsed.name" },
                    unit: { $first: "$materialsUsed.unit" },
                    totalQuantity: { $sum: "$materialsUsed.quantity" },
                    tasks: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: Product.collection.name,
                    localField: "_id.product",
                    foreignField: "_id",
                    as: "product"
                }
            },
            { $unwind: "$product" },
            {
                $project: {
                    _id: 0,
                    productId: "$_id.product",
                    productName: "$product.name",
                    materialId: "$_id.material",
                    materialName: 1,
                    unit: 1,
                    totalQuantity: 1,
                    tasks: 1
                }
            },
            { $sort: { productName: 1, totalQuantity: -1 } }
        ]);

        res.status(200).json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

// Task counts overall (by status) and per assigned user
const getTaskAnalytics = async (req, res, next) => {
    try {
        const count = (status) => ({
            $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] }
        });

        const [byStatus, byUser] = await Promise.all([
            Task.aggregate([{ $match: { organization: new mongoose.Types.ObjectId(req.user.organization) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
            Task.aggregate([
                { $match: { organization: new mongoose.Types.ObjectId(req.user.organization) } },
                {
                    $group: {
                        _id: "$assignedTo",
                        total: { $sum: 1 },
                        pending: count(TASK_STATUS.PENDING),
                        inProgress: count(TASK_STATUS.IN_PROGRESS),
                        completed: count(TASK_STATUS.COMPLETED),
                        unitsAssigned: { $sum: "$quantity" }
                    }
                },
                {
                    $lookup: {
                        from: User.collection.name,
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                {
                    $project: {
                        _id: 0,
                        userId: "$_id",
                        name: "$user.name",
                        email: "$user.email",
                        total: 1,
                        pending: 1,
                        inProgress: 1,
                        completed: 1,
                        unitsAssigned: 1
                    }
                },
                { $sort: { total: -1 } }
            ])
        ]);

        res.status(200).json({ success: true, data: { byStatus, byUser } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getInventoryAnalytics,
    getProductionAnalytics,
    getMaterialUsageByProduct,
    getTaskAnalytics
};
