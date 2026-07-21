const express = require("express");

const router = express.Router();

const homeController = require("../controller/home");
// GET / is now served by the SPA fallback in app.js (client/dist/index.html)
router.get("/get_noi_chien", homeController.noi_chien);
router.get("/get_noi_chien_detail", homeController.get_noi_chien_detail);
router.delete("/xoa_noi_chien_detail", homeController.xoa_noi_chien_detail);

module.exports = router;
