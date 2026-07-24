const express = require("express");

const router = express.Router();

const homeController = require("../controller/home");
// REST API cho React SPA (React là UI duy nhất ở `/`).
router.get("/thong_ke", homeController.thong_ke);
router.get("/get_noi_chien", homeController.noi_chien);
router.get("/get_noi_chien_detail", homeController.get_noi_chien_detail);
router.patch("/sua_noi_chien_detail", homeController.sua_noi_chien_detail);
router.delete("/xoa_noi_chien_detail", homeController.xoa_noi_chien_detail);

module.exports = router;
