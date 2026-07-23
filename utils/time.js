const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const vietnamFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getVietnamParts(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  return Object.fromEntries(
    vietnamFormatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function formatVietnamTimestamp(date = new Date()) {
  const parts = getVietnamParts(date);
  if (!parts) return "";
  return `${parts.hour}:${parts.minute}:${parts.second} ${Number(parts.day)}/${Number(parts.month)}/${parts.year}`;
}

function formatVietnamDateCode(date = new Date()) {
  const parts = getVietnamParts(date);
  return parts ? `${parts.year}${parts.month}${parts.day}` : "unknown";
}

module.exports = {
  VIETNAM_TIME_ZONE,
  formatVietnamTimestamp,
  formatVietnamDateCode,
};
