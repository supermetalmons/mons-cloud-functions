const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

exports.startMatchTimer = onCall(async (request) => {
  const uid = request.auth.uid;
  const id = request.data.inviteId; // TODO: distinguish match id and invite id

  const matchRef = admin.database().ref(`players/${uid}/matches/${id}`);
  const matchSnapshot = await matchRef.once("value");
  const matchData = matchSnapshot.val();

  const inviteRef = admin.database().ref(`invites/${id}`);
  const inviteSnapshot = await inviteRef.once("value");
  const inviteData = inviteSnapshot.val();

  const opponentId =
    inviteData.guestId === uid ? inviteData.hostId : inviteData.guestId;

  const opponentMatchRef = admin
    .database()
    .ref(`players/${opponentId}/matches/${id}`);
  const opponentMatchSnapshot = await opponentMatchRef.once("value");
  const opponentMatchData = opponentMatchSnapshot.val();

  const color = matchData.color;
  const opponentColor = opponentMatchData.color;

  const mons = await import("mons-rust");

  let game = mons.MonsGameModel.from_fen(matchData.fen);
  if (!game.is_later_than(opponentMatchData.fen)) {
    game = mons.MonsGameModel.from_fen(opponentMatchData.fen);
  }

  if (
    matchData.status == "surrendered" ||
    opponentMatchData.status == "surrendered" ||
    game.winner_color() !== undefined ||
    matchData.timer == "gg" ||
    opponentMatchData.timer == "gg"
  ) {
    throw new HttpsError("failed-precondition", "game is already over.");
  }

  let whiteFlatMovesString = "";
  let blackFlatMovesString = "";
  if (color === "white") {
    whiteFlatMovesString = matchData.flatMovesString;
    blackFlatMovesString = opponentMatchData.flatMovesString;
  } else {
    whiteFlatMovesString = opponentMatchData.flatMovesString;
    blackFlatMovesString = matchData.flatMovesString;
  }

  let result = game.verify_moves(whiteFlatMovesString, blackFlatMovesString);
  if (!result) {
    throw new HttpsError(
      "failed-precondition",
      "something is wrong with the moves."
    );
  }

  let turnNumber = game.turn_number();
  let activeColor = game.active_color();
  let opponentColorModel =
    opponentColor === "white" ? mons.Color.White : mons.Color.Black;

  if (activeColor != opponentColorModel) {
    throw new HttpsError(
      "failed-precondition",
      "can't start a timer on your own turn."
    );
  }

  const duration = 90000;
  const targetTimestamp = Date.now() + duration + 500;
  const timerString = `${turnNumber};${targetTimestamp}`;
  await matchRef.child("timer").set(timerString);

  return {
    duration: duration,
    timer: timerString,
    ok: true,
  };
});

exports.claimMatchVictoryByTimer = onCall(async (request) => {
  const uid = request.auth.uid;
  const id = request.data.inviteId; // TODO: distinguish match id and invite id

  const matchRef = admin.database().ref(`players/${uid}/matches/${id}`);
  const matchSnapshot = await matchRef.once("value");
  const matchData = matchSnapshot.val();

  const inviteRef = admin.database().ref(`invites/${id}`);
  const inviteSnapshot = await inviteRef.once("value");
  const inviteData = inviteSnapshot.val();

  const opponentId =
    inviteData.guestId === uid ? inviteData.hostId : inviteData.guestId;

  const opponentMatchRef = admin
    .database()
    .ref(`players/${opponentId}/matches/${id}`);
  const opponentMatchSnapshot = await opponentMatchRef.once("value");
  const opponentMatchData = opponentMatchSnapshot.val();

  const color = matchData.color;
  const opponentColor = opponentMatchData.color;

  const mons = await import("mons-rust");

  let game = mons.MonsGameModel.from_fen(matchData.fen);
  if (!game.is_later_than(opponentMatchData.fen)) {
    game = mons.MonsGameModel.from_fen(opponentMatchData.fen);
  }

  if (
    matchData.status == "surrendered" ||
    opponentMatchData.status == "surrendered" ||
    matchData.timer == "gg" ||
    opponentMatchData.timer == "gg" ||
    game.winner_color() !== undefined
  ) {
    throw new HttpsError("failed-precondition", "game is already over.");
  }

  let whiteFlatMovesString = "";
  let blackFlatMovesString = "";
  if (color === "white") {
    whiteFlatMovesString = matchData.flatMovesString;
    blackFlatMovesString = opponentMatchData.flatMovesString;
  } else {
    whiteFlatMovesString = opponentMatchData.flatMovesString;
    blackFlatMovesString = matchData.flatMovesString;
  }

  let result = game.verify_moves(whiteFlatMovesString, blackFlatMovesString);
  if (!result) {
    throw new HttpsError(
      "failed-precondition",
      "something is wrong with the moves."
    );
  }

  let activeColor = game.active_color();
  let opponentColorModel =
    opponentColor === "white" ? mons.Color.White : mons.Color.Black;

  if (activeColor != opponentColorModel) {
    throw new HttpsError("failed-precondition", "can't claim timer victory on your own turn.");
  }

  const timer = matchData.timer;
  if (timer && typeof timer === 'string') {
    const [turnNumber, targetTimestamp] = timer.split(';').map(Number);
    if (!isNaN(turnNumber) && !isNaN(targetTimestamp)) {
      const timeDelta = targetTimestamp - Date.now();
      const sameTurn = game.turn_number() === turnNumber;
      if (sameTurn && (timeDelta) <= 0) {
        await matchRef.child("timer").set("gg");
        return { ok: true, };
      } else if (!sameTurn) {
        throw new HttpsError("failed-precondition", "can't claim this timer anymore, it's turn is over.");
      } else {
        throw new HttpsError("failed-precondition", `can't claim yet, ${timeDelta} ms remaining`);
      }
    } else {
      throw new HttpsError("failed-precondition", "wrong timer format.");
    }
  } else {
    throw new HttpsError("failed-precondition", "could not find an existing timer.");
  }
});