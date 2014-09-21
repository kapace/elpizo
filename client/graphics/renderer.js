module chroma from "chroma-js";
module events from "events";

module sprites from "client/assets/sprites";
module entities from "client/models/entities";
module realm from "client/models/realm";
module bubble from "client/ui/overlay/bubble.react";
module colors from "client/util/colors";
module functions from "client/util/functions";
module geometry from "client/util/geometry";
module grid from "client/util/grid";
module objects from "client/util/objects";
module timing from "client/util/timing";

export class GraphicsRenderer extends events.EventEmitter {
  constructor(resources, parent) {
    super();

    // @ifdef DEBUG
    this.debug = false;
    // @endif

    this.el = document.createElement("div");
    this.el.classList.add("renderer");
    this.el.style.position = "relative";

    parent.appendChild(this.el);

    this.backBuffers = {};
    this.entityBuffers = {};

    this.canvas = this.createCanvas();
    this.canvas.width = 0;
    this.canvas.height = 0;
    this.el.appendChild(this.canvas);

    this.leftTop = new geometry.Vector2(0, 0);

    this.resources = resources;
    this.currentRealm = null;

    this.regionTerrainCache = {};
    this.elapsed = 0;
    this.lastRenderTime = 0;

    this.nextComponentKey = 0;

    window.onresize = functions.debounce(() => {
      this.refit();
    }, 500);

    this.style = window.getComputedStyle(this.el);

    this.sBounds = new geometry.Rectangle(0, 0, 0, 0);

    // We also hold React components here, which need to be parented onto the
    // overlay during the React tick phase.
    this.components = {};

    this.transitionTimer = new timing.CountdownTimer();
  }

  ensureBackBuffer(name) {
    if (!objects.has(this.backBuffers, name)) {
      var backBuffer = document.createElement("canvas");
      backBuffer.width = this.canvas.width;
      backBuffer.height = this.canvas.height;
      this.backBuffers[name] = backBuffer;
    }
    return this.backBuffers[name];
  }

  addComponent(id, comp) {
    delete this.components[id];

    objects.extend(comp.props, {
        renderer: this,
        key: this.nextComponentKey
    });

    ++this.nextComponentKey;
    this.components[id] = comp;
  }

  addChatBubble(entity, message) {
    this.addComponent(
        ["bubble", entity.id].join("."),
        bubble.Bubble({
            text: message,
            entity: entity,
            timer: new timing.CountdownTimer(3)
        }));
  }

  // @ifdef DEBUG
  setDebug(debug) {
    this.debug = debug;
    this.regionTerrainCache = {};
  }
  // @endif

  center(position) {
    var bounds = this.getViewportBounds();

    this.setLeftTop(new geometry.Vector2(
        position.x - Math.round(bounds.width / 2),
        position.y - Math.round(bounds.height / 2)));
  }

  prepareContext(canvas) {
    var ctx = canvas.getContext("2d");
    ctx.font = this.style.fontSize + " " + this.style.fontFamily;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  createCanvas() {
    var canvas = document.createElement("canvas");
    objects.extend(canvas.style, {
        position: "absolute",
        left: "0px",
        top: "0px",
        width: "100%",
        height: "100%"
    });
    return canvas;
  }

  toScreenCoords(location) {
    return location.scale(GraphicsRenderer.TILE_SIZE);
  }

  fromScreenCoords(location) {
    return location.scale(1 / GraphicsRenderer.TILE_SIZE);
  }

  setLeftTop(v) {
    var previous = this.getViewportBounds();
    this.leftTop = v;
    this.emit("viewportChange");
  }

  setScreenViewportSize(sw, sh) {
    var previous = this.getViewportBounds();

    this.el.style.width = sw + "px";
    this.el.style.height = sh + "px";

    var sBounds = this.el.getBoundingClientRect();
    this.sBounds = geometry.Rectangle.fromCorners(sBounds.left,
                                                  sBounds.top,
                                                  sBounds.right,
                                                  sBounds.bottom);

    Object.keys(this.backBuffers).forEach((k) => {
      var backbuffer = this.backBuffers[k];
      backbuffer.width = sw;
      backbuffer.height = sh;
    })

    this.canvas.width = sw;
    this.canvas.height = sh;

    this.emit("viewportChange");
  }

  refit() {
    this.setScreenViewportSize(window.innerWidth, window.innerHeight);

    // Clobber all back-buffers.
    this.backBuffers = {};

    this.emit("refit", this.sBounds);
  }

  getViewportBounds() {
    var size = this.fromScreenCoords(new geometry.Vector2(
        this.sBounds.width, this.sBounds.height));

    return new geometry.Rectangle(this.leftTop.x, this.leftTop.y,
                                  Math.ceil(size.x), Math.ceil(size.y));
  }

  getCacheBounds() {
    var viewport = this.getViewportBounds();

    return geometry.Rectangle.fromCorners(
        realm.Region.floor(viewport.left - realm.Region.SIZE),
        realm.Region.floor(viewport.top - realm.Region.SIZE),
        realm.Region.ceil(viewport.getRight() + realm.Region.SIZE),
        realm.Region.ceil(viewport.getBottom() + realm.Region.SIZE));
  }

  render(realm, me, dt) {
    this.transitionTimer.update(dt);

    var composite = this.ensureBackBuffer("composite");
    var retain = this.ensureBackBuffer("retain");

    if (realm !== this.currentRealm) {
      // Copy the last composite and retain it.
      var retainCtx = this.prepareContext(retain);
      retainCtx.clearRect(0, 0, retain.width, retain.height);
      retainCtx.drawImage(composite, 0, 0);
      this.transitionTimer.reset(0.25);
    }

    var illumination = this.ensureBackBuffer("illumination");
    var illuminationCtx = this.prepareContext(illumination);
    illuminationCtx.globalCompositeOperation = "lighter";

    this.elapsed += dt;
    this.renderTerrain(realm, me);
    this.renderEntities(realm, me);
    this.renderAmbientIllumination(realm, illuminationCtx);
    this.updateComponents(dt);

    var albedo = this.ensureBackBuffer("albedo");
    var albedoCtx = this.prepareContext(albedo);

    albedoCtx.save();
    albedoCtx.clearRect(0, 0, composite.width, composite.height);
    albedoCtx.drawImage(this.ensureBackBuffer("terrain"), 0, 0);
    albedoCtx.drawImage(this.ensureBackBuffer("underlay"), 0, 0);
    albedoCtx.drawImage(this.ensureBackBuffer("entity"), 0, 0);
    albedoCtx.globalAlpha = 0.25;
    albedoCtx.drawImage(this.ensureBackBuffer("xray"), 0, 0);
    albedoCtx.globalAlpha = 1.0;
    albedoCtx.restore();

    var compositeCtx = this.prepareContext(composite);
    compositeCtx.save();
    compositeCtx.clearRect(0, 0, composite.width, composite.height);

    compositeCtx.drawImage(albedo, 0, 0);

    compositeCtx.globalCompositeOperation = "multiply";
    compositeCtx.drawImage(illumination, 0, 0);

    compositeCtx.restore();

    var ctx = this.prepareContext(this.canvas);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.globalAlpha = 1 - this.transitionTimer.getElapsedRatio();
    ctx.drawImage(retain, 0, 0);

    ctx.globalAlpha = this.transitionTimer.getElapsedRatio();
    ctx.drawImage(composite, 0, 0);

    this.lastRenderTime = this.lastRenderTime * 0.9 + dt * 0.1;
  }

  renderAmbientIllumination(realm, ctx) {
  }

  updateComponents(dt) {
    var components = this.components;
    this.components = {};

    Object.keys(components).forEach((k) => {
      var comp = components[k];

      var timer = comp.props.timer;
      if (timer === null) {
        return;
      }

      timer.update(dt);
      if (!timer.isStopped()) {
        this.components[k] = comp;
      }
    });
  }

  renderTerrain(r, me) {
    var viewport = this.getViewportBounds();

    if (r !== this.currentRealm) {
      this.regionTerrainCache = {};
      this.currentRealm = r;
    } else {
      // Evict parts of the terrain cache to keep it synchronized with realm
      // regions.
      Object.keys(this.regionTerrainCache).forEach((k) => {
        if (!r.regions[k]) {
          delete this.regionTerrainCache[k];
        }
      });
    }

    var terrainCanvas = this.ensureBackBuffer("terrain");
    var ctx = this.prepareContext(terrainCanvas);
    ctx.clearRect(0, 0, terrainCanvas.width, terrainCanvas.height);

    var sOffset = this.toScreenCoords(this.leftTop.negate());

    // Only render the regions bounded by the viewport.
    for (var y = realm.Region.floor(viewport.top);
         y < realm.Region.ceil(viewport.getBottom());
         y += realm.Region.SIZE) {
      for (var x = realm.Region.floor(viewport.left);
           x < realm.Region.ceil(viewport.getRight());
           x += realm.Region.SIZE) {
        var sPosition = this.toScreenCoords(new geometry.Vector2(x, y));
        var sLeft = Math.round(sOffset.x + sPosition.x);
        var sTop = Math.round(sOffset.y + sPosition.y);

        var key = [x, y].join(",");
        var region = r.getRegionAt(new geometry.Vector2(x, y));

        if (region === null) {
          continue;
        }

        // If this region hasn't been rendered yet, then we render it and add it
        // to the cache.
        if (!objects.has(this.regionTerrainCache, key)) {
          this.regionTerrainCache[key] =
              this.renderRegionTerrainAsBuffer(region);
        }

        var buffer = this.regionTerrainCache[key];
        ctx.save();
        ctx.translate(sLeft, sTop);
        ctx.drawImage(buffer, 0, 0);

        // @ifdef DEBUG
        if (this.debug) {
          ctx.strokeStyle = "red";
          ctx.fillStyle = "red";
          ctx.strokeRect(0, 0, buffer.width, buffer.height);
          ctx.font = "24px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(key, buffer.width / 2, buffer.height / 2);
        }
        // @endif

        ctx.restore();
      }
    }
  }

  renderEntities(realm, me) {
    var sortedEntities = realm.getAllEntities()
        .sort((a, b) => {
            // Always sort drops below everything else.
            if (a instanceof entities.Drop) {
              return -1;
            } else if (b instanceof entities.Drop) {
              return 1;
            }

            var aBounds = a.getBounds();
            var bBounds = b.getBounds();

            return aBounds.getBottom() - bBounds.getBottom() ||
                   bBounds.top - aBounds.top ||
                   // We're desperate, tie break by id to avoid depth fighting.
                   a.id - b.id;
        });

    var entityCanvas = this.ensureBackBuffer("entity");
    var ctx = this.prepareContext(entityCanvas);
    ctx.save();
    ctx.clearRect(0, 0, entityCanvas.width, entityCanvas.height);

    var xrayCanvas = this.ensureBackBuffer("xray");
    var xrayCtx = this.prepareContext(xrayCanvas);
    xrayCtx.save();
    xrayCtx.clearRect(0, 0, xrayCanvas.width, xrayCanvas.height);

    var underlayCanvas = this.ensureBackBuffer("underlay");
    var underlayCtx = this.prepareContext(underlayCanvas);
    underlayCtx.save();
    underlayCtx.clearRect(0, 0, underlayCanvas.width, underlayCanvas.height);

    var terrainCanvas = this.ensureBackBuffer("terrain");
    var terrainCtx = this.prepareContext(terrainCanvas);

    sortedEntities.forEach((entity) => {
      // Entities are allowed to draw to the terrain canvas (if they really
      // want to.)
      this.renderEntity(entity, me, terrainCtx, "terrain");
      this.renderEntity(entity, me, ctx, "albedo");
      this.renderEntity(entity, me, underlayCtx, "underlay");
      this.renderEntity(entity, me, xrayCtx, "xray");
    });
    ctx.restore();
    xrayCtx.restore();

    var illuminationCanvas = this.ensureBackBuffer("illumination");
    var illuminationCtx = this.prepareContext(illuminationCanvas);
    illuminationCtx.save();
    illuminationCtx.clearRect(0, 0,
                              illuminationCanvas.width,
                              illuminationCanvas.height);
    // We run the illumination pass separately as we'd like to have access to
    // albedo during illumination.
    sortedEntities.forEach((entity) => {
      this.renderEntity(entity, me, illuminationCtx, "illumination");
    })
    illuminationCtx.restore();
  }

  renderAutotile(autotile, ctx) {
    autotile.forEach((sprite, index) => {
      var s = this.toScreenCoords(new geometry.Vector2(
          (index % 2) / 2,
          Math.floor(index / 2) / 2));

      ctx.save();
      ctx.translate(s.x, s.y);
      sprite.render(this.resources, ctx, this.elapsed);
      ctx.restore();
    });
  }

  renderRegionTerrainAsBuffer(region) {
    var canvas = document.createElement("canvas");
    var size = this.toScreenCoords(new geometry.Vector2(
        realm.Region.SIZE, realm.Region.SIZE));

    canvas.width = size.x;
    canvas.height = size.y;

    var halfTileSize = GraphicsRenderer.TILE_SIZE / 2;

    var ctx = this.prepareContext(canvas);

    for (var ry = 0; ry < realm.Region.SIZE; ++ry) {
      for (var rx = 0; rx < realm.Region.SIZE; ++rx) {
        region.layers.forEach((layer) => {
          var spriteSet = sprites[["tile", layer.terrain].join(".")];

          var tileNum = layer.tiles.getCell(rx, ry);
          if (tileNum < 0) {
            return;
          }

          var sOffset = this.toScreenCoords(new geometry.Vector2(rx, ry));
          ctx.save();
          ctx.translate(sOffset.x, sOffset.y);
          this.renderAutotile(spriteSet[tileNum], ctx);
          ctx.restore();
        });
      }
    }

    // @ifdef DEBUG
    if (this.debug) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
      ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (var ry = 0; ry < realm.Region.SIZE; ++ry) {
        for (var rx = 0; rx < realm.Region.SIZE; ++rx) {
          var x = rx * GraphicsRenderer.TILE_SIZE;
          var y = ry * GraphicsRenderer.TILE_SIZE;
          ctx.strokeRect(x, y,
                         GraphicsRenderer.TILE_SIZE,
                         GraphicsRenderer.TILE_SIZE);
          ctx.fillText(rx + "," + ry, x + halfTileSize, y + halfTileSize);

          for (var i = 0; i < 4; ++i) {
            var dv = entities.getDirectionVector(i);

            var dummy = Object.create(entities.Player.prototype);
            dummy.bbox = new geometry.Rectangle(0, 0, 1, 1);
            dummy.location = (new geometry.Vector3(rx, ry, 0))
                .offset(region.location)
                .offset(entities.getDirectionVector(i).negate());
            dummy.direction = i;
            var isPassable = region.isTerrainPassableBy(dummy);

            dv.x = -dv.x;
            dv.y = -dv.y;

            if (!isPassable) {
              ctx.fillRect(x + (dv.x + 1) * (halfTileSize - 4 - Math.abs(dv.y) * 6),
                           y + (dv.y + 1) * (halfTileSize - 4 - Math.abs(dv.x) * 6),
                           8 + Math.abs(dv.y) * 12,
                           8 + Math.abs(dv.x) * 12);
            }
          }
        }
      }

      ctx.restore();
    }
    // @endif

    return canvas;
  }

  renderEntity(entity, me, ctx, pass) {
    // Initialize the entity buffers container, if we don't have one already.
    if (!objects.has(this.entityBuffers, entity.id)) {
      this.entityBuffers[entity.id] = {};
    }

    var sOffset = this.toScreenCoords(
        entity.location.offset(this.leftTop.negate()));

    ctx.save();
    ctx.translate(sOffset.x, sOffset.y);
    entity.accept(new GraphicsRendererVisitor(this, me, ctx, pass));
    ctx.restore();
  }
}

function drawAutotileGrid(renderer, grid, autotile, ctx) {
  for (var y = 0; y < grid.height; ++y) {
    for (var x = 0; x < grid.width; ++x) {
      var filled = grid.getCell(x, y);

      if (!filled) {
        continue;
      }

      var neighborN =  grid.getCell(x,     y - 1);
      var neighborNE = grid.getCell(x + 1, y - 1);
      var neighborE =  grid.getCell(x + 1, y);
      var neighborSE = grid.getCell(x + 1, y + 1);
      var neighborS =  grid.getCell(x,     y + 1);
      var neighborSW = grid.getCell(x - 1, y + 1);
      var neighborW =  grid.getCell(x - 1, y);
      var neighborNW = grid.getCell(x - 1, y - 1);

      var autotileIndex;

      // Compute the autotile to use.
      if (!neighborN && !neighborE && !neighborS && !neighborW) {
        // NESW walls (46).
        autotileIndex = 46;
      } else if (!neighborN + !neighborE + !neighborS + !neighborW === 3) {
        // 3 walls (42, 43, 44, 45).
        autotileIndex = 42 + [neighborS, neighborE, neighborN, neighborW]
            .indexOf(true);
      } else if (!neighborN && !neighborS) {
        // NS wall (33).
        autotileIndex = 33;
      } else if (!neighborE && !neighborW) {
        // WE wall (32).
        autotileIndex = 32;
      } else if (!neighborN && !neighborE) {
        // NE walls (36, 37).
        autotileIndex = 36 + !neighborSW;
      } else if (!neighborE && !neighborS) {
        // ES walls (38, 39).
        autotileIndex = 38 + !neighborNW;
      } else if (!neighborS && !neighborW) {
        // SW walls (40, 41).
        autotileIndex = 40 + !neighborNE;
      } else if (!neighborW && !neighborN) {
        // WN walls (34, 35).
        autotileIndex = 34 + !neighborSE;
      } else if (!neighborN) {
        // N wall (20, 21, 22, 23).
        autotileIndex = 20 + ((!neighborSW << 1) | (!neighborSE << 0));
      } else if (!neighborE) {
        // E wall (24, 25, 26, 27).
        autotileIndex = 24 + ((!neighborNW << 1) | (!neighborSW << 0));
      } else if (!neighborS) {
        // S wall (28, 29, 30, 31).
        autotileIndex = 28 + ((!neighborNW << 1) | (!neighborNE << 0));
      } else if (!neighborW) {
        // W wall (16, 17, 18, 19).
        autotileIndex = 16 + ((!neighborSE << 1) | (!neighborNE << 0));
      } else {
        // Corner walls (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15).
        autotileIndex = (!neighborSW << 3) | (!neighborSE << 2) |
                        (!neighborNE << 1) | (!neighborNW << 0);
      }

      var sOffset = renderer.toScreenCoords(new geometry.Vector2(x, y));
      ctx.save();
      ctx.translate(sOffset.x, sOffset.y);
      renderer.renderAutotile(autotile[autotileIndex], ctx);
      ctx.restore();
    }
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) {
    r = w / 2;
  }

  if (h < 2 * r) {
    r = h / 2;
  }

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawAutotileRectangle(renderer, rect, autotile, ctx) {
  var g = new grid.Grid(rect.width, rect.height);
  g.fill(true);

  var sOffset = renderer.toScreenCoords(
      new geometry.Vector2(rect.left, rect.top));

  ctx.save();
  ctx.translate(sOffset.x, sOffset.y);
  drawAutotileGrid(renderer, g, autotile, ctx);
  ctx.restore();
}

export function getActorSpriteNames(actor) {
  var names = [["body", actor.gender, actor.body].join(".")];

  /*if (actor.facial !== null) {
    names.push(["facial", actor.gender, actor.facial].join("."));
  }

  if (actor.hair !== null) {
    names.push(["hair", actor.gender, actor.hair].join("."));
  }

  [].push.apply(names, [
      actor.headItem,
      actor.torsoItem,
      actor.legsItem,
      actor.feetItem,
      actor.weapon
  ]
      .filter((item) => item !== null)
      .map((item) => ["equipment", actor.gender, item.type].join(".")));*/

  return names;
}

class GraphicsRendererVisitor extends entities.EntityVisitor {
  constructor(renderer, me, ctx, pass) {
    this.renderer = renderer;
    this.me = me;
    this.ctx = ctx;
    this.pass = pass;
  }

  visitEntity(entity) {
    if (this.pass === "illumination") {
      return;
    }

    // @ifdef DEBUG
    if (this.renderer.debug) {
      this.ctx.save();
      this.ctx.fillStyle = "rgba(0, 0, 255, 0.25)";
      this.ctx.strokeStyle = "rgba(0, 0, 255, 0.75)";

      var sOffset = this.renderer.toScreenCoords(new geometry.Vector2(
          entity.bbox.left, entity.bbox.top));
      var sSize = this.renderer.toScreenCoords(new geometry.Vector2(
          entity.bbox.width, entity.bbox.height));
      this.ctx.translate(sOffset.x, sOffset.y);
      this.ctx.fillRect(0, 0, sSize.x, sSize.y);
      this.ctx.strokeRect(0, 0, sSize.x, sSize.y);
      this.ctx.fillStyle = "rgba(0, 0, 255, 0.75)";
      this.ctx.font = "12px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText("(id: " + entity.id + ")", sSize.x / 2, sSize.y / 2);
      this.ctx.restore();
    }
    // @endif

    super.visitEntity(entity);
  }

  visitActor(entity) {
    var state = entity.isMoving ? "walking" :
                "standing";

    var elapsed = this.renderer.elapsed * entity.getSpeed();

    var direction = entity.direction == entities.Directions.N ? "n" :
                    entity.direction == entities.Directions.W ? "w" :
                    entity.direction == entities.Directions.S ? "s" :
                    entity.direction == entities.Directions.E ? "e" :
                    null;

    var spriteNames = getActorSpriteNames(entity);

    switch (this.pass) {
      case "albedo":
        spriteNames.forEach((name) => {
            sprites[name][state][direction]
                .render(this.renderer.resources, this.ctx, elapsed);
        });
        break;

      case "xray":
        spriteNames.forEach((name) => {
            sprites[name][state][direction]
                .render(this.renderer.resources, this.ctx, elapsed);
        });
        break;

      case "underlay":
        var size = this.renderer.toScreenCoords(entity.bbox.getSize());

        // Render name card.
        this.ctx.save();
        this.ctx.translate(0, size.y + 4);

        this.ctx.font = "12px \"Roboto Condensed\"";

        var baseWidth = this.ctx.measureText(entity.name).width;
        var width = baseWidth + 8;

        this.ctx.translate(-width / 2 + size.x / 2, 0);

        var accentColor = chroma(colors.makeColorForString(entity.name))
            .darken(10).hex();

        this.ctx.textBaseline = "middle";

        roundedRect(this.ctx, 0, -2, width, 16 + 4, 2);
        this.ctx.fillStyle = accentColor;
        this.ctx.fill();

        roundedRect(this.ctx, 0, 16, Math.floor(entity.health / 100 * width), 2,
                    2);
        this.ctx.fillStyle = "#f77";
        this.ctx.fill();

        this.ctx.fillStyle = "#fff";
        this.ctx.fillText(entity.name, 4, 8);

        this.ctx.restore();

        break;
    }

    super.visitActor(entity);
  }

  visitDrop(entity) {
    if (this.pass === "albedo") {
      sprites[["item", entity.item.type].join(".")]
          .render(this.renderer.resources, this.ctx, this.renderer.elapsed);
    }

    super.visitDrop(entity);
  }

  visitTree(entity) {
    if (this.pass === "albedo") {
      sprites[["tree", entity.species, entity.getGrowthStageName()].join(".")]
          .render(this.renderer.resources, this.ctx, this.renderer.elapsed);
    }

    super.visitTree(entity);
  }

  visitBuilding(entity) {
    this.ctx.save();

    var doorLocation = (new geometry.Vector3(1, 1, 0))
        .offset(entities.getDirectionVector(entity.doorLocation));
    var doorSOffset = this.renderer.toScreenCoords(doorLocation);

    var drawExterior = true;
    var drawInterior = false;

    var t = 0;
    if (this.me.getBounds().intersect(entity.getBounds()) !== null) {
      var overlap = this.me.getBounds().intersect(entity.getBounds());
      t = overlap.height + overlap.width - 1;

      drawExterior = t !== 1;
      drawInterior = t !== 0;
    }

    switch (this.pass) {
      case "terrain":
        if (drawInterior) {
          var entityBuffers = this.renderer.entityBuffers[entity.id];

          if (!objects.has(entityBuffers, "terrainAlbedo")) {
            // Draw some stuff to the entity buffer.
            var terrainCanvas = document.createElement("canvas");
            entityBuffers.terrainAlbedo = terrainCanvas;

            var terrainCanvasSize =
                this.renderer.toScreenCoords(entity.bbox.getSize());
            terrainCanvas.width = terrainCanvasSize.x;
            terrainCanvas.height = terrainCanvasSize.y;

            var terrainContext = this.renderer.prepareContext(terrainCanvas);

            drawAutotileRectangle(this.renderer,
                                  new geometry.Rectangle(0, 0,
                                                         entity.bbox.width,
                                                         entity.bbox.height),
                                  sprites["tile.dirt"],
                                  terrainContext);
          }

          var sOffset = this.renderer.toScreenCoords(entity.bbox.getLeftTop());
          this.ctx.drawImage(entityBuffers.terrainAlbedo, sOffset.x, sOffset.y);
        }

        break;

      case "albedo":
        if (drawExterior) {
          var entityBuffers = this.renderer.entityBuffers[entity.id];

          if (!objects.has(entityBuffers, "wallAlbedo")) {
            // Draw some stuff to the entity buffer.
            var wallCanvas = document.createElement("canvas");
            entityBuffers.wallAlbedo = wallCanvas;

            var wallCanvasSize =
                this.renderer.toScreenCoords(
                    new geometry.Vector2(entity.bbox.width, 2));
            wallCanvas.width = wallCanvasSize.x;
            wallCanvas.height = wallCanvasSize.y;

            var wallContext = this.renderer.prepareContext(wallCanvas);
            drawAutotileRectangle(this.renderer,
                                  new geometry.Rectangle(0, 0,
                                                         entity.bbox.width, 2),
                                  sprites["building.wall"],
                                  wallContext);
          }

          this.ctx.globalAlpha = 1 - t;

          var sOffset = this.renderer.toScreenCoords(
              new geometry.Vector2(entity.bbox.left,
                                   entity.bbox.getBottom() - 2));
          this.ctx.drawImage(entityBuffers.wallAlbedo, sOffset.x, sOffset.y);

          var halfHeight = this.renderer.toScreenCoords(
              new geometry.Vector2(0, 1)).y / 2;

          if (entity.doorLocation === 2) {
            this.ctx.fillStyle = "black";
            this.ctx.fillRect(doorSOffset.x, doorSOffset.y,
                              GraphicsRenderer.TILE_SIZE, GraphicsRenderer.TILE_SIZE);
          }

          this.ctx.translate(0, -halfHeight);
          sprites["building.red_roof_1"].render(this.renderer.resources, this.ctx,
                                                this.renderer.elapsed);
        }
        break;

      case "illumination":
        if (drawInterior) {
          // Compute interior illumination mask by excluding portions of the
          // albedo buffer.
          var buildingInteriorIllumination =
              this.renderer.ensureBackBuffer("buildingInteriorIllumination");

          var buildingInteriorIlluminationCtx =
              this.renderer.prepareContext(buildingInteriorIllumination);
          buildingInteriorIlluminationCtx.clearRect(0, 0,
                                                    this.renderer.canvas.width,
                                                    this.renderer.canvas.height);
          buildingInteriorIlluminationCtx.drawImage(
              this.renderer.ensureBackBuffer("entity"), 0, 0);

          var sOffset = this.renderer.toScreenCoords(entity.location);

          buildingInteriorIlluminationCtx.save();
          buildingInteriorIlluminationCtx.globalCompositeOperation =
              "source-out";

          var sOffset2 = this.renderer.toScreenCoords(entity.location.offset(
              this.renderer.leftTop.negate()));
          buildingInteriorIlluminationCtx.translate(sOffset2.x, sOffset2.y);

          var sBboxOffset = this.renderer.toScreenCoords(new geometry.Vector2(
              entity.bbox.left, entity.bbox.top));
          var sBboxSize = this.renderer.toScreenCoords(new geometry.Vector2(
              entity.bbox.width, entity.bbox.height));

          buildingInteriorIlluminationCtx.fillStyle = "rgb(255, 255, 255)";
          buildingInteriorIlluminationCtx.fillRect(
              sBboxOffset.x, sBboxOffset.y, sBboxSize.x, sBboxSize.y);
          buildingInteriorIlluminationCtx.restore();

          var viewportOffset = this.renderer.toScreenCoords(
              this.renderer.leftTop);

          this.ctx.drawImage(buildingInteriorIllumination,
                             viewportOffset.x - sOffset.x,
                             viewportOffset.y - sOffset.y);
        }
        break;
    }

    this.ctx.restore();

    super.visitBuilding(entity);
  }
}
GraphicsRenderer.TILE_SIZE = 32;
