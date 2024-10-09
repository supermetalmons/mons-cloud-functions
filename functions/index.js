const admin = require("firebase-admin");
admin.initializeApp();

const { verifyEthAddress } = require("./verifyEthAddress");
const { attestVictory } = require("./attestVictory");

exports.verifyEthAddress = verifyEthAddress;
exports.attestVictory = attestVictory;
