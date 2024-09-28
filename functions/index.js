const {onCall, HttpsError} = require("firebase-functions/v2/https");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { SiweMessage } = require('siwe');

const client = new SecretManagerServiceClient();
const admin = require('firebase-admin');
admin.initializeApp();

exports.verifyEthAddress = onCall(async (request) => {
  if (!request.auth) { throw new HttpsError("unauthenticated", "The function must be called while authenticated."); }

  const message = request.data.message;
  const signature = request.data.signature;

  const siweMessage = new SiweMessage(message);
  const fields = await siweMessage.verify({signature});

  const address = fields.data.address;
  // TODO: associate an address with a user if it's ok

  if (fields.success && fields.data.nonce === request.auth.uid && fields.data.statement === "mons ftw") {
    return {
      ok: true,
      address: address,
    };
  } else {
    return {
      ok: false,
    };
  }
});