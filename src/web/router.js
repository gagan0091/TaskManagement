const express = require("express");

const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const userRoutes = require("./routes/userRoutes");
const materialRoutes = require("./routes/materialRoutes");
const productRoutes = require("./routes/productRoutes");
const taskRoutes = require("./routes/taskRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const router = express.Router();

router.use(authRoutes);
router.use(dashboardRoutes);
router.use(userRoutes);
router.use(materialRoutes);
router.use(productRoutes);
router.use(taskRoutes);
router.use(analyticsRoutes);

module.exports = router;
