import logging
from lxml import etree
from itertools import product
import json
import random

from elpizo import make_application
from elpizo.models.actors import Player
from elpizo.models.base import Base, User, Entity, Building
from elpizo.models.realm import Realm, Region, RegionLayer, Terrain
from elpizo.models.fixtures import Fixture, resource_sources
from elpizo.models.items import restorative, equipment, Drop
from elpizo.tools import mapgen


def initialize_schema(app):
  engine = app.sqla_factory().bind

  Base.metadata.drop_all(bind=engine)
  Base.metadata.create_all(bind=engine)
  logging.info("Initialized database schema.")


def initialize_realm(app):
  sqla = app.sqla_factory()

  realm = Realm(name="Windvale", aw=128, ah=128)
  sqla.add(realm)
  sqla.commit()

  ocean = Terrain(name="Ocean")
  sqla.add(ocean)

  grassland = Terrain(name="Grassland")
  sqla.add(grassland)

  grassland_wall = Terrain(name="GrasslandWall")
  sqla.add(grassland_wall)

  sqla.commit()

  logging.info("Created realm.")

  for ary in range(realm.ah // Region.SIZE):
    for arx in range(realm.aw // Region.SIZE):
      tiles = []

      for ry in range(Region.SIZE):
        for rx in range(Region.SIZE):
          ax = arx * Region.SIZE + rx
          ay = ary * Region.SIZE + ry

          tile = 0x0

          if ax == 0 and ay == 0:
            tile = 34
          elif ax == 0 and ay == realm.ah - 1:
            tile = 40
          elif ax == realm.aw - 1 and ay == 0:
            tile = 36
          elif ax == realm.aw - 1 and ay == realm.ah - 1:
            tile = 38
          elif ax == 0:
            tile = 16
          elif ax == realm.aw - 1:
            tile = 24
          elif ay == 0:
            tile = 20
          elif ay == realm.ah - 1:
            tile = 28

          tiles.append(tile)
      grass_layer = RegionLayer(terrain=grassland, tiles=tiles)

      platform_tiles = [-1] * (16 * 16)
      platform_tiles[4 + 4 * Region.SIZE] = 34
      platform_tiles[5 + 4 * Region.SIZE] = 20
      platform_tiles[6 + 4 * Region.SIZE] = 36

      platform_tiles[4 + 5 * Region.SIZE] = 16
      platform_tiles[5 + 5 * Region.SIZE] = 0
      platform_tiles[6 + 5 * Region.SIZE] = 24

      platform_tiles[4 + 6 * Region.SIZE] = 40
      platform_tiles[6 + 6 * Region.SIZE] = 38

      platform_layer = RegionLayer(terrain=grassland, tiles=platform_tiles)

      wall_tiles = [-1] * (16 * 16)
      wall_tiles[4 + 7 * Region.SIZE] = 40
      wall_tiles[6 + 7 * Region.SIZE] = 38
      wall_layer = RegionLayer(terrain=grassland_wall, tiles=wall_tiles)

      passabilities = [0b1111] * (16 * 16)

      passabilities[4 + 3 * Region.SIZE] = 0b1110
      passabilities[5 + 3 * Region.SIZE] = 0b1110
      passabilities[6 + 3 * Region.SIZE] = 0b1110

      passabilities[3 + 4 * Region.SIZE] = 0b1101
      passabilities[4 + 4 * Region.SIZE] = 0b0011
      passabilities[5 + 4 * Region.SIZE] = 0b1011
      passabilities[6 + 4 * Region.SIZE] = 0b1001
      passabilities[7 + 4 * Region.SIZE] = 0b0111

      passabilities[3 + 5 * Region.SIZE] = 0b1101
      passabilities[4 + 5 * Region.SIZE] = 0b0111
      passabilities[6 + 5 * Region.SIZE] = 0b1101
      passabilities[7 + 5 * Region.SIZE] = 0b0111

      passabilities[3 + 6 * Region.SIZE] = 0b1101
      passabilities[4 + 6 * Region.SIZE] = 0b0110
      passabilities[6 + 6 * Region.SIZE] = 0b1100
      passabilities[7 + 6 * Region.SIZE] = 0b0111

      passabilities[4 + 7 * Region.SIZE] = 0b0000
      passabilities[6 + 7 * Region.SIZE] = 0b0000

      region = Region(arx=arx, ary=ary, realm=realm,
                      layers=[grass_layer, platform_layer, wall_layer],
                      passabilities=passabilities)
      sqla.add(region)

  sqla.commit()
  logging.info("Created realm regions.")
  return realm


def initialize_fixtures(app, realm):
  sqla = app.sqla_factory()

  Fixture.initialize_type_table(sqla)

  sqla.add(resource_sources.Tree(realm=realm, ax=7, ay=7))
  sqla.add(Drop(item=restorative.Carrot(), realm=realm, ax=1, ay=0))
  sqla.add(Building(realm=realm, ax=2, ay=2, a_width=5, a_height=5))
  sqla.commit()

  logging.info("Created fixtures.")


def initialize_players(app, realm):
  sqla = app.sqla_factory()

  victor_hugo = User(name="victor_hugo")
  sqla.add(victor_hugo)

  white_longsleeve_shirt = equipment.WhiteLongsleeveShirt()
  teal_pants = equipment.TealPants()
  brown_shoes = equipment.BrownShoes()

  valjean = Player(name="Valjean", user=victor_hugo, gender="Male",
                   body="Light",
                   hair="BrownMessy1",
                   facial="BrownBeard",
                   direction=1,
                   health=10,
                   realm=realm, arx=0, ary=0, rx=0, ry=0,
                   inventory=[teal_pants, white_longsleeve_shirt, brown_shoes])
  sqla.add(valjean)
  sqla.flush()

  valjean.torso_item = white_longsleeve_shirt
  valjean.legs_item = teal_pants
  valjean.feet_item = brown_shoes
  sqla.commit()

  dumas = User(name="dumas")
  sqla.add(dumas)

  athos = Player(name="Athos", user=dumas, gender="Male",
                 body="Light",
                 direction=1,
                 health=10,
                 realm=realm, arx=0, ary=0, rx=0, ry=0,)
  sqla.add(athos)

  aramis = Player(name="Aramis", user=dumas, gender="Male",
                  body="Light",
                  direction=1,
                  health=10,
                  realm=realm, arx=0, ary=0, rx=0, ry=0)
  sqla.add(aramis)

  porthos = Player(name="Porthos", user=dumas, gender="Male",
                   body="Light",
                   direction=1,
                   health=10,
                   realm=realm, arx=0, ary=0, rx=0, ry=0)
  sqla.add(porthos)

  sqla.commit()

  logging.info("Created test users.")


def main():
  app = make_application()

  input("This will DELETE ALL DATA! Press ENTER to continue or CTRL+C to abort. ")

  initialize_schema(app)
  realm = initialize_realm(app)
  initialize_fixtures(app, realm)
  initialize_players(app, realm)


if __name__ == "__main__":
  main()
