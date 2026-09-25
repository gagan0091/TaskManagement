const express = require("express");

const {
    getUsers,
    createUser,
    updateUserRole
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get("/", getUsers);

router.post("/", createUser);

router.patch("/:id/role", updateUserRole);

module.exports = router;
