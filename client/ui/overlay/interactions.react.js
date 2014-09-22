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
      var [k, j] = actionIndex;
      var action = this.props.interactions[k].actions[j];
      action.f(this.props.protocol, this.props.me, this.props.log);
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

    var interactions = Object.keys(this.props.interactions).map((k) => {
      var group = this.props.interactions[k];

      var actions = group.actions.map((action, j) => {
        var checked = false;
        if (this.state.actionIndex !== null) {
          var [currentK, currentJ] = this.state.actionIndex;
          checked = currentK === k && currentJ === j;
        }

        return <li key={j}>
          <input type="radio" name="item"
                 id={"interactions-menu-" + k + "." + j}
                 onChange={this.setAction.bind(this, [k, j])}
                 checked={checked} />
          <label htmlFor={"interactions-menu-" + k + "." + j}
                 onClick={this.runAction.bind(this, [k, j])}>
            {action.title}
          </label>
        </li>
      });

      return <li key={k} className="action-group">
        <div className="heading">{group.entity.getTitle()}</div>
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
