const express = require("express");

const {
    createTask,
    getTasks,
    getTaskById,
    updateTask,
    updateTaskStatus,
    deleteTask
} = require("../controllers/taskController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);

router.post("/", authorize(ROLES.ADMIN), createTask);

router.get("/", getTasks);

router.get("/:id", getTaskById);

router.put("/:id", authorize(ROLES.ADMIN), updateTask);

// assigned user (or admin) moves the task forward
router.patch("/:id/status", updateTaskStatus);

router.delete("/:id", authorize(ROLES.ADMIN), deleteTask);

module.exports = router;
