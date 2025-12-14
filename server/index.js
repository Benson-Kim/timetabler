const express = require("express");
require("dotenv").config();

const dept_router = require("./routes/departmentRoutes");
const lec_router = require("./routes/lecturerRoutes");
const crs_router = require("./routes/courseRoutes");
const bat_router = require("./routes/batchRoutes");
const sub_router = require("./routes/subjectRoutes");
const rm_router = require("./routes/roomRoutes");
const sch_router = require("./routes/scheduleRoutes");
const cls_router = require("./routes/trialRoutes");
const auth = require("./routes/auth.routes");
const onboarding = require("./routes/onboarding.routes");

const cors = require("cors");
const helmet = require("helmet");

const app = express();

const port = process.env.PORT || 3016;
// sessions

app.use(express.json());
app.use(helmet())
app.use(
	cors({
		origin: "http://localhost:3000",
		credentials: true,
	}),
);

app.use("/dept", dept_router);
app.use("/lec", lec_router);
app.use("/crs", crs_router);
app.use("/bat", bat_router);
app.use("/sub", sub_router);
app.use("/rm", rm_router);
app.use("/sch", sch_router);
app.use("/cls", cls_router);
app.use("/auth", auth);
app.use("/onboarding", onboarding);

app.use((req, res, next) => {
	const error = new Error("Not found");
	error.status = 404;
	next(error);
});

app.use((err, req, res, next) => {
	res.json({
		status: err.status,
		success: false,
		message: err.message,
	});
});

app.listen(port, () => {
	console.log(`running port: ${port}`);
});
