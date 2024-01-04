import { ProtocolSchema, ProtocolMessage, MessageTranscoder } from "./types";

var Codec: MessageTranscoder = {
  DEBUG_MSG_ON: false,
  updateSchema: {
    propertiesBytes: 0,
    strings: [],
    numericLists: [],
    booleans: [],
    booleanBytes: 0,
    numerical: {
      id: 0,
      code: 0,
      roomId: 0,
      attemptCount: 0,
    },
  },
  encode: function (message: ProtocolMessage): ArrayBuffer {
    throw new Error("Function not implemented.");
  },
  computeSize: function (message: ProtocolMessage, schema: ProtocolSchema): number {
    throw new Error("Function not implemented.");
  },
  encodeBuffer: function (message: ProtocolMessage, buffer: ArrayBuffer, schema: ProtocolSchema): void {
    throw new Error("Function not implemented.");
  },
  encodeBytes: function (dv: DataView, offset: number, nbBytes: number, value: any): number {
    throw new Error("Function not implemented.");
  },
  encodeString: function (dv: DataView, offset: number, str: string): void {
    throw new Error("Function not implemented.");
  },
  encodeNumericList: function (dv: DataView, offset: number, list: number[]): void {
    throw new Error("Function not implemented.");
  },
  decode: function (buffer: ArrayBuffer): ProtocolMessage {
    throw new Error("Function not implemented.");
  },
  countProperties: function (schema: ProtocolSchema): number {
    throw new Error("Function not implemented.");
  },
  isMaskTrue: function (mask: number, nbProperties: number, idx: number): boolean {
    throw new Error("Function not implemented.");
  },
  decodeString: function (view: DataView, length: number, offset: number): string {
    throw new Error("Function not implemented.");
  },
  decodeNumericList: function (view: DataView, length: number, offset: number): number[] {
    throw new Error("Function not implemented.");
  },
};

Codec.updateSchema = {
  propertiesBytes: 2, // Size in bytes of the properties bitmask
  strings: ["attempt", "hint", "password", "secret"],
  numericLists: ["idList"],
  booleans: ["isWordGuessed"],
  booleanBytes: 1,
  numerical: {
    id: 1,
    code: 1,
    roomId: 1,
    attemptCount: 1,
  },
};

/* ### ENCODING ### */

Codec.encode = (message: ProtocolMessage) => {
  var schema = Codec.updateSchema;
  var size = Codec.computeSize(message, schema); // Count how many bytes should be allocated in the buffer
  if (Codec.DEBUG_MSG_ON) {
    console.log("[DEBUG] size = " + size + " bytes");
  }
  var buffer = new ArrayBuffer(size);
  Codec.encodeBuffer(message, buffer, schema);
  return buffer;
};

Codec.computeSize = (message: ProtocolMessage, schema: ProtocolSchema) => {
  // compute the size in bytes of the ArrayBuffer to create
  var size = 0;
  size += schema.propertiesBytes; // add the bytes necessary for the bitmask

  if (schema.numerical) {
    // Count the bytes needed for numerical values
    Object.keys(schema.numerical).forEach((key) => {
      if (message[key] !== undefined) size += schema.numerical[key]; // If the message has that property, allocate the corresponding amount of bytes
    });
  }

  if (schema.strings) {
    // Count the bytes needed for each string
    schema.strings.forEach((key) => {
      if (message[key] !== undefined) size += message[key].length + 1; // 1 byte per character + 1 byte to store the length of the string
    });
  }

  if (schema.numericLists) {
    schema.numericLists.forEach((key) => {
      if (message[key] !== undefined) size += message[key].length + 1;
    });
  }

  size += schema.booleanBytes; // Add schema.booleanBytes bytes to store the booleans (one boolean per bit)
  return size;
};

Codec.encodeBuffer = (message: ProtocolMessage, buffer: ArrayBuffer, schema: ProtocolSchema) => {
  var dv = new DataView(buffer);
  var offset = 0; // Offset, in bytes, from the start of the buffer, where the new bytes should be written
  var bitmaskOffset = offset;
  offset = Codec.encodeBytes(dv, bitmaskOffset, schema.propertiesBytes, 0); // Temporary 0 value for the bitmask
  var bitmask = 0; // The bitmask will be created as we go, and then stored in the arrayBuffer

  if (schema.numerical) {
    Object.keys(schema.numerical).forEach((key) => {
      if (message[key] !== undefined) {
        // If the message contains that propertie, encode it
        offset = Codec.encodeBytes(dv, offset, schema.numerical[key], message[key]);
        bitmask |= 1; // Bitwise operation to indicate in the mask that the current property is present in the message
      }
      bitmask <<= 1; // Shift the bitmask to the next property
    });
  }

  if (schema.strings) {
    schema.strings.forEach((key) => {
      if (message[key] !== undefined) {
        var length = message[key].length;
        offset = Codec.encodeBytes(dv, offset, 1, length); // Store the length of each string in a separate byte
        Codec.encodeString(dv, offset, message[key]);
        offset += length;
        bitmask |= 1;
      }
      bitmask <<= 1;
    });
  }

  // Encode like a string, but one byte allocated for list value as it is an integer
  if (schema.numericLists) {
    schema.numericLists.forEach((key) => {
      if (message[key] !== undefined) {
        var length = message[key].length;
        offset = Codec.encodeBytes(dv, offset, 1, length);
        Codec.encodeNumericList(dv, offset, message[key]);
        offset += length;
        bitmask |= 1;
      }
      bitmask <<= 1;
    });
  }

  if (schema.booleans) {
    var booleans = 0; // Create a bitmask to store the values of each boolean, one per bit
    schema.booleans.forEach(function (key) {
      if (message[key] !== undefined) {
        bitmask |= 1; // Indicate in the mask that the boolean is present
        booleans |= +message[key]; // Indicate its actual value using a bitwise operation
      }
      bitmask <<= 1;
      booleans <<= 1;
    });
    booleans >>= 1;
    offset = Codec.encodeBytes(dv, offset, schema.booleanBytes, booleans);
  }
  bitmask >>= 1;
  dv["setUint" + schema.propertiesBytes * 8](bitmaskOffset, bitmask); // Write the bitmask byte
};

Codec.encodeBytes = (dv: DataView, offset: number, nbBytes: number, value: any) => {
  // Allocate nbBytes for value at offset in dataview "dv", then return the new offset
  dv["setUint" + nbBytes * 8](offset, value);
  offset += nbBytes;
  return offset;
};

Codec.encodeString = (dv: DataView, offset: number, str: string) => {
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    dv.setUint8(offset, str.charCodeAt(i));
    offset++;
  }
};

Codec.encodeNumericList = (dv: DataView, offset: number, list: number[]) => {
  for (var i = 0; i < list.length; i++) {
    dv.setUint8(offset, list[i]);
    offset++;
  }
};

/* ### DECODING ### */

Codec.decode = (buffer: ArrayBuffer) => {
  var schema = Codec.updateSchema;
  var dv = new DataView(buffer);
  var offset = 0;
  var message: ProtocolMessage = {};

  var nbProperties = Codec.countProperties(schema); // Determine how many properties are listed in the schema
  // schema.propertiesBytes indicates how many bytes are required to make a mask for all the possible properties of the schema
  var bitmask = dv["getUint" + schema.propertiesBytes * 8](offset); // read the bitmask, or series of bits indicating the presence or absence of each property of the schema in the message
  offset += schema.propertiesBytes;
  var idx = 1; // index of the next field that will be checked, use to shift the properties mask correctly in isMaskTrue()

  if (schema.numerical) {
    Object.keys(schema.numerical).forEach((key) => {
      if (Codec.isMaskTrue(bitmask, nbProperties, idx)) {
        // check the properties bitmask to see if the property is present in the message or not, and therefore has to be decoded or skipped
        var nbBytes = schema.numerical[key];
        message[key] = dv["getUint" + nbBytes * 8](offset); // calls e.g. dv.getUint8, dv.getUint16 ... depending on how many bytes are indicated as necessary for the given field in the schema
        offset += nbBytes;
      }
      idx++;
    });
  }

  if (schema.strings) {
    schema.strings.forEach((key) => {
      if (Codec.isMaskTrue(bitmask, nbProperties, idx)) {
        // Same process as for the numerical fields, but need to decode one additional byte to know the length of each string
        var length = dv.getUint8(offset);
        offset++;
        message[key] = Codec.decodeString(dv, length, offset);
        offset += length;
      }
      idx++;
    });
  }

  if (schema.numericLists) {
    schema.numericLists.forEach((key) => {
      if (Codec.isMaskTrue(bitmask, nbProperties, idx)) {
        // Same process as for the string fields, but only one byte is allocated per list value
        var length = dv.getUint8(offset);
        offset++;
        message[key] = Codec.decodeNumericList(dv, length, offset);
        offset += length;
      }
      idx++;
    });
  }

  if (schema.booleans) {
    var booleans = dv["getUint" + schema.booleanBytes * 8](offset); // just like propertiesMask, bools is a mask indicating the presence/absence of each boolean
    var boolidx = 1; // index of the next boolean to decode
    offset += schema.booleanBytes;
    schema.booleans.forEach((key) => {
      if (Codec.isMaskTrue(bitmask, nbProperties, idx))
        message[key] = !!Codec.isMaskTrue(booleans, schema.booleans.length, boolidx); // !! converts to boolean
      idx++;
      boolidx++;
    });
  }

  return message;
};

Codec.countProperties = (schema: ProtocolSchema) => {
  // Returns the total number of fields in the schema (regardless of being present in the object to decode or not)
  // This information is needed to properly read the properties mask, to know by how much to shift it (see isMaskTrue() )
  var nbProperties = 0;
  if (schema.numerical !== undefined) nbProperties += Object.keys(schema.numerical).length;

  if (schema.strings !== undefined) nbProperties += schema.strings.length;

  if (schema.numericLists !== undefined) nbProperties += schema.numericLists.length;

  if (schema.booleans !== undefined) nbProperties += schema.booleans.length;

  return nbProperties;
};

Codec.isMaskTrue = (mask: number, nbProperties: number, idx: number): boolean => {
  // Process a bitmask to know if a specific field, at index idx, is present or not
  return !!((mask >> (nbProperties - idx)) & 1); // Shift right to put the target at position 0, and AND it with 1
};

Codec.decodeString = (view: DataView, length: number, offset: number) => {
  // Read length bytes starting at a specific offset to decode a string
  var chars: string[] = [];
  for (var i = 0; i < length; i++) {
    chars.push(String.fromCharCode(view.getUint8(offset)));
    offset++;
  }
  return chars.join("");
};

Codec.decodeNumericList = (view: DataView, length: number, offset: number) => {
  // Read length bytes starting at a specific offset to decode a string
  var list: number[] = [];
  for (var i = 0; i < length; i++) {
    list.push(view.getUint8(offset));
    offset++;
  }
  return list;
};

export default Codec;
