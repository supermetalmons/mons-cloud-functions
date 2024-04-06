const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");

exports.hello = onCall((request) => {

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
      }

    const uid = request.auth.uid;
    console.log(`Authenticated call by user: ${uid}`);
    return { 
        message: `Hello from Firebase, user ${uid}!`
      };
});
