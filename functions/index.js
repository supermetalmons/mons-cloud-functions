const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");

const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

exports.hello = onCall((request) => {

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

    const uid = request.auth.uid;
    console.log(`Authenticated call by user: ${uid}`);

    const message = `Hello from Firebase, user ${uid}!`;
    const keyPair = nacl.sign.keyPair();
    const messageUint8 = nacl.util.decodeUTF8(message);
    const signedMessage = nacl.sign(messageUint8, keyPair.secretKey);

    return { 
        message: message,
        signedMessage: nacl.util.encodeBase64(signedMessage),
      };
});
