const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("../config/env");

const { secret, expiresIn, algorithm, issuer, audience } = config.jwt;

async function hashPassword(password) {
  return bcrypt.hash(password, config.bcryptSaltRounds);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signToken(payload) {
  return jwt.sign(payload, secret, { algorithm, expiresIn, issuer, audience });
}

// Pin algorithm/issuer/audience so tokens from other systems or "alg" tricks are rejected.
function verifyToken(token) {
  return jwt.verify(token, secret, { algorithms: [algorithm], issuer, audience });
}

module.exports = {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken
};
