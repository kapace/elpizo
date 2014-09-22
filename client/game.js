import "browsernizr/lib/prefixed";
import "browsernizr/test/css/flexbox";
import "browsernizr/test/websockets/binary";
import "browsernizr/test/audio";
import "browsernizr/test/audio/webaudio";

module Modernizr from "browsernizr";

module events from "events";
module React from "react/react-with-addons";
module promise from "es6-promise";
module querystring from "querystring";

module graphics from "client/graphics";
module handlers from "client/handlers";
module packets from "client/protos/packets";
module net from "client/util/net";
module input from "client/util/input";
module objects from "client/util/objects";
module resources from "client/util/resources";
module geometry from "client/models/geometry";
module realm from "client/models/realm";
module ui from "client/ui/main.react";
module logUi from "client/ui/log.react";

function waitFor(emitter, event) {
  return new promise.Promise((resolve, reject) =>
    emitter.once(event, resolve));
}

var FEATURES = {
    "CSS3 flexible box layout": Modernizr.flexbox,
    "Binary WebSockets": Modernizr.websocketsbinary,
    "Web Audio": Modernizr.webaudio,
    "Opus audio codec": Modernizr.audio.opus
};

export class Game extends events.EventEmitter {
  constructor(parent) {
    super();
    this.log = [];

    this.uiRoot = document.createElement("div");
    parent.appendChild(this.uiRoot);
    this.uiRootComponent = ui.UI({
        game: this
    });

    // Disable the right-click menu on the root window. Not for anything
    // nefarious, we just want to render our own right-click menus.
    window.oncontextmenu = (e) => e.preventDefault();

    window.onerror = this.onError.bind(this);
    this.lastError = null;

    this.realm = null;
    this.me = null;

    this.running = false;

    this.resources = new resources.Resources();

    this.inputState = new input.InputState(window);

    this.graphicsRenderer = new graphics.GraphicsRenderer(this.resources,
                                                          parent);

    // Render the React components once to display the resource loading screen.
    this.renderReact();

    var qs = querystring.parse(window.location.search.substring(1));

    if (!qs.bypassFeatureDetect) {
      this.detectFeatures();
    }

    var encodedToken = atob(qs.token || "");
    this.token = new Uint8Array(encodedToken.length);
    [].forEach.call(encodedToken, (c, i) => {
      this.token[i] = c.charCodeAt(0);
    });

    this.graphicsRenderer.on("refit", this.onRefit.bind(this));
    this.graphicsRenderer.on("viewportChange", this.onViewportChange.bind(this));
    this.graphicsRenderer.on("click", this.onClick.bind(this));

    // @ifdef DEBUG
    this.setDebug(qs.debug === "on");
    // @endif
  }

  onError(msg, file, lineno, colno, e) {
    try {
      this.setLastError(msg.toString());
    } catch (e) {
      // Something has gone horribly wrong, bail out!
      console.error(e.stack);
    }
  }

  onClick(pos) {
    if (this.me === null) {
      return;
    }

    this.me.navigatingLocation = pos.map(Math.floor);
  }

  detectFeatures() {
    var unavailable = Object.keys(FEATURES).filter((k) => !FEATURES[k]);

    if (unavailable.length > 0) {
      throw new Error("Some required browser features are not available.\n" +
        "\n" +
        unavailable.map((feature) => " * " + feature).join("\n") + "\n" +
        "\n" +
        "We suggest that you upgrade to a more modern browser.");
    }
  }

  setLastError(e) {
    if (this.protocol) {
      this.protocol.transport.close();
    }
    this.lastError = e;
    this.renderReact();
  }

  // @ifdef DEBUG
  setDebug(v) {
    this.debug = v;
    this.graphicsRenderer.setDebug(v);

    var qs = querystring.parse(window.location.search.substring(1));

    if (!this.debug) {
      delete qs.debug;
    } else {
      qs.debug = "on";
    }

    var path = "/";
    var stringified = querystring.stringify(qs);
    if (stringified.length > 0) {
      path += "?" + stringified;
    }

    window.history.replaceState({}, null, path);
  }
  // @endif

  onRefit(bounds) {
    if (this.me !== null) {
      this.graphicsRenderer.center(this.me.location);
    }
  }

  onViewportChange() {
    if (this.realm === null) {
      return;
    }

    var bounds = this.graphicsRenderer.getCacheBounds();

    var toRemove = {};
    var toAdd = {};

    for (var y = this.clientBounds.top;
         y < this.clientBounds.getBottom();
         y += realm.Region.SIZE) {
      for (var x = this.clientBounds.left;
           x < this.clientBounds.getRight();
           x += realm.Region.SIZE) {
        var key = [x, y].join(",");
        toRemove[key] = true;
      }
    }

    for (var y = bounds.top;
         y < bounds.getBottom();
         y += realm.Region.SIZE) {
      for (var x = bounds.left;
           x < bounds.getRight();
           x += realm.Region.SIZE) {
        var key = [x, y].join(",");

        if (objects.has(toRemove, key)) {
          delete toRemove[key];
        } else {
          toAdd[key] = true;
        }
      }
    }

    Object.keys(toRemove).forEach((k) => {
      var [x, y] = k.split(",");
      x = parseInt(x, 10);
      y = parseInt(y, 10);

      var location = new geometry.Vector2(x, y);

      if (!this.realm.getExtendedBounds().contains(new geometry.Rectangle(
          location.x, location.y, realm.Region.SIZE, realm.Region.SIZE))) {
        return;
      }

      var region = this.realm.getRegionAt(location);
      if (region !== null) {
        this.realm.removeRegion(region);
      }
      this.protocol.send(new packets.UnsightPacket({
          location: location
      }));
    });

    Object.keys(toAdd).forEach((k) => {
      var [x, y] = k.split(",");
      x = parseInt(x, 10);
      y = parseInt(y, 10);

      var location = new geometry.Vector2(x, y);

      if (!this.realm.getExtendedBounds().contains(new geometry.Rectangle(
          location.x, location.y, realm.Region.SIZE, realm.Region.SIZE))) {
        return;
      }

      this.protocol.send(new packets.SightPacket({
          location: location
      }));
    });

    this.clientBounds = bounds;
  }

  onTransportOpen() {
    this.go();
  }

  onTransportClose() {
    this.stop();
  }

  loadFromManifest(manifest) {
    var bundle = {};

    Object.keys(manifest).forEach(function (fileName) {
      var type = manifest[fileName];
      bundle[fileName] = resources.Resources.TYPES[type]("assets/" + fileName);
    });

    this.resources.on("resourceLoaded", () => {
      this.renderReact();
    });

    this.resources.loadBundle(bundle).then(() => {
      // Render the React components once.
      this.renderReact();

      this.start();
    }, (e) => {
      this.setLastError(e);
    });
  }

  setRealm(realm) {
    this.realm = realm;
  }

  update(dt) {
    if (this.inputState.stick(input.Key.RETURN) ||
        this.inputState.stick(input.Key.T)) {
      window.setTimeout(() => this.uiRoot.querySelector(".log input").focus(),
                        0);
    }

    // Update the realm first.
    if (this.realm !== null) {
      this.realm.update(dt);
    }

    // Handle avatar updates.
    if (this.me !== null) {
      this.me.updateAsAvatar(dt, this.inputState, this.protocol);
      this.graphicsRenderer.center(this.me.location);
    }
  }

  render(dt) {
    if (this.realm !== null) {
      this.graphicsRenderer.render(this.realm, this.me, dt);
    }
  }

  renderReact() {
    React.renderComponent(this.uiRootComponent, this.uiRoot);
  }

  startUpdating() {
    var startTime = new Date().valueOf() / 1000;
    var cont = () => {
      var currentTime = new Date().valueOf() / 1000;
      this.update(currentTime - startTime);
      startTime = currentTime;

      if (this.running) {
        window.setTimeout(cont, 1 / 60);
      }
    };
    cont();
  }

  startRendering() {
    var startTime = new Date().valueOf() / 1000;

    var cont = () => {
      var currentTime = new Date().valueOf() / 1000;

      this.render(currentTime - startTime);
      this.renderReact();

      startTime = currentTime;

      if (this.running) {
        window.requestAnimationFrame(cont);
      }
    };
    cont();
  }

  start() {
    this.protocol = new net.Protocol(this, new net.Transport(
        "ws://" + window.location.host + "/socket"));
    handlers.install(this);

    this.protocol.transport.on("open", this.onTransportOpen.bind(this));
    this.protocol.transport.on("close", this.onTransportClose.bind(this));
  }

  go() {
    this.clientBounds = new geometry.Rectangle(0, 0, 0, 0);
    this.protocol.send(new packets.HelloPacket({
        token: this.token || ""
    }));

    this.running = true;
    this.graphicsRenderer.refit();
    this.startUpdating();
    this.startRendering();
  }

  stop() {
    this.renderReact();
    this.running = false;
  }
}
