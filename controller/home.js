const PLCData_noi_chien_1 = require("../model/noi_chien_1_data");
const PLCData_noi_chien_2 = require("../model/noi_chien_2_data");
const PLCData_noi_chien_3 = require("../model/noi_chien_3_data");
const PLCData_noi_chien_4 = require("../model/noi_chien_4_data");
const PLCData_noi_chien_5 = require("../model/noi_chien_5_data");
const PLCData_noi_chien_6 = require("../model/noi_chien_6_data");
const PLCData_noi_chien_7 = require("../model/noi_chien_7_data");
const PLCData_noi_chien_8 = require("../model/noi_chien_8_data");

exports.home = async (req, res, next) => {
  try {
    // PLCData_noi_chien_1.find();
    // .then((PLCDatas) => {
    //   res.render("view_home", {
    //     probs: PLCDatas,
    //   });
    // })
    // .catch((err) => {
    //   console.log(err);
    // });
    res.render("view_home", {
      probs: "PLCDatas",
    });
  } catch (error) {
    console.log(error);
  }
};

exports.noi_chien = async (req, res, next) => {
  let so_noiChien = req.query.so_noiChien;
  if (so_noiChien == 1) {
    PLCData_noi_chien_1.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 2) {
    PLCData_noi_chien_2.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 3) {
    PLCData_noi_chien_3.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 4) {
    PLCData_noi_chien_4.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 5) {
    PLCData_noi_chien_5.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 6) {
    PLCData_noi_chien_6.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 7) {
    PLCData_noi_chien_7.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 8) {
    PLCData_noi_chien_8.find()
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
};

exports.get_noi_chien_detail = async (req, res, next) => {
  let id_noi_chien = req.query.id;
  let so_noiChien = req.query.so_noiChien;
  if (so_noiChien == 1) {
    PLCData_noi_chien_1.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 2) {
    PLCData_noi_chien_2.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 3) {
    PLCData_noi_chien_3.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 4) {
    PLCData_noi_chien_4.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 5) {
    PLCData_noi_chien_5.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 6) {
    PLCData_noi_chien_6.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 7) {
    PLCData_noi_chien_7.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 8) {
    PLCData_noi_chien_8.findById(id_noi_chien)
      .then((PLCDatas) => {
        res.send(PLCDatas);
      })
      .catch((err) => {
        console.log(err);
      });
  }
};

exports.xoa_noi_chien_detail = async (req, res, next) => {
  let id_noi_chien = req.query.id;
  let so_noiChien = req.query.so_noiChien;
  if (so_noiChien == 1) {
    PLCData_noi_chien_1.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 2) {
    PLCData_noi_chien_2.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 3) {
    PLCData_noi_chien_3.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 4) {
    PLCData_noi_chien_4.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 5) {
    PLCData_noi_chien_5.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 6) {
    PLCData_noi_chien_6.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 7) {
    PLCData_noi_chien_7.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
  if (so_noiChien == 8) {
    PLCData_noi_chien_8.findByIdAndDelete(id_noi_chien)
      .then((PLCDatas) => {
        res.send({ success: true });
      })
      .catch((err) => {
        console.log(err);
      });
  }
};
