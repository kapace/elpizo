module items from "client/models/items";
module feetItems from "client/models/items/equipment/feetItems";
module legsItems from "client/models/items/equipment/legsItems";
module torsoItems from "client/models/items/equipment/torsoItems";
module weapons from "client/models/items/equipment/weapons";
module restorative from "client/models/items/restorative";
module objects from "client/util/objects";

items.Item.register(torsoItems.WhiteLongsleeveShirt);
items.Item.register(legsItems.TealPants);
items.Item.register(feetItems.BrownShoes);
items.Item.register(weapons.Dagger);
items.Item.register(restorative.Carrot);

export function makeItem(message) {
  if (!objects.has(items.Item.REGISTRY, message.type)) {
    return new items.Item(message);
  }

  return new items.Item.REGISTRY[message.type](message);
}
