const express = require("express");

const router = express.Router();

const homeController = require("../controller/home");
// REST API cho React SPA (React là UI duy nhất ở `/`).
router.get("/thong_ke", homeController.thong_ke);
router.get("/get_noi_chien", homeController.noi_chien);
router.get("/get_noi_chien_chart", homeController.get_noi_chien_chart);
router.get("/get_noi_chien_detail", homeController.get_noi_chien_detail);
router.patch("/sua_noi_chien_detail", homeController.sua_noi_chien_detail);
router.delete("/xoa_noi_chien_detail", homeController.xoa_noi_chien_detail);

// Cài đặt hệ thống — không gắn auth riêng ở đây: router này đã được mount sau
// `app.use(auth.requireAuth, home)` trong app.js nên tự động yêu cầu đăng nhập.
router.get("/cai_dat_he_thong", homeController.get_cai_dat_he_thong);
router.put("/cai_dat_he_thong", homeController.sua_cai_dat_he_thong);

module.exports = router;
