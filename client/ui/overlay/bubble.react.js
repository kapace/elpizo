/** @jsx React.DOM */

module Modernizr from "browsernizr";
module React from "react/react-with-addons";

module colors from "client/util/colors";

export var Bubble = React.createClass({
  render: function () {
    var entity = this.props.entity;
    var renderer = this.props.renderer;

    var position = renderer.toScreenCoords(entity.location);

    var style = {};
    style[Modernizr.prefixed("transform")] =
      "translate(" + (position.x + 16 + "px") + "," +
                     (position.y - (entity.getHeight() - 1) * 32 - 6 + "px") + ")";

    return <div style={style}>
      <div className="bubble transitionable">
        <div className="anchor">
          <div className="inner" style={{color: colors.makeColorForString(entity.name)}}>
            {this.props.text}
          </div>
        </div>
      </div>
    </div>;
  }
});
