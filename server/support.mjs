import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/* Help requests raised from the account settings. They are stored once in the
 * shared data directory so the separate admin console can read and answer them
 * through /api/console/support. Messages are additive: a console notification
 * is just an unread entry. */

const MAX_MESSAGE_LENGTH = 2000;
const MAX_SUBJECT_LENGTH = 120;
const MAX_KEPT = 500;
const MAX_NOTE_LENGTH = 500;
const STATUSES = ["open", "read", "done"];
const UNSAFE_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

export const supportLimits = Object.freeze({ MAX_MESSAGE_LENGTH, MAX_SUBJECT_LENGTH, MAX_NOTE_LENGTH });

/* Keeps the message readable while removing control and spoofing characters. */
export function cleanSupportText(value, max) {
  return String(value ?? "")
    .replace(UNSAFE_TEXT, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function createSupportStore({ dataDir }) {
  const file = path.join(dataDir, "support-messages.json");

  function read() {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      return Array.isArray(data?.messages) ? data : { messages: [] };
    } catch {
      return { messages: [] };
    }
  }

  function write(data) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    try {
      fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(tmp, file);
    } finally {
      if (fs.existsSync(tmp)) fs.rmSync(tmp);
    }
  }

  function add(entry) {
    const data = read();
    const message = {
      id: crypto.randomBytes(8).toString("hex"),
      at: new Date().toISOString(),
      status: "open",
      note: "",
      ...entry
    };
    data.messages = [message, ...data.messages].slice(0, MAX_KEPT);
    write(data);
    return message;
  }

  function list() {
    return read().messages;
  }

  function unreadCount() {
    return read().messages.filter((message) => message.status === "open").length;
  }

  function update(id, patch = {}) {
    const data = read();
    const index = data.messages.findIndex((message) => message.id === id);
    if (index === -1) return null;
    const current = data.messages[index];
    const next = { ...current, answeredAt: new Date().toISOString() };
    if (STATUSES.includes(patch.status)) next.status = patch.status;
    if (typeof patch.note === "string") next.note = cleanSupportText(patch.note, MAX_NOTE_LENGTH);
    data.messages[index] = next;
    write(data);
    return next;
  }

  return { file, add, list, unreadCount, update };
}
