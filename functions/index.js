const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { SiweMessage } = require("siwe");

const secretManagerServiceClient = new SecretManagerServiceClient();
const admin = require("firebase-admin");
admin.initializeApp();

exports.attestVictory = onCall(async (request) => {
  const gameId = request.data.gameId;
  
  // TODO: get actual players addresses
  const address1 = "0xE26067c76fdbe877F48b0a8400cf5Db8B47aF0fE";
  const address2 = "0xFD50b031E778fAb33DfD2Fc3Ca66a1EeF0652165";

  const {
    EAS,
    SchemaEncoder,
  } = require("@ethereum-attestation-service/eas-sdk");

  const { ethers } = require("ethers");
  const privateKey = ethers.Wallet.createRandom().privateKey; // TODO: get secret mons attester key
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const signer = new ethers.Wallet(privateKey, provider);

  const eas = new EAS("0x4200000000000000000000000000000000000021");
  eas.connect(signer);
  const delegated = await eas.getDelegated();
  const schemaEncoder = new SchemaEncoder("uint64 gameId, uint64 points, bool isWin");

  const encodedData1 = schemaEncoder.encodeData([
    { name: "gameId", value: 0, type: "uint64" },
    { name: "points", value: 1000, type: "uint64" },
    { name: "isWin", value: true, type: "bool" },
  ]);
  const encodedData2 = schemaEncoder.encodeData([
    { name: "gameId", value: 0, type: "uint64" },
    { name: "points", value: 1000, type: "uint64" },
    { name: "isWin", value: false, type: "bool" },
  ]);

  try {
    const response1 = await delegated.signDelegatedAttestation(
      {
        schema:
          "0xb6cdeca57cf4618b9e6f619771b9ca43febd99de294a8de229aa4938405f2efa",
        recipient: address1,
        expirationTime: 0n,
        revocable: false,
        refUID:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        data: encodedData1,
        deadline: 0n,
        value: 0n,
      },
      signer
    );
    const signature1 = response1.signature; 
    
    const response2 = await delegated.signDelegatedAttestation(
      {
        schema:
          "0xb6cdeca57cf4618b9e6f619771b9ca43febd99de294a8de229aa4938405f2efa",
        recipient: address2,
        expirationTime: 0n,
        revocable: false,
        refUID:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        data: encodedData2,
        deadline: 0n,
        value: 0n,
      },
      signer
    );
    const signature2 = response2.signature; 

    const signatures = [
      {
        r: signature1.r,
        s: signature1.s,
        v: signature1.v
      },
      {
        r: signature2.r,
        s: signature2.s,
        v: signature2.v
      }
    ];

    // TODO: add extra data needed for tx to the response

    return {
      signatures: signatures,
      ok: true,
    };
  } catch (error) {
    console.error("Error in attestVictory:", error);
    throw new HttpsError("internal", "An error occurred while processing the attestation.");
  }
});

exports.verifyEthAddress = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const message = request.data.message;
  const signature = request.data.signature;

  const siweMessage = new SiweMessage(message);
  const fields = await siweMessage.verify({ signature });
  const address = fields.data.address;
  const uid = request.auth.uid;

  if (
    fields.success &&
    fields.data.nonce === uid &&
    fields.data.statement === "mons ftw"
  ) {
    const db = admin.database();
    const ethAddressRef = db.ref(`players/${uid}/ethAddress`);
    const ethAddressSnapshot = await ethAddressRef.once("value");
    const existingEthAddress = ethAddressSnapshot.val();

    let responseAddress;
    if (existingEthAddress === null) {
      await ethAddressRef.set(address);
      responseAddress = address;
    } else {
      responseAddress = existingEthAddress;
    }

    return {
      ok: true,
      uid: uid,
      address: responseAddress,
    };
  } else {
    return {
      ok: false,
    };
  }
});
