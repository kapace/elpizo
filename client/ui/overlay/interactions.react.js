/** @jsx React.DOM */

module Modernizr from "browsernizr";
module React from "react/react-with-addons";

module input from "client/util/input";

export var InteractionsMenu = React.createClass({
  getInitialState: function () {
    return {
      actionIndex: null
    };
  },

  onSubmit: function (e) {
    e.preventDefault();
    this.runAction(this.state.actionIndex);
  },

  setAction: function (actionIndex) {
    this.setState({actionIndex: actionIndex});
  },

  runAction: function (actionIndex) {
    if (actionIndex !== null) {
      var [i, j] = actionIndex;
      var action = this.props.interactions[i].actions[j];
      action.f(this.props.game.protocol, this.props.me, this.props.game.log);
    }
    this.dismiss();
  },

  dismiss: function () {
    this.props.renderer.removeComponent("interactions");
  },

  render: function () {
    var renderer = this.props.renderer;

    var position = renderer.toScreenCoords(this.props.location);

    var style = {};
    style[Modernizr.prefixed("transform")] =
      "translate(" + (position.x - 32 + "px") + "," +
                     (position.y + 32 + 8 + "px") + ")";

    var interactions = this.props.entities.map((entity, i) => {
      var actions = entity.getInteractions(this.props.me).map((action, j) => {
        var checked = false;
        if (this.state.actionIndex !== null) {
          var [currentI, currentJ] = this.state.actionIndex;
          checked = currentI === i && currentJ === j;
        }

        return <li key={j}>
          <input type="radio" name="item"
                 id={"interactions-menu-" + i + "." + j}
                 onChange={this.setAction.bind(this, [i, j])}
                 checked={checked} />
          <label htmlFor={"interactions-menu-" + i + "." + j}
                 onClick={this.runAction.bind(this, [i, j])}>
            {action.title}
          </label>
        </li>
      });

      return <li key={i} className="action-group">
        <div className="heading">{entity.getTitle()}</div>
        <ul>{actions}</ul>
      </li>;
    });

    return <div style={style}>
      <form className="interactions-menu transitionable"
            onSubmit={this.onSubmit}>
        <div className="content">
          <ul>{interactions}</ul>
          <input type="radio" name="item" id="interactions-menu-cancel"
                 onChange={this.setAction.bind(this, null)} />
          <label htmlFor="interactions-menu-cancel" className="cancel"
                 onClick={this.runAction.bind(this, null)}>Cancel</label>
          <button type="submit" tabIndex="-1"></button>
        </div>
      </form>
    </div>;
  }
});
