const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { SecretManagerServiceClient } = require("@google-cloud/secret-manager");
const { SiweMessage } = require("siwe");

const secretManagerServiceClient = new SecretManagerServiceClient();
const admin = require("firebase-admin");
admin.initializeApp();

exports.attestVictory = onCall(async (request) => {
  const gameId = request.data.gameId;

  // TODO: get actual players addresses
  const address1 = "0xE4790DD79c334e3f848904975272ec17f9F70366";
  const address2 = "0x2bB97367fF26b701a60aedc213640C34F469cf38";

  const {
    EAS,
    SchemaEncoder,
    EIP712Proxy,
  } = require("@ethereum-attestation-service/eas-sdk");

  const { ethers } = require("ethers");
  const name = `projects/${process.env.GCLOUD_PROJECT}/secrets/mons-attester/versions/latest`;
  const [version] = await secretManagerServiceClient.accessSecretVersion({name});
  const privateKey = version.payload.data.toString('utf8');
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const signer = new ethers.Wallet(privateKey, provider);

  const newProxy = new EIP712Proxy(
    "0x6D132b7cDC2b5A5F7C4DFd6C84C0A776062C58Ae",
    { signer: signer }
  );
  const eas = new EAS("0x4200000000000000000000000000000000000021", {
    proxy: newProxy,
    signer: signer,
  });
  const proxy = await eas.getEIP712Proxy();
  const delegated = await proxy?.getDelegated();

  const schemaEncoder = new SchemaEncoder(
    "uint64 gameId, uint64 points, bool isWin"
  );

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

  // TODO: make sure refUIDs are fresh

  try {
    const response1 = await delegated.signDelegatedProxyAttestation(
      {
        schema:
          "0xb6cdeca57cf4618b9e6f619771b9ca43febd99de294a8de229aa4938405f2efa",
        recipient: address1,
        expirationTime: 0n,
        revocable: false,
        refUID:
          "0x90c4567ef07bd1b837fbf0c6d0c7006bebda90e2fa5b32f72d79b121eabec961",
        value: 0n,
        data: encodedData1,
        deadline: 0n,
      },
      signer
    );
    const signature1 = response1.signature;

    const response2 = await delegated.signDelegatedProxyAttestation(
      {
        schema:
          "0xb6cdeca57cf4618b9e6f619771b9ca43febd99de294a8de229aa4938405f2efa",
        recipient: address2,
        expirationTime: 0n,
        revocable: false,
        refUID:
          "0x90c4567ef07bd1b837fbf0c6d0c7006bebda90e2fa5b32f72d79b121eabec961",
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

    // TODO: add extra data needed for tx to the response

    const attester = await signer.getAddress();

    return {
      attester: attester,
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
