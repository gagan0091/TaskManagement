const mongoose = require("mongoose");
const { UNITS } = require("../config/constants");

const rawMaterialSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        sku: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },

        unit: {
            type: String,
            enum: UNITS,
            required: true
        },

        // Current stock. Only changed through inventoryService.changeStock
        quantity: {
            type: Number,
            default: 0,
            min: 0
        },

        minStockLevel: {
            type: Number,
            default: 0,
            min: 0
        },

        costPerUnit: {
            type: Number,
            default: 0,
            min: 0
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
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

module.exports = mongoose.model("RawMaterial", rawMaterialSchema);
