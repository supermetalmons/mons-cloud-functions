const admin = require("firebase-admin");
admin.initializeApp();

const { verifyEthAddress } = require("./verifyEthAddress");
const { attestVictory } = require("./attestVictory");
const { startTimer, claimVictoryByTimer } = require("./timers");

exports.verifyEthAddress = verifyEthAddress;
exports.attestVictory = attestVictory;
exports.startTimer = startTimer;
exports.claimVictoryByTimer = claimVictoryByTimer;
