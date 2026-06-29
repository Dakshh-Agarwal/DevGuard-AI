// server/utils/logger.js
// Structured Winston logger with Loki transport for DevGuard-AI
const winston = require('winston');
const { getRequestContext } = require('../middleware/requestContext');

// ============================================================
// Sensitive field sanitizer
// ============================================================
const SENSITIVE_KEYS = [
  'authorization', 'token', 'access_token', 'api_key', 'apikey',
  'password', 'secret', 'client_secret', 'service_role_key',
  'supabase_service_role_key', 'gemini_api_key', 'cookie',
];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = sanitize(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ============================================================
// Custom format that injects request context from AsyncLocalStorage
// ============================================================
const requestContextFormat = winston.format((info) => {
  const ctx = getRequestContext();
  if (ctx) {
    info.request_id = ctx.request_id || undefined;
    info.user_id = ctx.user_id || undefined;
  }
  return info;
});

// ============================================================
// Winston Logger Configuration
// ============================================================
const transports = [
  // Console transport (always active)
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, service, request_id, user_id, ...meta }) => {
        const reqId = request_id ? ` [${request_id.substring(0, 8)}]` : '';
        const uid = user_id ? ` [user:${user_id.substring(0, 8)}]` : '';
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(sanitize(meta))}` : '';
        return `${timestamp} ${level}${reqId}${uid}: ${message}${metaStr}`;
      })
    ),
  }),
];

// Add Loki transport if LOKI_URL is configured
if (process.env.LOKI_URL) {
  try {
    const LokiTransport = require('winston-loki');
    console.log("Initializing Loki transport at:", process.env.LOKI_URL);
    transports.push(
      new LokiTransport({
        host: process.env.LOKI_URL,
        labels: { service: 'devguard-backend' },
        json: true,
        replaceTimestamp: true,
        gracefulShutdown: false,
        clearOnError: false,
        onConnectionError: (err) => {
          console.error('Loki connection error:', err.message);
        },
      })
    );
  } catch (err) {
    // winston-loki may not be installed in dev
    console.warn('winston-loki not available, Loki transport disabled');
  }
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    requestContextFormat(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'devguard-backend' },
  transports,
});

// ============================================================
// Helper: create a child logger with extra context labels
// ============================================================
logger.child = function (meta) {
  const child = winston.createLogger({
    level: this.level,
    format: this.format,
    defaultMeta: { ...this.defaultMeta, ...meta },
    transports: this.transports,
  });
  return child;
};

// ============================================================
// Sanitize helper exported for use in metric labels etc.
// ============================================================
logger.sanitize = sanitize;

module.exports = logger;
