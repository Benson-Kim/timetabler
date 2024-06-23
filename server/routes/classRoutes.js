const express = require("express");
const router = express.Router();

const {
	addClass,
	getClassById,
	getNumClasses,
	updateClass,
	deleteClass,
} = require("../controllers/classController");

router.get("/classes", getNumClasses);
router.get("/get-subject", getClassById);
router.post("/generate", addClass);
router.put("/update-subject", updateClass);
router.delete("/delete-subject", deleteClass);

module.exports = router;
