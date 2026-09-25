const RawMaterial = require("../models/RawMaterial");
const InventoryTransaction = require("../models/InventoryTransaction");
const AppError = require("../utils/AppError");

// avoids 0.1 + 0.2 style float noise in stock numbers
const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * The ONLY place where stock changes.
 * Atomically updates RawMaterial.quantity and writes a ledger entry.
 * Must be called inside a transaction (pass `session`).
 * delta < 0 fails (no change) if stock would go below zero.
 */
const changeStock = async ({
    materialId,
    delta,
    type,
    performedBy,
    note,
    task,
    product,
    organization,
    session
}) => {
    const filter = { _id: materialId };

    if (delta < 0) {
        filter.quantity = { $gte: Math.abs(delta) };
    }

    const material = await RawMaterial.findOneAndUpdate(
        filter,
        { $inc: { quantity: delta } },
        { new: true, session }
    );

    if (!material) {
        const exists = await RawMaterial.exists({ _id: materialId }).session(session);

        if (!exists) {
            throw new AppError("Raw material not found", 404);
        }

        throw new AppError("Insufficient stock", 400);
    }

    await InventoryTransaction.create(
        [
            {
                material: material._id,
                type,
                quantityChange: delta,
                balanceAfter: material.quantity,
                task,
                product,
                performedBy,
                note,
                organization,
            }
        ],
        { session }
    );

    return material;
};

module.exports = { changeStock, round3 };
