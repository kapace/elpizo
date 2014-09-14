import random, math, copy
from collections import deque

import numpy
numpy.set_printoptions(threshold=numpy.nan, linewidth = numpy.nan)

from elpizo.models import realm

ISLAND_FACTOR = 1.07


class Point:
  def __init__(self, x, y):
    self.x, self.y = x, y
    self.length = math.sqrt( x ** 2 + y ** 2 )

class Tile:
  def __init__ (self, point=None, water=False, ocean=False):
    self.autotileIndex = -1

    self.point = point
    self.water = water
    self.ocean = ocean
    self.coast = False
    self.border = False
    self.elevation = 1000000
    self.moisture = 0
    self.visited = False
  
  def __gt__(self, other):
    return self.elevation > other

  def __repr__ (self):
    return str(self.autotileIndex)

class TerrainGenerator:
  def __init__ (self, seed = None): # 23234 kinda looks like a clover leaf
    random.seed(seed)
    self.seed = seed
    self.borders = []
    self.generation_function = self.generate_radial()

  def generate_radial(self):
    bumps = random.randrange(1, 6);
    startAngle = random.uniform(0, 2*math.pi);
    dipAngle = random.uniform(0, 2*math.pi);
    dipWidth = random.uniform(0.2, 0.7);

    def inside (q):
      angle = math.atan2(q.y, q.x);
      length = 0.5 * (max(abs(q.x), abs(q.y)) + q.length);

      r1 = 0.5 + 0.40*math.sin(startAngle + bumps*angle + math.cos((bumps+3)*angle));
      r2 = 0.7 - 0.20*math.sin(startAngle + bumps*angle - math.sin((bumps+2)*angle));
      
      if (abs(angle - dipAngle) < dipWidth 
          or abs(angle - dipAngle + 2*math.pi) < dipWidth
          or abs(angle - dipAngle - 2*math.pi) < dipWidth):
        r1 = r2 = 0.2

      return  (length < r1 or (length > r1*ISLAND_FACTOR and length < r2));
    return inside

  # Autotiles and annotations (water, ocean, coast, border)
  def autotile_pass(self, tiles):
    for (x,y), value in numpy.ndenumerate(tiles):
      if value.autotileIndex == -1:
        continue

      neighborW  = tiles [ x,     y - 1 ].autotileIndex != -1;
      neighborSW = tiles [ x + 1, y - 1 ].autotileIndex != -1;
      neighborS  = tiles [ x + 1, y     ].autotileIndex != -1;
      neighborSE = tiles [ x + 1, y + 1 ].autotileIndex != -1;
      neighborE  = tiles [ x,     y + 1 ].autotileIndex != -1;
      neighborNE = tiles [ x - 1, y + 1 ].autotileIndex != -1;
      neighborN  = tiles [ x - 1, y     ].autotileIndex != -1;
      neighborNW = tiles [ x - 1, y - 1 ].autotileIndex != -1;

      autotileIndex = value.autotileIndex

      if not neighborN and not neighborE and not neighborS and not neighborW:
        autotileIndex = 46
      elif (int(not neighborN) + int(not neighborE) + int(not neighborS) + int(not neighborW) == 3):
        autotileIndex = 42 + [neighborS, neighborE, neighborN, neighborW].index(True)
      elif (not neighborN and not neighborS):
        # NS wall (33).
        autotileIndex = 33;
      elif (not neighborE and not neighborW):
        # WE wall (32).
        autotileIndex = 32;
      elif (not neighborN and not neighborE):
        # NE walls (36, 37).
        autotileIndex = 36 + int(not neighborSW);
      elif (not neighborE and not neighborS):
        # ES walls (38, 39).
        autotileIndex = 38 + int(not neighborNW);
      elif (not neighborS and not neighborW):
        # SW walls (40, 41).
        autotileIndex = 40 + int(not neighborNE);
      elif (not neighborW and not neighborN):
        # WN walls (34, 35).
        autotileIndex = 34 + int(not neighborSE);
      elif (not neighborN):
        autotileIndex = 20 + ((int(not neighborSW) << 1) | (int (not neighborSE) << 0))
      elif (not neighborE):
        # E wall (24, 25, 26, 27).
        autotileIndex = 24 + ((int(not neighborNW) << 1) | (int (not neighborSW) << 0));
      elif (not neighborS):
        # S wall (28, 29, 30, 31).
        autotileIndex = 28 + ((int(not neighborNW) << 1) | (int(not neighborNE) << 0));
      elif (not neighborW):
        # W wall (16, 17, 18, 19).
        autotileIndex = 16 + ((int(not neighborSE) << 1) | (int(not neighborNE) << 0));
      else:
        # Corner walls (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15).
        autotileIndex = (int(not neighborSW) << 3) | (int(not neighborSE) << 2) | \
                    (int(not neighborNE) << 1) | (int(not neighborNW) << 0);

      tiles[x,y].autotileIndex = autotileIndex;

      # Since we have the nearby tiles, we can set tile annotations 
      # Any neighbouring water tiles means tile is a coast.
      #tile.coast = not neighborN  or \
      #              not neighborNE or \
      #              not neighborE  or \
      #              not neighborSE or \
      #              not neighborS  or \
      #              not neighborSW or \
      #              not neighborW  or \
      #              not neighborNW
    return tiles

  # Use BFS to computer elevations for each tile.
  def computeElevations (self, tiles):
    width, height = tiles.shape[0], tiles.shape[1]

    for border in self.borders:
      border.elevation = 0

    # Start the bfs queue 
    queue = deque(self.borders[:])

    while len(queue) > 0:
      tile = queue.popleft()

      # Get neighbouring tiles, increment their elevation if they aren't water.
      right  = tiles[tile.point.x,   tile.point.y+1] if tile.point.y+1 < width  else None
      bottom = tiles[tile.point.x+1, tile.point.y  ] if tile.point.x+1 < height else None
      left   = tiles[tile.point.x,   tile.point.y-1] if tile.point.y-1 >= 0  else None
      top    = tiles[tile.point.x-1, tile.point.y  ] if tile.point.x-1 >= 0 else None

      for neighbour in (right, bottom, left, top):
        if neighbour == None:
          continue

        nelevation = tile.elevation + 0.01

        if not tile.water and not neighbour.water:
          nelevation += 1

        if nelevation < neighbour.elevation:
          neighbour.elevation = nelevation
          queue.append(neighbour)

  def generate_terrain(self, base_width, base_height):
    # initialize region tiles with ocean water
    terrain = numpy.zeros((base_width * realm.Region.SIZE, base_height * realm.Region.SIZE), dtype=Tile)

    width, height = terrain.shape[0], terrain.shape[1]

    for (x,y), value in numpy.ndenumerate(terrain):
      terrain[x][y] = tile =  Tile(Point(x,y), water=True, ocean=True)

      # normalize to [-1.0, 1.0] range
      nx = (x / (width  / 2)) - 1.0
      ny = (y / (height / 2)) - 1.0

      if self.generation_function( Point(nx, ny) ):
        tile.autotileIndex = 0
        tile.water = tile.ocean = False

      if x == 0 or y == 0 or x == height - 1 or y == width - 1:
         tile.border = True 
         self.borders.append(tile)
        
    self.computeElevations(terrain)
    self.terrain = self.autotile_pass(terrain)

    grass = numpy.where(terrain > 6, copy.deepcopy(terrain), Tile())
    self.grass = self.autotile_pass(grass)

  def get_region_island(self, base_x, base_y, region_size):
    # Get a region sized block from the terrain array, starting at the base coordinates.
    region = self.terrain[ base_y : base_y + region_size, base_x : base_x + region_size]
    return [tile.autotileIndex for tile in region.flatten().tolist()]

  def get_region_grass(self, base_x, base_y, region_size):
    region = self.grass[ base_y : base_y + region_size, base_x : base_x + region_size]
    return [tile.autotileIndex for tile in region.flatten().tolist()]

if __name__ == '__main__':
  tg = TerrainGenerator()
  t = tg.generate_terrain(8,8)
  
