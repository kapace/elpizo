/** @jsx React.DOM */

module React from "react";

export var Loading = React.createClass({
  render: function () {
    if (this.props.game.running) {
      return null;
    }

    var body;
    if (this.props.game.protocol.lastError !== null) {
      body = <div className="error">
        <div>
          <h1>:(</h1>
          <p>An unexpected error has occurred.</p>
          <pre>{this.props.game.protocol.lastError}</pre>
          <p>Your session has been closed. Please try logging in again.</p>
        </div>
      </div>;
    } else {
      body = <div className="spinner">
        <div className="cube1" />
        <div className="cube2" />
      </div>;
    }

    return <div className="loading">{{body}}</div>;
  }
});
