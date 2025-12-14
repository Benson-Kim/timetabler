const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const authMiddleWare = require("../middlewares/auth.middleware");


router.post("/login", authController.userLogin);
router.post("/refresh-token", authController.refreshToken);

router.use(authMiddleWare.authenticate)

router.post("/logout", authController.logout);
router.post("/change-password", authController.changePassword);
router.get("/profile", authController.getProfile);

router.post(
    "/create-account", 
    authMiddleWare.authorize("Admin"),
    authController.userRegister
);

router.get(
    "/users", 
    authMiddleWare.checkPasswordChange,
    authMiddleWare.authorize("Admin"), 
    authController.getAllUsers
);

router.patch(
	"/users/:id/status",
	authMiddleWare.checkPasswordChange,
	authMiddleWare.authorize("Admin"),
	authController.deactivateUser
);

module.exports = router;