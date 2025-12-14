const express = require("express");
const router = express.Router();

const onboardingController = require("../controllers/onboarding.controller");


// All public routes
router.get("/institution-types", onboardingController.getInstitutionTypes);
router.get("/check-code/:code", onboardingController.checkInstitutionCode);
router.get("/check-email/:email", onboardingController.checkEmail);
router.post("/register", onboardingController.createInstitution);

module.exports = router;