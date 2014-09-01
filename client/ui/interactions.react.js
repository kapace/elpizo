/** @jsx React.DOM */

module React from "react";

module input from "client/util/input";

export var InteractionsMenu = React.createClass({
  getInitialState: function () {
    return {
      actionIndex: [0, 0]
    };
  },

  componentDidMount: function () {
    this.getDOMNode().querySelector("input[type='radio']:checked").focus();
  },

  onSubmit: function (e) {
    e.preventDefault();
    this.runAction(this.state.actionIndex);
  },

  onKeyDown: function (e) {
    if (e.keyCode === input.Key.Z) {
      this.onSubmit(e);
    } else if (e.keyCode === input.Key.ESCAPE) {
      this.dismiss();
    }
  },

  setAction: function (actionIndex) {
    this.setState({actionIndex: actionIndex});
  },

  runAction: function (actionIndex) {
    if (actionIndex !== null) {
      var [i, j] = actionIndex;
      var action = this.props.me.interactions[i].actions[j];
      action.f(this.props.protocol, this.props.me, this.props.log);
    }
    this.dismiss();
  },

  dismiss: function () {
    this.props.me.interactions = [];
  },

  render: function () {
    var interactions = this.props.me.interactions.map((group, i) => {
      var actions = group.actions.map((action, j) => {
        var checked = false;
        if (this.state.actionIndex !== null) {
          var [currentI, currentJ] = this.state.actionIndex;
          checked = currentI === i && currentJ === j;
        }

        return <li key={j}>
          <input type="radio" name="item" id={"interactions-menu-" + i + "." + j}
                 onChange={this.setAction.bind(this, [i, j])}
                 checked={checked} />
          <label htmlFor={"interactions-menu-" + i + "." + j}
                 onClick={this.runAction.bind(this, [i, j])}>
            {action.title}
          </label>
        </li>
      });

      return <li key={i} className="action-group">
        <div className="heading">{group.entity.getTitle()}</div>
        <ul>{actions}</ul>
      </li>;
    });

    return <div className="center">
      <form className="interactions-menu" onSubmit={this.onSubmit}
            onKeyDown={this.onKeyDown}>
        <div className="content">
          <ul>{interactions}</ul>
          <input type="radio" name="item" id="interactions-menu-cancel"
                 onChange={this.setAction.bind(this, null)}
                 checked={this.state.actionIndex === null} />
          <label htmlFor="interactions-menu-cancel" className="cancel"
                 onClick={this.runAction.bind(this, null)}>Cancel</label>
          <button type="submit" tabIndex="-1"></button>
        </div>
      </form>
    </div>;
  }
});
