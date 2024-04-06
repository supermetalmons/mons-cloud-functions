const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");

const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

exports.hello = onCall(async (request) => {

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

    const uid = request.auth.uid;
    console.log(`Authenticated call by user: ${uid}`);

    const message = `Hello from Firebase, user ${uid}!`;
    const keyPair = nacl.sign.keyPair();
    const messageUint8 = nacl.util.decodeUTF8(message);
    const signedMessage = nacl.sign(messageUint8, keyPair.secretKey);

    const name = `projects/${process.env.GCLOUD_PROJECT}/secrets/solana-private-key/versions/latest`;
    const [version] = await client.accessSecretVersion({name});
    const payload = version.payload.data.toString('utf8');

    return { 
        message: message,
        signedMessage: nacl.util.encodeBase64(signedMessage),
        testSecretKey: payload,
      };
});
