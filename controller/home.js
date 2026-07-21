const plcModels = require("../model/plc_schema");

exports.noi_chien = async (req, res, next) => {
  const n = parseInt(req.query.so_noiChien);
  if (n >= 1 && n <= 8) {
    plcModels[n]
      .find()
      .select('thoi_gian_start thoi_gian_stop dong_ep_khoi_dong')
      .lean()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
};

exports.get_noi_chien_detail = async (req, res, next) => {
  const id_noi_chien = req.query.id;
  const n = parseInt(req.query.so_noiChien);
  if (n >= 1 && n <= 8) {
    plcModels[n]
      .findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
};

exports.xoa_noi_chien_detail = async (req, res, next) => {
  const id_noi_chien = req.query.id;
  const n = parseInt(req.query.so_noiChien);
  if (n >= 1 && n <= 8) {
    plcModels[n]
      .findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
};
