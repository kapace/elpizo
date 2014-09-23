import logging

from elpizo.models import entities
from elpizo.models import geometry
from elpizo.protos import packets_pb2
from elpizo.util import green
from elpizo.util import net


logger = logging.getLogger(__name__)


class UnauthenticatedPolicy(object):
  def on_hello(self, protocol):
    pass

  def get_actor(self, origin):
    return None

  def on_despawn(self, origin):
    pass

  def get_ephemera(self, origin):
    raise NotImplementedError

  def can_receive_broadcasts_from(self, origin):
    return False

  def on_finish(self):
    pass


class PlayerPolicy(object):
  def __init__(self, id, server):
    self.server = server
    self.player = server.store.entities.load(int(id))
    self.ephemera = entities.Ephemera()

  def on_hello(self, protocol):
    if self.server.bus.has(self.player.bus_key):
      # We remove the protocol from the player associated with the bus, since
      # we're switching the player to a different protocol.
      last_protocol = self.server.bus.get(self.player.bus_key)
      last_protocol.send(None, packets_pb2.ErrorPacket(
          text="Session collision. You may have logged in from another " +
               "location."))
      last_protocol.bind_policy(UnauthenticatedPolicy())
      last_protocol.transport.close()
      self.server.bus.remove(self.player.bus_key)

    self.player.add_to_bus(self.server.bus, protocol)

    protocol.send(
        None,
        packets_pb2.RealmPacket(id=self.player.realm.id,
                                realm=self.player.realm.to_protobuf()))
    self.player.send(
        protocol,
        packets_pb2.EntityPacket(entity=self.player.to_protected_protobuf()))

    self.player.subscribe(self.server.bus, self.player.channel)

    # Only self.players get chat access.
    self.player.subscribe(self.server.bus, ("conversation", self.player.name))
    self.player.subscribe(self.server.bus, ("chatroom", "global"))

  def get_actor(self, origin):
    return self.player

  def on_despawn(self, origin):
    if origin == self.player.id:
      # TODO: we should do something about this...
      raise NotImplementedError

  def get_ephemera(self, origin):
    return self.ephemera

  def can_receive_broadcasts_from(self, entity):
    # Don't receive our own broadcasts.
    return entity is not self.player

  def on_finish(self):
    self.server.store.entities.save(self.player)
    logger.info("Flushing player %s to database.", self.player.id)
    self.player.remove_from_bus(self.server.bus)


class NPCPolicy(object):
  def __init__(self, id, server):
    self.server = server
    self.id = id
    self.npcs = {}
    self.npc_ephemeras = {}

  @property
  def bus_key(self):
    return ("npc", self.id)

  def on_hello(self, protocol):
    self.server.bus.add(self.bus_key, protocol)
    logger.info("Hello, NPC server %s!", self.id)

    for realm in self.server.store.realms.load_all():
      protocol.send(
          None,
          packets_pb2.RealmPacket(id=realm.id,
                                  realm=realm.to_protobuf()))

      for region in realm.regions.load_all():
        self.server.bus.subscribe(self.bus_key, region.channel)

        protocol.send(None, packets_pb2.RegionPacket(
            location=region.location.to_protobuf(),
            realm_id=realm.id,
            region=region.to_public_protobuf(realm)))

        for entity in region.client_entities:
          if isinstance(entity, entities.NPC):
            self.npcs[entity.id] = entity
            self.npc_ephemeras[entity.id] = entities.Ephemera()

            entity_protobuf = entity.to_protected_protobuf()
          else:
            entity_protobuf = entity.to_public_protobuf()

          entity.send(protocol, packets_pb2.EntityPacket(
              entity=entity_protobuf))

  def on_despawn(self, origin):
    if origin in self.npcs:
      del self.npcs[origin]
      del self.npc_ephemeras[origin]

  def get_actor(self, origin):
    if origin is None:
      return None

    try:
      return self.npcs[origin]
    except KeyError:
      raise net.Reject("Actor {} no longer exists.".format(origin))

  def get_ephemera(self, origin):
    return self.npc_ephemeras[origin]

  def can_receive_broadcasts_from(self, entity):
    # Don't receive broadcasts we sent.
    return entity not in self.npcs

  def on_finish(self):
    logger.warn("NPC server %s died!", self.id)

    self.server.bus.remove(self.bus_key)
    for npc in self.npcs.values():
      self.server.store.entities.save(npc)
      logger.info("Flushing NPC %s to database.", npc.id)


REGISTRY = {
    "player": PlayerPolicy,
    "npc": NPCPolicy
}
