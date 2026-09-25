const mongoose = require("mongoose");

// materials[] is the "recipe" (BOM): raw material needed for ONE unit of product
const productSchema = new mongoose.Schema(
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

        description: {
            type: String,
            trim: true,
            maxlength: 500
        },

        materials: [
            {
                _id: false,
                material: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "RawMaterial",
                    required: true
                },
                quantityPerUnit: {
                    type: Number,
                    required: true,
                    min: [0.001, "quantityPerUnit must be greater than 0"]
                }
            }
        ],

        // Finished units produced so far (incremented when a task completes)
        stockQuantity: {
            type: Number,
            default: 0,
            min: 0
        },

        isActive: {
            type: Boolean,
            default: true
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

productSchema.index({ "materials.material": 1 });

module.exports = mongoose.model("Product", productSchema);
