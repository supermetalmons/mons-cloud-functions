const admin = require("firebase-admin");
admin.initializeApp();

const { verifyEthAddress } = require("./verifyEthAddress");

const { attestVictory } = require("./attestVictory");
const { startTimer, claimVictoryByTimer } = require("./timers");

const { attestMatchVictory } = require("./attestMatchVictory");
const { startMatchTimer, claimMatchVictoryByTimer } = require("./matchTimers");

exports.verifyEthAddress = verifyEthAddress;
exports.attestVictory = attestVictory;
exports.startTimer = startTimer;
exports.claimVictoryByTimer = claimVictoryByTimer;

exports.attestMatchVictory = attestMatchVictory;
exports.startMatchTimer = startMatchTimer;
exports.claimMatchVictoryByTimer = claimMatchVictoryByTimer;