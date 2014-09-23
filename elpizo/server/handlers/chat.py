from elpizo.protos import packets_pb2
from elpizo.util import net


def on_chat(protocol, actor, message):
  ns, name = message.target.split(".")

  if ns not in ["chatroom", "conversation"]:
    raise net.ProtocolError("unknown chat namespace: {}".format(ns))

  actor.broadcast(
      protocol.server.bus,
      (ns, name),
      packets_pb2.ChatPacket(target=message.target,
                             actor_name=actor.name,
                             text=message.text[:100]))
