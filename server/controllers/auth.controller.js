const { exec, pool } = require("../helpers/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

module.exports = {
	getUsers: async (req, res) => {
		try {
			const [response] = await exec("CALL sp_get_all_users");
			return res.status(200).json({
				status: 200,
				success: true,
				data: response,
			});
		} catch (error) {
			console.log(error.message);
			res.status(500).json({
				status: 500,
				success: false,
				message: error.message,
			});
		}
	},

	userRegister: async (req, res) => {
		const { institution_id, username, email, password, user_type } =
			req.body;

		// Validation
		if (!institution_id || !username || !email || !password || !user_type) {
			return res.status(400).json({
				success: false,
				message: "All fields are required",
			});
		}

		// Password strength validation
		if (password.length < 8) {
			return res.status(400).json({
				success: false,
				message: "Password must be at least 8 characters",
			});
		}

		try {
			// Check if username exists
			const [existingUser] = await pool.execute(
				`SELECT user_id FROM user_account 
                 WHERE institution_id = ? AND (username = ? OR email = ?)`,
				[institution_id, username, email]
			);

			if (existingUser.length > 0) {
				return res.status(409).json({
					success: false,
					message: "Username or email already exists",
				});
			}

			// Hash password
			const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

			// Create user using stored procedure
			const [result] = await pool.execute(
				`CALL sp_create_user(?, ?, ?, ?, ?)`,
				[institution_id, username, email, passwordHash, user_type]
			);

			const userId = result[0][0].user_id;

			return res.status(201).json({
				success: true,
				message: "User registered successfully",
				data: { user_id: userId },
			});
		} catch (error) {
			console.error("Registration error:", error);
			return res.status(500).json({
				success: false,
				message: "Registration failed",
			});
		}
	},

	userLogin: async (req, res) => {
		const { institution_id, username, password } = req.body;

		if (!username || !password) {
			return res.status(400).json({
				success: false,
				message: "Username and password are required",
			});
		}

		try {
			const [users] = await pool.execute(
				`SELECT 
                    user_id,
                    institution_id,
                    username,
                    email,
                    password_hash,
                    user_type,
                    is_active,
                    must_change_password,
                    failed_login_attempts,
                    locked_until
                 FROM user_account 
                 WHERE institution_id = ? AND username = ?`,
				[institution_id || 1, username]
			);

			// User not found - use generic message for security
			if (users.length === 0) {
				return res.status(401).json({
					success: false,
					message: "Invalid credentials",
				});
			}

			const user = users[0];

			// Check if account is active
			if (!user.is_active) {
				return res.status(403).json({
					success: false,
					message: "Account is deactivated. Contact administrator.",
				});
			}

			// Check if account is locked
			if (user.locked_until && new Date(user.locked_until) > new Date()) {
				const remainingTime = Math.ceil(
					(new Date(user.locked_until) - new Date()) / 60000
				);
				return res.status(423).json({
					success: false,
					message: `Account is locked. Try again in ${remainingTime} minutes.`,
				});
			}

			// Verify password
			const isValidPassword = await bcrypt.compare(
				password,
				user.password_hash
			);

			if (!isValidPassword) {
				// Increment failed attempts
				const newAttempts = user.failed_login_attempts + 1;
				const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

				await pool.execute(
					`UPDATE user_account 
                     SET failed_login_attempts = ?,
                         locked_until = ?
                     WHERE user_id = ?`,
					[
						newAttempts,
						shouldLock
							? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
							: null,
						user.user_id,
					]
				);

				const attemptsLeft = MAX_LOGIN_ATTEMPTS - newAttempts;
				return res.status(401).json({
					success: false,
					message: shouldLock
						? `Account locked for ${LOCKOUT_MINUTES} minutes`
						: `Invalid credentials. ${attemptsLeft} attempts remaining.`,
				});
			}

			// Successful login - reset failed attempts & update last login
			await pool.execute(
				`UPDATE user_account 
                 SET failed_login_attempts = 0,
                     locked_until = NULL,
                     last_login = NOW()
                 WHERE user_id = ?`,
				[user.user_id]
			);

			// Generate tokens
			const tokenPayload = {
				user_id: user.user_id,
				institution_id: user.institution_id,
				username: user.username,
				user_type: user.user_type,
			};

			const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
				expiresIn: TOKEN_EXPIRY,
			});

			const refreshToken = jwt.sign(
				{ user_id: user.user_id },
				process.env.JWT_REFRESH_SECRET,
				{ expiresIn: REFRESH_TOKEN_EXPIRY }
			);

			return res.status(200).json({
				success: true,
				message: "Login successful",
				data: {
					user: {
						user_id: user.user_id,
						username: user.username,
						email: user.email,
						user_type: user.user_type,
					},
					must_change_password: user.must_change_password === 1,
					access_token: accessToken,
					refresh_token: refreshToken,
					expires_in: TOKEN_EXPIRY,
				},
			});
		} catch (error) {
			console.error("Login error:", error);
			return res.status(500).json({
				success: false,
				message: "Login failed",
			});
		}
	},

	verifyToken: (req, res, next) => {
		const authHeader = req.headers.authorization;
		if (authHeader) {
			const token = authHeader.split(" ")[1];
			jwt.verify(token, process.env.TOKEN, (err, user) => {
				console.log(err);
				if (err) {
					return res.sendStatus(403);
				}
				req.user = user;
				next();
			});
		} else {
			res.sendStatus(401);
		}
	},

	/**
	 * Refresh access token
	 */
	refreshToken: async (req, res) => {
		const { refresh_token } = req.body;

		if (!refresh_token) {
			return res.status(400).json({
				success: false,
				message: "Refresh token is required",
			});
		}

		try {
			const decoded = jwt.verify(
				refresh_token,
				process.env.JWT_REFRESH_SECRET
			);

			// Get current user data
			const [users] = await pool.execute(
				`SELECT user_id, institution_id, username, user_type, is_active
                 FROM user_account WHERE user_id = ?`,
				[decoded.user_id]
			);

			if (users.length === 0 || !users[0].is_active) {
				return res.status(401).json({
					success: false,
					message: "Invalid refresh token",
				});
			}

			const user = users[0];

			// Generate new access token
			const accessToken = jwt.sign(
				{
					user_id: user.user_id,
					institution_id: user.institution_id,
					username: user.username,
					user_type: user.user_type,
				},
				process.env.JWT_SECRET,
				{ expiresIn: TOKEN_EXPIRY }
			);

			return res.status(200).json({
				success: true,
				data: {
					access_token: accessToken,
					expires_in: TOKEN_EXPIRY,
				},
			});
		} catch (error) {
			return res.status(401).json({
				success: false,
				message: "Invalid or expired refresh token",
			});
		}
	},

	/**
	 * Change password
	 */
	changePassword: async (req, res) => {
		const { current_password, new_password } = req.body;
		const userId = req.user.user_id;

		if (!current_password || !new_password) {
			return res.status(400).json({
				success: false,
				message: "Current and new password are required",
			});
		}

		if (new_password.length < 8) {
			return res.status(400).json({
				success: false,
				message: "New password must be at least 8 characters",
			});
		}

		if (current_password === new_password) {
			return res.status(400).json({
				success: false,
				message: "New password must be different from current password",
			});
		}

		try {
			// Get current password hash
			const [users] = await pool.execute(
				`SELECT password_hash FROM user_account WHERE user_id = ?`,
				[userId]
			);

			if (users.length === 0) {
				return res.status(404).json({
					success: false,
					message: "User not found",
				});
			}

			// Verify current password
			const isValid = await bcrypt.compare(
				current_password,
				users[0].password_hash
			);

			if (!isValid) {
				return res.status(401).json({
					success: false,
					message: "Current password is incorrect",
				});
			}

			// Hash new password
			const newPasswordHash = await bcrypt.hash(
				new_password,
				SALT_ROUNDS
			);

			// Update password using stored procedure
			await pool.execute(`CALL sp_change_password(?, ?)`, [
				userId,
				newPasswordHash,
			]);

			return res.status(200).json({
				success: true,
				message: "Password changed successfully",
			});
		} catch (error) {
			console.error("Change password error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to change password",
			});
		}
	},

	/**
	 * Get current user profile
	 */
	getProfile: async (req, res) => {
		try {
			const [users] = await pool.execute(
				`SELECT 
                    user_id,
                    institution_id,
                    username,
                    email,
                    user_type,
                    linked_entity_type,
                    linked_entity_id,
                    last_login,
                    created_at
                 FROM user_account WHERE user_id = ?`,
				[req.user.user_id]
			);

			if (users.length === 0) {
				return res.status(404).json({
					success: false,
					message: "User not found",
				});
			}

			return res.status(200).json({
				success: true,
				data: users[0],
			});
		} catch (error) {
			console.error("Get profile error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to get profile",
			});
		}
	},

	/**
	 * Get all users (Admin only)
	 */
	getAllUsers: async (req, res) => {
		try {
			const institutionId = req.user.institution_id;

			const [users] = await pool.execute(
				`SELECT 
                    user_id,
                    username,
                    email,
                    user_type,
                    is_active,
                    last_login,
                    created_at
                 FROM user_account 
                 WHERE institution_id = ?
                 ORDER BY created_at DESC`,
				[institutionId]
			);

			return res.status(200).json({
				success: true,
				data: users,
				count: users.length,
			});
		} catch (error) {
			console.error("Get users error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to get users",
			});
		}
	},

	/**
	 * Deactivate user (Admin only)
	 */
	deactivateUser: async (req, res) => {
		const { user_id } = req.params;

		// Prevent self-deactivation
		if (parseInt(user_id) === req.user.user_id) {
			return res.status(400).json({
				success: false,
				message: "Cannot deactivate your own account",
			});
		}

		try {
			const [result] = await pool.execute(
				`UPDATE user_account 
                 SET is_active = FALSE 
                 WHERE user_id = ? AND institution_id = ?`,
				[user_id, req.user.institution_id]
			);

			if (result.affectedRows === 0) {
				return res.status(404).json({
					success: false,
					message: "User not found",
				});
			}

			return res.status(200).json({
				success: true,
				message: "User deactivated successfully",
			});
		} catch (error) {
			console.error("Deactivate user error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to deactivate user",
			});
		}
	},

	/**
	 * Logout (optional - for token blacklisting if implemented)
	 */
	logout: async (req, res) => {
		// With JWT, logout is typically handled client-side by deleting tokens
		// For enhanced security, you could implement token blacklisting here

		return res.status(200).json({
			success: true,
			message: "Logged out successfully",
		});
	},
};
