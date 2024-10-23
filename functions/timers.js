const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

exports.startTimer = onCall(async (request) => {
  const uid = request.auth.uid;
  const id = request.data.gameId;

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

  // TODO: get the current player / turn info, make sure there is no winner / resigner yet
  // TODO: do not run an entire winner verification
  
  // const color = matchData.color;
  // const opponentColor = opponentMatchData.color;
  // const mons = await import("mons-rust");
  // const winnerColorFen = mons.winner(
  //   matchData.fen,
  //   opponentMatchData.fen,
  //   matchData.flatMovesString,
  //   opponentMatchData.flatMovesString
  // );

  // TODO: create a timer within player's match model

  return {
    ok: true,
  };
});

exports.claimVictoryByTimer = onCall(async (request) => {
  const uid = request.auth.uid;
  const id = request.data.gameId;

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

  // TODO: get the current player / turn info, make sure there is no winner / resigner yet
  // TODO: do not run an entire winner verification
  // TODO: compare the game state with the existing timer
  
  // const color = matchData.color;
  // const opponentColor = opponentMatchData.color;
  // const mons = await import("mons-rust");
  // const winnerColorFen = mons.winner(
  //   matchData.fen,
  //   opponentMatchData.fen,
  //   matchData.flatMovesString,
  //   opponentMatchData.flatMovesString
  // );

  return {
    ok: true,
  };
});