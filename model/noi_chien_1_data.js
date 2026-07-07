const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const plcSchema = new Schema({
  thoi_gian_start: {
    type: String,
    require: true,
  },
  thoi_gian_stop: {
    type: String,
    require: true,
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
});
module.exports = mongoose.model("noi_chien_1", plcSchema);
