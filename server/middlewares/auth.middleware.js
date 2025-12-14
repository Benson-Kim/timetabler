const jwt = require("jsonwebtoken");

/**
 * Verify JWT token
 */
const authenticate = (req, res, next) => {
	const authHeader = req.headers.authorization;

	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({
			success: false,
			message: "Access token is required",
		});
	}

	const token = authHeader.split(" ")[1];

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		req.user = decoded;
		next();
	} catch (error) {
		if (error.name === "TokenExpiredError") {
			return res.status(401).json({
				success: false,
				message: "Token has expired",
				code: "TOKEN_EXPIRED",
			});
		}
		return res.status(403).json({
			success: false,
			message: "Invalid token",
		});
	}
};

/**
 * Check if user has required role(s)
 */
const authorize = (...allowedRoles) => {
	return (req, res, next) => {
		if (!req.user) {
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		if (!allowedRoles.includes(req.user.user_type)) {
			return res.status(403).json({
				success: false,
				message: "Insufficient permissions",
			});
		}

		next();
	};
};

/**
 * Check if password change is required
 */
const checkPasswordChange = async (req, res, next) => {
	// Skip for password change endpoint
	if (req.path === "/change-password") {
		return next();
	}

	const pool = require("../config/database");

	try {
		const [users] = await pool.execute(
			`SELECT must_change_password FROM user_account WHERE user_id = ?`,
			[req.user.user_id]
		);

		if (users.length > 0 && users[0].must_change_password) {
			return res.status(403).json({
				success: false,
				message: "Password change required",
				code: "PASSWORD_CHANGE_REQUIRED",
			});
		}

		next();
	} catch (error) {
		next(error);
	}
};

module.exports = {
	authenticate,
	authorize,
	checkPasswordChange,
};
