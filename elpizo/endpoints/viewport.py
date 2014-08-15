from sqlalchemy.orm import joinedload

from .. import game_pb2
from ..models.base import Entity
from ..models.realm import Region


def viewport(ctx, message):
  last_viewport = ctx.transient_storage.get("viewport")

  ctx.transient_storage["viewport"] = message

  if last_viewport is not None:
    last_regions = {region.key: region
        for region in ctx.sqla.query(Region)
            .filter(
                Region.intersects(
                    last_viewport.ar_left * Region.SIZE,
                    last_viewport.ar_top * Region.SIZE,
                    (last_viewport.ar_right - 1) * Region.SIZE,
                    (last_viewport.ar_bottom - 1) * Region.SIZE))}
  else:
    last_regions = {}

  regions = {region.key: region
      for region in ctx.sqla.query(Region)
          .filter(
              Region.intersects(
                  message.ar_left * Region.SIZE,
                  message.ar_top * Region.SIZE,
                  (message.ar_right - 1) * Region.SIZE,
                  (message.ar_bottom - 1) * Region.SIZE))
          .options(joinedload(Region.layers))}

  for added_region_key in set(regions.keys()) - set(last_regions.keys()):
    region = regions[added_region_key]

    ctx.send(None, game_pb2.RegionPacket(region=region.to_protobuf()))
    ctx.subscribe(region.routing_key)

  for removed_region_key in set(last_regions.keys()) - set(regions.keys()):
    region = last_regions[removed_region_key]
    ctx.unsubscribe(region.routing_key)

  # Always send the full list of entities, as it may have become inconsistent.
  #
  # Maybe this can be optimized for edge regions?
  for entity in ctx.sqla.query(Entity).filter(
      Entity.contained_by(message.ar_left * Region.SIZE,
                          (message.ar_top - 1) * Region.SIZE,
                          message.ar_right * Region.SIZE,
                          (message.ar_bottom - 1) * Region.SIZE),
      Entity.id != ctx.player.id):
    ctx.send(entity.id, game_pb2.EntityPacket(entity=entity.to_protobuf()))
