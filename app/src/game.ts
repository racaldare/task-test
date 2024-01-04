import { ProtocolMessage } from "../../utils/types";

import { input, select } from "@inquirer/prompts";
const appClient = require("./client").default;

const DEBUG_MSG_ON = false;
appClient.DEBUG_MSG_ON = DEBUG_MSG_ON;

var isInMatch = false,
  isInterrupted = false,
  isDisconnected = false;

const messageReceived = async (msg: ProtocolMessage) => {
  if (DEBUG_MSG_ON) {
    console.log("[DEBUG] messageReceived:", msg);
  }

  if (msg.code == 24) {
    // Player disconnected
    console.clear();
    console.log(`! Player no longer available`);
    input({ message: `Hit enter to continue` }).then(() => {
      isInterrupted = false;
      mainMenu();
    });
    isDisconnected = true;
    isInMatch = false;
    isInterrupted = true;
  } else if (msg.code == 25) {
    // Game refused
    console.clear();
    console.log(`! Player refused`);
    input({ message: `Hit enter to continue` }).then(() => {
      isInterrupted = false;
      mainMenu();
    });
    isInMatch = false;
    isInterrupted = true;
  } else if (msg.code == 18) {
    // Player gave up
    console.clear();
    console.log(`! Player gave up :(`);
    input({ message: `Hit enter to continue` }).then(() => {
      isInterrupted = false;
      mainMenu();
    });
    isInMatch = false;
    isInterrupted = true;
  } else if (msg.code == 3) {
    // Game finished
    console.clear();
    console.log(`! Game Over`);
    input({ message: `Hit enter to continue` }).then(() => {
      isInterrupted = false;
      mainMenu();
    });
    isInMatch = false;
    isInterrupted = true;
  } else if (msg.code == 16) {
    // Guess received
    console.log(`! Other player guessed\n! Attempt ${msg.attemptCount}: ${msg.attempt}\n! Continue typing`);
  } else if (msg.code == 17) {
    // Hint received
    console.log(`\n! Other player sent a hint: ${msg.hint}\n! Continue typing`);
  } else if (msg.code === 15) {
    // Game starting
    isInMatch = true;
    isInterrupted = true;
    startMatch(msg.hint);
  } else if (msg.code === 13) {
    // Challange notification received
    isInterrupted = true;
    if (msg.idList === undefined) {
      console.log("! Error occured.");
      mainMenu();
      return;
    }
    console.clear();
    console.log("! Challange received");
    console.log(`! Player ${msg.id} is challenging you!`);

    if (DEBUG_MSG_ON) {
      console.log("[DEBUG] isInterrupted", isInterrupted, "isInMatch ", isInMatch);
    }

    getPromptSelectValue("Accept challenge:", [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ]).then((value: boolean) => {
      if (isDisconnected) {
        return;
      }
      isInterrupted = false;

      if (value) {
        appClient.acceptChallenge(msg.idList[0]);
      } else {
        appClient.refuseChallenge(msg.idList[0]);
        mainMenu();
      }
    });
  } else if (msg.code === 19) {
    getPlayerList(msg);
  }
};

const getPlayerList = async (msg: ProtocolMessage) => {
  console.clear();
  // get list of players
  if (msg.idList === undefined) {
    console.log("! No players found.");
    input({ message: `Hit enter to continue` }).then(() => {
      isInterrupted = false;
      mainMenu();
    });
    return;
  }

  var playerList = msg.idList
    .filter((id) => id !== appClient.getId())
    .map((player) => {
      return {
        name: `Player ${player}`,
        value: player,
      };
    });

  if (DEBUG_MSG_ON) {
    console.log("[DEBUG] player list: ", playerList);
  }
  if (playerList.length <= 0) {
    console.log("! No players found.");
    input({ message: `Hit enter to continue` }).then(() => {
      mainMenu();
    });
  } else {
    var items = [{ name: "Main menu", value: -1 }, ...playerList];
    var selectedPlayerId = await getPromptSelectValue("Please, choose from the list of players:", items);

    if (selectedPlayerId === -1) {
      mainMenu();
    } else {
      let secret = "";
      while (secret === "") {
        secret = await getPromptValue("Secret word:");
        if (secret === "") {
          console.log("! Please, do not enter empty space");
        }
      }

      let hint = "";
      while (hint === "") {
        hint = await getPromptValue("Hint:");
        if (hint === "") {
          console.log("! Please, do not enter empty space");
        }
      }
      console.log("! Please, await other player's response...");
      appClient.challangePlayer(secret, selectedPlayerId, hint);
    }
  }
};

const startGame = async () => {
  console.clear();
  var isUnix = await getPromptSelectValue("How to connect?", [
    { name: "Unix", value: true },
    { name: "TPC", value: false },
  ]);

  await appClient.initiateClient(messageReceived, isUnix);

  mainMenu();
};

const mainMenu = async () => {
  if (DEBUG_MSG_ON) {
    console.log("[DEBUG] Main menu");
  }
  console.clear();
  var isRequested = await getPromptSelectValue("Would you like a list of available players?", [
    { name: "Yes", value: true },
    { name: "No", value: false },
  ]);

  if (DEBUG_MSG_ON) {
    console.log("[DEBUG] isInterrupted", isInterrupted);
  }

  if (isInterrupted || isInMatch) {
    return;
  }

  if (DEBUG_MSG_ON) {
    console.log("[DEBUG] isRequested", isRequested);
  }

  if (isRequested) {
    appClient.requestPlayerList();
  } else {
    if (DEBUG_MSG_ON) {
      console.log("[DEBUG] Menu again");
    }
    mainMenu();
  }
};

const getPromptValue = async (msg) => {
  var answer = await input({ message: msg }).catch(() => {
    process.exit();
  });

  return answer.toLocaleLowerCase();
};

const getPromptSelectValue = async (msg, items) => {
  let answer = await select({
    message: msg,
    choices: items,
  }).catch(() => {
    process.exit();
  });
  return answer;
};

const startMatch = async (hint: string | undefined = undefined) => {
  console.clear();
  console.log("*********************** Match ***********************");
  if (hint) {
    console.log(`! Other player sent you a hint: ${hint}`);
    enterMatchAsGuesser();
  } else {
    console.log("! Other player is thinking...");
    enterMatchAsHintter();
  }
};

const enterMatchAsGuesser = async () => {
  let attempt = "";
  console.log("! To give up, type <igiveup>");
  while (attempt === "" && isInMatch) {
    attempt = await getPromptValue("Guess a word:");
    if (attempt === "") {
      console.log("! Please, do not enter empty space");
    }
  }

  if (isInMatch) {
    appClient.sendAttempt(attempt);

    enterMatchAsGuesser();
  }
};

const enterMatchAsHintter = async () => {
  let hint = await getPromptValue("Hint:");

  while (hint === "" && isInMatch) {
    console.log("! Please, do not enter empty space");
    hint = await getPromptValue("Hint:");
  }

  if (isInMatch) {
    appClient.sendHint(hint);

    enterMatchAsHintter();
  }
};

startGame();
