const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const webAuth = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) return res.redirect("/login");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId)
      .select("name email role organization");

    if (!user) {
      res.clearCookie("token");
      return res.redirect("/login");
    }

    req.user = {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      organization: user.organization.toString(),
    };

    res.locals.currentUser = req.user;
    next();
  } catch (err) {
    res.clearCookie("token");
    return res.redirect("/login");
  }
};

const redirectIfAuthenticated = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) return next();

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return res.redirect("/dashboard");
  } catch {
    res.clearCookie("token");
    return next();
  }
};

const webAuthorize = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.redirect("/dashboard");
    }

    next();
};

module.exports = { webAuth, redirectIfAuthenticated, webAuthorize };
