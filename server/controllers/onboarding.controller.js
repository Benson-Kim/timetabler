// controllers/onboarding.controller.js
const { exec, pool } = require("../helpers/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 12;

module.exports = {
	/**
	 * Check if institution code is available
	 */
	checkInstitutionCode: async (req, res) => {
		const { code } = req.params;

		if (!code || code.length < 3) {
			return res.status(400).json({
				success: false,
				message: "Institution code must be at least 3 characters",
			});
		}

		try {
			const [existing] = await pool.execute(
				`SELECT institution_id FROM institution WHERE institution_code = ?`,
				[code.toUpperCase()]
			);

			return res.status(200).json({
				success: true,
				available: existing.length === 0,
			});
		} catch (error) {
			console.error("Check institution code error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to check institution code",
			});
		}
	},

	/**
	 * Check if admin email is available
	 */
	checkEmail: async (req, res) => {
		const { email } = req.params;

		if (!email) {
			return res.status(400).json({
				success: false,
				message: "Email is required",
			});
		}

		try {
			const [existing] = await pool.execute(
				`SELECT user_id FROM user_account WHERE email = ?`,
				[email.toLowerCase()]
			);

			return res.status(200).json({
				success: true,
				available: existing.length === 0,
			});
		} catch (error) {
			console.error("Check email error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to check email",
			});
		}
	},

	/**
	 * Create new institution with admin user
	 */
	createInstitution: async (req, res) => {
		const {
			// Institution details
			institution_code,
			institution_name,
			institution_type,
			address,
			phone,
			email: institution_email,
			// Admin details
			admin_username,
			admin_email,
			admin_password,
		} = req.body;

		// Validation
		const errors = [];

		if (!institution_code || institution_code.length < 3) {
			errors.push("Institution code must be at least 3 characters");
		}
		if (!institution_name || institution_name.length < 2) {
			errors.push("Institution name is required");
		}
		if (!institution_type) {
			errors.push("Institution type is required");
		}
		if (!admin_username || admin_username.length < 3) {
			errors.push("Admin username must be at least 3 characters");
		}
		if (!admin_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email)) {
			errors.push("Valid admin email is required");
		}
		if (!admin_password || admin_password.length < 8) {
			errors.push("Admin password must be at least 8 characters");
		}

		if (errors.length > 0) {
			return res.status(400).json({
				success: false,
				message: "Validation failed",
				errors,
			});
		}

		try {
			// Check if institution code exists
			const [existingInst] = await pool.execute(
				`SELECT institution_id FROM institution WHERE institution_code = ?`,
				[institution_code.toUpperCase()]
			);

			if (existingInst.length > 0) {
				return res.status(409).json({
					success: false,
					message: "Institution code already exists",
				});
			}

			// Check if admin email exists
			const [existingEmail] = await pool.execute(
				`SELECT user_id FROM user_account WHERE email = ?`,
				[admin_email.toLowerCase()]
			);

			if (existingEmail.length > 0) {
				return res.status(409).json({
					success: false,
					message: "Admin email already exists",
				});
			}

			// Hash password
			const passwordHash = await bcrypt.hash(admin_password, SALT_ROUNDS);

			// Create institution and admin using stored procedure
			const [result] = await pool.execute(
				`CALL sp_create_institution_with_admin(?, ?, ?, ?, ?, ?, ?, ?, ?, @inst_id, @user_id)`,
				[
					institution_code.toUpperCase(),
					institution_name,
					institution_type,
					address || null,
					phone || null,
					institution_email || null,
					admin_username,
					admin_email.toLowerCase(),
					passwordHash,
				]
			);

			const institutionId = result[0][0].institution_id;
			const adminUserId = result[0][0].admin_user_id;

			// Generate tokens for auto-login
			const tokenPayload = {
				user_id: adminUserId,
				institution_id: institutionId,
				username: admin_username,
				user_type: "Admin",
			};

			const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
				expiresIn: "1h",
			});

			const refreshToken = jwt.sign(
				{ user_id: adminUserId },
				process.env.JWT_REFRESH_SECRET,
				{ expiresIn: "7d" }
			);

			return res.status(201).json({
				success: true,
				message: "Institution created successfully",
				data: {
					institution: {
						institution_id: institutionId,
						institution_code: institution_code.toUpperCase(),
						institution_name,
						institution_type,
					},
					user: {
						user_id: adminUserId,
						username: admin_username,
						email: admin_email.toLowerCase(),
						user_type: "Admin",
					},
					access_token: accessToken,
					refresh_token: refreshToken,
					expires_in: "1h",
				},
			});
		} catch (error) {
			console.error("Create institution error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to create institution",
			});
		}
	},

	/**
	 * Get institution types
	 */
	getInstitutionTypes: async (req, res) => {
		const types = [
			{ value: "Primary", label: "Primary School" },
			{ value: "Secondary", label: "Secondary School" },
			{ value: "College", label: "College" },
			{ value: "University", label: "University" },
			{ value: "Technical", label: "Technical Institute" },
			{ value: "Other", label: "Other" },
		];

		return res.status(200).json({
			success: true,
			data: types,
		});
	},
};
