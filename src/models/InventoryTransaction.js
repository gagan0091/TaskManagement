const mongoose = require("mongoose");
const { INVENTORY_TX } = require("../config/constants");

// Append-only ledger: every stock movement is recorded here
const inventoryTransactionSchema = new mongoose.Schema(
    {
        material: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RawMaterial",
            required: true
        },

        type: {
            type: String,
            enum: Object.values(INVENTORY_TX),
            required: true
        },

        // Signed: +ve = stock added, -ve = stock removed
        quantityChange: {
            type: Number,
            required: true
        },

        balanceAfter: {
            type: Number,
            required: true
        },

        // Which task / product caused this movement (if any)
        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task"
        },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product"
        },

        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        note: {
            type: String,
            trim: true,
            maxlength: 300
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        }
    },
    {
        timestamps: true
    }
);

inventoryTransactionSchema.index({ material: 1, createdAt: -1 });
inventoryTransactionSchema.index({ task: 1 });

module.exports = mongoose.model("InventoryTransaction", inventoryTransactionSchema);
