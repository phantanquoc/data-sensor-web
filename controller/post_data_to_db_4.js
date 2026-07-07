const PLCData_noi_chien_4 = require("../model/noi_chien_4_data");
const Buffer = require("buffer").Buffer;
let id_document_plc_4;

exports.postDataPlc_to_noi_chien_4 = async (
  values,
  io_,
  Start_PLC4,
  giai_doan_1,
  giai_doan_2,
  giai_doan_3,
  giai_doan_4,
) => {
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

  // let d704 = values && values["D704"] !== undefined ? values["D704"] : 0;
  // let d705 = values && values["D705"] !== undefined ? values["D705"] : 0;
  // const buf_704_705 = Buffer.alloc(4);
  // buf_704_705.writeUInt16LE(d704, 0);
  // buf_704_705.writeUInt16LE(d705, 2);
  // let d_704_705 = parseFloat(buf_704_705.readFloatLE(0).toFixed(2));

  // let d710 = values && values["D710"] !== undefined ? values["D710"] : 0;
  // let d711 = values && values["D711"] !== undefined ? values["D711"] : 0;
  // const buf_710_711 = Buffer.alloc(4);
  // buf_710_711.writeUInt16LE(d710, 0);
  // buf_710_711.writeUInt16LE(d711, 2);
  // let d_710_711 = parseFloat(buf_710_711.readFloatLE(0).toFixed(2));

  // let d716 = values && values["D716"] !== undefined ? values["D716"] : 0;
  // let d717 = values && values["D717"] !== undefined ? values["D717"] : 0;
  // const buf_716_717 = Buffer.alloc(4);
  // buf_716_717.writeUInt16LE(d716, 0);
  // buf_716_717.writeUInt16LE(d717, 2);
  // let d_716_717 = parseFloat(buf_716_717.readFloatLE(0).toFixed(2));

  // let d722 = values && values["D722"] !== undefined ? values["D722"] : 0;
  // let d723 = values && values["D723"] !== undefined ? values["D723"] : 0;
  // const buf_722_723 = Buffer.alloc(4);
  // buf_722_723.writeUInt16LE(d722, 0);
  // buf_722_723.writeUInt16LE(d723, 2);
  // let d_722_723 = parseFloat(buf_722_723.readFloatLE(0).toFixed(2));

  let d84 = values && values["D84"] !== undefined ? values["D84"] : 0;
  let d85 = values && values["D85"] !== undefined ? values["D85"] : 0;
  let d86 = values && values["D86"] !== undefined ? values["D86"] : 0;
  let d87 = values && values["D87"] !== undefined ? values["D87"] : 0;

  let d60 = values && values["D60"] !== undefined ? values["D60"] : 0;

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
  // save data to mongoo
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

  // khởi tạo
  if (Start_PLC4 === 1) {
    const docunent = await PLCData_noi_chien_4.create(dataFormat).catch(
      (err) => {
        console.log(err);
      },
    );
    if (docunent) id_document_plc_4 = docunent._id;
  }
  // update
  if (Start_PLC4 > 1) {
    // read mongoodb về và update data
    //giai đoạn 1
    if (giai_doan_1 && typeof giai_doan_1 === "boolean") {
      const document = await PLCData_noi_chien_4.findByIdAndUpdate(
        id_document_plc_4,
        {
          tong_thoi_gian_chay: d60,
          $set: {
            "giai_doan_1.thoi_gian_chay": thoi_gian_chay_gd1,
            "giai_doan_1.so_lan_nhung": so_lan_nhung_gd1,
            "giai_doan_1.thoi_gian_nhung": thoi_gian_nhung_gd1,
            "giai_doan_1.thoi_gian_lap_lai": thoi_gian_lap_lai_gd1,
            "giai_doan_1.nhiet_do_cai_dat": nhiet_do_cai_dat_gd1,
            "giai_doan_1.vi_tri_dung": vi_tri_muc_dau_gd_1,
          },
          $push: {
            "giai_doan_1.bien_du_lieu": newData_gd_1,
          },
        },
        { new: true },
      );
      console.log("giai đoạn 1");

      io_.emit("noi_chien_4_data", {
        data: newData_gd_1,
        giai_doan: "Giai đoạn: 1",
        tong_thoi_gian_chay: d60,
        set_giai_doan: {
          thoi_gian_chay: thoi_gian_chay_gd1,
          so_lan_nhung: so_lan_nhung_gd1,
          thoi_gian_nhung: thoi_gian_nhung_gd1,
          thoi_gian_lap_lai: thoi_gian_lap_lai_gd1,
          nhiet_do_cai_dat: nhiet_do_cai_dat_gd1,
          vi_tri_muc_dau: vi_tri_muc_dau_gd_1,
        },
      });
    }
    // giai đoạn 2
    if (giai_doan_2 && typeof giai_doan_2 === "boolean") {
      const document = await PLCData_noi_chien_4.findByIdAndUpdate(
        id_document_plc_4,
        {
          tong_thoi_gian_chay: d60,
          $set: {
            "giai_doan_2.thoi_gian_chay": thoi_gian_chay_gd2,
            "giai_doan_2.so_lan_nhung": so_lan_nhung_gd2,
            "giai_doan_2.thoi_gian_nhung": thoi_gian_nhung_gd2,
            "giai_doan_2.thoi_gian_lap_lai": thoi_gian_lap_lai_gd2,
            "giai_doan_2.nhiet_do_cai_dat": nhiet_do_cai_dat_gd2,
            "giai_doan_2.vi_tri_dung": vi_tri_muc_dau_gd_2,
          },
          $push: {
            "giai_doan_2.bien_du_lieu": newData_gd_2,
          },
        },
        { new: true },
      );
      console.log("giai đoạn 2");
      io_.emit("noi_chien_4_data", {
        data: newData_gd_2,
        giai_doan: "Giai đoạn: 2",
        tong_thoi_gian_chay: d60,
        set_giai_doan: {
          thoi_gian_chay: thoi_gian_chay_gd2,
          so_lan_nhung: so_lan_nhung_gd2,
          thoi_gian_nhung: thoi_gian_nhung_gd2,
          thoi_gian_lap_lai: thoi_gian_lap_lai_gd2,
          nhiet_do_cai_dat: nhiet_do_cai_dat_gd2,
          vi_tri_muc_dau: vi_tri_muc_dau_gd_2,
        },
      });
    }
    //giai đoạn 3
    if (giai_doan_3 && typeof giai_doan_3 === "boolean") {
      const document = await PLCData_noi_chien_4.findByIdAndUpdate(
        id_document_plc_4,
        {
          tong_thoi_gian_chay: d60,
          $set: {
            "giai_doan_3.thoi_gian_chay": thoi_gian_chay_gd3,
            "giai_doan_3.so_lan_nhung": so_lan_nhung_gd3,
            "giai_doan_3.thoi_gian_nhung": thoi_gian_nhung_gd3,
            "giai_doan_3.thoi_gian_lap_lai": thoi_gian_lap_lai_gd3,
            "giai_doan_3.nhiet_do_cai_dat": nhiet_do_cai_dat_gd3,
            "giai_doan_3.vi_tri_dung": vi_tri_muc_dau_gd_3,
          },
          $push: {
            "giai_doan_3.bien_du_lieu": newData_gd_3,
          },
        },
        { new: true },
      );
      console.log("giai đoạn: 3");
      io_.emit("noi_chien_4_data", {
        data: newData_gd_3,
        giai_doan: "Giai đoạn: 3",
        tong_thoi_gian_chay: d60,
        set_giai_doan: {
          thoi_gian_chay: thoi_gian_chay_gd3,
          so_lan_nhung: so_lan_nhung_gd3,
          thoi_gian_nhung: thoi_gian_nhung_gd3,
          thoi_gian_lap_lai: thoi_gian_lap_lai_gd3,
          nhiet_do_cai_dat: nhiet_do_cai_dat_gd3,
          vi_tri_muc_dau: vi_tri_muc_dau_gd_3,
        },
      });
    }
    //giai đoạn 4
    if (giai_doan_4 && typeof giai_doan_4 === "boolean") {
      const document = await PLCData_noi_chien_4.findByIdAndUpdate(
        id_document_plc_4,
        {
          tong_thoi_gian_chay: d60,
          $set: {
            "giai_doan_4.thoi_gian_treo_long": thoi_gian_treo_long_gd4,
          },
          $push: {
            "giai_doan_4.bien_du_lieu": newData_gd_4,
          },
        },
        { new: true },
      );
      console.log("giai đoạn 4");
      io_.emit("noi_chien_4_data", {
        data: newData_gd_4,
        giai_doan: "Giai đoạn: 4",
        tong_thoi_gian_chay: d60,
        set_giai_doan: {
          thoi_gian_treo_long: thoi_gian_treo_long_gd4,
        },
      });
    }
  }

  // update stop
  if (Start_PLC4 === 0) {
    const document = await PLCData_noi_chien_4.findByIdAndUpdate(
      id_document_plc_4,
      {
        thoi_gian_stop: new Date().toLocaleString("vi-VN"),
      },
      { new: true },
    );
    console.log(document);
    io_.emit("noi_chien_4_stop", {
      stop: "đã hoang thành xong mẽ chiên",
    });
  }
};
