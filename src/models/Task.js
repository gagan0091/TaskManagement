const mongoose = require("mongoose");
const { TASK_STATUS } = require("../config/constants");

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500
        },

        status: {
            type: String,
            enum: Object.values(TASK_STATUS),
            default: TASK_STATUS.PENDING
        },

        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium"
        },

        dueDate: {
            type: Date
        },

        // What has to be produced
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        quantity: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: Number.isInteger,
                message: "quantity must be a whole number"
            }
        },

        // Snapshot of raw material allocated to this task (recipe can change later,
        // this never changes). Used to revert inventory on delete.
        materialsUsed: [
            {
                _id: false,
                material: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "RawMaterial",
                    required: true
                },
                name: String,
                unit: String,
                quantity: { type: Number, required: true }
            }
        ],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        startedAt: Date,
        completedAt: Date,

        statusHistory: [
            {
                _id: false,
                status: String,
                changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                changedAt: { type: Date, default: Date.now }
            }
        ],
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
    },
    {
        timestamps: true
    }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ product: 1 });

module.exports = mongoose.model("Task", taskSchema);
