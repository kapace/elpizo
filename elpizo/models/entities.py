import asyncio
import collections
import contextlib
import logging
import websockets

from elpizo.models import geometry
from elpizo.models import realm
from elpizo.models import record
from elpizo.models import items
from elpizo.protos import entities_pb2
from elpizo.protos import packets_pb2
from elpizo.util import green
from elpizo.util import support


logger = logging.getLogger(__name__)


class Ephemera(object):
  def __init__(self):
    self.last_move_time = 0


class Entity(record.ProtobufRecord):
  REGISTRY = {}

  FIELDS = [
      record.Field("type", record.Scalar, record_field="TYPE"),
      record.Field("realm_id", record.Scalar),
      record.Field("location", geometry.Vector3),
      record.Field("bbox", geometry.Rectangle),
      record.Field("direction", record.Scalar)
  ]

  PROTOBUF_TYPE = entities_pb2.Entity

  DIRECTION_VECTORS = {
      0: geometry.Vector3( 0, -1,  0),  # N
      1: geometry.Vector3(-1, -1,  0),  # NW
      2: geometry.Vector3(-1,  0,  0),  # W
      3: geometry.Vector3(-1,  1,  0),  # SW
      4: geometry.Vector3( 0,  1,  0),  # S
      5: geometry.Vector3( 1,  1,  0),  # SE
      6: geometry.Vector3( 1,  0,  0),  # E
      7: geometry.Vector3( 1, -1,  0)   # NE
  }

  DIRECTIONS = {v: k for k, v in DIRECTION_VECTORS.items()}

  def __init__(self, *args, **kwargs):
    super().__init__(*args, **kwargs)
    self.location_log = collections.deque()
    self.location_lock = asyncio.Lock()

  def log_location(self, time, location):
    self.location_log.append((time, location))

  def retain_log_after(self, since):
    while self.location_log:
      time, head  = self.location_log[0]
      if time < since:
        self.location_log.popleft()
      else:
        break

  @property
  def all_locations(self):
    for _, location in self.location_log:
      yield location
    yield self.location

  @property
  def direction_vector(self):
    return self.DIRECTION_VECTORS[self.direction]

  @classmethod
  def register(cls, subclass):
    cls.REGISTRY[subclass.TYPE] = subclass
    return subclass

  def to_public_protobuf(self):
    return self.to_protobuf()

  def to_protected_protobuf(self):
    protobuf = self.to_protobuf()
    protobuf.type = "avatar"
    return protobuf

  @classmethod
  def from_protobuf_polymorphic(cls, proto):
    return cls.REGISTRY[proto.type].from_protobuf(proto)

  @property
  def target_location(self):
    return self.location.offset(self.direction_vector)

  @property
  def target_bounds(self):
    return self.bounds.offset(self.direction_vector)

  @property
  def bounds(self):
    return self.bbox.offset(self.location)

  @property
  def regions(self):
    return self.realm.load_intersecting_regions(self.bounds)

  @property
  def client_visible(self):
    return True

  @contextlib.contextmanager
  def movement(self):
    initial_regions = list(self.regions)

    yield

    for region in initial_regions:
      region.entities.remove(self)

    for region in self.regions:
      region.entities.add(self)

  def is_passable_by(self, entity):
    return False

  def send(self, protocol, message):
    protocol.send(self.id, message)

  def send_via_bus(self, bus, target, message):
    return asyncio.gather(*[
        green.coroutine(self.send)(protocol, message)
        for protocol in bus.get_protocols_for_channel(target.channel)])

  def broadcast(self, bus, channel, message):
    return asyncio.gather(*[
        green.coroutine(self.send)(protocol, message)
        for protocol in bus.get_protocols_for_channel(channel)
        if protocol.policy.can_receive_broadcasts_from(self)])

  def broadcast_to_regions(self, bus, message):
    return asyncio.gather(*[
        self.broadcast(bus, region.channel, message)
        for region in self.regions])

  @property
  def bus_key(self):
    return (self.TYPE, self.id)

  @property
  def channel(self):
    return (self.TYPE, self.id)

  def subscribe(self, bus, channel):
    bus.subscribe(self.bus_key, channel)

  def unsubscribe(self, bus, channel):
    bus.unsubscribe(self.bus_key, channel)

  def add_to_bus(self, bus, protocol):
    bus.add(self.bus_key, protocol)

  def remove_from_bus(self, bus):
    bus.remove(self.bus_key)

  @property
  def realm(self):
    return self.store.parent.realms.load(self.realm_id)

  def on_contact(self, protocol, actor):
    pass


class Actor(Entity):
  FIELDS = [
      record.Field("name", record.Scalar, extension=entities_pb2.Actor.ext),
      record.Field("health", record.Scalar, extension=entities_pb2.Actor.ext),
      record.Field("gender", record.Scalar, extension=entities_pb2.Actor.ext),
      record.Field("body", record.Scalar, extension=entities_pb2.Actor.ext),
      record.RepeatedField("inventory", record.Polymorphic(items.Item),
                           extension=entities_pb2.Actor.ext),
      record.Field("facial", record.Scalar, extension=entities_pb2.Actor.ext),
      record.Field("hair", record.Scalar, extension=entities_pb2.Actor.ext),
      record.Field("head_item", record.Polymorphic(items.Item),
                   extension=entities_pb2.Actor.ext),
      record.Field("torso_item", record.Polymorphic(items.Item),
                   extension=entities_pb2.Actor.ext),
      record.Field("legs_item", record.Polymorphic(items.Item),
                   extension=entities_pb2.Actor.ext),
      record.Field("feet_item", record.Polymorphic(items.Item),
                   extension=entities_pb2.Actor.ext),
      record.Field("weapon", record.Polymorphic(items.Item),
                   extension=entities_pb2.Actor.ext)
  ]

  BASE_SPEED = 4

  @property
  def speed(self):
    return self.BASE_SPEED

  def to_public_protobuf(self):
    proto = super().to_public_protobuf()
    proto.Extensions[entities_pb2.Actor.ext].ClearField("inventory")
    return proto

  @property
  def equipment(self):
    return {item for item in
            [self.head_item, self.torso_item, self.legs_item, self.feet_item,
             self.weapon] if item is not None}

  @property
  def inventory(self):
    return self.inventory_dict.values()

  @inventory.setter
  def inventory(self, items):
    self.inventory_dict = {item.id: item for item in items}

  @property
  def full_inventory(self):
    return set(self.inventory) | self.equipment

  def get_realm(self, realm_store):
    return realm_store.find(self.realm_id)

  def is_passable_by(self, entity):
    return False


@Entity.register
class Player(Actor):
  FIELDS = [
      record.Field("online", record.Scalar, extension=entities_pb2.Player.ext)
  ]

  TYPE = "player"

  def __init__(self, *args, **kwargs):
    self.bbox = geometry.Rectangle(0, 0, 1, 1)
    super().__init__(*args, **kwargs)

  def is_passable_by(self, entity):
    return entity is self


@Entity.register
class Avatar(Player):
  # dummy class to allow the NPC server to deserialize avatars correctly.
  TYPE = "avatar"


@Entity.register
class NPC(Actor):
  FIELDS = [
      record.Field("behavior", record.Scalar, extension=entities_pb2.NPC.ext)
  ]

  TYPE = "npc"

  def __init__(self, *args, **kwargs):
    self.bbox = geometry.Rectangle(0, 0, 1, 1)
    super().__init__(*args, **kwargs)

  def to_public_protobuf(self):
    proto = super().to_public_protobuf()
    proto.Extensions[entities_pb2.NPC.ext].ClearField("behavior")
    return proto


@Entity.register
class Building(Entity):
  FIELDS = [
      record.Field("door_location", record.Scalar,
                   extension=entities_pb2.Building.ext),
  ]

  TYPE = "building"

  def __init__(self, *args, **kwargs):
    self.bbox = geometry.Rectangle(0, 0, 3, 3)
    self.direction = 0
    super().__init__(*args, **kwargs)

  def is_passable_by(self, entity):
    door_bounds = geometry.Rectangle(0, 0, 1, 1) \
        .offset(Entity.DIRECTION_VECTORS[self.door_location]) \
        .offset(self.location.offset(geometry.Vector3(1, 1, 0)))

    # If the entity is inside the building, we always allow passability to
    # another point of the building.
    if entity.bounds.intersect(self.bounds) is not None:
      if entity.bounds.intersect(door_bounds) is not None and \
          entity.target_bounds.intersect(door_bounds.offset(
              Entity.DIRECTION_VECTORS[self.door_location])) is not None:
        return True

      return entity.target_bounds.intersect(self.bounds) is not None

    return door_bounds.intersect(entity.target_bounds) is not None


@Entity.register
class Drop(Entity):
  FIELDS = [
      record.Field("item", record.Polymorphic(items.Item),
                   extension=entities_pb2.Drop.ext)
  ]

  TYPE = "drop"

  def __init__(self, *args, **kwargs):
    self.bbox = geometry.Rectangle(0, 0, 1, 1)
    self.direction = 0
    super().__init__(*args, **kwargs)

  def is_passable_by(self, entity):
    return True


@Entity.register
class Teleporter(Entity):
  FIELDS = [
      record.Field("teleport_realm_id", record.Scalar,
                   extension=entities_pb2.Teleporter.ext),
      record.Field("teleport_location", geometry.Vector3,
                   extension=entities_pb2.Teleporter.ext)
  ]

  TYPE = "teleporter"

  def __init__(self, *args, **kwargs):
    self.bbox = geometry.Rectangle(0, 0, 1, 1)
    self.direction = 0
    super().__init__(*args, **kwargs)

  @property
  def client_visible(self):
    return False

  def is_passable_by(self, entity):
    return True

  def on_contact(self, protocol, actor):
    with actor.movement():
      # TODO: remove player from all active region channels
      actor.realm_id = self.teleport_realm_id
      actor.location = self.teleport_location

    actor.send(protocol,
               packets_pb2.TeleportPacket(realm_id=actor.realm_id,
                                          direction=actor.direction,
                                          location=actor.location.to_protobuf()))
    protocol.send(
        None,
        packets_pb2.RealmPacket(id=actor.realm.id,
                                realm=actor.realm.to_protobuf()))


@Entity.register
class Tree(Entity):
  FIELDS = [
      record.Field("species", record.Scalar, extension=entities_pb2.Tree.ext),
      record.Field("growth_stage", record.Scalar,
                   extension=entities_pb2.Tree.ext)
  ]

  TYPE = "tree"

  def __init__(self, *args, **kwargs):
    self.bbox = geometry.Rectangle(0, 0, 1, 1)
    self.direction = 0
    super().__init__(*args, **kwargs)

  def is_passable_by(self, entity):
    return False


class EntityStore(record.PolymorphicProtobufStore):
  RECORD_TYPE = Entity
  PROTOBUF_TYPE = entities_pb2.Entity

  def __init__(self, parent, kvs):
    self.parent = parent
    super().__init__(kvs)

  def add(self, entity):
    super().add(entity)
    entity.store = self

  def create(self, entity):
    super().create(entity)
    for region in entity.regions:
      region.entities.add(entity)
      entity.realm.regions.save(region)

  def destroy(self, entity):
    super().destroy(entity)
    for region in entity.regions:
      region.entities.remove(entity)
