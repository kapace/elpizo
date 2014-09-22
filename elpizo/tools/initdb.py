import asyncio
import logging
import random

from elpizo import server
from elpizo.models import entities
from elpizo.models import geometry
from elpizo.models import realm
from elpizo.models.items import restorative
from elpizo.models.items.equipment import feet_items
from elpizo.models.items.equipment import legs_items
from elpizo.models.items.equipment import torso_items
from elpizo.models.items.equipment import weapons
from elpizo.util import green


def initdb(app):
  app.store.lock()
  try:
    input("This will DELETE ALL DATA from the database! Press ENTER to "
          "continue, or Ctrl+C to abort. ")
  except KeyboardInterrupt:
    app.store.unlock()
    return

  green.await_coro(app.store.redis.flushdb())

  app.store.lock()

  windvale = realm.Realm(name="Windvale", bbox=geometry.Rectangle(0, 0,
                                                                  128, 128))
  app.store.realms.create(windvale)

  for base_y in range(realm.Region.floor(windvale.bbox.left),
                      realm.Region.ceil(windvale.bbox.right),
                      realm.Region.SIZE):
    for base_x in range(realm.Region.floor(windvale.bbox.top),
                        realm.Region.ceil(windvale.bbox.bottom),
                        realm.Region.SIZE):
      tiles = []

      for offset_y in range(realm.Region.SIZE):
        for offset_x in range(realm.Region.SIZE):
          x = base_x + offset_x
          y = base_y + offset_y

          if x == 0 and y == 0:
            tile = 34
          elif x == 0 and y == windvale.bbox.right - 1:
            tile = 40
          elif x == windvale.bbox.left - 1 and y == 0:
            tile = 36
          elif x == windvale.bbox.left - 1 and y == windvale.bbox.right - 1:
            tile = 38
          elif x == 0:
            tile = 16
          elif x == windvale.bbox.left - 1:
            tile = 24
          elif y == 0:
            tile = 20
          elif y == windvale.bbox.right - 1:
            tile = 28
          else:
            tile = 0

          tiles.append(tile)

      platform_tiles = [-1] * (realm.Region.SIZE * realm.Region.SIZE)
      platform_tiles[4 + 4 * realm.Region.SIZE] = 34
      platform_tiles[5 + 4 * realm.Region.SIZE] = 20
      platform_tiles[6 + 4 * realm.Region.SIZE] = 36
      platform_tiles[4 + 5 * realm.Region.SIZE] = 16
      platform_tiles[5 + 5 * realm.Region.SIZE] = 0
      platform_tiles[6 + 5 * realm.Region.SIZE] = 24
      platform_tiles[4 + 6 * realm.Region.SIZE] = 40
      platform_tiles[5 + 6 * realm.Region.SIZE] = 28
      platform_tiles[6 + 6 * realm.Region.SIZE] = 38

      wall_tiles = [-1] * (realm.Region.SIZE * realm.Region.SIZE)
      wall_tiles[4 + 7 * realm.Region.SIZE] = 46
      wall_tiles[6 + 7 * realm.Region.SIZE] = 46

      passabilities = [0b11111111] * (realm.Region.SIZE * realm.Region.SIZE)

      region = realm.Region(
          realm_id=windvale.id, location=geometry.Vector2(base_x, base_y),
          passabilities=passabilities,
          layers=[realm.Layer(terrain="grassland", tiles=tiles),
                  realm.Layer(terrain="dirt", tiles=platform_tiles),
                  realm.Layer(terrain="grassland", tiles=platform_tiles),
                  realm.Layer(terrain="dirt_wall", tiles=wall_tiles)],
          entities=set())
      # We don't use create() here because we've already assigned an id.
      windvale.regions.save(region)

  logging.info("Created Windvale.")

  app.store.entities.create(entities.Player(
      name="Valjean",
      gender="male",
      body="light",
      hair="brown_messy_1",
      facial="brown_beard",
      direction=0,
      health=75,
      realm_id=windvale.id,
      location=geometry.Vector3(0, 0, 0),
      inventory=set(),
      torso_item=app.store.create_item(torso_items.WhiteLongsleeveShirt()),
      legs_item=app.store.create_item(legs_items.TealPants()),
      feet_item=app.store.create_item(feet_items.BrownShoes()),
      weapon=app.store.create_item(weapons.Dagger())))

  app.store.entities.create(entities.Player(
      name="Marius",
      gender="male",
      body="light",
      hair="brown_messy_1",
      direction=0,
      health=100,
      realm_id=windvale.id,
      location=geometry.Vector3(0, 16, 0),
      inventory=set(),
      legs_item=app.store.create_item(legs_items.TealPants())))

  app.store.entities.create(entities.Player(
      name="Courfeyrac",
      gender="male",
      body="light",
      hair="brown_messy_1",
      direction=0,
      health=100,
      realm_id=windvale.id,
      location=geometry.Vector3(16, 16, 0),
      inventory=set(),
      legs_item=app.store.create_item(legs_items.TealPants())))

  app.store.entities.create(entities.Player(
      name="Enjolras",
      gender="male",
      body="light",
      hair="brown_messy_1",
      direction=0,
      health=100,
      realm_id=windvale.id,
      location=geometry.Vector3(12, 16, 0),
      inventory=set(),
      legs_item=app.store.create_item(legs_items.TealPants())))

  app.store.entities.create(entities.Building(
      location=geometry.Vector3(1, 10, 0),
      door_location=2,
      realm_id=windvale.id))

  app.store.entities.create(entities.Building(
      location=geometry.Vector3(1, 13, 0),
      door_location=4,
      realm_id=windvale.id))

  app.store.entities.create(entities.Tree(
      location=geometry.Vector3(4, 16, 0),
      species="oak",
      growth_stage=2,
      realm_id=windvale.id))

  for _ in range(25):
    app.store.entities.create(entities.NPC(
        name="Some Bad Dude",
        gender="male",
        body="smurf",
        direction=random.choice(list(entities.Entity.DIRECTION_VECTORS)),
        health=5,
        realm_id=windvale.id,
        location=geometry.Vector3(random.randint(0, 32), random.randint(0, 32), 0),
        inventory={app.store.create_item(restorative.Carrot())},
        behavior="wander"))

  logging.info("Created players.")


def main():
  server.Application(server.make_config_parser().parse_args()).once(initdb)


if __name__ == "__main__":
  main()
