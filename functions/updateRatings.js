const { onCall, HttpsError } = require("firebase-functions/v2/https");
const glicko2 = require("glicko2");
const admin = require("firebase-admin");
const { batchReadWithRetry } = require("./utils");

exports.updateRatings = onCall(async (request) => {
  throw new HttpsError("internal", "not implemented.");
});
