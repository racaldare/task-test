export type Room = {
  secret: string;
  initiatorId: number;
  targetPlayerId: number;
  attempts: number;
  isWordGuessed: boolean;
  hints: string[];
};
export type ProtocolMessage = {
  code?: number;
  secret?: string;
  id?: number;
  idList?: number[] | string[];
  hint?: string;
  roomId?: number;
  attempt?: string;
  attemptCount?: number;
  password?: string;
};
export type ProtocolSchema = {
  propertiesBytes: number;
  strings: string[];
  numericLists: string[];
  booleans: string[];
  booleanBytes: number;
  numerical: {
    id: number;
    code: number;
    roomId: number;
    attemptCount: number;
  };
};
export type MessageTranscoder = {
  DEBUG_MSG_ON: boolean;
  updateSchema: ProtocolSchema;
  encode: (message: ProtocolMessage) => ArrayBuffer;
  computeSize: (message: ProtocolMessage, schema: ProtocolSchema) => number;
  encodeBuffer: (message: ProtocolMessage, buffer: ArrayBuffer, schema: ProtocolSchema) => void;
  encodeBytes: (dv: DataView, offset: number, nbBytes: number, value: any) => number;
  encodeString: (dv: DataView, offset: number, str: string) => void;
  encodeNumericList: (dv: DataView, offset: number, list: number[]) => void;
  decode: (buffer: ArrayBuffer) => ProtocolMessage;
  countProperties: (schema: ProtocolSchema) => number;
  isMaskTrue: (mask: number, nbProperties: number, idx: number) => boolean;
  decodeString: (view: DataView, length: number, offset: number) => string;
  decodeNumericList: (view: DataView, length: number, offset: number) => number[];
};
export type AppClient = {
  DEBUG_MSG_ON: boolean;
  sendMessage: (msg: ProtocolMessage) => void;
  initiateClient: (dataReceivedCallback: (msg: ProtocolMessage) => {}, isUnixParam: boolean) => void;
  getId: () => number | undefined;
  getClientType: () => string | undefined;
  requestPlayerList: () => void;
  challangePlayer: (secret: string, selectedPlayerId: number, hint: string) => void;
  acceptChallenge: (targetPlayerId: string, secret: string, hint: string) => void;
  refuseChallenge: (targetPlayerId: number) => void;
  sendHint: (hint: string) => void;
  sendAttempt: (attempt: string) => void;
};
