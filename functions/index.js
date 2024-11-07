const admin = require("firebase-admin");
admin.initializeApp();

const { verifyEthAddress } = require("./verifyEthAddress");
const { attestMatchVictory } = require("./attestMatchVictory");
const { startMatchTimer, claimMatchVictoryByTimer } = require("./matchTimers");
const { automatch } = require("./automatch");

exports.verifyEthAddress = verifyEthAddress;
exports.attestMatchVictory = attestMatchVictory;
exports.startMatchTimer = startMatchTimer;
exports.claimMatchVictoryByTimer = claimMatchVictoryByTimer;
exports.automatch = automatch;