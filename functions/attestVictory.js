const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const {
  EAS,
  SchemaEncoder,
  EIP712Proxy,
} = require("@ethereum-attestation-service/eas-sdk");
const { ethers } = require("ethers");
const admin = require("firebase-admin");

const secretManagerServiceClient = new SecretManagerServiceClient();

exports.attestVictory = onCall(async (request) => {
  const easAddress = "0x4200000000000000000000000000000000000021";
  const proxyAddress = "0x6D132b7cDC2b5A5F7C4DFd6C84C0A776062C58Ae";
  const schema =
    "0xb6cdeca57cf4618b9e6f619771b9ca43febd99de294a8de229aa4938405f2efa";

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

  const playerEthAddressRef = admin.database().ref(`players/${uid}/ethAddress`);
  const playerEthAddressSnapshot = await playerEthAddressRef.once("value");
  const playerEthAddress = playerEthAddressSnapshot.val();

  if (!playerEthAddress) {
    throw new HttpsError(
      "failed-precondition",
      "Player's Ethereum address not found."
    );
  }

  const opponentEthAddressRef = admin
    .database()
    .ref(`players/${opponentId}/ethAddress`);
  const opponentEthAddressSnapshot = await opponentEthAddressRef.once("value");
  const opponentEthAddress = opponentEthAddressSnapshot.val();

  if (!opponentEthAddress) {
    throw new HttpsError(
      "failed-precondition",
      "Opponent's Ethereum address not found."
    );
  }

  var result = "none";
  if (matchData.status == "surrendered") {
    result = "gg";
  } else if (opponentMatchData.status == "surrendered") {
    result = "win";
  } else {
    const color = matchData.color;
    const opponentColor = opponentMatchData.color;
    const mons = await import("mons-rust");
    var winnerColorFen = "";
    if (color == "white") {
      winnerColorFen = mons.winner(
        matchData.fen,
        opponentMatchData.fen,
        matchData.flatMovesString,
        opponentMatchData.flatMovesString
      );
    } else {
      winnerColorFen = mons.winner(
        opponentMatchData.fen,
        matchData.fen,
        opponentMatchData.flatMovesString,
        matchData.flatMovesString
      );
    }
    if (winnerColorFen != "") {
      if (winnerColorFen === "x") {
        // TODO: explore corrupted game data to see if there was cheating
      }

      var winnerColor = "none";
      if (winnerColorFen == "w") {
        winnerColor = "white";
      } else if (winnerColorFen == "b") {
        winnerColor = "black";
      }

      if (winnerColor == color) {
        result = "win";
      } else if (winnerColor == opponentColor) {
        result = "gg";
      }
    }
  }

  if (result !== "win") {
    throw new HttpsError("internal", "Cound not confirm victory.");
  }

  const recipient1 = playerEthAddress;
  const recipient2 = opponentEthAddress;

  const graph = "https://base.easscan.org/graphql";
  const recipientForQuery = recipient1; // TODO: get for both of them
  const query = `
    query Attestation {
      attestations(
        take: 20,
        skip: 0,
        orderBy: { timeCreated: desc },
        where: { 
          schemaId: { equals: "${schema}" }, 
          attester: { equals: "${proxyAddress}" },
          recipient: { equals: "${recipientForQuery}" },
          revoked: { equals: false },
        },
      ) {
        decodedDataJson
        refUID
        id
      }
    }
  `;

  const name = `projects/${process.env.GCLOUD_PROJECT}/secrets/mons-attester/versions/latest`;
  const [version] = await secretManagerServiceClient.accessSecretVersion({
    name,
  });
  const privateKey = version.payload.data.toString("utf8");
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const signer = new ethers.Wallet(privateKey, provider);

  const newProxy = new EIP712Proxy(proxyAddress, { signer: signer });
  const eas = new EAS(easAddress, {
    proxy: newProxy,
    signer: signer,
  });
  const proxy = await eas.getEIP712Proxy();
  const delegated = await proxy?.getDelegated();

  const schemaEncoder = new SchemaEncoder(
    "uint64 gameId, uint64 points, bool isWin"
  );

  // TODO: get actual game results, calculate actual updated elo
  const encodedData1 = schemaEncoder.encodeData([
    { name: "gameId", value: 0, type: "uint64" },
    { name: "points", value: 1001, type: "uint64" },
    { name: "isWin", value: true, type: "bool" },
  ]);
  const encodedData2 = schemaEncoder.encodeData([
    { name: "gameId", value: 0, type: "uint64" },
    { name: "points", value: 999, type: "uint64" },
    { name: "isWin", value: false, type: "bool" },
  ]);

  // TODO: make sure refUIDs are fresh
  const refUID1 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const refUID2 =
    "0x0000000000000000000000000000000000000000000000000000000000000000";

  try {
    const response1 = await delegated.signDelegatedProxyAttestation(
      {
        schema: schema,
        recipient: recipient1,
        expirationTime: 0n,
        revocable: false,
        refUID: refUID1,
        value: 0n,
        data: encodedData1,
        deadline: 0n,
      },
      signer
    );
    const signature1 = response1.signature;

    const response2 = await delegated.signDelegatedProxyAttestation(
      {
        schema: schema,
        recipient: recipient2,
        expirationTime: 0n,
        revocable: false,
        refUID: refUID2,
        value: 0n,
        data: encodedData2,
        deadline: 0n,
      },
      signer
    );
    const signature2 = response2.signature;

    const signatures = [
      {
        r: signature1.r,
        s: signature1.s,
        v: signature1.v,
      },
      {
        r: signature2.r,
        s: signature2.s,
        v: signature2.v,
      },
    ];

    const attester = await signer.getAddress();

    return {
      easAddress: easAddress,
      proxyAddress: proxyAddress,
      schema: schema,
      attester: attester,
      recipient1: recipient1,
      recipient2: recipient2,
      refUID1: refUID1,
      refUID2: refUID2,
      encodedData1: encodedData1,
      encodedData2: encodedData2,
      signatures: signatures,
      ok: true,
    };
  } catch (error) {
    console.error("Error in attestVictory:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while processing the attestation."
    );
  }
});
