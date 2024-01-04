import { Socket } from "net";
import codec from "../../utils/codec";
import { ProtocolMessage, AppClient } from "../../utils/types";

const UNIX_ADDRESS = "/tmp/unix.sock",
  TCP_ADDRESS = "127.0.0.1",
  TCP_PORT = 55555,
  SERVER_PASSWORD = "0123456789Sa!%^-";

var clientInstance = new Socket(),
  isUnix: string | undefined,
  id: number | undefined,
  roomId: number | undefined;

const appClient: AppClient = {
  DEBUG_MSG_ON: true,
  sendMessage: function (msg: ProtocolMessage): void {
    throw new Error("Function not implemented.");
  },
  initiateClient: function (dataReceivedCallback: (msg: ProtocolMessage) => {}, isUnixParam: boolean): void {
    throw new Error("Function not implemented.");
  },
  getId: function (): number | undefined {
    throw new Error("Function not implemented.");
  },
  getClientType: function (): string | undefined {
    throw new Error("Function not implemented.");
  },
  requestPlayerList: function (): void {
    throw new Error("Function not implemented.");
  },
  challangePlayer: function (secret: string, selectedPlayerId: number, hint: string): void {
    throw new Error("Function not implemented.");
  },
  acceptChallenge: function (targetPlayerId: string): void {
    throw new Error("Function not implemented.");
  },
  refuseChallenge: function (targetPlayerId: number): void {
    throw new Error("Function not implemented.");
  },
  sendHint: function (hint: string): void {
    throw new Error("Function not implemented.");
  },
  sendAttempt: function (attempt: string): void {
    throw new Error("Function not implemented.");
  },
};

appClient.initiateClient = (dataReceivedCallback, isUnixParam = false) => {
  return new Promise<void>((resolve) => {
    if (isUnixParam) {
      clientInstance.connect(UNIX_ADDRESS);
    } else {
      clientInstance.connect(TCP_PORT, TCP_ADDRESS);
    }

    clientInstance.on("data", (data) => {
      var msg = codec.decode(data.buffer);
      if (msg.code === 10) {
        console.log("! Authentication required.");
        appClient.sendMessage({ code: 10, password: SERVER_PASSWORD });
      } else if (msg.code === 30) {
        console.log("\n! Server terminated connection.");
        resolve();
      } else if (msg.code === 20) {
        console.log("\nUnexpected error.");
        clientInstance.end();
        resolve();
      } else if (msg.code === 21) {
        console.log("\nUser is unauthorised.");
        clientInstance.end();
        resolve();
      } else if (msg.code === 22) {
        console.log("\nIncorrect password.");
        clientInstance.end();
        resolve();
      } else if (msg.code === 15) {
        // Game starting
        roomId = msg.roomId;
        dataReceivedCallback(msg);
      } else if (msg.code === 1) {
        console.log("! Client connected. Authentication successful.");
        id = msg.id;
        if (appClient.DEBUG_MSG_ON) {
          console.log(`\n[DEBUG] Id received - ${id}`);
        }
        resolve();
      } else {
        dataReceivedCallback(msg);
      }
    });
  });
};

appClient.getId = () => {
  return id;
};

appClient.getClientType = () => {
  return isUnix;
};

appClient.sendMessage = (msg: ProtocolMessage) => {
  if (appClient.DEBUG_MSG_ON) {
    console.log("[DEBUG] Client send msg: ", msg);
  }
  clientInstance.write(Buffer.from(codec.encode(msg)));
};

appClient.requestPlayerList = () => {
  appClient.sendMessage({ code: 11, id: id });
};

appClient.challangePlayer = (secret: string, selectedPlayerId: number, hint: string) => {
  appClient.sendMessage({
    code: 12,
    secret: secret,
    idList: [selectedPlayerId],
    hint: hint,
    id: id,
  });
};

appClient.acceptChallenge = (targetPlayerId: string) => {
  appClient.sendMessage({
    code: 14,
    idList: [targetPlayerId],
    id: id,
  });
};

appClient.refuseChallenge = (targetPlayerId: number) => {
  appClient.sendMessage({
    code: 23,
    idList: [targetPlayerId],
    id: id,
  });
};

appClient.sendHint = (hint: string) => {
  appClient.sendMessage({
    code: 17,
    id: id,
    hint: hint,
    roomId: roomId,
  });
};

appClient.sendAttempt = (attempt: string) => {
  appClient.sendMessage({
    code: 16,
    id: id,
    attempt: attempt,
    roomId: roomId,
  });
};

export default appClient;
