import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Compatibility adapter until server/support.mjs from the settings branch is
// present. It reads the same JSON schema and performs atomic updates.
export function createSupportInbox({ dataDir }) {
  const file = path.join(dataDir, "support-messages.json");
  function list() {
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(data?.messages)) throw new Error("invalid support message store");
    return [...data.messages].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }
  function unreadCount() { return list().filter((message) => message.status === "open").length; }
  function update(id, patch) {
    const messages = list();
    const message = messages.find((entry) => entry.id === id);
    if (!message) return null;
    Object.assign(message, patch);
    const temp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    try {
      fs.writeFileSync(temp, `${JSON.stringify({ messages }, null, 2)}\n`, { mode: 0o600 });
      fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.rmSync(temp); }
    return message;
  }
  return { list, unreadCount, update };
}
