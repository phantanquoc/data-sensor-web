let isConnectPLC_1 = false;
let isConnectPLC_2 = false;
let isConnectPLC_3 = false;
let isConnectPLC_4 = false;
let isConnectPLC_5 = false;
let isConnectPLC_6 = false;
let isConnectPLC_7 = false;
let isConnectPLC_8 = false;

const ModbusRTU = require("modbus-serial");
require("dotenv").config();
//-----plc1---------------------
const plcConnection_1 = new ModbusRTU();
async function connectPLC_1() {
  try {
    await plcConnection_1.connectTCP(process.env.IP_PLC1, {
      port: process.env.PORT_PLC,
    });
    plcConnection_1.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_1 = true;
    return plcConnection_1;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_1 = false;
    throw err;
  }
}
//-----plc2---------------------
const plcConnection_2 = new ModbusRTU();
async function connectPLC_2() {
  try {
    await plcConnection_2.connectTCP(process.env.IP_PLC2, {
      port: process.env.PORT_PLC,
    });
    plcConnection_2.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_2 = true;
    return plcConnection_2;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_2 = false;
    throw err;
  }
}
//-----plc3---------------------
const plcConnection_3 = new ModbusRTU();
async function connectPLC_3() {
  try {
    await plcConnection_3.connectTCP(process.env.IP_PLC3, {
      port: process.env.PORT_PLC,
    });
    plcConnection_3.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_3 = true;
    return plcConnection_3;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_3 = false;
    throw err;
  }
}

//-----plc4---------------------
const plcConnection_4 = new ModbusRTU();
async function connectPLC_4() {
  try {
    await plcConnection_4.connectTCP(process.env.IP_PLC4, {
      port: process.env.PORT_PLC,
    });
    plcConnection_4.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_4 = true;
    return plcConnection_4;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_4 = false;
    throw err;
  }
}

//-----plc5---------------------
const plcConnection_5 = new ModbusRTU();
async function connectPLC_5() {
  try {
    await plcConnection_5.connectTCP(process.env.IP_PLC5, {
      port: process.env.PORT_PLC,
    });
    plcConnection_5.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_5 = true;
    return plcConnection_5;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_5 = false;
    throw err;
  }
}

//-----plc6---------------------
const plcConnection_6 = new ModbusRTU();
async function connectPLC_6() {
  try {
    await plcConnection_6.connectTCP(process.env.IP_PLC6, {
      port: process.env.PORT_PLC,
    });
    plcConnection_6.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_6 = true;
    return plcConnection_6;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_6 = false;
    throw err;
  }
}

//-----plc7---------------------
const plcConnection_7 = new ModbusRTU();
async function connectPLC_7() {
  try {
    await plcConnection_7.connectTCP(process.env.IP_PLC7, {
      port: process.env.PORT_PLC,
    });
    plcConnection_7.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_7 = true;
    return plcConnection_7;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_7 = false;
    throw err;
  }
}

//-----plc8---------------------
const plcConnection_8 = new ModbusRTU();
async function connectPLC_8() {
  try {
    await plcConnection_8.connectTCP(process.env.IP_PLC8, {
      port: process.env.PORT_PLC,
    });
    plcConnection_8.setID(1);
    console.log("Kết nối thành công");
    isConnectPLC_8 = true;
    return plcConnection_8;
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnectPLC_8 = false;
    throw err;
  }
}

function getStatusConnectPLCs() {
  return {
    isConnectPLC_1,
    isConnectPLC_2,
    isConnectPLC_3,
    isConnectPLC_4,
    isConnectPLC_5,
    isConnectPLC_6,
    isConnectPLC_7,
    isConnectPLC_8,
  };
}
function update_StatusConnectPLC1(value) {
  isConnectPLC_1 = value;
}
function update_StatusConnectPLC2(value) {
  isConnectPLC_2 = value;
}
function update_StatusConnectPLC3(value) {
  isConnectPLC_3 = value;
}
function update_StatusConnectPLC4(value) {
  isConnectPLC_4 = value;
}
function update_StatusConnectPLC5(value) {
  isConnectPLC_5 = value;
}
function update_StatusConnectPLC6(value) {
  isConnectPLC_6 = value;
}
function update_StatusConnectPLC7(value) {
  isConnectPLC_7 = value;
}
function update_StatusConnectPLC8(value) {
  isConnectPLC_8 = value;
}

module.exports = {
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
};
//-------------------------------
