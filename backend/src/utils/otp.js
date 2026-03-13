const crypto = require("crypto");

function generateOTP(length = 6) {
  const digits = "0123456789";
  let otp = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % digits.length];
  }
  return otp;
}

function otpExpiresAt(minutes = parseInt(process.env.OTP_EXPIRES_MIN) || 10) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

module.exports = { generateOTP, otpExpiresAt };
