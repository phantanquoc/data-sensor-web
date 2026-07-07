const crypto = require("crypto");
global.crypto = crypto;
const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
const path = require("path");
require("dotenv").config();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Cấu hình thư mục 'public' làm nơi chứa file tĩnh
app.use(express.static(path.join(__dirname, "pubic")));

app.set("view engine", "ejs");
app.set("views", "views");

app.post("/enable_machine", (req, res, next) => {
  console.log(req.body);
  res.json({
    success: true,
    data: req.body,
  });
});
const home = require("./router/home");
app.use(home);

let dbConnected = false;
let isServer = false;

// Luôn khởi động server trước
// app.listen(3000, "0.0.0.0", () => {
//   console.log("Server running on port 3000");
// });

let io_; // tạo socket
function startServer() {
  try {
    const server_app = app.listen(process.env.PORT_SERVER, "0.0.0.0", () => {
      console.log("Server running on port " + process.env.PORT_SERVER);
      isServer = true;

      io_ = require("socket.io")(server_app, {
        cors: {
          origin: "*",
        },
      });
      // Lưu io để dùng ở controller hoặc file khác
      app.set("io_", io_);
      // ===== Socket Connection =====
      io_.on("connection", (socket) => {
        console.log("Client connected:", socket.id);
        socket.emit("message", {
          text: "Connected successfully",
        });
        socket.on("disconnect", () => {
          console.log("Client disconnected:", socket.id);
        });
      });
    });

    server_app.on("error", (err) => {
      console.error("Server Error:", err);
      isServer = false;
      setTimeout(startServer, 5000);
    });

    server_app.on("close", () => {
      console.log("Server Closed");
      isServer = false;
      setTimeout(startServer, 5000);
    });
  } catch (err) {
    console.error("Start Server Error:", err);
    isServer = false;
    setTimeout(startServer, 5000);
  }
}
startServer();

// ======================
// MongoDB
// ======================
const mongoose = require("mongoose");

async function connectMongo() {
  try {
    // await mongoose.connect(
    //   "mongodb+srv://plc_data:123456789_@cluster0.t2derow.mongodb.net/mydb?appName=Cluster0",
    // );
    await mongoose.connect(process.env.MONGO_URI_LOCAL);
    dbConnected = true;
    console.log("MongoDB Connected");
  } catch (err) {
    dbConnected = false;
    console.error("MongoDB Error:", err.message);
    setTimeout(connectMongo, 5000);
  }
}
mongoose.connection.on("connected", () => {
  dbConnected = true;
  console.log("MongoDB Connected");
});
mongoose.connection.on("disconnected", () => {
  dbConnected = false;
  console.log("MongoDB Disconnected");
  setTimeout(connectMongo, 5000);
});
mongoose.connection.on("error", (err) => {
  dbConnected = false;
  console.error("MongoDB Error:", err.message);
});
connectMongo();

// ======================
// PLC
// ======================
// const { connectPLC, plcConnection } = require("./connectPLC");
const {
  connectPLC_1,
  connectPLC_2,
  connectPLC_3,
  connectPLC_4,
  connectPLC_5,
  connectPLC_6,
  connectPLC_7,
  connectPLC_8,
  plcConnection_1,
  plcConnection_2,
  plcConnection_3,
  plcConnection_4,
  plcConnection_5,
  plcConnection_6,
  plcConnection_7,
  plcConnection_8,
  getStatusConnectPLCs,
  update_StatusConnectPLC1,
  update_StatusConnectPLC2,
  update_StatusConnectPLC3,
  update_StatusConnectPLC4,
  update_StatusConnectPLC5,
  update_StatusConnectPLC6,
  update_StatusConnectPLC7,
  update_StatusConnectPLC8,
} = require("./connectPLC");

async function plcLoop_1() {
  try {
    const HMI1 = await connectPLC_1();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_1, 5000);
  }
}
plcLoop_1();

async function plcLoop_2() {
  try {
    const HMI2 = await connectPLC_2();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_2, 5000);
  }
}
plcLoop_2();

async function plcLoop_3() {
  try {
    const HMI3 = await connectPLC_3();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_3, 5000);
  }
}
plcLoop_3();

async function plcLoop_4() {
  try {
    const HMI4 = await connectPLC_4();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_4, 5000);
  }
}
plcLoop_4();

async function plcLoop_5() {
  try {
    const HMI5 = await connectPLC_5();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_5, 5000);
  }
}
plcLoop_5();

async function plcLoop_6() {
  try {
    const HMI6 = await connectPLC_6();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_6, 5000);
  }
}
plcLoop_6();

async function plcLoop_7() {
  try {
    const HMI7 = await connectPLC_7();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_7, 5000);
  }
}
plcLoop_7();

async function plcLoop_8() {
  try {
    const HMI8 = await connectPLC_8();
  } catch (err) {
    console.error("PLC Connect Error:", err.message);
    setTimeout(plcLoop_8, 5000);
  }
}
plcLoop_8();

//--------------
const post_data_to_db_1 = require("./controller/post_data_to_db_1");
const post_data_to_db_2 = require("./controller/post_data_to_db_2");
const post_data_to_db_3 = require("./controller/post_data_to_db_3");
const post_data_to_db_4 = require("./controller/post_data_to_db_4");
const post_data_to_db_5 = require("./controller/post_data_to_db_5");
const post_data_to_db_6 = require("./controller/post_data_to_db_6");
const post_data_to_db_7 = require("./controller/post_data_to_db_7");
const post_data_to_db_8 = require("./controller/post_data_to_db_8");

let Start_PLC1 = 0;
let Start_PLC2 = 0;
let Start_PLC3 = 0;
let Start_PLC4 = 0;
let Start_PLC5 = 0;
let Start_PLC6 = 0;
let Start_PLC7 = 0;
let Start_PLC8 = 0;
let isStart_PLC1 = false;
let isStart_PLC2 = false;
let isStart_PLC3 = false;
let isStart_PLC4 = false;
let isStart_PLC5 = false;
let isStart_PLC6 = false;
let isStart_PLC7 = false;
let isStart_PLC8 = false;
let timeGetdata = null;
const Buffer = require("buffer").Buffer;

const registerList_PLC1 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC2 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC3 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC4 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC5 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC6 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC7 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const registerList_PLC8 = [
  // --- THUỘC DẢI 1 (Từ D0 đến D400) -> modbusAddr = Tên thanh ghi ---
  { name: "D2", modbusAddr: 2, val: 0, dataType: "reg" },
  { name: "D3", modbusAddr: 3, val: 0, dataType: "reg" },

  { name: "D4", modbusAddr: 4, val: 0, dataType: "reg" },
  { name: "D5", modbusAddr: 5, val: 0, dataType: "reg" },

  { name: "D81", modbusAddr: 81, val: 0, dataType: "reg" },
  { name: "D82", modbusAddr: 82, val: 0, dataType: "reg" },

  { name: "D134", modbusAddr: 134, val: 0, dataType: "reg" },
  { name: "D135", modbusAddr: 135, val: 0, dataType: "reg" },

  { name: "D575", modbusAddr: 576, val: 0, dataType: "reg" },
  { name: "D576", modbusAddr: 577, val: 0, dataType: "reg" },

  { name: "D571", modbusAddr: 572, val: 0, dataType: "reg" },
  { name: "D572", modbusAddr: 573, val: 0, dataType: "reg" },

  // { name: "D704", modbusAddr: 705, val: 0, dataType: "reg" },
  // { name: "D705", modbusAddr: 706, val: 0, dataType: "reg" },
  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

  // { name: "D710", modbusAddr: 711, val: 0, dataType: "reg" },
  // { name: "D711", modbusAddr: 712, val: 0, dataType: "reg" },

  // { name: "D716", modbusAddr: 717, val: 0, dataType: "reg" },
  // { name: "D717", modbusAddr: 718, val: 0, dataType: "reg" },

  // { name: "D722", modbusAddr: 723, val: 0, dataType: "reg" },
  // { name: "D723", modbusAddr: 724, val: 0, dataType: "reg" },

  // khởi động
  { name: "M120", modbusAddr: 120 + 15000, val: 0, dataType: "coil" },

  //gia đoạn 1
  { name: "M70", modbusAddr: 70 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D260", modbusAddr: 260, val: 0, dataType: "reg" },
  { name: "D258", modbusAddr: 258, val: 0, dataType: "reg" },
  { name: "D256", modbusAddr: 256, val: 0, dataType: "reg" },
  { name: "D316", modbusAddr: 316, val: 0, dataType: "reg" },
  { name: "D500", modbusAddr: 501, val: 0, dataType: "reg" },
  { name: "D507", modbusAddr: 508, val: 0, dataType: "reg" },
  //gia đoạn 2
  { name: "M124", modbusAddr: 124 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D202", modbusAddr: 202, val: 0, dataType: "reg" },
  { name: "D262", modbusAddr: 262, val: 0, dataType: "reg" },
  { name: "D204", modbusAddr: 204, val: 0, dataType: "reg" },
  { name: "D264", modbusAddr: 264, val: 0, dataType: "reg" },
  { name: "D502", modbusAddr: 503, val: 0, dataType: "reg" },
  { name: "D508", modbusAddr: 509, val: 0, dataType: "reg" },
  //gia đoạn 3
  { name: "M126", modbusAddr: 126 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D206", modbusAddr: 206, val: 0, dataType: "reg" },
  { name: "D266", modbusAddr: 266, val: 0, dataType: "reg" },
  { name: "D208", modbusAddr: 208, val: 0, dataType: "reg" },
  { name: "D268", modbusAddr: 268, val: 0, dataType: "reg" },
  { name: "D504", modbusAddr: 505, val: 0, dataType: "reg" },
  { name: "D509", modbusAddr: 510, val: 0, dataType: "reg" },
  //giai đoạn 4
  { name: "M127", modbusAddr: 127 + 15000, val: 0, dataType: "coil" }, // đèn báo

  { name: "D214", modbusAddr: 214, val: 0, dataType: "reg" },

  //test X0
  { name: "X0", modbusAddr: 0 + 16000, val: 0, dataType: "coil" },
  //test M155
  { name: "M155", modbusAddr: 155 + 15000, val: 0, dataType: "coil" },

  //tổng thời gian chạy
  { name: "D60", modbusAddr: 60, val: 0, dataType: "reg" },
];

const values_PLC1 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC2 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC3 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC4 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC5 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC6 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC7 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

const values_PLC8 = {
  D2: null,
  D3: null,
  D4: null,
  D5: null,
  D81: null,
  D82: null,
  D134: null,
  D135: null,
  D575: null,
  D576: null,
  D571: null,
  D572: null,
  // D704: null,
  // D705: null,
  // D710: null,
  // D711: null,
  // D716: null,
  // D717: null,
  // D722: null,
  // D723: null,
  D84: null,
  D85: null,
  D86: null,
  D87: null,

  M120: null,
  M70: null,
  D260: null,
  D258: null,
  D256: null,
  D316: null,
  D500: null,
  D507: null,
  M124: null,
  D202: null,
  D262: null,
  D204: null,
  D264: null,
  D502: null,
  D508: null,
  M126: null,
  D206: null,
  D266: null,
  D208: null,
  D268: null,
  D504: null,
  D509: null,
  M127: null,
  //test X0
  X0: null,
  //test M155
  M155: null,

  D60: null,
};

let timerOut_else_plc1;
let timerOut_else_plc2;
let timerOut_else_plc3;
let timerOut_else_plc4;
let timerOut_else_plc5;
let timerOut_else_plc6;
let timerOut_else_plc7;
let timerOut_else_plc8;

timeGetdata = setInterval(() => {
  const {
    isConnectPLC_1,
    isConnectPLC_2,
    isConnectPLC_3,
    isConnectPLC_4,
    isConnectPLC_5,
    isConnectPLC_6,
    isConnectPLC_7,
    isConnectPLC_8,
  } = getStatusConnectPLCs();
  console.log(
    isConnectPLC_1,
    isConnectPLC_2,
    isConnectPLC_3,
    isConnectPLC_4,
    isConnectPLC_5,
    isConnectPLC_6,
    isConnectPLC_7,
    isConnectPLC_8,
  );
  //---------------HMI 1
  if (isConnectPLC_1) {
    if (dbConnected && isServer) {
      // plcConnection_1
      //   .readHoldingRegisters(4, 2)
      //   .then((response) => {
      //     const data_1 = response.data[0]; // register 2 (16-bit)
      //     const data_2 = response.data[1]; // register 3 (16-bit)
      //     console.log("Raw registers:", data_1, data_2);
      //     // Tạo buffer 4 byte để chứa 2 word (2 x 16-bit)
      //     const buf = Buffer.alloc(4);
      //     // Ghi mỗi register dưới dạng 16-bit
      //     buf.writeUInt16LE(data_1, 0); // byte 0-1
      //     buf.writeUInt16LE(data_2, 2); // byte 2-3
      //     // Đọc lại thành float 32-bit
      //     const floatValue = parseFloat(buf.readFloatLE(0).toFixed(2));
      //     console.log("Float value =", floatValue);
      //   })
      //   .catch((error) => {
      //     console.log("Read error:", error);
      //   });
      clearTimeout(timerOut_else_plc1);
      async function readAllRegisters() {
        const tasks = registerList_PLC1.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_1.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_1.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC1(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC1.map((reg) => {
          if (reg.name == "D2") values_PLC1.D2 = reg.val;
          if (reg.name == "D3") values_PLC1.D3 = reg.val;

          if (reg.name == "D4") values_PLC1.D4 = reg.val;
          if (reg.name == "D5") values_PLC1.D5 = reg.val;

          if (reg.name == "D81") values_PLC1.D81 = reg.val;
          if (reg.name == "D82") values_PLC1.D82 = reg.val;

          if (reg.name == "D134") values_PLC1.D134 = reg.val;
          if (reg.name == "D135") values_PLC1.D135 = reg.val;

          if (reg.name == "D575") values_PLC1.D575 = reg.val;
          if (reg.name == "D576") values_PLC1.D576 = reg.val;

          if (reg.name == "D571") values_PLC1.D571 = reg.val;
          if (reg.name == "D572") values_PLC1.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC1.D84 = reg.val;
          if (reg.name == "D85") values_PLC1.D85 = reg.val;
          if (reg.name == "D86") values_PLC1.D86 = reg.val;
          if (reg.name == "D87") values_PLC1.D87 = reg.val;

          if (reg.name == "D260") values_PLC1.D260 = reg.val;
          if (reg.name == "D258") values_PLC1.D258 = reg.val;
          if (reg.name == "D256") values_PLC1.D256 = reg.val;
          if (reg.name == "D316") values_PLC1.D316 = reg.val;
          if (reg.name == "D500") values_PLC1.D500 = reg.val;
          if (reg.name == "D507") values_PLC1.D507 = reg.val;

          if (reg.name == "D202") values_PLC1.D202 = reg.val;
          if (reg.name == "D262") values_PLC1.D262 = reg.val;
          if (reg.name == "D204") values_PLC1.D204 = reg.val;
          if (reg.name == "D264") values_PLC1.D264 = reg.val;
          if (reg.name == "D502") values_PLC1.D502 = reg.val;
          if (reg.name == "D508") values_PLC1.D508 = reg.val;

          if (reg.name == "D206") values_PLC1.D206 = reg.val;
          if (reg.name == "D266") values_PLC1.D266 = reg.val;
          if (reg.name == "D208") values_PLC1.D208 = reg.val;
          if (reg.name == "D268") values_PLC1.D268 = reg.val;
          if (reg.name == "D504") values_PLC1.D504 = reg.val;
          if (reg.name == "D509") values_PLC1.D509 = reg.val;

          if (reg.name == "D214") values_PLC1.D214 = reg.val;

          if (reg.name == "M120") values_PLC1.M120 = reg.val;
          if (reg.name == "M70") values_PLC1.M70 = reg.val;
          if (reg.name == "M124") values_PLC1.M124 = reg.val;
          if (reg.name == "M126") values_PLC1.M126 = reg.val;
          if (reg.name == "M127") values_PLC1.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC1.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC1.M155 = reg.val;

          if (reg.name == "D60") values_PLC1.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC1["M120"]);

        let giai_doan_1 = values_PLC1["M155"];
        let giai_doan_2 = values_PLC1["M124"];
        let giai_doan_3 = values_PLC1["M126"];
        let giai_doan_4 = values_PLC1["M127"];
        // start
        if (values_PLC1["M120"] && typeof values_PLC1["M120"] === "boolean") {
          isStart_PLC1 = true;
          Start_PLC1++;
          if (Start_PLC1 > 2) Start_PLC1 = 2;
          post_data_to_db_1.postDataPlc_to_noi_chien_1(
            values_PLC1,
            io_,
            Start_PLC1,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC1");
        }
        // Stop
        if (
          !values_PLC1["M120"] &&
          typeof values_PLC1["M120"] === "boolean" &&
          isStart_PLC1
        ) {
          Start_PLC1 = 0;
          isStart_PLC1 = false;
          post_data_to_db_1.postDataPlc_to_noi_chien_1(
            values_PLC1,
            io_,
            Start_PLC1,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC1");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc1 = setTimeout(plcLoop_1, 1000);
    console.log("đagn cố gắng kết nối else_plc1");
  }
  //---------------HMI 2
  if (isConnectPLC_2) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc2);
      async function readAllRegisters() {
        const tasks = registerList_PLC2.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_2.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_2.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC2(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC2.map((reg) => {
          if (reg.name == "D2") values_PLC2.D2 = reg.val;
          if (reg.name == "D3") values_PLC2.D3 = reg.val;

          if (reg.name == "D4") values_PLC2.D4 = reg.val;
          if (reg.name == "D5") values_PLC2.D5 = reg.val;

          if (reg.name == "D81") values_PLC2.D81 = reg.val;
          if (reg.name == "D82") values_PLC2.D82 = reg.val;

          if (reg.name == "D134") values_PLC2.D134 = reg.val;
          if (reg.name == "D135") values_PLC2.D135 = reg.val;

          if (reg.name == "D575") values_PLC2.D575 = reg.val;
          if (reg.name == "D576") values_PLC2.D576 = reg.val;

          if (reg.name == "D571") values_PLC2.D571 = reg.val;
          if (reg.name == "D572") values_PLC2.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC2.D84 = reg.val;
          if (reg.name == "D85") values_PLC2.D85 = reg.val;
          if (reg.name == "D86") values_PLC2.D86 = reg.val;
          if (reg.name == "D87") values_PLC2.D87 = reg.val;

          if (reg.name == "D260") values_PLC2.D260 = reg.val;
          if (reg.name == "D258") values_PLC2.D258 = reg.val;
          if (reg.name == "D256") values_PLC2.D256 = reg.val;
          if (reg.name == "D316") values_PLC2.D316 = reg.val;
          if (reg.name == "D500") values_PLC2.D500 = reg.val;
          if (reg.name == "D507") values_PLC2.D507 = reg.val;

          if (reg.name == "D202") values_PLC2.D202 = reg.val;
          if (reg.name == "D262") values_PLC2.D262 = reg.val;
          if (reg.name == "D204") values_PLC2.D204 = reg.val;
          if (reg.name == "D264") values_PLC2.D264 = reg.val;
          if (reg.name == "D502") values_PLC2.D502 = reg.val;
          if (reg.name == "D508") values_PLC2.D508 = reg.val;

          if (reg.name == "D206") values_PLC2.D206 = reg.val;
          if (reg.name == "D266") values_PLC2.D266 = reg.val;
          if (reg.name == "D208") values_PLC2.D208 = reg.val;
          if (reg.name == "D268") values_PLC2.D268 = reg.val;
          if (reg.name == "D504") values_PLC2.D504 = reg.val;
          if (reg.name == "D509") values_PLC2.D509 = reg.val;

          if (reg.name == "D214") values_PLC2.D214 = reg.val;

          if (reg.name == "M120") values_PLC2.M120 = reg.val;
          if (reg.name == "M70") values_PLC2.M70 = reg.val;
          if (reg.name == "M124") values_PLC2.M124 = reg.val;
          if (reg.name == "M126") values_PLC2.M126 = reg.val;
          if (reg.name == "M127") values_PLC2.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC2.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC2.M155 = reg.val;

          if (reg.name == "D60") values_PLC2.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC2["M120"]);

        let giai_doan_1 = values_PLC2["M155"];
        let giai_doan_2 = values_PLC2["M124"];
        let giai_doan_3 = values_PLC2["M126"];
        let giai_doan_4 = values_PLC2["M127"];
        // start
        if (values_PLC2["M120"] && typeof values_PLC2["M120"] === "boolean") {
          isStart_PLC2 = true;
          Start_PLC2++;
          if (Start_PLC2 > 2) Start_PLC2 = 2;
          post_data_to_db_2.postDataPlc_to_noi_chien_2(
            values_PLC2,
            io_,
            Start_PLC2,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC2");
        }
        // Stop
        if (
          !values_PLC2["M120"] &&
          typeof values_PLC2["M120"] === "boolean" &&
          isStart_PLC2
        ) {
          Start_PLC2 = 0;
          isStart_PLC2 = false;
          post_data_to_db_2.postDataPlc_to_noi_chien_2(
            values_PLC2,
            io_,
            Start_PLC2,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC2");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc2 = setTimeout(plcLoop_2, 1000);
    console.log("đagn cố gắng kết nối else_plc2");
  }
  //--------------------hmi 3 -------------------------------
  if (isConnectPLC_3) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc3);
      async function readAllRegisters() {
        const tasks = registerList_PLC3.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_3.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_3.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC3(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC3.map((reg) => {
          if (reg.name == "D2") values_PLC3.D2 = reg.val;
          if (reg.name == "D3") values_PLC3.D3 = reg.val;

          if (reg.name == "D4") values_PLC3.D4 = reg.val;
          if (reg.name == "D5") values_PLC3.D5 = reg.val;

          if (reg.name == "D81") values_PLC3.D81 = reg.val;
          if (reg.name == "D82") values_PLC3.D82 = reg.val;

          if (reg.name == "D134") values_PLC3.D134 = reg.val;
          if (reg.name == "D135") values_PLC3.D135 = reg.val;

          if (reg.name == "D575") values_PLC3.D575 = reg.val;
          if (reg.name == "D576") values_PLC3.D576 = reg.val;

          if (reg.name == "D571") values_PLC3.D571 = reg.val;
          if (reg.name == "D572") values_PLC3.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC3.D84 = reg.val;
          if (reg.name == "D85") values_PLC3.D85 = reg.val;
          if (reg.name == "D86") values_PLC3.D86 = reg.val;
          if (reg.name == "D87") values_PLC3.D87 = reg.val;

          if (reg.name == "D260") values_PLC3.D260 = reg.val;
          if (reg.name == "D258") values_PLC3.D258 = reg.val;
          if (reg.name == "D256") values_PLC3.D256 = reg.val;
          if (reg.name == "D316") values_PLC3.D316 = reg.val;
          if (reg.name == "D500") values_PLC3.D500 = reg.val;
          if (reg.name == "D507") values_PLC3.D507 = reg.val;

          if (reg.name == "D202") values_PLC3.D202 = reg.val;
          if (reg.name == "D262") values_PLC3.D262 = reg.val;
          if (reg.name == "D204") values_PLC3.D204 = reg.val;
          if (reg.name == "D264") values_PLC3.D264 = reg.val;
          if (reg.name == "D502") values_PLC3.D502 = reg.val;
          if (reg.name == "D508") values_PLC3.D508 = reg.val;

          if (reg.name == "D206") values_PLC3.D206 = reg.val;
          if (reg.name == "D266") values_PLC3.D266 = reg.val;
          if (reg.name == "D208") values_PLC3.D208 = reg.val;
          if (reg.name == "D268") values_PLC3.D268 = reg.val;
          if (reg.name == "D504") values_PLC3.D504 = reg.val;
          if (reg.name == "D509") values_PLC3.D509 = reg.val;

          if (reg.name == "D214") values_PLC3.D214 = reg.val;

          if (reg.name == "M120") values_PLC3.M120 = reg.val;
          if (reg.name == "M70") values_PLC3.M70 = reg.val;
          if (reg.name == "M124") values_PLC3.M124 = reg.val;
          if (reg.name == "M126") values_PLC3.M126 = reg.val;
          if (reg.name == "M127") values_PLC3.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC3.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC3.M155 = reg.val;

          if (reg.name == "D60") values_PLC3.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC3["M120"]);

        let giai_doan_1 = values_PLC3["M155"];
        let giai_doan_2 = values_PLC3["M124"];
        let giai_doan_3 = values_PLC3["M126"];
        let giai_doan_4 = values_PLC3["M127"];
        // start
        if (values_PLC3["M120"] && typeof values_PLC3["M120"] === "boolean") {
          isStart_PLC3 = true;
          Start_PLC3++;
          if (Start_PLC3 > 2) Start_PLC3 = 2;
          post_data_to_db_3.postDataPlc_to_noi_chien_3(
            values_PLC3,
            io_,
            Start_PLC3,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC3");
        }
        // Stop
        if (
          !values_PLC3["M120"] &&
          typeof values_PLC3["M120"] === "boolean" &&
          isStart_PLC3
        ) {
          Start_PLC3 = 0;
          isStart_PLC3 = false;
          post_data_to_db_3.postDataPlc_to_noi_chien_3(
            values_PLC3,
            io_,
            Start_PLC3,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC3");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc3 = setTimeout(plcLoop_3, 1000);
    console.log("đagn cố gắng kết nối else_plc3");
  }

  //------------------HMI 4--------------------
  if (isConnectPLC_4) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc4);
      async function readAllRegisters() {
        const tasks = registerList_PLC4.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_4.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_4.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC4(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC4.map((reg) => {
          if (reg.name == "D2") values_PLC4.D2 = reg.val;
          if (reg.name == "D3") values_PLC4.D3 = reg.val;

          if (reg.name == "D4") values_PLC4.D4 = reg.val;
          if (reg.name == "D5") values_PLC4.D5 = reg.val;

          if (reg.name == "D81") values_PLC4.D81 = reg.val;
          if (reg.name == "D82") values_PLC4.D82 = reg.val;

          if (reg.name == "D134") values_PLC4.D134 = reg.val;
          if (reg.name == "D135") values_PLC4.D135 = reg.val;

          if (reg.name == "D575") values_PLC4.D575 = reg.val;
          if (reg.name == "D576") values_PLC4.D576 = reg.val;

          if (reg.name == "D571") values_PLC4.D571 = reg.val;
          if (reg.name == "D572") values_PLC4.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC4.D84 = reg.val;
          if (reg.name == "D85") values_PLC4.D85 = reg.val;
          if (reg.name == "D86") values_PLC4.D86 = reg.val;
          if (reg.name == "D87") values_PLC4.D87 = reg.val;

          if (reg.name == "D260") values_PLC4.D260 = reg.val;
          if (reg.name == "D258") values_PLC4.D258 = reg.val;
          if (reg.name == "D256") values_PLC4.D256 = reg.val;
          if (reg.name == "D316") values_PLC4.D316 = reg.val;
          if (reg.name == "D500") values_PLC4.D500 = reg.val;
          if (reg.name == "D507") values_PLC4.D507 = reg.val;

          if (reg.name == "D202") values_PLC4.D202 = reg.val;
          if (reg.name == "D262") values_PLC4.D262 = reg.val;
          if (reg.name == "D204") values_PLC4.D204 = reg.val;
          if (reg.name == "D264") values_PLC4.D264 = reg.val;
          if (reg.name == "D502") values_PLC4.D502 = reg.val;
          if (reg.name == "D508") values_PLC4.D508 = reg.val;

          if (reg.name == "D206") values_PLC4.D206 = reg.val;
          if (reg.name == "D266") values_PLC4.D266 = reg.val;
          if (reg.name == "D208") values_PLC4.D208 = reg.val;
          if (reg.name == "D268") values_PLC4.D268 = reg.val;
          if (reg.name == "D504") values_PLC4.D504 = reg.val;
          if (reg.name == "D509") values_PLC4.D509 = reg.val;

          if (reg.name == "D214") values_PLC4.D214 = reg.val;

          if (reg.name == "M120") values_PLC4.M120 = reg.val;
          if (reg.name == "M70") values_PLC4.M70 = reg.val;
          if (reg.name == "M124") values_PLC4.M124 = reg.val;
          if (reg.name == "M126") values_PLC4.M126 = reg.val;
          if (reg.name == "M127") values_PLC4.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC4.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC4.M155 = reg.val;

          if (reg.name == "D60") values_PLC4.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC4["M120"]);

        let giai_doan_1 = values_PLC4["M155"];
        let giai_doan_2 = values_PLC4["M124"];
        let giai_doan_3 = values_PLC4["M126"];
        let giai_doan_4 = values_PLC4["M127"];
        // start
        if (values_PLC4["M120"] && typeof values_PLC4["M120"] === "boolean") {
          isStart_PLC4 = true;
          Start_PLC4++;
          if (Start_PLC4 > 2) Start_PLC4 = 2;
          post_data_to_db_4.postDataPlc_to_noi_chien_4(
            values_PLC4,
            io_,
            Start_PLC4,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC4");
        }
        // Stop
        if (
          !values_PLC4["M120"] &&
          typeof values_PLC4["M120"] === "boolean" &&
          isStart_PLC4
        ) {
          Start_PLC4 = 0;
          isStart_PLC4 = false;
          post_data_to_db_4.postDataPlc_to_noi_chien_4(
            values_PLC4,
            io_,
            Start_PLC4,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC4");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc4 = setTimeout(plcLoop_4, 1000);
    console.log("đagn cố gắng kết nối else_plc4");
  }

  //-------------------HMI5--------------------------------
  if (isConnectPLC_5) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc5);
      async function readAllRegisters() {
        const tasks = registerList_PLC5.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_5.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_5.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC5(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC5.map((reg) => {
          if (reg.name == "D2") values_PLC5.D2 = reg.val;
          if (reg.name == "D3") values_PLC5.D3 = reg.val;

          if (reg.name == "D4") values_PLC5.D4 = reg.val;
          if (reg.name == "D5") values_PLC5.D5 = reg.val;

          if (reg.name == "D81") values_PLC5.D81 = reg.val;
          if (reg.name == "D82") values_PLC5.D82 = reg.val;

          if (reg.name == "D134") values_PLC5.D134 = reg.val;
          if (reg.name == "D135") values_PLC5.D135 = reg.val;

          if (reg.name == "D575") values_PLC5.D575 = reg.val;
          if (reg.name == "D576") values_PLC5.D576 = reg.val;

          if (reg.name == "D571") values_PLC5.D571 = reg.val;
          if (reg.name == "D572") values_PLC5.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC5.D84 = reg.val;
          if (reg.name == "D85") values_PLC5.D85 = reg.val;
          if (reg.name == "D86") values_PLC5.D86 = reg.val;
          if (reg.name == "D87") values_PLC5.D87 = reg.val;

          if (reg.name == "D260") values_PLC5.D260 = reg.val;
          if (reg.name == "D258") values_PLC5.D258 = reg.val;
          if (reg.name == "D256") values_PLC5.D256 = reg.val;
          if (reg.name == "D316") values_PLC5.D316 = reg.val;
          if (reg.name == "D500") values_PLC5.D500 = reg.val;
          if (reg.name == "D507") values_PLC5.D507 = reg.val;

          if (reg.name == "D202") values_PLC5.D202 = reg.val;
          if (reg.name == "D262") values_PLC5.D262 = reg.val;
          if (reg.name == "D204") values_PLC5.D204 = reg.val;
          if (reg.name == "D264") values_PLC5.D264 = reg.val;
          if (reg.name == "D502") values_PLC5.D502 = reg.val;
          if (reg.name == "D508") values_PLC5.D508 = reg.val;

          if (reg.name == "D206") values_PLC5.D206 = reg.val;
          if (reg.name == "D266") values_PLC5.D266 = reg.val;
          if (reg.name == "D208") values_PLC5.D208 = reg.val;
          if (reg.name == "D268") values_PLC5.D268 = reg.val;
          if (reg.name == "D504") values_PLC5.D504 = reg.val;
          if (reg.name == "D509") values_PLC5.D509 = reg.val;

          if (reg.name == "D214") values_PLC5.D214 = reg.val;

          if (reg.name == "M120") values_PLC5.M120 = reg.val;
          if (reg.name == "M70") values_PLC5.M70 = reg.val;
          if (reg.name == "M124") values_PLC5.M124 = reg.val;
          if (reg.name == "M126") values_PLC5.M126 = reg.val;
          if (reg.name == "M127") values_PLC5.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC5.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC5.M155 = reg.val;

          if (reg.name == "D60") values_PLC5.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC5["M120"]);

        let giai_doan_1 = values_PLC5["M155"];
        let giai_doan_2 = values_PLC5["M124"];
        let giai_doan_3 = values_PLC5["M126"];
        let giai_doan_4 = values_PLC5["M127"];
        // start
        if (values_PLC5["M120"] && typeof values_PLC5["M120"] === "boolean") {
          isStart_PLC5 = true;
          Start_PLC5++;
          if (Start_PLC5 > 2) Start_PLC5 = 2;
          post_data_to_db_5.postDataPlc_to_noi_chien_5(
            values_PLC5,
            io_,
            Start_PLC5,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC5");
        }
        // Stop
        if (
          !values_PLC5["M120"] &&
          typeof values_PLC5["M120"] === "boolean" &&
          isStart_PLC5
        ) {
          Start_PLC5 = 0;
          isStart_PLC5 = false;
          post_data_to_db_5.postDataPlc_to_noi_chien_5(
            values_PLC5,
            io_,
            Start_PLC5,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC5");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc5 = setTimeout(plcLoop_5, 1000);
    console.log("đagn cố gắng kết nối else_plc5");
  }

  //-------------------HMI6--------------------------------
  if (isConnectPLC_6) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc6);
      async function readAllRegisters() {
        const tasks = registerList_PLC6.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_6.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_6.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC6(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC6.map((reg) => {
          if (reg.name == "D2") values_PLC6.D2 = reg.val;
          if (reg.name == "D3") values_PLC6.D3 = reg.val;

          if (reg.name == "D4") values_PLC6.D4 = reg.val;
          if (reg.name == "D5") values_PLC6.D5 = reg.val;

          if (reg.name == "D81") values_PLC6.D81 = reg.val;
          if (reg.name == "D82") values_PLC6.D82 = reg.val;

          if (reg.name == "D134") values_PLC6.D134 = reg.val;
          if (reg.name == "D135") values_PLC6.D135 = reg.val;

          if (reg.name == "D575") values_PLC6.D575 = reg.val;
          if (reg.name == "D576") values_PLC6.D576 = reg.val;

          if (reg.name == "D571") values_PLC6.D571 = reg.val;
          if (reg.name == "D572") values_PLC6.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC6.D84 = reg.val;
          if (reg.name == "D85") values_PLC6.D85 = reg.val;
          if (reg.name == "D86") values_PLC6.D86 = reg.val;
          if (reg.name == "D87") values_PLC6.D87 = reg.val;

          if (reg.name == "D260") values_PLC6.D260 = reg.val;
          if (reg.name == "D258") values_PLC6.D258 = reg.val;
          if (reg.name == "D256") values_PLC6.D256 = reg.val;
          if (reg.name == "D316") values_PLC6.D316 = reg.val;
          if (reg.name == "D500") values_PLC6.D500 = reg.val;
          if (reg.name == "D507") values_PLC6.D507 = reg.val;

          if (reg.name == "D202") values_PLC6.D202 = reg.val;
          if (reg.name == "D262") values_PLC6.D262 = reg.val;
          if (reg.name == "D204") values_PLC6.D204 = reg.val;
          if (reg.name == "D264") values_PLC6.D264 = reg.val;
          if (reg.name == "D502") values_PLC6.D502 = reg.val;
          if (reg.name == "D508") values_PLC6.D508 = reg.val;

          if (reg.name == "D206") values_PLC6.D206 = reg.val;
          if (reg.name == "D266") values_PLC6.D266 = reg.val;
          if (reg.name == "D208") values_PLC6.D208 = reg.val;
          if (reg.name == "D268") values_PLC6.D268 = reg.val;
          if (reg.name == "D504") values_PLC6.D504 = reg.val;
          if (reg.name == "D509") values_PLC6.D509 = reg.val;

          if (reg.name == "D214") values_PLC6.D214 = reg.val;

          if (reg.name == "M120") values_PLC6.M120 = reg.val;
          if (reg.name == "M70") values_PLC6.M70 = reg.val;
          if (reg.name == "M124") values_PLC6.M124 = reg.val;
          if (reg.name == "M126") values_PLC6.M126 = reg.val;
          if (reg.name == "M127") values_PLC6.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC6.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC6.M155 = reg.val;

          if (reg.name == "D60") values_PLC6.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC6["M120"]);

        let giai_doan_1 = values_PLC6["M155"];
        let giai_doan_2 = values_PLC6["M124"];
        let giai_doan_3 = values_PLC6["M126"];
        let giai_doan_4 = values_PLC6["M127"];
        // start
        if (values_PLC6["M120"] && typeof values_PLC6["M120"] === "boolean") {
          isStart_PLC6 = true;
          Start_PLC6++;
          if (Start_PLC6 > 2) Start_PLC6 = 2;
          post_data_to_db_6.postDataPlc_to_noi_chien_6(
            values_PLC6,
            io_,
            Start_PLC6,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC6");
        }
        // Stop
        if (
          !values_PLC6["M120"] &&
          typeof values_PLC6["M120"] === "boolean" &&
          isStart_PLC6
        ) {
          Start_PLC6 = 0;
          isStart_PLC6 = false;
          post_data_to_db_6.postDataPlc_to_noi_chien_6(
            values_PLC6,
            io_,
            Start_PLC6,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC6");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc6 = setTimeout(plcLoop_6, 1000);
    console.log("đagn cố gắng kết nối else_plc6");
  }
  //-------------------HMI7--------------------------------
  if (isConnectPLC_7) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc7);
      async function readAllRegisters() {
        const tasks = registerList_PLC7.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_7.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_7.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC7(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC7.map((reg) => {
          if (reg.name == "D2") values_PLC7.D2 = reg.val;
          if (reg.name == "D3") values_PLC7.D3 = reg.val;

          if (reg.name == "D4") values_PLC7.D4 = reg.val;
          if (reg.name == "D5") values_PLC7.D5 = reg.val;

          if (reg.name == "D81") values_PLC7.D81 = reg.val;
          if (reg.name == "D82") values_PLC7.D82 = reg.val;

          if (reg.name == "D134") values_PLC7.D134 = reg.val;
          if (reg.name == "D135") values_PLC7.D135 = reg.val;

          if (reg.name == "D575") values_PLC7.D575 = reg.val;
          if (reg.name == "D576") values_PLC7.D576 = reg.val;

          if (reg.name == "D571") values_PLC7.D571 = reg.val;
          if (reg.name == "D572") values_PLC7.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC7.D84 = reg.val;
          if (reg.name == "D85") values_PLC7.D85 = reg.val;
          if (reg.name == "D86") values_PLC7.D86 = reg.val;
          if (reg.name == "D87") values_PLC7.D87 = reg.val;

          if (reg.name == "D260") values_PLC7.D260 = reg.val;
          if (reg.name == "D258") values_PLC7.D258 = reg.val;
          if (reg.name == "D256") values_PLC7.D256 = reg.val;
          if (reg.name == "D316") values_PLC7.D316 = reg.val;
          if (reg.name == "D500") values_PLC7.D500 = reg.val;
          if (reg.name == "D507") values_PLC7.D507 = reg.val;

          if (reg.name == "D202") values_PLC7.D202 = reg.val;
          if (reg.name == "D262") values_PLC7.D262 = reg.val;
          if (reg.name == "D204") values_PLC7.D204 = reg.val;
          if (reg.name == "D264") values_PLC7.D264 = reg.val;
          if (reg.name == "D502") values_PLC7.D502 = reg.val;
          if (reg.name == "D508") values_PLC7.D508 = reg.val;

          if (reg.name == "D206") values_PLC7.D206 = reg.val;
          if (reg.name == "D266") values_PLC7.D266 = reg.val;
          if (reg.name == "D208") values_PLC7.D208 = reg.val;
          if (reg.name == "D268") values_PLC7.D268 = reg.val;
          if (reg.name == "D504") values_PLC7.D504 = reg.val;
          if (reg.name == "D509") values_PLC7.D509 = reg.val;

          if (reg.name == "D214") values_PLC7.D214 = reg.val;

          if (reg.name == "M120") values_PLC7.M120 = reg.val;
          if (reg.name == "M70") values_PLC7.M70 = reg.val;
          if (reg.name == "M124") values_PLC7.M124 = reg.val;
          if (reg.name == "M126") values_PLC7.M126 = reg.val;
          if (reg.name == "M127") values_PLC7.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC7.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC7.M155 = reg.val;

          if (reg.name == "D60") values_PLC7.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC7["M120"]);

        let giai_doan_1 = values_PLC7["M155"];
        let giai_doan_2 = values_PLC7["M124"];
        let giai_doan_3 = values_PLC7["M126"];
        let giai_doan_4 = values_PLC7["M127"];
        // start
        if (values_PLC7["M120"] && typeof values_PLC7["M120"] === "boolean") {
          isStart_PLC7 = true;
          Start_PLC7++;
          if (Start_PLC7 > 2) Start_PLC7 = 2;
          post_data_to_db_7.postDataPlc_to_noi_chien_7(
            values_PLC7,
            io_,
            Start_PLC7,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC7");
        }
        // Stop
        if (
          !values_PLC7["M120"] &&
          typeof values_PLC7["M120"] === "boolean" &&
          isStart_PLC7
        ) {
          Start_PLC7 = 0;
          isStart_PLC7 = false;
          post_data_to_db_7.postDataPlc_to_noi_chien_7(
            values_PLC7,
            io_,
            Start_PLC7,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC7");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc7 = setTimeout(plcLoop_7, 1000);
    console.log("đagn cố gắng kết nối else_plc7");
  }
  //-------------------HMI8--------------------------------
  if (isConnectPLC_8) {
    if (dbConnected && isServer) {
      clearTimeout(timerOut_else_plc8);
      async function readAllRegisters() {
        const tasks = registerList_PLC8.map(async (reg) => {
          try {
            if (reg.dataType == "reg") {
              const response = await plcConnection_8.readHoldingRegisters(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
            if (reg.dataType == "coil") {
              const response = await plcConnection_8.readCoils(
                reg.modbusAddr,
                1,
              );
              reg.val = response.data[0];
            }
          } catch (err) {
            reg.val = 0;
            update_StatusConnectPLC8(false);
          }
        });
        await Promise.all(tasks);
        console.log("Tất cả đã hoàn tất");

        registerList_PLC8.map((reg) => {
          if (reg.name == "D2") values_PLC8.D2 = reg.val;
          if (reg.name == "D3") values_PLC8.D3 = reg.val;

          if (reg.name == "D4") values_PLC8.D4 = reg.val;
          if (reg.name == "D5") values_PLC8.D5 = reg.val;

          if (reg.name == "D81") values_PLC8.D81 = reg.val;
          if (reg.name == "D82") values_PLC8.D82 = reg.val;

          if (reg.name == "D134") values_PLC8.D134 = reg.val;
          if (reg.name == "D135") values_PLC8.D135 = reg.val;

          if (reg.name == "D575") values_PLC8.D575 = reg.val;
          if (reg.name == "D576") values_PLC8.D576 = reg.val;

          if (reg.name == "D571") values_PLC8.D571 = reg.val;
          if (reg.name == "D572") values_PLC8.D572 = reg.val;

          // if (reg.name == "D704") values.D704 = reg.val;
          // if (reg.name == "D705") values.D705 = reg.val;

          // if (reg.name == "D710") values.D710 = reg.val;
          // if (reg.name == "D711") values.D711 = reg.val;

          // if (reg.name == "D716") values.D716 = reg.val;
          // if (reg.name == "D717") values.D717 = reg.val;

          // if (reg.name == "D722") values.D722 = reg.val;
          // if (reg.name == "D723") values.D723 = reg.val;

          if (reg.name == "D84") values_PLC8.D84 = reg.val;
          if (reg.name == "D85") values_PLC8.D85 = reg.val;
          if (reg.name == "D86") values_PLC8.D86 = reg.val;
          if (reg.name == "D87") values_PLC8.D87 = reg.val;

          if (reg.name == "D260") values_PLC8.D260 = reg.val;
          if (reg.name == "D258") values_PLC8.D258 = reg.val;
          if (reg.name == "D256") values_PLC8.D256 = reg.val;
          if (reg.name == "D316") values_PLC8.D316 = reg.val;
          if (reg.name == "D500") values_PLC8.D500 = reg.val;
          if (reg.name == "D507") values_PLC8.D507 = reg.val;

          if (reg.name == "D202") values_PLC8.D202 = reg.val;
          if (reg.name == "D262") values_PLC8.D262 = reg.val;
          if (reg.name == "D204") values_PLC8.D204 = reg.val;
          if (reg.name == "D264") values_PLC8.D264 = reg.val;
          if (reg.name == "D502") values_PLC8.D502 = reg.val;
          if (reg.name == "D508") values_PLC8.D508 = reg.val;

          if (reg.name == "D206") values_PLC8.D206 = reg.val;
          if (reg.name == "D266") values_PLC8.D266 = reg.val;
          if (reg.name == "D208") values_PLC8.D208 = reg.val;
          if (reg.name == "D268") values_PLC8.D268 = reg.val;
          if (reg.name == "D504") values_PLC8.D504 = reg.val;
          if (reg.name == "D509") values_PLC8.D509 = reg.val;

          if (reg.name == "D214") values_PLC8.D214 = reg.val;

          if (reg.name == "M120") values_PLC8.M120 = reg.val;
          if (reg.name == "M70") values_PLC8.M70 = reg.val;
          if (reg.name == "M124") values_PLC8.M124 = reg.val;
          if (reg.name == "M126") values_PLC8.M126 = reg.val;
          if (reg.name == "M127") values_PLC8.M127 = reg.val;

          //test X0
          if (reg.name == "X0") values_PLC8.X0 = reg.val;
          //test M155
          if (reg.name == "M155") values_PLC8.M155 = reg.val;

          if (reg.name == "D60") values_PLC8.D60 = reg.val;
        });
        console.log(`values["M120"] `, values_PLC8["M120"]);

        let giai_doan_1 = values_PLC8["M155"];
        let giai_doan_2 = values_PLC8["M124"];
        let giai_doan_3 = values_PLC8["M126"];
        let giai_doan_4 = values_PLC8["M127"];
        // start
        if (values_PLC8["M120"] && typeof values_PLC8["M120"] === "boolean") {
          isStart_PLC8 = true;
          Start_PLC8++;
          if (Start_PLC8 > 2) Start_PLC8 = 2;
          post_data_to_db_8.postDataPlc_to_noi_chien_8(
            values_PLC8,
            io_,
            Start_PLC8,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã gét data PLC8");
        }
        // Stop
        if (
          !values_PLC8["M120"] &&
          typeof values_PLC8["M120"] === "boolean" &&
          isStart_PLC8
        ) {
          Start_PLC8 = 0;
          isStart_PLC8 = false;
          post_data_to_db_8.postDataPlc_to_noi_chien_8(
            values_PLC8,
            io_,
            Start_PLC8,
            giai_doan_1,
            giai_doan_2,
            giai_doan_3,
            giai_doan_4,
          );
          console.log("đã stop gét data PLC8");
        }
      }
      readAllRegisters();
    }
  } else {
    timerOut_else_plc8 = setTimeout(plcLoop_8, 1000);
    console.log("đagn cố gắng kết nối else_plc8");
  }
}, 3000);

//------------------------
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION");
  console.error(err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION");
  console.error(err);
});
