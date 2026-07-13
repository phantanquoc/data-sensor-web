const ModbusRTU = require("modbus-serial");
require("dotenv").config();

// Array of 8 Modbus connections and their status flags, indexed 1..8
// plcConnections[1]..plcConnections[8] are the ModbusRTU instances
// isConnected[1]..isConnected[8] are the boolean status flags
const plcConnections = {};
const isConnected = {};

for (let n = 1; n <= 8; n++) {
  plcConnections[n] = new ModbusRTU();
  isConnected[n] = false;
}

/**
 * connect(n) - connects PLC at index n (1..8), sets ID to 1, updates status
 */
async function connect(n) {
  const ipEnv = "IP_PLC" + n;
  try {
    await plcConnections[n].connectTCP(process.env[ipEnv], {
      port: process.env.PORT_PLC,
    });
    plcConnections[n].setID(1);
    console.log("Kết nối thành công");
    isConnected[n] = true;
    return plcConnections[n];
  } catch (err) {
    console.error("Kết nối thất bại:", err.message);
    isConnected[n] = false;
    throw err;
  }
}

/**
 * getStatus() - returns object with isConnectPLC_1..8 keys (backward-compatible shape)
 */
function getStatus() {
  return {
    isConnectPLC_1: isConnected[1],
    isConnectPLC_2: isConnected[2],
    isConnectPLC_3: isConnected[3],
    isConnectPLC_4: isConnected[4],
    isConnectPLC_5: isConnected[5],
    isConnectPLC_6: isConnected[6],
    isConnectPLC_7: isConnected[7],
    isConnectPLC_8: isConnected[8],
  };
}

/**
 * updateStatus(n, value) - sets isConnected[n] to value
 */
function updateStatus(n, value) {
  isConnected[n] = value;
}

module.exports = {
  plcConnections,
  isConnected,
  connect,
  getStatus,
  updateStatus,
};
