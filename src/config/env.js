/**
 * Centralised, validated runtime configuration.
 *
 * - The ONLY place that reads secrets from process.env.
 * - Fails fast at boot: a misconfigured instance refuses to start instead of
 *   silently running with an insecure default.
 * - There are deliberately NO fallback values for secrets.
 */
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";
const isTest = NODE_ENV === "test";

const MIN_JWT_SECRET_LENGTH = 32;

// Values that have appeared in templates / source and must never be used for real.
const KNOWN_INSECURE_SECRETS = [
  "velvet_plate_auth_internal_secret_key_2026",
  "super_secret_jwt_key_velvet_plate_2026_secure_token_change_in_production",
  "secret",
  "changeme",
];

const problems = [];

function requireString(name) {
  const value = (process.env[name] || "").trim();
  if (!value) problems.push(`${name} is required but not set`);
  return value;
}

function intInRange(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    problems.push(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
    return fallback;
  }
  return n;
}

/* ---------- JWT ---------- */
const jwtSecret = requireString("JWT_SECRET");
if (jwtSecret) {
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
        `(generate one: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")`
    );
  }
  if (KNOWN_INSECURE_SECRETS.includes(jwtSecret.toLowerCase())) {
    problems.push("JWT_SECRET is a known placeholder/leaked value - generate a new one");
  }
}

/* ---------- Database URL ---------- */
const databaseUrl = requireString("DATABASE_URL");
if (databaseUrl) {
  const isValidMongoUri =
    databaseUrl.startsWith("mongodb://") || databaseUrl.startsWith("mongodb+srv://");
  if (!isValidMongoUri) {
    problems.push(
      "DATABASE_URL must be a valid MongoDB connection string starting with mongodb:// or mongodb+srv://"
    );
  }
}

/* ---------- Cloudinary Storage ---------- */
const isConfiguredValue = (val) =>
  Boolean(val && !val.startsWith("your_cloudinary_") && !val.includes("<your_"));

let cloudinaryCloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
let cloudinaryApiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
let cloudinaryApiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();

const rawCloudinaryUrl = (process.env.CLOUDINARY_URL || "").trim();
if (rawCloudinaryUrl && !rawCloudinaryUrl.includes("<your_api_key>")) {
  try {
    const parsedUrl = new URL(rawCloudinaryUrl);
    if (parsedUrl.protocol === "cloudinary:") {
      cloudinaryApiKey = cloudinaryApiKey || decodeURIComponent(parsedUrl.username || "");
      cloudinaryApiSecret = cloudinaryApiSecret || decodeURIComponent(parsedUrl.password || "");
      cloudinaryCloudName = cloudinaryCloudName || parsedUrl.hostname;
    }
  } catch {
    // Handled by validation logic below
  }
}

const isCloudinaryPartiallySet = Boolean(
  (isConfiguredValue(cloudinaryCloudName) ||
    isConfiguredValue(cloudinaryApiKey) ||
    isConfiguredValue(cloudinaryApiSecret)) &&
    !(
      isConfiguredValue(cloudinaryCloudName) &&
      isConfiguredValue(cloudinaryApiKey) &&
      isConfiguredValue(cloudinaryApiSecret)
    )
);
const isCloudinaryFullySet = Boolean(
  isConfiguredValue(cloudinaryCloudName) &&
    isConfiguredValue(cloudinaryApiKey) &&
    isConfiguredValue(cloudinaryApiSecret)
);
const isCloudinaryRequired = process.env.ENABLE_CLOUDINARY === "true";

if (isCloudinaryRequired && !isCloudinaryFullySet) {
  problems.push(
    "Cloudinary is enabled (ENABLE_CLOUDINARY=true) but credentials are incomplete: " +
      "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must all be set."
  );
} else if (isCloudinaryPartiallySet && !isCloudinaryFullySet) {
  problems.push(
    "Incomplete Cloudinary configuration: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and " +
      "CLOUDINARY_API_SECRET must all be provided together."
  );
}

/* ---------- Trust Proxy Configuration ---------- */
let trustProxySetting = false;
const rawTrustProxy = (process.env.TRUST_PROXY || "").trim();
if (rawTrustProxy === "true") {
  trustProxySetting = true;
} else if (rawTrustProxy === "false" || rawTrustProxy === "") {
  trustProxySetting = false;
} else {
  const hopCount = Number(rawTrustProxy);
  if (!Number.isInteger(hopCount) || hopCount < 0) {
    problems.push(
      `TRUST_PROXY must be a boolean or a non-negative integer representing trusted proxy hops (got "${rawTrustProxy}")`
    );
  } else {
    trustProxySetting = hopCount;
  }
}

/* ---------- Email Service Configuration ---------- */
const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
const isResendConfigured = Boolean(
  resendApiKey && !resendApiKey.startsWith("your_resend_api_key")
);

const config = Object.freeze({
  env: NODE_ENV,
  isProduction,
  isTest,
  databaseUrl,
  trustProxy: trustProxySetting,
  email: Object.freeze({
    isResendConfigured,
    from: process.env.RESEND_FROM || "Velvet Plate <onboarding@resend.dev>",
  }),
  jwt: Object.freeze({
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    algorithm: "HS256",
    issuer: process.env.JWT_ISSUER || "velvet-plate-api",
    audience: process.env.JWT_AUDIENCE || "velvet-plate-client",
  }),
  cloudinary: Object.freeze({
    isConfigured: isCloudinaryFullySet,
    cloudName: cloudinaryCloudName,
    apiKey: cloudinaryApiKey,
  }),
  bcryptSaltRounds: intInRange("BCRYPT_SALT_ROUNDS", 12, isTest ? 4 : 10, 15),
});

if (problems.length) {
  const message =
    "Invalid environment configuration:\n" + problems.map((p) => `  - ${p}`).join("\n");
  // Throwing at require-time stops boot before the server accepts traffic.
  throw new Error(message);
}

module.exports = config;
