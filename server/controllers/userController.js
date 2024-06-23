const { exec } = require("../helpers/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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
		const { user_name, password, role } = req.body;
	},

	userLogin: async (req, res) => {
		const { user_name, password } = req.body;

		try {
			const [user] = await exec("CALL sp_verify_exists (?, ?,?)", [
				"users",
				"user_name",
				user_name,
			]);

			if (user && user.length > 0) {
				// Check if user is defined and has a recordset with length

				if (password === user[0].password) {
					const jsontoken = jwt.sign(
						{ user_name: user.user_name },
						process.env.TOKEN,
						{ expiresIn: "40m" },
					);
					res.status(200).json({
						user_name: user_name,
						message: "Logged in Successfully",
						token: jsontoken,
						role: user[0].role,
					});
				} else {
					res.status(401).send({
						success: false,
						message: "Wrong password",
					});
				}
			} else {
				res.status(404).send({
					success: false,
					message: "user does not exist",
				});
			}
		} catch (error) {
			console.log("db err", error);
			res.status(500).send({
				success: false,
				message: "Database error",
			});
		}
	},

	//  Verify Token
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
};
