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

  const playerEthAddressRef = admin.database().ref(`players/${uid}/ethAddress`);
  if (playerEthAddressRef) {
    const playerEthAddressSnapshot = await playerEthAddressRef.once("value");
    if (playerEthAddressSnapshot && playerEthAddressSnapshot.val()) {
      const playerEthAddress = playerEthAddressSnapshot.val();
      name = playerEthAddress.slice(2, 6) + "..." + playerEthAddress.slice(-4);
    }
  }

  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  const ipAddress = request.rawRequest.ip;
  const message = `${name} from ${ipAddress} is looking for a match!`;

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

  return {
    ok: true,
  };
});
