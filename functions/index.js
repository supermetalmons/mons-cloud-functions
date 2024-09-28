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

  // TODO: associate an address with a user if it's ok

  if (fields.success) {
    const statement = fields.data.statement;
    return {
      ok: true,
      message: message, // TODO: remove tmp mirror
      signature: signature, // TODO: remove tmp mirror
      statement: statement, // TODO: remove tmp mirror
    };
  } else {
    return {
      ok: false,
      message: message, // TODO: remove tmp mirror
      signature: signature, // TODO: remove tmp mirror
      wrongData: fields.data.toMessage(), // TODO: remove tmp mirror
    };
  }
});