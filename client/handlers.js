module exports from "client/exports";

module models from "client/models";
module geometry from "client/models/geometry";
module itemRegistry from "client/models/items/registry";
module realm from "client/models/realm";
module objects from "client/util/objects";
module packets from "client/protos/packets";

export function install(game) {
  var protocol = game.protocol;
  var renderer = game.renderer;

  protocol.on(packets.Packet.Type.REALM, (origin, message) => {
    game.setRealm(new realm.Realm(message.realm));
  });

  protocol.on(packets.Packet.Type.REGION, (origin, message) => {
    if (message.region.location.realmId !== game.realm.id) {
      console.warn("Got invalid region realm ID (" + message.region.realmId +
                   ") for current realm (" + game.realm.id + "), discarding.");
      return;
    }

    var region = new realm.Region(message.region);
    game.realm.addRegion(region);
  });

  protocol.on(packets.Packet.Type.ENTITY, (origin, message) => {
    if (message.entity.location.realmId !== game.realm.id) {
      console.warn("Got invalid entity realm ID (" +
                   message.entity.location.realmId + ") for current realm (" +
                   game.realm.id + "), discarding.");
      return;
    }

    if (objects.hasOwnProp.call(game.realm.entities, message.entity.id)) {
      return;
    }

    game.realm.addEntity(models.makeEntity(message.entity));
  });

  protocol.on(packets.Packet.Type.AVATAR, (origin, message) => {
    game.setAvatarById(origin);
  });

  protocol.on(packets.Packet.Type.MOVE, (origin, message) => {
    game.realm.getEntity(origin).moveInDirection(message.direction);
  });

  protocol.on(packets.Packet.Type.STOP_MOVE, (origin, message) => {
    game.realm.getEntity(origin).moving = false;
  });

  protocol.on(packets.Packet.Type.TELEPORT, (origin, message) => {
    var entity = game.realm.getEntity(origin);

    if (message.location.realmId !== game.realm.id) {
      console.warn("Got invalid teleport realm ID (" +
                   message.location.realmId + ") for current realm (" +
                   game.realm.id + "), discarding.");
      return;
    }

    entity.moving = false;
    entity.remainder = 0;
    entity.location = geometry.Vector2.fromProtobuf(message.location);
    entity.direction = message.direction;
  });

  protocol.on(packets.Packet.Type.DESPAWN_ENTITY, (origin, message) => {
    var entity = game.realm.getEntity(origin);

    if (entity.realm.id !== game.realm.id) {
      console.warn("Got invalid entity realm ID (" +
                   entity.location.realmId + ") for current realm (" +
                   game.realm.id + "), discarding.");
      return;
    }

    game.realm.removeEntity(entity);
  });

  protocol.on(packets.Packet.Type.INVENTORY, (origin, message) => {
    game.me.inventory.push(itemRegistry.makeItem(message.item));
  });

  protocol.on(packets.Packet.Type.REGION_CHANGE, (origin, message) => {
    if (message.location.realmId !== game.realm.id) {
      console.warn("Got invalid region realm ID (" +
                   message.entity.location.realmId + ") for current realm (" +
                   game.realm.id + "), discarding.");
      return;
    }

    if (!renderer.getRegionCacheBounds().contains(new geometry.Vector2(
        message.location.arx, message.location.ary))) {
      game.realm.removeEntity(game.realm.getEntity(origin));
    }
  });
}
