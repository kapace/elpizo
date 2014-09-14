module sprite from "client/graphics/sprite";
module geometry from "client/util/geometry";

export default = {
  "tree.oak.mature":
      new sprite.Sprite("fixture/tree.png", new geometry.Vector2(64, 64),
                        [new geometry.Vector2(0, 0)],
                        new geometry.Vector2(16, 32), 0),

  "item.carrot":
      new sprite.Sprite("item/carrot.png", new geometry.Vector2(32, 32),
                        [new geometry.Vector2(0, 0)],
                        new geometry.Vector2(0, 0), 0),

  "item.white_longsleeve_shirt":
      new sprite.Sprite("equipment/male/white_longsleeve_shirt.png",
                        new geometry.Vector2(32, 32),
                        [new geometry.Vector2(16, 64 * 10 + 24)],
                        new geometry.Vector2(0, 0), 0),

  "item.teal_pants":
      new sprite.Sprite("equipment/male/teal_pants.png",
                        new geometry.Vector2(32, 32),
                        [new geometry.Vector2(16, 64 * 10 + 32)],
                        new geometry.Vector2(0, 0), 0),

  "item.brown_shoes":
      new sprite.Sprite("equipment/male/brown_shoes.png",
                        new geometry.Vector2(32, 32),
                        [new geometry.Vector2(16, 64 * 10 + 40)],
                        new geometry.Vector2(0, 0), 0),

  "item.dagger":
      new sprite.Sprite("equipment/male/dagger.png",
                        new geometry.Vector2(32, 32),
                        [new geometry.Vector2(22, 64 * 10 + 32)],
                        new geometry.Vector2(0, 0), 0),

  "body.male.light":
      sprite.makeHumanoidSprite("body/male/light.png"),

  "body.male.smurf":
      sprite.makeHumanoidSprite("body/male/smurf.png"),

  "facial.male.brown_beard":
      sprite.makeHumanoidSprite("facial/male/brown_beard.png"),

  "hair.male.brown_messy_1":
      sprite.makeHumanoidSprite("hair/male/brown_messy_1.png"),

  "equipment.male.white_longsleeve_shirt":
      sprite.makeHumanoidSprite("equipment/male/white_longsleeve_shirt.png"),

  "equipment.male.teal_pants":
      sprite.makeHumanoidSprite("equipment/male/teal_pants.png"),

  "equipment.male.brown_shoes":
      sprite.makeHumanoidSprite("equipment/male/brown_shoes.png"),

  "equipment.male.dagger":
      sprite.makeHumanoidSprite("equipment/male/dagger.png"),

  "tile.water":
      sprite.makeAutotile("tiles/water.png",
                          new geometry.Vector2(0, 0)),

  "tile.grassland":
      sprite.makeAutotile("tiles/grassland.png",
                          new geometry.Vector2(0, 0)),

  "tile.dirt":
      sprite.makeAutotile("tiles/dirt.png",
                          new geometry.Vector2(0, 0)),

  "tile.dirt_wall":
      sprite.makeAutotile("tiles/dirt-wall.png",
                          new geometry.Vector2(0, 0)),

  "building.wall":
      sprite.makeAutotile("tiles/building-wall.png",
                          new geometry.Vector2(0, 0)),

  "building.red_roof_1":
      new sprite.Sprite("buildings/red_roof_1.png",
                        new geometry.Vector2(96, 80),
                        [new geometry.Vector2(0, 0)],
                        new geometry.Vector2(0, 0), 0),
};
