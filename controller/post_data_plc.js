const { Buffer } = require("buffer");

const DEBUG = process.env.DEBUG === "true" || process.env.DEBUG === "1";
function dbg(...args) { if (DEBUG) console.log(...args); }

// id_document keyed by fryer index (n = 1..8), module-scoped in memory
// Behavior including loss on restart is unchanged.
const id_document = {};

const PUSH_EVERY_N_CYCLES = 5;   // K: mỗi 5 chu kỳ mới $push 1 điểm vào bien_du_lieu
const pushCount = {};            // pushCount[n] = {1,2,3,4} đếm số chu kỳ active mỗi giai đoạn

// Cache latest stagesArray per fryer for instant snapshot on client join
const latestStages = {};

// Server-authoritative stage-start timestamps (RAM). Anchored on each stage's
// rising edge; cleared on its falling edge. Lost on restart — a restart closes
// the running batch (cleanupOrphanBatches) and starts a fresh one, so elapsed
// legitimately restarts rather than being recovered.
// stageStartMs[n] = { 1: ms|null, 2: ms|null, 3: ms|null, 4: ms|null }
const stageStartMs = {};

/**
 * postDataPlc - single parameterized function replacing the 8 post_data_to_db_* files.
 *
 * @param {object} model     - Mongoose model for noi_chien_N
 * @param {number} n         - fryer index 1..8
 * @param {object} values    - register values map
 * @param {object} io_       - Socket.IO server instance
 * @param {number} Start     - current Start counter (0, 1, or 2)
 * @param {*} giai_doan_1    - boolean or falsy (M155 coil)
 * @param {*} giai_doan_2    - boolean or falsy (M124 coil)
 * @param {*} giai_doan_3    - boolean or falsy (M126 coil)
 * @param {*} giai_doan_4    - boolean or falsy (M127 coil)
 */
exports.postDataPlc = async (
  model,
  n,
  values,
  io_,
  Start,
  giai_doan_1,
  giai_doan_2,
  giai_doan_3,
  giai_doan_4,
) => {
  // --- Float assembly (Buffer LE 32-bit pairs) ---
  let d2 = values && values["D2"] !== undefined ? values["D2"] : 0;
  let d3 = values && values["D3"] !== undefined ? values["D3"] : 0;
  const buf_2_3 = Buffer.alloc(4);
  buf_2_3.writeUInt16LE(d2, 0);
  buf_2_3.writeUInt16LE(d3, 2);
  let d_2_3 = parseFloat(buf_2_3.readFloatLE(0).toFixed(2));

  let d4 = values && values["D4"] !== undefined ? values["D4"] : 0;
  let d5 = values && values["D5"] !== undefined ? values["D5"] : 0;
  const buf_4_5 = Buffer.alloc(4);
  buf_4_5.writeUInt16LE(d4, 0);
  buf_4_5.writeUInt16LE(d5, 2);
  let d_4_5 = parseFloat(buf_4_5.readFloatLE(0).toFixed(2));

  let d81 = values && values["D81"] !== undefined ? values["D81"] : 0;
  let d82 = values && values["D82"] !== undefined ? values["D82"] : 0;
  const buf_81_82 = Buffer.alloc(4);
  buf_81_82.writeUInt16LE(d81, 0);
  buf_81_82.writeUInt16LE(d82, 2);
  let d_81_82 = parseFloat(buf_81_82.readFloatLE(0).toFixed(2));

  let d134 = values && values["D134"] !== undefined ? values["D134"] : 0;
  let d135 = values && values["D135"] !== undefined ? values["D135"] : 0;
  const buf_134_135 = Buffer.alloc(4);
  buf_134_135.writeUInt16LE(d134, 0);
  buf_134_135.writeUInt16LE(d135, 2);
  let d_134_135 = parseFloat(buf_134_135.readFloatLE(0).toFixed(2));

  let d575 = values && values["D575"] !== undefined ? values["D575"] : 0;
  let d576 = values && values["D576"] !== undefined ? values["D576"] : 0;
  const buf_575_576 = Buffer.alloc(4);
  buf_575_576.writeUInt16LE(d575, 0);
  buf_575_576.writeUInt16LE(d576, 2);
  let d_575_576 = parseFloat(buf_575_576.readFloatLE(0).toFixed(2));

  let d571 = values && values["D571"] !== undefined ? values["D571"] : 0;
  let d572 = values && values["D572"] !== undefined ? values["D572"] : 0;
  const buf_571_572 = Buffer.alloc(4);
  buf_571_572.writeUInt16LE(d571, 0);
  buf_571_572.writeUInt16LE(d572, 2);
  let d_571_572 = parseFloat(buf_571_572.readFloatLE(0).toFixed(2));

  // D84..D87 divided by 10
  let d84 = values && values["D84"] !== undefined ? values["D84"] : 0;
  let d85 = values && values["D85"] !== undefined ? values["D85"] : 0;
  let d86 = values && values["D86"] !== undefined ? values["D86"] : 0;
  let d87 = values && values["D87"] !== undefined ? values["D87"] : 0;

  let d60 = values && values["D60"] !== undefined ? values["D60"] : 0;

  // --- Stage params ---
  //giai đoạn 1
  let thoi_gian_chay_gd1 =
    values && values["D260"] !== undefined ? values["D260"] : 0;
  let so_lan_nhung_gd1 =
    values && values["D258"] !== undefined ? values["D258"] : 0;
  let thoi_gian_nhung_gd1 =
    values && values["D256"] !== undefined ? values["D256"] : 0;
  let thoi_gian_lap_lai_gd1 =
    values && values["D316"] !== undefined ? values["D316"] : 0;
  let nhiet_do_cai_dat_gd1 =
    values && values["D500"] !== undefined ? values["D500"] : 0;
  let gia_tri_muc_dau_gd_1 =
    values && values["D507"] !== undefined ? values["D507"] : 0;
  let vi_tri_muc_dau_gd_1;
  if (gia_tri_muc_dau_gd_1 === 0) vi_tri_muc_dau_gd_1 = "1/3 mức dầu";
  if (gia_tri_muc_dau_gd_1 === 1) vi_tri_muc_dau_gd_1 = "2/3 mức dầu";
  if (gia_tri_muc_dau_gd_1 === 2) vi_tri_muc_dau_gd_1 = "ngập dầu";

  //giai đoạn 2
  let thoi_gian_chay_gd2 =
    values && values["D202"] !== undefined ? values["D202"] : 0;
  let so_lan_nhung_gd2 =
    values && values["D262"] !== undefined ? values["D262"] : 0;
  let thoi_gian_nhung_gd2 =
    values && values["D204"] !== undefined ? values["D204"] : 0;
  let thoi_gian_lap_lai_gd2 =
    values && values["D264"] !== undefined ? values["D264"] : 0;
  let nhiet_do_cai_dat_gd2 =
    values && values["D502"] !== undefined ? values["D502"] : 0;
  let gia_tri_muc_dau_gd_2 =
    values && values["D508"] !== undefined ? values["D508"] : 0;
  let vi_tri_muc_dau_gd_2;
  if (gia_tri_muc_dau_gd_2 === 0) vi_tri_muc_dau_gd_2 = "1/3 mức dầu";
  if (gia_tri_muc_dau_gd_2 === 1) vi_tri_muc_dau_gd_2 = "2/3 mức dầu";
  if (gia_tri_muc_dau_gd_2 === 2) vi_tri_muc_dau_gd_2 = "ngập dầu";

  //giai đoạn 3
  let thoi_gian_chay_gd3 =
    values && values["D206"] !== undefined ? values["D206"] : 0;
  let so_lan_nhung_gd3 =
    values && values["D266"] !== undefined ? values["D266"] : 0;
  let thoi_gian_nhung_gd3 =
    values && values["D208"] !== undefined ? values["D208"] : 0;
  let thoi_gian_lap_lai_gd3 =
    values && values["D268"] !== undefined ? values["D268"] : 0;
  let nhiet_do_cai_dat_gd3 =
    values && values["D504"] !== undefined ? values["D504"] : 0;
  let gia_tri_muc_dau_gd_3 =
    values && values["D509"] !== undefined ? values["D509"] : 0;
  let vi_tri_muc_dau_gd_3;
  if (gia_tri_muc_dau_gd_3 === 0) vi_tri_muc_dau_gd_3 = "1/3 mức dầu";
  if (gia_tri_muc_dau_gd_3 === 1) vi_tri_muc_dau_gd_3 = "2/3 mức dầu";
  if (gia_tri_muc_dau_gd_3 === 2) vi_tri_muc_dau_gd_3 = "ngập dầu";

  //giai đoạn 4
  let thoi_gian_treo_long_gd4 =
    values && values["D214"] !== undefined ? values["D214"] : 0;

  // --- Document initial shape ---
  const dataFormat = {
    thoi_gian_start: new Date().toLocaleString("vi-VN"),
    thoi_gian_stop: "",
    tong_thoi_gian_chay: 0,
    giai_doan_1: {
      thoi_gian_chay: 0,
      so_lan_nhung: 0,
      thoi_gian_nhung: 0,
      thoi_gian_lap_lai: 0,
      nhiet_do_cai_dat: 0,
      vi_tri_dung: 0,
      bien_du_lieu: [
        {
          thoi_gian: "",
          ap_suat_vo_hoi: 0,
          ap_suat_chan_khong: 0,
          ap_suat_vong_nuoc: 0,
          nhiet_do: 0,
          so_lan_nhung: 0,
          thoi_gian_nhung: 0,
          thoi_gian_lap_lai: 0,
          nhiet_do_cai_dat: 0,
          vi_tri_dung: 0,
          dong_dien_dong_co_root: 0,
          dong_dien_dong_co_vong_nuoc: 0,
          nhiet_do_vao_binh_sinh_han: 0,
          nhiet_do_ra_binh_sinh_han: 0,
          nhiet_do_vao_bom_vong_nuoc: 0,
          nhiet_do_ra_bom_vong_nuoc: 0,
        },
      ],
    },
    giai_doan_2: {
      thoi_gian_chay: 0,
      so_lan_nhung: 0,
      thoi_gian_nhung: 0,
      thoi_gian_lap_lai: 0,
      nhiet_do_cai_dat: 0,
      vi_tri_dung: 0,
      bien_du_lieu: [
        {
          thoi_gian: 0,
          ap_suat_vo_hoi: 0,
          ap_suat_chan_khong: 0,
          ap_suat_vong_nuoc: 0,
          nhiet_do: 0,
          so_lan_nhung: 0,
          thoi_gian_nhung: 0,
          thoi_gian_lap_lai: 0,
          nhiet_do_cai_dat: 0,
          vi_tri_dung: 0,
          dong_dien_dong_co_root: 0,
          dong_dien_dong_co_vong_nuoc: 0,
          nhiet_do_vao_binh_sinh_han: 0,
          nhiet_do_ra_binh_sinh_han: 0,
          nhiet_do_vao_bom_vong_nuoc: 0,
          nhiet_do_ra_bom_vong_nuoc: 0,
        },
      ],
    },
    giai_doan_3: {
      thoi_gian_chay: 0,
      so_lan_nhung: 0,
      thoi_gian_nhung: 0,
      thoi_gian_lap_lai: 0,
      nhiet_do_cai_dat: 0,
      vi_tri_dung: 0,
      bien_du_lieu: [
        {
          thoi_gian: "",
          ap_suat_vo_hoi: 0,
          ap_suat_chan_khong: 0,
          ap_suat_vong_nuoc: 0,
          nhiet_do: 0,
          so_lan_nhung: 0,
          thoi_gian_nhung: 0,
          thoi_gian_lap_lai: 0,
          nhiet_do_cai_dat: 0,
          vi_tri_dung: 0,
          dong_dien_dong_co_root: 0,
          dong_dien_dong_co_vong_nuoc: 0,
          nhiet_do_vao_binh_sinh_han: 0,
          nhiet_do_ra_binh_sinh_han: 0,
          nhiet_do_vao_bom_vong_nuoc: 0,
          nhiet_do_ra_bom_vong_nuoc: 0,
          vi_tri_muc_dau: 0,
        },
      ],
    },
    giai_doan_4: {
      thoi_gian_treo_long_gd_4: 0,
      bien_du_lieu: [
        {
          thoi_gian: "",
          ap_suat_vo_hoi: 0,
          ap_suat_chan_khong: 0,
          ap_suat_vong_nuoc: 0,
          nhiet_do: 0,
          dong_dien_dong_co_root: 0,
          dong_dien_dong_co_vong_nuoc: 0,
          nhiet_do_vao_binh_sinh_han: 0,
          nhiet_do_ra_binh_sinh_han: 0,
          nhiet_do_vao_bom_vong_nuoc: 0,
          nhiet_do_ra_bom_vong_nuoc: 0,
        },
      ],
    },
  };

  const newData_gd_1 = {
    thoi_gian: new Date().toLocaleString("vi-VN"),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    so_lan_nhung: so_lan_nhung_gd1,
    thoi_gian_nhung: thoi_gian_nhung_gd1,
    thoi_gian_lap_lai: thoi_gian_lap_lai_gd1,
    nhiet_do_cai_dat: nhiet_do_cai_dat_gd1,
    vi_tri_dung: vi_tri_muc_dau_gd_1,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  const newData_gd_2 = {
    thoi_gian: new Date().toLocaleString("vi-VN"),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    so_lan_nhung: so_lan_nhung_gd2,
    thoi_gian_nhung: thoi_gian_nhung_gd2,
    thoi_gian_lap_lai: thoi_gian_lap_lai_gd2,
    nhiet_do_cai_dat: nhiet_do_cai_dat_gd2,
    vi_tri_dung: vi_tri_muc_dau_gd_2,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  const newData_gd_3 = {
    thoi_gian: new Date().toLocaleString("vi-VN"),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    so_lan_nhung: so_lan_nhung_gd3,
    thoi_gian_nhung: thoi_gian_nhung_gd3,
    thoi_gian_lap_lai: thoi_gian_lap_lai_gd3,
    nhiet_do_cai_dat: nhiet_do_cai_dat_gd3,
    vi_tri_dung: vi_tri_muc_dau_gd_3,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  const newData_gd_4 = {
    thoi_gian: new Date().toLocaleString("vi-VN"),
    ap_suat_vo_hoi: d_2_3,
    ap_suat_chan_khong: d_4_5,
    ap_suat_vong_nuoc: d_81_82,
    nhiet_do: d_134_135,
    dong_dien_dong_co_root: d_575_576,
    dong_dien_dong_co_vong_nuoc: d_571_572,
    nhiet_do_vao_binh_sinh_han: d84 / 10,
    nhiet_do_ra_binh_sinh_han: d85 / 10,
    nhiet_do_vao_bom_vong_nuoc: d86 / 10,
    nhiet_do_ra_bom_vong_nuoc: d87 / 10,
  };

  // --- Batch lifecycle ---
  // khởi tạo
  if (Start === 1) {
    // Đóng mọi mẻ chưa stop cũ của nồi này trước khi tạo mẻ mới
    await model.updateMany(
      { thoi_gian_stop: "" },
      { $set: { thoi_gian_stop: new Date().toLocaleString("vi-VN") } },
    ).catch((err) => console.log(err));

    const docunent = await model.create(dataFormat).catch((err) => {
      console.log(err);
    });
    if (docunent) {
      id_document[n] = docunent._id;
      pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      stageStartMs[n] = { 1: null, 2: null, 3: null, 4: null };
    }
  }
  // update
  if (Start > 1) {
    //giai đoạn 1
    if (giai_doan_1 && typeof giai_doan_1 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][1]++;
      const update_1 = {
        $set: {
          tong_thoi_gian_chay: d60,
          "giai_doan_1.thoi_gian_chay": thoi_gian_chay_gd1,
          "giai_doan_1.so_lan_nhung": so_lan_nhung_gd1,
          "giai_doan_1.thoi_gian_nhung": thoi_gian_nhung_gd1,
          "giai_doan_1.thoi_gian_lap_lai": thoi_gian_lap_lai_gd1,
          "giai_doan_1.nhiet_do_cai_dat": nhiet_do_cai_dat_gd1,
          "giai_doan_1.vi_tri_dung": vi_tri_muc_dau_gd_1,
        },
      };
      if (pushCount[n][1] % PUSH_EVERY_N_CYCLES === 1) {
        update_1.$push = { "giai_doan_1.bien_du_lieu": newData_gd_1 };
      }
      await model.updateOne({ _id: id_document[n] }, update_1);
      dbg("nồi chiên " + n + " giai đoạn 1");
    }
    // giai đoạn 2
    if (giai_doan_2 && typeof giai_doan_2 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][2]++;
      const update_2 = {
        $set: {
          tong_thoi_gian_chay: d60,
          "giai_doan_2.thoi_gian_chay": thoi_gian_chay_gd2,
          "giai_doan_2.so_lan_nhung": so_lan_nhung_gd2,
          "giai_doan_2.thoi_gian_nhung": thoi_gian_nhung_gd2,
          "giai_doan_2.thoi_gian_lap_lai": thoi_gian_lap_lai_gd2,
          "giai_doan_2.nhiet_do_cai_dat": nhiet_do_cai_dat_gd2,
          "giai_doan_2.vi_tri_dung": vi_tri_muc_dau_gd_2,
        },
      };
      if (pushCount[n][2] % PUSH_EVERY_N_CYCLES === 1) {
        update_2.$push = { "giai_doan_2.bien_du_lieu": newData_gd_2 };
      }
      await model.updateOne({ _id: id_document[n] }, update_2);
      dbg("nồi chiên " + n + " giai đoạn 2");
    }
    //giai đoạn 3
    if (giai_doan_3 && typeof giai_doan_3 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][3]++;
      const update_3 = {
        $set: {
          tong_thoi_gian_chay: d60,
          "giai_doan_3.thoi_gian_chay": thoi_gian_chay_gd3,
          "giai_doan_3.so_lan_nhung": so_lan_nhung_gd3,
          "giai_doan_3.thoi_gian_nhung": thoi_gian_nhung_gd3,
          "giai_doan_3.thoi_gian_lap_lai": thoi_gian_lap_lai_gd3,
          "giai_doan_3.nhiet_do_cai_dat": nhiet_do_cai_dat_gd3,
          "giai_doan_3.vi_tri_dung": vi_tri_muc_dau_gd_3,
        },
      };
      if (pushCount[n][3] % PUSH_EVERY_N_CYCLES === 1) {
        update_3.$push = { "giai_doan_3.bien_du_lieu": newData_gd_3 };
      }
      await model.updateOne({ _id: id_document[n] }, update_3);
      dbg("nồi chiên " + n + " giai đoạn: 3");
    }
    //giai đoạn 4
    if (giai_doan_4 && typeof giai_doan_4 === "boolean") {
      if (!pushCount[n]) pushCount[n] = { 1: 0, 2: 0, 3: 0, 4: 0 };
      pushCount[n][4]++;
      const update_4 = {
        $set: {
          tong_thoi_gian_chay: d60,
          "giai_doan_4.thoi_gian_treo_long": thoi_gian_treo_long_gd4,
        },
      };
      if (pushCount[n][4] % PUSH_EVERY_N_CYCLES === 1) {
        update_4.$push = { "giai_doan_4.bien_du_lieu": newData_gd_4 };
      }
      await model.updateOne({ _id: id_document[n] }, update_4);
      dbg("nồi chiên " + n + " giai đoạn 4");
    }
  }

  // update stop
  if (Start === 0) {
    await model.updateOne(
      { _id: id_document[n] },
      { $set: { thoi_gian_stop: new Date().toLocaleString("vi-VN") } },
    );
    console.log("nồi chiên " + n + " đã stop mẻ");
    io_.to("noi_" + n).emit("noi_chien_" + n + "_stop", {
      stop: "đã hoang thành xong mẽ chiên",
    });
  }

  // --- Stage-start tracking + elapsed computation (server-authoritative) ---
  if (!stageStartMs[n]) stageStartMs[n] = { 1: null, 2: null, 3: null, 4: null };
  const activeFlags = [
    giai_doan_1 && typeof giai_doan_1 === "boolean",
    giai_doan_2 && typeof giai_doan_2 === "boolean",
    giai_doan_3 && typeof giai_doan_3 === "boolean",
    giai_doan_4 && typeof giai_doan_4 === "boolean",
  ];

  for (let k = 1; k <= 4; k++) {
    const wasActive = stageStartMs[n][k] !== null;
    const nowActive = !!activeFlags[k - 1];
    if (nowActive && !wasActive) {
      // Rising edge: anchor this stage's start to the server clock now.
      // On restart, cleanupOrphanBatches (app.js) closes any running batch and a
      // fresh document is created on the next M120 cycle, so there is no prior
      // stage-start to recover — elapsed legitimately restarts with the new batch.
      stageStartMs[n][k] = Date.now();
    } else if (!nowActive && wasActive) {
      // Falling edge: clear
      stageStartMs[n][k] = null;
    }
    // active→active: leave unchanged (no-op)
  }

  // Compute stage_elapsed_ms: find active stage, compute elapsed
  let stage_elapsed_ms = null;
  for (let k = 1; k <= 4; k++) {
    if (activeFlags[k - 1] && stageStartMs[n][k] !== null) {
      stage_elapsed_ms = Math.max(0, Date.now() - stageStartMs[n][k]);
      break;
    }
  }

  // Consolidated emit: single event with 4-stage array, room-scoped
  const stagesArray = [
    {
      data: newData_gd_1,
      giai_doan: "Giai đoạn: 1",
      active: giai_doan_1 && typeof giai_doan_1 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_chay: thoi_gian_chay_gd1,
        so_lan_nhung: so_lan_nhung_gd1,
        thoi_gian_nhung: thoi_gian_nhung_gd1,
        thoi_gian_lap_lai: thoi_gian_lap_lai_gd1,
        nhiet_do_cai_dat: nhiet_do_cai_dat_gd1,
        vi_tri_muc_dau: vi_tri_muc_dau_gd_1,
      },
    },
    {
      data: newData_gd_2,
      giai_doan: "Giai đoạn: 2",
      active: giai_doan_2 && typeof giai_doan_2 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_chay: thoi_gian_chay_gd2,
        so_lan_nhung: so_lan_nhung_gd2,
        thoi_gian_nhung: thoi_gian_nhung_gd2,
        thoi_gian_lap_lai: thoi_gian_lap_lai_gd2,
        nhiet_do_cai_dat: nhiet_do_cai_dat_gd2,
        vi_tri_muc_dau: vi_tri_muc_dau_gd_2,
      },
    },
    {
      data: newData_gd_3,
      giai_doan: "Giai đoạn: 3",
      active: giai_doan_3 && typeof giai_doan_3 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_chay: thoi_gian_chay_gd3,
        so_lan_nhung: so_lan_nhung_gd3,
        thoi_gian_nhung: thoi_gian_nhung_gd3,
        thoi_gian_lap_lai: thoi_gian_lap_lai_gd3,
        nhiet_do_cai_dat: nhiet_do_cai_dat_gd3,
        vi_tri_muc_dau: vi_tri_muc_dau_gd_3,
      },
    },
    {
      data: newData_gd_4,
      giai_doan: "Giai đoạn: 4",
      active: giai_doan_4 && typeof giai_doan_4 === "boolean" ? true : false,
      tong_thoi_gian_chay: d60,
      set_giai_doan: {
        thoi_gian_treo_long: thoi_gian_treo_long_gd4,
      },
    },
  ];
  latestStages[n] = { stages: stagesArray, stage_elapsed_ms };
  io_.to("noi_" + n).emit("noi_chien_" + n + "_data", { stages: stagesArray, stage_elapsed_ms });
};

exports.getLatestStages = (n) => latestStages[n];
