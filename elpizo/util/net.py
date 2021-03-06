import logging
import sys

from elpizo.protos import packets_pb2
from elpizo.util import green

logger = logging.getLogger(__name__)


class Transport(object):
  def __init__(self, websocket):
    self.websocket = websocket

  def recv(self):
    return green.await_coro(self.websocket.recv())

  def send(self, packet):
    green.await_coro(self.websocket.send(packet))

  def close(self):
    green.await_coro(self.websocket.close())

  @property
  def is_open(self):
    return self.websocket.open


class Protocol(object):
  PACKETS = {}

  def __init__(self, transport):
    self.transport = transport

  @classmethod
  def serialize_packet(cls, origin, message):
    packet = packets_pb2.Packet(
        type=message.DESCRIPTOR.GetOptions().Extensions[
            packets_pb2.packet_type],
        payload=message.SerializeToString())

    if origin is not None:
      packet.origin = origin

    return packet.SerializeToString()

  @classmethod
  def deserialize_packet(cls, raw):
    packet = packets_pb2.Packet.FromString(raw)
    return packet.origin if packet.HasField("origin") else None, \
           cls.PACKETS[packet.type].FromString(packet.payload)

  def on_open(self):
    pass

  def on_close(self):
    pass

  def on_message(self, origin, message):
    pass

  def on_error(self, e, exc_info):
    raise e

  def run(self):
    self.on_open()

    try:
      while True:
        packet = self.transport.recv()

        if packet is None:
          break
        origin, message = self.deserialize_packet(packet)
        try:
          self.on_message(origin, message)
        except Reject as e:
          logger.warn("Rejected a packet: %s", e)
    except Exception as e:
      self.on_error(e, sys.exc_info())
    finally:
      if self.transport.is_open:
        self.transport.close()
      self.on_close()

  def send(self, origin, message):
    self.transport.send(self.serialize_packet(origin, message))


for name, descriptor in packets_pb2.DESCRIPTOR.message_types_by_name.items():
  options = descriptor.GetOptions()

  if options.HasExtension(packets_pb2.packet_type):
    Protocol.PACKETS[options.Extensions[packets_pb2.packet_type]] = \
        getattr(packets_pb2, name)


Protocol.PACKET_NAMES = {ev.number: ev.name
  for ev in packets_pb2.Packet.DESCRIPTOR
     .enum_types_by_name["Type"]
     .values}


class ProtocolError(Exception):
  """Protocol errors are failure modes for protocols. They are caused by
     critical client-server state inconsistencies."""


class Reject(Exception):
  """Rejections are non-fatal protocol errors. They are generally caused by
     non-critical client-server state inconsistencies."""
