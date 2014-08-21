module retry from "retry";
module events from "events";

module packets from "client/protos/packets";
module objects from "client/util/objects";

export class Transport extends events.EventEmitter {
  constructor(host) {
    super();

    this.host = host;
    this.connect();
    this.opened = false;
  }

  connect() {
    this.socket = new WebSocket(this.host);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = (e) => {
      this.opened = true;
      this.emit("open", e);
    };

    this.socket.onclose = (e) => {
      this.opened = false;
      this.emit("close", e);
    };

    this.socket.onmessage = (e) => {
      this.currentRetryOperation = null;
      this.emit("message", packets.Packet.decode(e.data));
    };
  }

  send(packet) {
    this.socket.send(packet.encodeAB());
  }

  close() {
    this.socket.close();
  }
}

var PACKETS = {};
Object.keys(packets).forEach((name) => {
  var cls = packets[name];
  if (!objects.hasOwnProp.call(cls.$options, "(packet_type)")) {
    return;
  }

  var packetType = packets.Packet.Type[cls.$options["(packet_type)"]];
  PACKETS[packetType] = cls;
});

export class Protocol extends EventEmitter {
  constructor(transport) {
    super();

    this.transport = transport;

    this.lastError = null;
    this.currentRetryOperation = null;

    this.transport.on("message", (packet) => {
      var message = PACKETS[packet.type].decode(packet.payload);
      if (packet.type === packets.Packet.Type.ERROR) {
        this.lastError = message.text;
        this.transport.close();
      }
      this.emit(packet.type, packet.origin, message);
    });

    this.transport.on("close", (e) => {
      if (this.lastError !== null) {
        return;
      }

      if (this.currentRetryOperation === null) {
        this.currentRetryOperation = retry.operation();
        this.currentRetryOperation.attempt(() => {
          this.transport.connect();
        });
      } else {
        this.currentRetryOperation.retry(e);
      }
    });
  }

  send(message) {
    this.transport.send(new packets.Packet({
        type: message.$type.options["(packet_type)"],
        payload: message.encode()
    }));
  }
}

