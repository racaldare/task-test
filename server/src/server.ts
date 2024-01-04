import { Server, Socket, createServer } from 'net';
import { stat, unlink } from 'fs';
import codec from '../../utils/codec';
import { Room, ProtocolMessage } from '../../utils/types';
import http, { IncomingMessage, ServerResponse } from "http";

// general variables
const SOCKETFILE = '/tmp/unix.sock',
  SERVER_PASSWORD = '0123456789Sa!%^-',
  connections = Array.of<Socket>(),
  rooms = Array.of<Room>(),
  DEBUG_MSG_ON = false;
var unixServer: Server;

// web server
const getHtmlDocument = () : string => {
  var matchesListHtml = rooms.map((item, index) => {
    return [
      `<li>Room ${index}`, // Room number
      `<ul><li>Players:<ul><li>Player ${item.initiatorId}</li><li>Player ${item.targetPlayerId}</li></ul></li></ul>`, // all players
      `<ul><li>Secret: ${item.secret}</li></ul>`, // secret
      `<ul><li>Attempts: ${item.attempts}</li></ul>`, // attempts count
      `<ul><li>Hints:</li><ul>${item.hints
        .map((hint) => `<li>${hint}</li>`)
        .join('')}</ul></li></ul>`, // attempts count
    ].join('');
  });

  var htmlDocumentArray = [
    '<html>',
    '<head>',
    '<title></title>',
    '</head>',
    '<body>',
    '<ul>',
    ...matchesListHtml,
    '<ul>',
    '</body>',
    '</html>',
  ];

  var htmlDocument = htmlDocumentArray.join('\n');

  return htmlDocument
}

const requestListener = (_req: IncomingMessage, res: ServerResponse) => {
  res.setHeader("Content-Type", "text/html");
  res.writeHead(200);
  res.end(getHtmlDocument());
};

const host = 'localhost';
const port = 8000;
const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});

// prevent duplicate exit messages
var SHUTDOWN = false;

const sendMessage = (connection: Socket, msg: ProtocolMessage) => {
  if (DEBUG_MSG_ON) {
    console.log('[DEBUG] msg sent', msg);
  }
  connection.write(Buffer.from(codec.encode(msg)));
};

const sendUnexpectedError = (sender: Socket, msg: string) => {
  if (DEBUG_MSG_ON) {
    console.log(msg);
  }
  sendMessage(sender, {
    code: 20,
  });
};

// generate id from 1 to 255
const generateId = (): number => {
  var id = 0;
  var idList = Object.keys(connections);
  while (idList.indexOf(id.toString()) != -1) {
    var id = Math.floor(Math.random() * 255 + 1);
  }

  return id;
};

const disconnectUnauthorised = (socket: Socket) => {
  var msg: ProtocolMessage = {
    code: 21,
  };

  sendMessage(socket, msg);
  socket.end();
};

const createAppSocket = (address: string | number) => {
  return createServer((stream) => {
    stream.once('data', (data) => {
      var msg = codec.decode(data.buffer);
      if (msg.password && msg.code === 10) {
        if (msg.password == SERVER_PASSWORD) {
          var self = generateId();
          connections[self] = stream;
          sendMessage(connections[self], {
            code: 1,
            id: self,
          });

          connections[self].on('data', (data) => {
            var msg = codec.decode(data.buffer);
            if (msg.id !== undefined) {
              if (DEBUG_MSG_ON) {
                console.log('[DEBUG] message: ', msg);
              }
              //process data
              messageReceived(msg, connections[self]);
            } else {
              disconnectUnauthorised(connections[self]);
            }
          });

          connections[self].on('end', () => {
            console.log(`Client ${self} disconnected.`);

            var room: Room | undefined;
            var roomIndex: number | undefined;
            rooms.forEach((item, index) => {
              if (item.initiatorId === self || item.targetPlayerId === self) {
                room = item;
                roomIndex = index;
              }
            });
            console.log('[DEBUG] roomIndex', roomIndex, 'room', room);

            if (room !== undefined && roomIndex !== undefined) {
              if (room.initiatorId === self) {
                if (connections[room.targetPlayerId] !== undefined) {
                  // notify target about disconnect
                  sendMessage(connections[room.targetPlayerId], {
                    code: 24,
                  });
                }
              } else {
                if (connections[room.initiatorId] !== undefined) {
                  // notify initiator about disconnect
                  sendMessage(connections[room.initiatorId], {
                    code: 24,
                  });
                }
              }

              delete rooms[roomIndex];
            }

            delete connections[self];
          });
        } else {
          // incorrect password
          console.log('Incorrect password.');
          sendMessage(stream, {
            code: 22,
          });
        }
      } else {
        disconnectUnauthorised(stream);
      }
    });
  })
    .listen(address)
    .on('connection', (socket) => {
      console.log('Client connected.');
      sendMessage(socket, {
        code: 10,
      });
    });
};

// unix socket
console.log('Starting Unix socket');
console.log('Checking for leftover socket.');
stat(SOCKETFILE, (err) => {
  if (err) {
    // start server
    console.log('No leftover socket found.');
    unixServer = createAppSocket(SOCKETFILE);
    return;
  }
  // remove file then start server
  console.log('Removing leftover socket.');
  unlink(SOCKETFILE, (err) => {
    if (err) {
      // This should never happen.
      console.error(err);
      process.exit(0);
    }
    unixServer = createAppSocket(SOCKETFILE);
    return;
  });
});

// tcp socket
console.log('Starting TCP socket');
const tcpSocketServer = createAppSocket(55555);

// close all connections when the user does CTRL-C
function cleanup() {
  if (!SHUTDOWN) {
    SHUTDOWN = true;
    console.log('\n', 'Terminating.', '\n');
    if (Object.keys(connections).length) {
      let clients = Object.keys(connections);
      while (clients.length) {
        let clientIdString = clients.pop();
        if (clientIdString !== undefined) {
          let clientId = parseInt(clientIdString);

          sendMessage(connections[clientId], {
            code: 30,
          });
          connections[clientId].end();
        }
      }
    }
    unixServer.close();
    tcpSocketServer.close();
    process.exit(0);
  }
}
process.on('SIGINT', cleanup);

const onlyUnique = (value: any, index: number, array: any[]) => {
  return array.indexOf(value) === index;
};

const messageReceived = (msg: ProtocolMessage, sender: Socket) => {
  if (msg.code === 11) {
    // send id list
    var occupied = rooms
      .flatMap((room) => [room.initiatorId.toString(), room.targetPlayerId.toString()])
      .filter(onlyUnique);
    var list = Object.keys(connections).filter((item) => occupied.indexOf(item) === -1);

    sendMessage(sender, { idList: list, code: 19 });
  } else if (msg.code === 12) {
    //challange player
    if (msg.idList !== undefined && msg.id !== undefined) {
      var targetPlayerId =
        typeof msg.idList[0] == 'number' ? msg.idList[0] : parseInt(msg.idList[0]);
      console.log(`Player ${msg.id} is challanging player ${targetPlayerId}`);

      createRoom(msg.secret, msg.id, targetPlayerId, msg.hint);
      sendMessage(connections[targetPlayerId], {
        idList: [msg.id],
        id: targetPlayerId,
        code: 13,
      });
    } else {
      sendUnexpectedError(
        sender,
        `Id or IdList is not defined Id: ${msg.id} IdList: ${msg.idList}`,
      );
    }
  } else if (msg.code === 14) {
    if (msg.idList === undefined || msg.id === undefined) {
      sendUnexpectedError(
        sender,
        `Id or IdList is not defined Id: ${msg.id} IdList: ${msg.idList}`,
      );
      return;
    }
    // challange accepted, creating room, starting game
    var initiatorId: number =
      typeof msg.idList[0] === 'string' ? parseInt(msg.idList[0]) : msg.idList[0];
    var targetPlayerId: number = msg.id;

    // check if both players still connected
    // if player missing, send error code to clients
    if (connections[targetPlayerId] === undefined) {
      sendMessage(connections[initiatorId], {
        code: 24,
      });
    }
    if (connections[initiatorId] === undefined) {
      sendMessage(connections[targetPlayerId], {
        code: 24,
      });
    } else {
      // if all good, send room details
      let roomId: number | undefined;
      rooms.forEach((item, index) => {
        if (item.initiatorId === initiatorId && item.targetPlayerId === targetPlayerId) {
          roomId = index;
        }
      });

      sendMessage(connections[targetPlayerId], {
        roomId: roomId,
        code: 15,
        hint: rooms[roomId].hints[0],
      });

      sendMessage(connections[initiatorId], {
        roomId: roomId,
        code: 15,
      });
    }
  } else if (msg.code === 16) {
    // attempt received
    if (msg.roomId === undefined) {
      sendUnexpectedError(sender, `RoomId is not defined RoomId: ${msg.roomId}`);
      return;
    }
    rooms[msg.roomId].attempts++;

    if (msg.attempt === '<igiveup>') {
      // notify that guesser gave up and delete room
      endMatch(
        18,
        connections[rooms[msg.roomId].initiatorId],
        connections[rooms[msg.roomId].targetPlayerId],
        msg.roomId,
      );
    } // If word is guessed, notify both and delete room
    else if (rooms[msg.roomId].secret === msg.attempt) {
      endMatch(
        3,
        connections[rooms[msg.roomId].initiatorId],
        connections[rooms[msg.roomId].targetPlayerId],
        msg.roomId,
      );
    } else {
      // Show attempt to initiator
      sendMessage(connections[rooms[msg.roomId].initiatorId], {
        code: 16,
        attempt: msg.attempt,
        attemptCount: rooms[msg.roomId].attempts,
      });
    }
  } else if (msg.code === 17) {
    // hint received
    if (msg.roomId === undefined || msg.hint === undefined) {
      sendUnexpectedError(
        sender,
        `RoomId or Hint is not defined RoomId: ${msg.roomId} Hint: ${msg.hint}`,
      );
      return;
    }
    rooms[msg.roomId].hints.push(msg.hint);
    sendMessage(connections[rooms[msg.roomId].targetPlayerId], {
      code: 17,
      hint: msg.hint,
    });
  } else if (msg.code === 23) {
    // player refused challenge
    if (msg.idList === undefined) {
      sendUnexpectedError(sender, `IdList is not defined IdList: ${msg.idList}`);
      return;
    }

    var initiatorId: number =
      typeof msg.idList[0] === 'string' ? parseInt(msg.idList[0]) : msg.idList[0];
    var targetPlayerId: number = msg.id;

    let roomId: number | undefined;
    rooms.forEach((item, index) => {
      if (item.initiatorId === initiatorId && item.targetPlayerId === targetPlayerId) {
        roomId = index;
      }
    });

    var initiatorId = typeof msg.idList[0] === 'string' ? parseInt(msg.idList[0]) : msg.idList[0];
    if (connections[initiatorId] !== undefined) {
      delete rooms[roomId];
      sendMessage(connections[initiatorId], {
        code: 25,
      });
    }
  } else {
    // unexpected error
    sendMessage(sender, {
      code: 20,
    });
  }
};

const endMatch = (code: number, initiator: Socket, targetPlayer: Socket, roomId: number) => {
  sendMessage(initiator, {
    code: code,
  });

  sendMessage(targetPlayer, {
    code: code,
  });

  delete rooms[roomId];
};

// generate id from 1 to 255
const createRoom = (
  secret: string,
  initiatorId: number,
  targetPlayerId: number,
  hint: string,
): number => {
  var roomId = 0;
  var roomList = Object.keys(rooms);
  while (roomList.indexOf(roomId.toString()) != -1) {
    var roomId = Math.floor(Math.random() * 255 + 1);
  }

  rooms[roomId] = {
    secret: secret,
    initiatorId: initiatorId,
    targetPlayerId: targetPlayerId,
    attempts: 0,
    isWordGuessed: false,
    hints: [hint],
  };

  return roomId;
};
