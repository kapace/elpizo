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
from elpizo.tools.terrain_gen import TerrainGenerator


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

  windvale = realm.Realm(name="Windvale", size=geometry.Vector2(128, 128))
  app.store.realms.create(windvale)

  tg = TerrainGenerator() 
  tg.generate_terrain(windvale.size.x//realm.Region.SIZE, windvale.size.y//realm.Region.SIZE)

  for base_y in range(0, windvale.size.y, realm.Region.SIZE):
    for base_x in range(0, windvale.size.x, realm.Region.SIZE):
      tiles = []

      for offset_y in range(realm.Region.SIZE):
        for offset_x in range(realm.Region.SIZE):
          x = base_x + offset_x
          y = base_y + offset_y

          if x == 0 and y == 0:
            tile = 34
          elif x == 0 and y == windvale.size.y - 1:
            tile = 40
          elif x == windvale.size.x - 1 and y == 0:
            tile = 36
          elif x == windvale.size.x - 1 and y == windvale.size.y - 1:
            tile = 38
          elif x == 0:
            tile = 16
          elif x == windvale.size.x - 1:
            tile = 24
          elif y == 0:
            tile = 20
          elif y == windvale.size.y - 1:
            tile = 28
          else:
            tile = 0

          tiles.append(tile)

      island_tiles = tg.get_region_island(base_x, base_y, realm.Region.SIZE)
      grass_tiles = tg.get_region_grass(base_x, base_y, realm.Region.SIZE)
      passabilities = [0b1111] * (realm.Region.SIZE * realm.Region.SIZE)

      region = realm.Region(
          realm_id=windvale.id, location=geometry.Vector2(base_x, base_y),
          passabilities=passabilities,
          layers=[realm.Layer(terrain="water", tiles=tiles),
                  realm.Layer(terrain="dirt", tiles=island_tiles),
                  realm.Layer(terrain="grassland", tiles=grass_tiles)],
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
      direction=1,
      health=10,
      realm_id=windvale.id,
      location=geometry.Vector3(64, 64, 0),
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
      direction=1,
      health=10,
      realm_id=windvale.id,
      location=geometry.Vector3(0, 16, 0),
      inventory=set(),
      legs_item=app.store.create_item(legs_items.TealPants())))

  app.store.entities.create(entities.Player(
      name="Courfeyrac",
      gender="male",
      body="light",
      hair="brown_messy_1",
      direction=1,
      health=10,
      realm_id=windvale.id,
      location=geometry.Vector3(16, 16, 0),
      inventory=set(),
      legs_item=app.store.create_item(legs_items.TealPants())))

  app.store.entities.create(entities.Player(
      name="Enjolras",
      gender="male",
      body="light",
      hair="brown_messy_1",
      direction=1,
      health=10,
      realm_id=windvale.id,
      location=geometry.Vector3(12, 16, 0),
      inventory=set(),
      legs_item=app.store.create_item(legs_items.TealPants())))

  app.store.entities.create(entities.Building(
      location=geometry.Vector3(1, 10, 0),
      door_location=1,
      realm_id=windvale.id,
      interior_realm_id=windvale.id))

  app.store.entities.create(entities.Building(
      location=geometry.Vector3(1, 13, 0),
      door_location=2,
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
        direction=random.randint(0, 3),
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
