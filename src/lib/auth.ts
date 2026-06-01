// Phone-OTP auth + session helpers.
// OWNER: Emma + Jordan. EPIC-4 (web dashboard) + EPIC-7 (security), Day 6.
//
// Stub during EPIC-1. Lands here:
//   - generateCode() / storeCode() with 10-min expiry (auth_codes table)
//   - verifyCode() with attempt lockout + rate limiting (Jordan)
//   - createSession()/getSessionUser() using HTTP-only, secure, sameSite cookies
//
// SESSION_SECRET env var is used to sign/validate session tokens.

// TODO(EPIC-4/7): implement OTP request/verify + session management.
export {};
