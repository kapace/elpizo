/** @jsx React.DOM */

module Modernizr from "browsernizr";
module React from "react/react-with-addons";

export var Overlay = React.createClass({
  render: function () {
    var realm = this.props.game.realm;
    var renderer = this.props.game.graphicsRenderer;

    var position = renderer.toScreenCoords(renderer.leftTop);

    var components = Object.keys(renderer.components).map((k) =>
        renderer.components[k]);

    var style = {};
    style[Modernizr.prefixed("transform")] = "translate(" +
      (-position.x + "px") + "," +
      (-position.y + "px") + ")";

    return <div className="overlay" style={style}>
      <React.addons.CSSTransitionGroup className="components"
                                       transitionName="slide"
                                       component={React.DOM.div}>
        {components}
      </React.addons.CSSTransitionGroup>
    </div>;
  }
});
