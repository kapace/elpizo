/** @jsx React.DOM */

module Modernizr from "browsernizr";
module chroma from "chroma-js";
module React from "react/react-with-addons";

module graphicsRenderer from "client/graphics/renderer";
module colors from "client/util/colors";
module sprites from "client/assets/sprites";

var Avatar = React.createClass({
  render: function () {
    var paperdoll = graphicsRenderer.getActorSpriteNames(this.props.me).map(
      (spriteName) => {
        var sprite = sprites[spriteName].standing.s;

        var firstFrame = sprite.frames[0];
        var img = sprite.getResource(this.props.resources);

        return "url(\"" + img.src + "\") " +
               -firstFrame.x + "px " +
               -firstFrame.y + "px " +
               "no-repeat";
      }).reverse().join(", ");

    return <div className="avatar" style={{background: paperdoll}} />;
  }
});

var Health = React.createClass({
  render: function () {
    return <div className="health">
      <div className="value"
           style={{width: (this.props.health / this.props.max * 100) + "%"}}>
      </div>
      <div className="caption">{this.props.health} / {this.props.max}</div>
    </div>;
  }
});

export var Stats = React.createClass({
  toggleInventory: function () {
    this.props.me.showInventory = !this.props.me.showInventory;
  },

  render: function () {
    var me = this.props.me;
    var fill = colors.makeColorForString(me.name);
    var emboss = chroma(fill).darken(10).hex();

    var style = {};
    style["backgroundColor"] = colors.makeColorForString(me.name);
    style[Modernizr.prefixed("boxShadow")] = "0 4px 0 " + emboss + ", 0 8px 20px rgba(0, 0, 0, 0.5)";

    return <div className="stats transitionable" style={style}>
      <div className="content">
        <button onClick={this.toggleInventory}
                className={me.showInventory ? "active" : ""}>
          <Avatar resources={this.props.resources} me={me} />
        </button>
        <div className="info">
          <div className="heading">{me.name}</div>
          <Health health={me.health} max={100} />
        </div>
      </div>
    </div>;
  }
});
