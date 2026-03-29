const MESSAGE_STATUSES = new Set(["sent", "displaying", "expired", "hidden"]);
const MESSAGE_RETENTION_LIMIT = 200;
const MAX_MESSAGE_LENGTH = 180;
const RATE_LIMIT_WINDOW_MS = 2500;
const RATE_LIMIT_TTL_MS = 10 * 60 * 1000;
const PROFANITY_PATTERNS = [
  /fuck/i,
  /shit/i,
  /bitch/i,
  /เหี้ย/i,
  /ควย/i,
  /สัส/i,
];

let messages = [];
const senderLastPostedAt = new Map();
const subscribers = new Set();

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanupStore(now) {
  messages = messages.slice(-MESSAGE_RETENTION_LIMIT);

  for (const [senderKey, lastPostedAt] of senderLastPostedAt.entries()) {
    if (now - lastPostedAt > RATE_LIMIT_TTL_MS) {
      senderLastPostedAt.delete(senderKey);
    }
  }
}

function publish(event) {
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

export function getSenderKey(req) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");

  return forwardedFor?.split(",")[0]?.trim() || realIp || "anonymous";
}

export function getMessageStatuses() {
  return MESSAGE_STATUSES;
}

export function getMaxMessageLength() {
  return MAX_MESSAGE_LENGTH;
}

export function getFilteredMessages({ statuses, limit } = {}) {
  cleanupStore(Date.now());

  const normalizedStatuses = Array.isArray(statuses)
    ? statuses.filter((status) => MESSAGE_STATUSES.has(status))
    : null;
  const normalizedLimit = Number.isFinite(limit) && limit > 0
    ? Math.min(limit, MESSAGE_RETENTION_LIMIT)
    : MESSAGE_RETENTION_LIMIT;
  const filteredMessages = normalizedStatuses?.length
    ? messages.filter((message) => normalizedStatuses.includes(message.status))
    : messages;

  return filteredMessages.slice(-normalizedLimit).reverse();
}

export function createMessage({ text, senderKey }) {
  const now = Date.now();
  cleanupStore(now);

  const sanitizedText = sanitizeText(text);

  if (!sanitizedText) {
    return {
      success: false,
      error: "กรุณาพิมพ์ข้อความก่อนส่ง",
      status: 400,
    };
  }

  if (sanitizedText.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      error: `ข้อความยาวเกินไป กรุณาไม่เกิน ${MAX_MESSAGE_LENGTH} ตัวอักษร`,
      status: 400,
    };
  }

  if (PROFANITY_PATTERNS.some((pattern) => pattern.test(sanitizedText))) {
    return {
      success: false,
      error: "ข้อความนี้ไม่สามารถส่งได้ กรุณาปรับถ้อยคำอีกครั้ง",
      status: 400,
    };
  }

  const lastPostedAt = senderLastPostedAt.get(senderKey);

  if (lastPostedAt && now - lastPostedAt < RATE_LIMIT_WINDOW_MS) {
    return {
      success: false,
      error: "ส่งถี่เกินไป กรุณารอสักครู่แล้วลองใหม่",
      status: 429,
    };
  }

  senderLastPostedAt.set(senderKey, now);

  const message = {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    text: sanitizedText,
    status: "sent",
    createdAt: now,
    updatedAt: now,
    displayedAt: null,
    expiredAt: null,
    hiddenAt: null,
  };

  messages.push(message);
  cleanupStore(now);
  publish({ type: "created", message });

  return {
    success: true,
    status: 201,
    message,
  };
}

export function updateMessageStatus({ id, status }) {
  const now = Date.now();

  if (!id || !MESSAGE_STATUSES.has(status)) {
    return {
      success: false,
      error: "ข้อมูลการอัปเดตข้อความไม่ถูกต้อง",
      status: 400,
    };
  }

  const message = messages.find((item) => item.id === id);

  if (!message) {
    return {
      success: false,
      error: "ไม่พบข้อความที่ต้องการอัปเดต",
      status: 404,
    };
  }

  message.status = status;
  message.updatedAt = now;

  if (status === "displaying") {
    message.displayedAt = message.displayedAt ?? now;
  }

  if (status === "expired") {
    message.expiredAt = message.expiredAt ?? now;
  }

  if (status === "hidden") {
    message.hiddenAt = message.hiddenAt ?? now;
  }

  publish({ type: "updated", message });

  return {
    success: true,
    status: 200,
    message,
  };
}

export function subscribeToMessages(subscriber) {
  subscribers.add(subscriber);

  return () => {
    subscribers.delete(subscriber);
  };
}