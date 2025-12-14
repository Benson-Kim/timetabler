const mysql = require("mysql2/promise"); 
require("dotenv").config();

const dbConfig = {
	user: process.env.DB_USER,
	password: process.env.DB_PWD,
	database: process.env.DB_NAME,
	host: "localhost",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
};

class Connection {

	constructor() {
		this.pool = null;
		this.connectToDatabase();
	}

	connectToDatabase = async () => {
		try {
			this.pool = await mysql.createPool(dbConfig);
			console.log("Connected to database");
		} catch (error) {
			console.log(error.message);
			throw new Error(error.message);
		}
	};

	exec = async (procedure, data = []) => {
		const [results] = await this.pool.query(procedure, Object.values(data));

		try {
			return results;
		} catch (error) {
			console.log(error.message);
			throw new Error(error.message);
		}
	};
}

const connection = new Connection();

module.exports = {
	exec: connection.exec,
	pool: connection.pool,
};
