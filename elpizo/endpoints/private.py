from .. import game_pb2
from ..models import Region


def on_open(ctx):
  # Bind to the relevant channels.
  ctx.subscribe(ctx.player.actor.routing_key)
  ctx.subscribe(ctx.player.actor.realm.routing_key)

  # Send realm information.
  ctx.send(game_pb2.Packet.REALM, None,
           game_pb2.RealmPacket(realm=ctx.player.actor.realm.to_protobuf()))


def viewport(ctx, message):
  last_viewport = ctx.transient_storage.get(
      "viewport",
      game_pb2.ViewportPacket(aLeft=0, aTop=0, aRight=0, aBottom=0))

  ctx.transient_storage["viewport"] = message

  last_regions = {region.key: region
      for region in ctx.application.sqla.query(Region).filter(
      Region.bounded_by(last_viewport.aLeft, last_viewport.aTop,
                        last_viewport.aRight, last_viewport.aBottom))}

  regions = {region.key: region
      for region in ctx.application.sqla.query(Region).filter(
      Region.bounded_by(message.aLeft, message.aTop,
                        message.aRight, message.aBottom))}


  for added_region_key in set(regions.keys()) - set(last_regions.keys()):
    region = regions[added_region_key]

    ctx.send(game_pb2.Packet.REGION, None,
             game_pb2.RegionPacket(region=region.to_protobuf()))
    ctx.subscribe(region.routing_key)

    for entity in region.entities:
      ctx.send(game_pb2.Packet.ENTITY, None,
               game_pb2.EntityPacket(entity=entity.to_protobuf()))

  for removed_region_key in set(last_regions.keys()) - set(regions.keys()):
    region = regions[removed_region_key]
    ctx.unsubscribe(region.routing_key)

  ctx.send(game_pb2.Packet.AVATAR, ctx.player.actor.to_origin_protobuf(),
           game_pb2.AvatarPacket())
