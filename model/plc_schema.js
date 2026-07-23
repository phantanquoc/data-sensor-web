const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const plcSchema = new Schema({
  ma_me_chien: {
    type: String,
    default: "",
    trim: true,
  },
  ghi_chu: {
    type: String,
    default: "",
    trim: true,
  },
  thoi_gian_start: {
    type: String,
    require: true,
  },
  thoi_gian_stop: {
    type: String,
    require: true,
  },
  // Normalized timestamps for filtering/sorting; legacy string fields remain
  // the display/source-of-truth format for backward compatibility.
  thoi_gian_start_at: {
    type: Date,
  },
  thoi_gian_stop_at: {
    type: Date,
  },
  // Cờ đánh dấu mẻ bị đóng ép do khởi động lại hệ thống
  dong_ep_khoi_dong: {
    type: Boolean,
    default: false,
  },
  // D42
  tong_thoi_gian_chay: {
    type: Number,
    require: true,
  },
  giai_doan_1: {
    // D260
    thoi_gian_chay: {
      type: Number,
      require: true,
    },
    //D258
    so_lan_nhung: {
      type: Number,
      require: true,
    },
    //D256
    thoi_gian_nhung: {
      type: Number,
      require: true,
    },
    //D316
    thoi_gian_lap_lai: {
      type: Number,
      require: true,
    },
    //D500
    nhiet_do_cai_dat: {
      type: Number,
      require: true,
    },
    //D507
    vi_tri_dung: {
      type: String,
      default: 0,
    },
    bien_du_lieu: [
      {
        thoi_gian: {
          type: String,
          require: true,
        },
        // D2
        ap_suat_vo_hoi: {
          type: Number,
          default: 0,
        },
        // D4
        ap_suat_chan_khong: {
          type: Number,
          default: 0,
        },
        // D81
        ap_suat_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D134
        nhiet_do: {
          type: Number,
          default: 0,
        },
        //D258
        so_lan_nhung: {
          type: Number,
          require: true,
        },
        //D256
        thoi_gian_nhung: {
          type: Number,
          require: true,
        },
        //D316
        thoi_gian_lap_lai: {
          type: Number,
          require: true,
        },
        // D500
        nhiet_do_cai_dat: {
          type: Number,
          default: 0,
        },
        //D507
        vi_tri_dung: {
          type: String,
          default: 0,
        },
        // D575
        dong_dien_dong_co_root: {
          type: Number,
          default: 0,
        },
        // D571
        dong_dien_dong_co_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D704
        nhiet_do_vao_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D710
        nhiet_do_ra_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D716
        nhiet_do_vao_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D722
        nhiet_do_ra_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  giai_doan_2: {
    //D202
    thoi_gian_chay: {
      type: Number,
      require: true,
    },
    //D262
    so_lan_nhung: {
      type: Number,
      require: true,
    },
    //D204
    thoi_gian_nhung: {
      type: Number,
      require: true,
    },
    //D264
    thoi_gian_lap_lai: {
      type: Number,
      require: true,
    },
    //D502
    nhiet_do_cai_dat: {
      type: Number,
      require: true,
    },
    //D508
    vi_tri_dung: {
      type: String,
      default: 0,
    },
    bien_du_lieu: [
      {
        thoi_gian: {
          type: String,
          require: true,
        },
        // D2
        ap_suat_vo_hoi: {
          type: Number,
          default: 0,
        },
        // D4
        ap_suat_chan_khong: {
          type: Number,
          default: 0,
        },
        // D81
        ap_suat_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D134
        nhiet_do: {
          type: Number,
          default: 0,
        },
        //D262
        so_lan_nhung: {
          type: Number,
          require: true,
        },
        //D204
        thoi_gian_nhung: {
          type: Number,
          require: true,
        },
        //D264
        thoi_gian_lap_lai: {
          type: Number,
          require: true,
        },
        // D502
        nhiet_do_cai_dat: {
          type: Number,
          default: 0,
        },
        //D508
        vi_tri_dung: {
          type: String,
          default: 0,
        },
        // D575
        dong_dien_dong_co_root: {
          type: Number,
          default: 0,
        },
        // D571
        dong_dien_dong_co_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D704
        nhiet_do_vao_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D710
        nhiet_do_ra_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D716
        nhiet_do_vao_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D722
        nhiet_do_ra_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  giai_doan_3: {
    //D206
    thoi_gian_chay: {
      type: Number,
      require: true,
    },
    //D266
    so_lan_nhung: {
      type: Number,
      require: true,
    },
    //D208
    thoi_gian_nhung: {
      type: Number,
      require: true,
    },
    //D268
    thoi_gian_lap_lai: {
      type: Number,
      require: true,
    },
    //D504
    nhiet_do_cai_dat: {
      type: Number,
      require: true,
    },
    //D509
    vi_tri_dung: {
      type: String,
      default: 0,
    },
    bien_du_lieu: [
      {
        thoi_gian: {
          type: String,
          require: true,
        },
        // D2
        ap_suat_vo_hoi: {
          type: Number,
          default: 0,
        },
        // D4
        ap_suat_chan_khong: {
          type: Number,
          default: 0,
        },
        // D81
        ap_suat_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D134
        nhiet_do: {
          type: Number,
          default: 0,
        },
        //D266
        so_lan_nhung: {
          type: Number,
          require: true,
        },
        //D208
        thoi_gian_nhung: {
          type: Number,
          require: true,
        },
        //D268
        thoi_gian_lap_lai: {
          type: Number,
          require: true,
        },
        //D504
        nhiet_do_cai_dat: {
          type: Number,
          require: true,
        },
        //D509
        vi_tri_dung: {
          type: String,
          default: 0,
        },
        // D575
        dong_dien_dong_co_root: {
          type: Number,
          default: 0,
        },
        // D571
        dong_dien_dong_co_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D704
        nhiet_do_vao_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D710
        nhiet_do_ra_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D716
        nhiet_do_vao_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D722
        nhiet_do_ra_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  giai_doan_4: {
    //D214
    thoi_gian_treo_long: {
      type: Number,
      default: 0,
    },
    bien_du_lieu: [
      {
        thoi_gian: {
          type: String,
          require: true,
        },
        // D2
        ap_suat_vo_hoi: {
          type: Number,
          default: 0,
        },
        // D4
        ap_suat_chan_khong: {
          type: Number,
          default: 0,
        },
        // D81
        ap_suat_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D134
        nhiet_do: {
          type: Number,
          default: 0,
        },
        // D575
        dong_dien_dong_co_root: {
          type: Number,
          default: 0,
        },
        // D571
        dong_dien_dong_co_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D704
        nhiet_do_vao_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D710
        nhiet_do_ra_binh_sinh_han: {
          type: Number,
          default: 0,
        },
        // D716
        nhiet_do_vao_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
        // D722
        nhiet_do_ra_bom_vong_nuoc: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  // Ảnh chụp thông số tại thời điểm M6 (đèn nhúng lòng) lên true LẦN ĐẦU trong mẻ.
  // Ghi đúng 1 lần/mẻ. thoi_gian (chuỗi VN) để hiển thị, thoi_gian_at (Date) để sort/filter.
  nhung_long_dau: {
    thoi_gian: { type: String, default: "" },
    thoi_gian_at: { type: Date, default: null },
    // Số giây từ lúc M120 start đến khi nhận M6 on lần đầu
    giay_tu_start: { type: Number, default: null },
    // Số giây từ lúc M120 start đến khi vào GĐ1 (M155 on lần đầu) — để so sánh mốc
    giay_vao_gd1: { type: Number, default: null },
    // D2
    ap_suat_vo_hoi: { type: Number, default: 0 },
    // D4
    ap_suat_chan_khong: { type: Number, default: 0 },
    // D81
    ap_suat_vong_nuoc: { type: Number, default: 0 },
    // D134
    nhiet_do: { type: Number, default: 0 },
    // D575
    dong_dien_dong_co_root: { type: Number, default: 0 },
    // D571
    dong_dien_dong_co_vong_nuoc: { type: Number, default: 0 },
    // D84
    nhiet_do_vao_binh_sinh_han: { type: Number, default: 0 },
    // D85
    nhiet_do_ra_binh_sinh_han: { type: Number, default: 0 },
    // D86
    nhiet_do_vao_bom_vong_nuoc: { type: Number, default: 0 },
    // D87
    nhiet_do_ra_bom_vong_nuoc: { type: Number, default: 0 },
  },
  // HIỆU SUẤT MÁY: ảnh chụp full sensor tại 2 mốc sự kiện đầu tiên trong mẻ.
  //   kick_root  = tại M1 (bắt đầu kick root) lên true lần đầu
  //   nhung_hang = tại M155 (bắt đầu nhúng hàng / vào GĐ1) lên true lần đầu
  // Mỗi snapshot ghi đúng 1 lần/mẻ. giay_tu_start = số giây từ M120 start đến mốc đó.
  hieu_suat_may: {
    kick_root: {
      thoi_gian: { type: String, default: "" },
      thoi_gian_at: { type: Date, default: null },
      giay_tu_start: { type: Number, default: null },
      ap_suat_vo_hoi: { type: Number, default: 0 },
      ap_suat_chan_khong: { type: Number, default: 0 },
      ap_suat_vong_nuoc: { type: Number, default: 0 },
      nhiet_do: { type: Number, default: 0 },
      dong_dien_dong_co_root: { type: Number, default: 0 },
      dong_dien_dong_co_vong_nuoc: { type: Number, default: 0 },
      nhiet_do_vao_binh_sinh_han: { type: Number, default: 0 },
      nhiet_do_ra_binh_sinh_han: { type: Number, default: 0 },
      nhiet_do_vao_bom_vong_nuoc: { type: Number, default: 0 },
      nhiet_do_ra_bom_vong_nuoc: { type: Number, default: 0 },
    },
    nhung_hang: {
      thoi_gian: { type: String, default: "" },
      thoi_gian_at: { type: Date, default: null },
      giay_tu_start: { type: Number, default: null },
      ap_suat_vo_hoi: { type: Number, default: 0 },
      ap_suat_chan_khong: { type: Number, default: 0 },
      ap_suat_vong_nuoc: { type: Number, default: 0 },
      nhiet_do: { type: Number, default: 0 },
      dong_dien_dong_co_root: { type: Number, default: 0 },
      dong_dien_dong_co_vong_nuoc: { type: Number, default: 0 },
      nhiet_do_vao_binh_sinh_han: { type: Number, default: 0 },
      nhiet_do_ra_binh_sinh_han: { type: Number, default: 0 },
      nhiet_do_vao_bom_vong_nuoc: { type: Number, default: 0 },
      nhiet_do_ra_bom_vong_nuoc: { type: Number, default: 0 },
    },
  },
});

// Index for fast lookup of open batches (thoi_gian_stop: "")
plcSchema.index({ thoi_gian_stop: 1 });

// Register and export all 8 models indexed by fryer number (1-based)
// plcModels[1] = noi_chien_1, plcModels[2] = noi_chien_2, ..., plcModels[8] = noi_chien_8
const plcModels = {};
for (let n = 1; n <= 8; n++) {
  plcModels[n] = mongoose.model("noi_chien_" + n, plcSchema);
}

module.exports = plcModels;
