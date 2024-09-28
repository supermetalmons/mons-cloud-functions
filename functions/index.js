const {onCall, HttpsError} = require("firebase-functions/v2/https");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();
const admin = require('firebase-admin');
admin.initializeApp();

exports.verifyEthAddress = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "The function must be called while authenticated."); }

  const message = request.data.message;
  const signature = request.data.signature;
  
  // TODO: verify, associate an address with a user

  return {
    ok: true,
    message: message, // TODO: remove tmp mirror
    signature: signature, // TODO: remove tmp mirror
  };
});