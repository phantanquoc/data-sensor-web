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
let orphanCleanupDone = false;

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
    await mongoose.connect(process.env.MONGO_URI);
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
  if (!orphanCleanupDone) {
    orphanCleanupDone = true;
    cleanupOrphanBatches();
  }
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
// PLC — config-driven
// ======================
const { plcConnections, connect, getStatus, updateStatus } = require("./connectPLC");
const plcModels = require("./model/plc_schema");
const { postDataPlc } = require("./controller/post_data_plc");
const { Buffer } = require("buffer");

// Dọn mẻ mồ côi (mẻ chưa stop) khi khởi động lại hệ thống
async function cleanupOrphanBatches() {
  for (let n = 1; n <= 8; n++) {
    await plcModels[n].updateMany(
      { thoi_gian_stop: "" },
      { $set: { thoi_gian_stop: new Date().toLocaleString("vi-VN"), dong_ep_khoi_dong: true } },
    ).catch((err) => console.log(err));
  }
  console.log("Đã dọn mẻ mồ côi");
}

// Shared register-list template — cloned per fryer so each fryer owns its reg.val state
const REGISTER_LIST_TEMPLATE = [
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

  { name: "D84", modbusAddr: 84, val: 0, dataType: "reg" },
  { name: "D85", modbusAddr: 85, val: 0, dataType: "reg" },
  { name: "D86", modbusAddr: 86, val: 0, dataType: "reg" },
  { name: "D87", modbusAddr: 87, val: 0, dataType: "reg" },

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

// PLC config array — one entry per fryer
// Each fryer gets its own cloned register list (deep clone ensures isolated reg.val state)
const PLC_CONFIGS = [];
for (let n = 1; n <= 8; n++) {
  PLC_CONFIGS.push({
    index: n,
    ipEnv: "IP_PLC" + n,
    model: plcModels[n],
    registerList: REGISTER_LIST_TEMPLATE.map((r) => Object.assign({}, r)),
    values: {
      D2: null, D3: null, D4: null, D5: null,
      D81: null, D82: null, D134: null, D135: null,
      D575: null, D576: null, D571: null, D572: null,
      D84: null, D85: null, D86: null, D87: null,
      M120: null, M70: null,
      D260: null, D258: null, D256: null, D316: null, D500: null, D507: null,
      M124: null,
      D202: null, D262: null, D204: null, D264: null, D502: null, D508: null,
      M126: null,
      D206: null, D266: null, D208: null, D268: null, D504: null, D509: null,
      M127: null,
      X0: null, M155: null, D60: null,
    },
  });
}

// Per-fryer mutable state, indexed 1..8
const Start = {};
const isStart = {};
const timerOut_else = {};
for (let n = 1; n <= 8; n++) {
  Start[n] = 0;
  isStart[n] = false;
  timerOut_else[n] = null;
}

// readAllRegisters — defined ONCE, parameterized by fryer config
async function readAllRegisters(cfg) {
  const n = cfg.index;
  const conn = plcConnections[n];

  // Read all registers for this fryer
  const tasks = cfg.registerList.map(async (reg) => {
    try {
      if (reg.dataType === "reg") {
        const response = await conn.readHoldingRegisters(reg.modbusAddr, 1);
        reg.val = response.data[0];
      }
      if (reg.dataType === "coil") {
        const response = await conn.readCoils(reg.modbusAddr, 1);
        reg.val = response.data[0];
      }
    } catch (err) {
      reg.val = 0;
      updateStatus(n, false);
    }
  });
  await Promise.all(tasks);
  console.log("Tất cả đã hoàn tất");

  // Map reg values into the fryer's values object
  cfg.registerList.forEach((reg) => {
    cfg.values[reg.name] = reg.val;
  });
  console.log(`values["M120"] `, cfg.values["M120"]);

  const giai_doan_1 = cfg.values["M155"];
  const giai_doan_2 = cfg.values["M124"];
  const giai_doan_3 = cfg.values["M126"];
  const giai_doan_4 = cfg.values["M127"];

  // start
  if (cfg.values["M120"] && typeof cfg.values["M120"] === "boolean") {
    isStart[n] = true;
    Start[n]++;
    if (Start[n] > 2) Start[n] = 2;
    postDataPlc(cfg.model, n, cfg.values, io_, Start[n], giai_doan_1, giai_doan_2, giai_doan_3, giai_doan_4);
    console.log("đã gét data PLC" + n);
  }
  // Stop
  if (
    !cfg.values["M120"] &&
    typeof cfg.values["M120"] === "boolean" &&
    isStart[n]
  ) {
    Start[n] = 0;
    isStart[n] = false;
    postDataPlc(cfg.model, n, cfg.values, io_, Start[n], giai_doan_1, giai_doan_2, giai_doan_3, giai_doan_4);
    console.log("đã stop gét data PLC" + n);
  }
}

// plcLoop — initial connect per fryer (5000ms retry on failure)
function plcLoop(n) {
  connect(n).catch((err) => {
    console.error("PLC Connect Error:", err.message);
    setTimeout(() => plcLoop(n), 5000);
  });
}

for (let n = 1; n <= 8; n++) {
  plcLoop(n);
}

// Single 3000ms interval driving all 8 fryers
let timeGetdata = setInterval(() => {
  const status = getStatus();
  console.log(
    status.isConnectPLC_1,
    status.isConnectPLC_2,
    status.isConnectPLC_3,
    status.isConnectPLC_4,
    status.isConnectPLC_5,
    status.isConnectPLC_6,
    status.isConnectPLC_7,
    status.isConnectPLC_8,
  );

  for (const cfg of PLC_CONFIGS) {
    const n = cfg.index;
    if (status["isConnectPLC_" + n]) {
      if (dbConnected && isServer) {
        clearTimeout(timerOut_else[n]);
        readAllRegisters(cfg);
      }
    } else {
      timerOut_else[n] = setTimeout(() => plcLoop(n), 1000);
      console.log("đagn cố gắng kết nối else_plc" + n);
    }
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
