const crypto = require("crypto");
global.crypto = crypto;
const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
const path = require("path");
require("dotenv").config();

const DEBUG = process.env.DEBUG === "true" || process.env.DEBUG === "1";
function dbg(...args) { if (DEBUG) console.log(...args); }

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
        socket.on("join_noi", (n) => {
          // Leave any previous noi_* rooms
          for (const room of socket.rooms) {
            if (room.startsWith("noi_") && room !== socket.id) {
              socket.leave(room);
            }
          }
          socket.join("noi_" + n);
          // Emit cached snapshot immediately so client doesn't wait for next read cycle
          const snap = getLatestStages(n);
          if (snap) {
            socket.emit("noi_chien_" + n + "_data", snap);
          }
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
const { postDataPlc, getLatestStages } = require("./controller/post_data_plc");
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
const isReading = {};
const prevConnected = {};
const lastConfigRead = {}; // mốc thời gian (ms) lần cuối đọc block config
const needConfigRead = {}; // cờ ép đọc config ở cycle tới (kết nối lại / sườn lên M120)
for (let n = 1; n <= 8; n++) {
  Start[n] = 0;
  isStart[n] = false;
  timerOut_else[n] = null;
  isReading[n] = false;
  prevConnected[n] = null;
  lastConfigRead[n] = 0;
  needConfigRead[n] = true; // đọc config ngay ở cycle đầu tiên
}

// Chu kỳ làm mới config định kỳ (phương án C): 60s
const CONFIG_REFRESH_MS = 60000;

// Block definitions for grouped Modbus reads — [startAddress, count]
//
// REALTIME: 10 cảm biến + tổng thời gian + trạng thái giai đoạn → đọc MỖI cycle.
//   holding [2,4]=D2..D5, [60,1]=D60(tổng t/g), [81,7]=D81..D87,
//           [134,2]=D134/135, [572,6]=D571..D576(dòng điện)
//   coil    [15070,86]=M70,M120,M124,M126,M127,M155
const REALTIME_HOLDING_BLOCKS = [
  [2, 4],
  [60, 1],
  [81, 7],
  [134, 2],
  [572, 6],
];
const REALTIME_COIL_BLOCKS = [
  [15070, 86],
];

// CONFIG: thông số cài đặt từng giai đoạn (ít khi đổi) → đọc theo nhịp C (đầu mẻ + 60s).
//   [202,13]=gd2, [256,13]=gd1/3, [316,1]=gd1, [501,10]=gd1/2/3 setpoint+vị trí
const CONFIG_HOLDING_BLOCKS = [
  [202, 13],
  [256, 13],
  [316, 1],
  [501, 10],
];
// (X0 [16000,1] đã bỏ — không được tiêu thụ ở backend/frontend)

// Đọc 1 nhóm holding-block tuần tự (một request tại một thời điểm / kết nối).
// Split response.data[addr-start] vào reg.val theo địa chỉ Modbus (bảo toàn offset +1).
// Per-block fallback: block lỗi thì đọc lẻ từng thanh ghi, không ảnh hưởng block khác.
async function readHoldingBlocks(cfg, blocks) {
  const n = cfg.index;
  const conn = plcConnections[n];
  for (const [start, count] of blocks) {
    try {
      const response = await conn.readHoldingRegisters(start, count);
      for (const reg of cfg.registerList) {
        if (reg.dataType === "reg" && reg.modbusAddr >= start && reg.modbusAddr < start + count) {
          reg.val = response.data[reg.modbusAddr - start];
        }
      }
    } catch (err) {
      for (const reg of cfg.registerList) {
        if (reg.dataType === "reg" && reg.modbusAddr >= start && reg.modbusAddr < start + count) {
          try {
            const response = await conn.readHoldingRegisters(reg.modbusAddr, 1);
            reg.val = response.data[0];
          } catch (err2) {
            reg.val = 0;
            updateStatus(n, false);
          }
        }
      }
    }
  }
}

// Đọc 1 nhóm coil-block tuần tự (cùng nguyên tắc split + fallback như holding).
async function readCoilBlocks(cfg, blocks) {
  const n = cfg.index;
  const conn = plcConnections[n];
  for (const [start, count] of blocks) {
    try {
      const response = await conn.readCoils(start, count);
      for (const reg of cfg.registerList) {
        if (reg.dataType === "coil" && reg.modbusAddr >= start && reg.modbusAddr < start + count) {
          reg.val = response.data[reg.modbusAddr - start];
        }
      }
    } catch (err) {
      for (const reg of cfg.registerList) {
        if (reg.dataType === "coil" && reg.modbusAddr >= start && reg.modbusAddr < start + count) {
          try {
            const response = await conn.readCoils(reg.modbusAddr, 1);
            reg.val = response.data[0];
          } catch (err2) {
            reg.val = 0;
            updateStatus(n, false);
          }
        }
      }
    }
  }
}

// readAllRegisters — defined ONCE, parameterized by fryer config.
// Vòng nóng: luôn đọc block REALTIME (6 rq/nồi: 5 holding + 1 coil).
// Vòng nguội: đọc block CONFIG (4 rq) theo phương án C — khi (tái) kết nối,
// khi bắt đầu mẻ (sườn lên M120), hoặc định kỳ mỗi CONFIG_REFRESH_MS.
async function readAllRegisters(cfg) {
  const n = cfg.index;

  // 1) REALTIME — mỗi cycle
  await readHoldingBlocks(cfg, REALTIME_HOLDING_BLOCKS);
  await readCoilBlocks(cfg, REALTIME_COIL_BLOCKS);

  // 2) Sườn lên M120 (mẻ vừa bắt đầu) → ép đọc config để thông số cài đặt tươi ngay đầu mẻ.
  //    M120 mới nằm ở reg.val (chưa map vào cfg.values); isStart[n] còn là trạng thái mẻ trước.
  const m120Reg = cfg.registerList.find((r) => r.name === "M120");
  const m120Now = m120Reg && m120Reg.val === true;
  if (m120Now && !isStart[n]) {
    needConfigRead[n] = true;
  }

  // 3) CONFIG — theo nhịp C: khi cần (kết nối lại / đầu mẻ) hoặc định kỳ mỗi CONFIG_REFRESH_MS
  const now = Date.now();
  const dueByTimer = now - lastConfigRead[n] >= CONFIG_REFRESH_MS;
  if (needConfigRead[n] || dueByTimer) {
    await readHoldingBlocks(cfg, CONFIG_HOLDING_BLOCKS);
    lastConfigRead[n] = now;
    needConfigRead[n] = false;
  }

  dbg("Tất cả đã hoàn tất");

  // Map reg values into the fryer's values object
  cfg.registerList.forEach((reg) => {
    cfg.values[reg.name] = reg.val;
  });
  dbg(`values["M120"] `, cfg.values["M120"]);

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
    dbg("đã gét data PLC" + n);
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
    dbg("đã stop gét data PLC" + n);
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

// Per-fryer self-scheduling loop (replaces the single shared setInterval)
function scheduleRead(n) {
  const cfg = PLC_CONFIGS[n - 1];

  async function runCycle() {
    if (isReading[n]) return; // re-entrancy guard: skip if previous cycle still running
    isReading[n] = true;
    try {
      const status = getStatus();
      const isConn = status["isConnectPLC_" + n];
      if (prevConnected[n] !== isConn) {
        console.log("PLC" + n + " connected:", isConn);
        prevConnected[n] = isConn;
        // Vừa (tái) kết nối → ép đọc config ở cycle này để màn có thông số ngay
        if (isConn) needConfigRead[n] = true;
      }

      if (status["isConnectPLC_" + n]) {
        if (dbConnected && isServer) {
          clearTimeout(timerOut_else[n]);
          await readAllRegisters(cfg);
        }
      } else {
        timerOut_else[n] = setTimeout(() => plcLoop(n), 1000);
        dbg("đagn cố gắng kết nối else_plc" + n);
      }
    } catch (err) {
      console.error("Read cycle error PLC" + n + ":", err.message);
    } finally {
      isReading[n] = false;
      setTimeout(runCycle, 800);
    }
  }

  // Start the first cycle after initial delay
  setTimeout(runCycle, 3000);
}

for (let n = 1; n <= 8; n++) {
  scheduleRead(n);
}

//------------------------
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION");
  console.error(err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION");
  console.error(err);
});
