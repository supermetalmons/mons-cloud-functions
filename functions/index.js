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
  const uid = request.auth.uid;

  const user = await admin.auth().getUser(uid);
  const existingClaims = user.customClaims || {};

  var responseAddress = address;
  if (!existingClaims.ethAddress) {
    existingClaims.ethAddress = address;
    await admin.auth().setCustomUserClaims(uid, existingClaims);
    const db = admin.database();
    const playerRef = db.ref(`players/${uid}`);
    await playerRef.update({
      ethAddress: address
    });
  } else {
    responseAddress = existingClaims.ethAddress;
  }

  if (fields.success && fields.data.nonce === uid && fields.data.statement === "mons ftw") {
    return {
      ok: true,
      address: responseAddress,
    };
  } else {
    return {
      ok: false,
    };
  }
});