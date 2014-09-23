import logging
import math

from elpizo.models import geometry
from elpizo.models import record
from elpizo.protos import realm_pb2


logger = logging.getLogger(__name__)


class Realm(record.ProtobufRecord):
  PROTOBUF_TYPE = realm_pb2.Realm
  FIELDS = [
      record.Field("name", record.Scalar),
      record.Field("bbox", geometry.Rectangle),
  ]

  def __init__(self, *args, **kwargs):
    self.regions = None
    super().__init__(*args, **kwargs)

  def load_intersecting_regions(self, bounds):
    left = Region.floor(max([bounds.left, self.bbox.left]))
    top = Region.floor(max([bounds.top, self.bbox.top]))
    right = Region.ceil(min([bounds.right, self.bbox.right]))
    bottom = Region.ceil(min([bounds.bottom, self.bbox.bottom]))

    for y in range(top, bottom, Region.SIZE):
      for x in range(left, right, Region.SIZE):
          yield self.regions.load(geometry.Vector2(x, y))

  def is_terrain_passable_by(self, entity):
    if not self.bbox.contains(entity.target_bounds):
      return False

    try:
      regions = list(self.load_intersecting_regions(entity.target_bounds))
    except KeyError:
      return False

    return all(region.is_terrain_passable_by(entity) for region in regions)

  def is_passable_by(self, entity):
    if not self.bbox.contains(entity.target_bounds):
      return False

    try:
      regions = set(self.load_intersecting_regions(entity.target_bounds)) | \
                set(self.load_intersecting_regions(entity.bounds))
    except KeyError:
      return False

    return all(region.is_passable_by(entity) for region in regions)


class Layer(record.ProtobufRecord):
  PROTOBUF_TYPE = realm_pb2.Layer
  FIELDS = [
      record.Field("terrain", record.Scalar),
      record.RepeatedField("tiles", record.Scalar),
  ]


class Region(record.ProtobufRecord):
  PROTOBUF_TYPE = realm_pb2.Region
  FIELDS = [
      record.RepeatedField("layers", Layer),
      record.RepeatedField("passabilities", record.Scalar),
      record.RepeatedField("entity_ids_idx", record.Scalar),
  ]

  SIZE = 16

  @classmethod
  def floor(cls, x):
    return (x // cls.SIZE) * cls.SIZE

  @classmethod
  def ceil(cls, x):
    return math.ceil(x / cls.SIZE) * cls.SIZE

  @property
  def id(self):
    return "{x},{y}".format(x=self.location.x, y=self.location.y)

  @property
  def bounds(self):
    return geometry.Rectangle(self.location.x, self.location.y,
                              self.SIZE, self.SIZE)

  @property
  def client_entities(self):
    return (entity for entity in self.entities if entity.client_visible)

  @id.setter
  def id(self, v):
    if v is None:
      return

    x, y = v.split(",")
    self.location = geometry.Vector2(int(x), int(y))

  def to_public_protobuf(self, realm):
    proto = self.to_protobuf()
    proto.ClearField("entity_ids_idx")
    return proto

  def is_terrain_passable_by(self, entity):
    bounds = entity.target_bounds.offset(self.location.negate())

    for y in range(bounds.top, bounds.bottom):
      for x in range(bounds.left, bounds.right):
        if 0 <= x < Region.SIZE and 0 <= y < Region.SIZE and \
          not ((self.passabilities[y * Region.SIZE + x] >>
              entity.direction) & 0x1):
          return False

    return True

  def is_passable_by(self, entity):
    if not self.is_terrain_passable_by(entity):
      return False

    return not any((target.bounds.intersect(entity.target_bounds) is not None or
                    target.bounds.intersect(entity.bounds) is not None) and
                   not target.is_passable_by(entity)
                   for target in self.entities)

  @property
  def channel(self):
    return ("region", self.realm.id, self.location)


class RealmStore(record.ProtobufStore):
  RECORD_TYPE = Realm
  PROTOBUF_TYPE = realm_pb2.Realm

  def __init__(self, parent, kvs):
    self.parent = parent
    super().__init__(kvs)

  def add(self, realm):
    super().add(realm)
    realm.update(regions=self.parent.make_region_store(realm))

  def expire(self, realm):
    super().expire(realm)
    realm.regions.expire_all()

  def save(self, realm):
    super().save(realm)
    if realm.regions is not None:
      logger.info("Saving all child regions for realm: %s", realm.id)
      realm.regions.save_all()


class RegionStore(record.ProtobufStore):
  RECORD_TYPE = Region
  PROTOBUF_TYPE = realm_pb2.Region

  def __init__(self, realm, entities, kvs):
    self.realm = realm
    self.entities = entities
    super().__init__(kvs)

  def load(self, vec):
    return super().load("{x},{y}".format(x=vec.x, y=vec.y))

  def load_closest(self, location):
    return self.load(location.map(Region.floor))

  def find(self, id):
    region = super().find(id)
    region.update(realm=self.realm,
                  entities={self.entities.load(entity_id)
                            for entity_id in region.entity_ids_idx})
    return region

  def save(self, region):
    region.update(entity_ids_idx=[entity.id for entity in region.entities])
    super().save(region)

  def keys(self):
    # We don't want to use the store's integer coercion.
    for key in self.kvs.keys():
      x, y = key.split(",")
      yield geometry.Vector2(int(x), int(y))
