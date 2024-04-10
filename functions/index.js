const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions/v2");

const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();
const bs58 = require('bs58');
const admin = require('firebase-admin');
admin.initializeApp();

exports.gameResult = onCall(async (request) => {
    if (!request.auth) { throw new HttpsError("unauthenticated", "The function must be called while authenticated."); }
    const signatureType = request.data.signature;
    if (signatureType != "ed25519") { throw new HttpsError("invalid-argument", "Unsupported signature type"); }

    const uid = request.auth.uid;
    const id = request.data.id;

    const matchRef = admin.database().ref(`players/${uid}/matches/${id}`);
    const matchSnapshot = await matchRef.once('value');
    const matchData = matchSnapshot.val();

    const inviteRef = admin.database().ref(`invites/${id}`);
    const inviteSnapshot = await inviteRef.once('value');
    const inviteData = inviteSnapshot.val();

    const opponentId = inviteData.guestId === uid ? inviteData.hostId : inviteData.guestId;

    const opponentMatchRef = admin.database().ref(`players/${opponentId}/matches/${id}`);
    const opponentMatchSnapshot = await opponentMatchRef.once('value');
    const opponentMatchData = opponentMatchSnapshot.val();

    var result = "none"; // gg / win / none / draw
    var resultForChain = `${id}+none`;
    if (matchData.status == "surrendered") {
      result = "gg";
      resultForChain = `${id}+${opponentId}`;
    } else if (opponentMatchData.status == "surrendered") {
      result = "win";
      resultForChain = `${id}+${uid}`;
    } else {
      const color = matchData.color;
      const opponentColor = opponentMatchData.color;
      const mons = await import('mons-rust');
      var winnerColorFen = "";
      if (color == "white") {
        winnerColorFen = mons.winner(matchData.fen, opponentMatchData.fen, matchData.flatMovesString, opponentMatchData.flatMovesString);
      } else {
        winnerColorFen = mons.winner(opponentMatchData.fen, matchData.fen, opponentMatchData.flatMovesString, matchData.flatMovesString);
      }
      if (winnerColorFen != "") {
        var winnerColor = "none";
        if (winnerColorFen == "w") {
          winnerColor = "white";
        } else if (winnerColorFen == "b") {
          winnerColor = "black";
        }

        if (winnerColor == color) {
          result = "win";
          resultForChain = `${id}+${uid}`;
        } else if (winnerColor == opponentColor) {
          result = "gg";
          resultForChain = `${id}+${opponentId}`;
        }
      }
    }
    
    const name = `projects/${process.env.GCLOUD_PROJECT}/secrets/solana-private-key/versions/latest`;
    const [version] = await client.accessSecretVersion({name});
    const privateKeyBase58 = version.payload.data.toString('utf8');
    const privateKeyUint8 = bs58.decode(privateKeyBase58);
    const keyPair = nacl.sign.keyPair.fromSecretKey(privateKeyUint8);
    const messageUint8 = nacl.util.decodeUTF8(resultForChain);
    const signed = nacl.sign(messageUint8, keyPair.secretKey);

    return {
        result: result,
        resultForChain: resultForChain,
        signed: bs58.encode(signed),
      };
});
