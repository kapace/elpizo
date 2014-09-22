import time

from elpizo.models import entities
from elpizo.models import geometry
from elpizo.protos import packets_pb2
from elpizo.util import green


def on_move(protocol, actor, message):
  ephemera = protocol.get_ephemera(actor)
  now = time.monotonic()
  dt = now - ephemera.last_move_time

  old_location = actor.location

  expected_location = geometry.Vector3.from_protobuf(message.location)

  if actor.target_location != expected_location or \
      dt < 1 / actor.speed * actor.direction_vector.magnitude() * 0.25: # compensate for slow connections by 0.25
    actor.send(protocol, packets_pb2.TeleportPacket(
        location=actor.location.to_protobuf(),
        direction=actor.direction,
        realm_id=actor.realm_id))
    return

  old_regions = list(actor.regions)

  # BEGIN CRITICAL SECTION: We need to update the location of the actor, and
  # ensure no conflicting writes occur due to greenlet switching during IO.
  #
  # Passability checking MUST be done within the critical section, as we only
  # know where we're moving to within the critical section.
  with green.locking(actor.location_lock):
    # Check for realm passability.
    passable = actor.realm.is_passable_by(actor)

    if passable:
      with actor.movement():
        actor.location = actor.target_location
  # END CRITICAL SECTION

  if not passable:
    actor.send(protocol, packets_pb2.TeleportPacket(
        location=actor.location.to_protobuf(),
        direction=actor.direction,
        realm_id=actor.realm_id))
    return

  # We don't need strict sequentiality of the location log, so we keep this out
  # of the critical section.
  ephemera.last_move_time = now
  actor.log_location(now, old_location)
  actor.retain_log_after(now - 1)

  new_region_locations = set(region.location for region in actor.regions)
  old_region_locations = set(region.location for region in old_regions)

  added_region_locations = new_region_locations - old_region_locations
  removed_region_locations = old_region_locations - new_region_locations

  # Broadcast ENTER to the regions the entity is entering.
  actor_protobuf = actor.to_public_protobuf()

  for region_location in removed_region_locations:
    for new_region_location in new_region_locations:
      actor.broadcast(
          protocol.server.bus,
          ("region", actor.realm.id, new_region_location),
          packets_pb2.EnterPacket(
              location=region_location.to_protobuf(),
              entity=actor_protobuf))

  # Broadcast EXIT to the regions the entity is exiting.
  for region_location in added_region_locations:
    for old_region_location in old_region_locations:
      actor.broadcast(
          protocol.server.bus,
          ("region", actor.realm.id, old_region_location),
          packets_pb2.ExitPacket(
              location=region_location.to_protobuf()))

  # For every region that we moved from, we broadcast that we moved.
  for region in old_regions:
    actor.broadcast(
        protocol.server.bus,
        region.channel,
        packets_pb2.MovePacket(location=actor.location.to_protobuf()))

  # We also run intersect events.
  for region in actor.regions:
    for entity in list(region.entities):
      if actor.bounds.intersect(entity.bounds) is not None and \
          actor is not entity:
        entity.on_contact(protocol, actor)


def on_stop_move(protocol, actor, message):
  actor.broadcast_to_regions(protocol.server.bus, message)


def on_turn(protocol, actor, message):
  actor.direction = message.direction
  actor.broadcast_to_regions(protocol.server.bus, message)
