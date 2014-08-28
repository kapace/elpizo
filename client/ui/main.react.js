/** @jsx React.DOM */

module React from "react";

module log from "client/ui/log.react";
module debug from "client/ui/debug.react";
module loading from "client/ui/loading.react";
module overlay from "client/ui/overlay/overlay.react";

export var UI = React.createClass({
  onKeyDown: function (e) {
    e.stopPropagation();
  },

  render: function () {
    // We copy the log because we need to know if it changed length.
    return <div className="ui-root" onKeyDown={this.onKeyDown}>
      <overlay.Overlay game={this.props.game} />
      <log.Log game={this.props.game} log={this.props.game.log.slice()} />
      <debug.Debug game={this.props.game} />
      <loading.Loading game={this.props.game} />
    </div>;
  }
});
