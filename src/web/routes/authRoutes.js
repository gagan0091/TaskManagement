const express = require("express");
const { apiRequest } = require("../apiClient");
const { redirectIfAuthenticated } = require("../middleware/webAuth");

const router = express.Router();

router.get("/login", redirectIfAuthenticated, (req, res) => {
    res.render("auth/login", { title: "Login" });
});

router.post("/login", redirectIfAuthenticated, async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await apiRequest(req, "POST", "/api/auth/login", { email, password });

        res.cookie("token", result.data.token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: "lax",
            secure: false // production में true (HTTPS)
        });



        res.redirect("/dashboard");
    } catch (error) {
        console.log("error", error.message || "Login failed");
        res.redirect("/login");
    }
});

router.get("/register", redirectIfAuthenticated, (req, res) => {
    res.render("auth/register", { title: "Register" });
});

router.post("/register", redirectIfAuthenticated, async (req, res) => {console.log("Registering user:", req.body);
    try {
        const { name, email, password, confirmPassword, organizationName } = req.body;

        if (password !== confirmPassword) {
            console.log("error", "Passwords do not match");
            return res.redirect("/register");
        }
        console.log("Registering user:", { name, email, password, confirmPassword, organizationName });

        const result = await apiRequest(req, "POST", "/api/auth/register", { name, email, password, organizationName });
        console.log("Registration successful:", result.data);

        res.cookie("token", result.data.token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: "lax",
            secure: false,
            });

res.redirect("/dashboard");

        console.log("success", "Account created successfully!");
        res.redirect("/dashboard");
    } catch (error) {
        console.log("Registration error:", error.response ? error.response.data : error.message);
        console.log("error", error.message || "Registration failed");
        // res.redirect("/register");
    }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

module.exports = router;
