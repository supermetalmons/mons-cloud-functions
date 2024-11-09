const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

exports.automatch = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  let name = "anon";
  const uid = request.auth.uid;
  const emojiId = request.data.emojiId;

  const automatchRef = admin.database().ref("automatch").limitToFirst(1);
  const snapshot = await automatchRef.once("value");

  if (snapshot.exists()) {
    const firstAutomatchId = Object.keys(snapshot.val())[0];
    const existingAutomatchData = snapshot.val()[firstAutomatchId];
    // TODO: make sure there is still no guest for this invite, otherwise try getting another automatch
    // TODO: won't need to make sure though if joining automatch as a guest will be prohibited for a non admin users
    if (existingAutomatchData.uid !== uid) {
      await admin.database().ref(`automatch/${firstAutomatchId}`).remove();
      await sendTelegramMessage(
        `${existingAutomatchData.uid} automatched with ${uid}`
      );
    }
    return {
      ok: true,
      inviteId: firstAutomatchId,
    };
  } else {
    const letters =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let inviteId = "auto_";
    for (let i = 0; i < 11; i++) {
      inviteId += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    await admin.database().ref(`automatch/${inviteId}`).set({
      uid: uid,
      timestamp: admin.database.ServerValue.TIMESTAMP,
    });

    const hostColor = Math.random() < 0.5 ? "white" : "black";
    const controllerVersion = 2;
    const initialFen =
      "0 0 w 0 0 0 0 0 1 n03y0xs0xd0xa0xe0xn03/n11/n11/n04xxmn01xxmn04/n03xxmn01xxmn01xxmn03/xxQn04xxUn04xxQ/n03xxMn01xxMn01xxMn03/n04xxMn01xxMn04/n11/n11/n03E0xA0xD0xS0xY0xn03";

    const invite = {
      version: controllerVersion,
      hostId: uid,
      hostColor: hostColor,
      guestId: null,
    };

    await admin.database().ref(`invites/${inviteId}`).set(invite);

    const match = {
      version: controllerVersion,
      color: hostColor,
      emojiId: emojiId,
      fen: initialFen,
      status: "",
      flatMovesString: "",
      timer: "",
    };

    await admin.database().ref(`players/${uid}/matches/${inviteId}`).set(match);

    const playerEthAddressRef = admin
      .database()
      .ref(`players/${uid}/ethAddress`);
    if (playerEthAddressRef) {
      const playerEthAddressSnapshot = await playerEthAddressRef.once("value");
      if (playerEthAddressSnapshot && playerEthAddressSnapshot.val()) {
        const playerEthAddress = playerEthAddressSnapshot.val();
        name =
          playerEthAddress.slice(2, 6) + "..." + playerEthAddress.slice(-4);
      }
    }

    let locationString = "🌎";
    try {
      const response = await fetch(
        `http://ip-api.com/json/${request.rawRequest.ip}`
      );
      const data = await response.json();
      if (data.status === "success") {
        locationString = `${data.country.toLowerCase()}`;
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
    const message = `${uid} ${name} from ${locationString} is looking for a match 👉 https://mons.link`;
    await sendTelegramMessage(message);

    return {
      ok: true,
      inviteId: inviteId,
    };
  }
});

async function sendTelegramMessage(message) {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  try {
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: message,
      }),
    });
  } catch (error) {
    console.error("Error sending Telegram message:", error);
  }
}
