const path = require("path");
const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const productRoutes = require("./routes/productRoutes");
const taskRoutes = require("./routes/taskRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const webRouter = require("./web/router");

const requestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFoundMiddleware");
const errorHandler = require("./middleware/errorMiddleware");

const app = express();

const cookieParser = require("cookie-parser");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser()); // ✅ Add this

// lets HTML forms send PUT/DELETE via a hidden <input name="_method"> field
// or a "?_method=DELETE" query string - the JSON API is unaffected.
app.use(methodOverride("_method"));
app.use(methodOverride((req) => {
    if (req.body && typeof req.body === "object" && "_method" in req.body) {
        const method = req.body._method;
        delete req.body._method;
        return method;
    }
}));



app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.static(path.join(__dirname, "..", "public")));


// logs EVERY request, API or frontend (must be before the routes)
app.use(requestLogger);

// health check for the API - kept exactly as before so existing API consumers
// are unaffected. The human-facing home page is the EJS frontend at /login or /dashboard.
app.get("/", (req, res) => {
    if(process.env.frontend){
        return res.redirect('/login');
    }
    res.status(200).json({
        success: true,
        message: "Task Management API is running"
    });
});


// errors thrown inside the EJS frontend render an HTML error page instead of
// falling through to the JSON error handler used by /api/*
app.use((err, req, res, next) => {
    if (req.path.startsWith("/api")) {
        return next(err);
    }

    const status = err.status || 500;
    console.error(`[WEB ERROR] ${req.method} ${req.originalUrl} -> ${err.message}`);
    res.status(status).render("errors/error", {
        title: "Error",
        status,
        message: err.message || "Something went wrong"
    });
});

// ---- JSON API (unchanged contract) ----
app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/inventory", inventoryRoutes);

app.use("/api/products", productRoutes);

app.use("/api/tasks", taskRoutes);

app.use("/api/analytics", analyticsRoutes);


// ---- EJS frontend (browser pages): /login, /dashboard, /tasks, /products, /admin/* ----
// This is purely a CLIENT of the JSON API below (see src/web/apiClient.js) -
// it never touches models/controllers directly. Swap it for any other
// frontend later without changing a single line under /api.
const jwt = require("jsonwebtoken");

app.use((req, res, next) => {
  const token = req.cookies?.token;

  res.locals.currentUser = null;

  if (token) {
    try {
      res.locals.currentUser = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      res.clearCookie("token");
    }
  }

  next();
});

app.use("/", webRouter);

app.use(notFound);

app.use(errorHandler);

module.exports = app;
