/** @jsx React.DOM */

module React from "react/react-with-addons";

module packets from "client/protos/packets";
module colors from "client/util/colors";
module input from "client/util/input";
module objects from "client/util/objects";
module timing from "client/util/timing";

var COMMANDS = {
  // @ifdef DEBUG
  debug: (game) => {
    game.setDebug(!game.debug);

    game.log.push(InfoMessageEntry({
        text: "Debug mode " + (game.debug ? "on" : "off") + "."
    }));
  },

  deval: (game, cmd) => {
    var r;
    var evalOk = false;
    try {
      r = eval(cmd);
      evalOk = true;
    } catch (e) {
      game.log.push(<pre className="info">&lt;&lt;! {e.toString()}</pre>);
    }

    if (evalOk) {
      game.log.push(<pre className="info">&lt;&lt;&lt; {objects.repr(r)}</pre>);
    }
  },
  // @endif

  ping: (game) => {
    game.protocol.send(new packets.EchoPacket({
        payload: new Date().valueOf().toString()}));
  }
};

var Origin = React.createClass({
  render: function () {
    return <span className="origin" style={{color: colors.makeColorForString(this.props.origin)}}>
      {this.props.origin}
    </span>;
  }
});

export var ChatMessageEntry = React.createClass({
  render: function () {
    return <div className="chat">
      <Origin origin={this.props.origin} /> {this.props.text}
    </div>;
  }
});

export var StatusMessageEntry = React.createClass({
  render: function () {
    return <div className="status">
      <Origin origin={this.props.origin} /> {this.props.text}
    </div>;
  }
});

export var InfoMessageEntry = React.createClass({
  render: function () {
    return <div className="info">{this.props.text}</div>;
  }
});

export var Log = React.createClass({
  getInitialState: function () {
    return {
        pendingMessage: ""
    };
  },

  componentDidUpdate: function (prevProps, prevState) {
    if (prevProps.log.length === this.props.log.length) {
      return;
    }

    var node = this.refs.messages.getDOMNode();
    node.scrollTop = node.scrollHeight;
  },

  onKeyDown: function (e) {
    e.stopPropagation();

    if (e.keyCode === input.Key.ESCAPE) {
      this.blurChat();
    }
  },

  onChange: function (e) {
    this.setState({pendingMessage: e.target.value});
  },

  blurChat: function () {
    this.refs.text.getDOMNode().blur();
  },

  focusChat: function () {
    this.refs.text.getDOMNode().focus();
  },

  handleSubmit: function (e) {
    e.preventDefault();
    var pendingMessage = this.state.pendingMessage;
    this.setState({pendingMessage: ""});
    this.refs.text.getDOMNode().blur();

    if (pendingMessage.trim().length === 0) {
      return;
    }

    if (pendingMessage[0] === "/" && pendingMessage[1] !== "/") {
      var parts = pendingMessage.slice(1).split(/ /);
      var commandName = parts[0].trim().toLowerCase();
      var rest = parts.slice(1).join(" ").trim();

      if (!objects.has(COMMANDS, commandName)) {
        this.props.game.log.push(InfoMessageEntry({
          text: "No such command: " + commandName
        }))
      } else {
        COMMANDS[commandName](this.props.game, rest);
      }
    } else {
      pendingMessage = pendingMessage.replace(/^\/\//, "/");

      this.props.game.log.push(ChatMessageEntry({
          origin: this.props.game.me.name,
          text: pendingMessage
      }));
      this.props.game.graphicsRenderer.addChatBubble(
          this.props.game.me, pendingMessage);

      this.props.game.protocol.send(new packets.ChatPacket({
          target: "chatroom.global",
          text: pendingMessage
      }));
    }
  },

  render: function () {
    var messages = this.props.log.map((entry, i) => <li key={i}>{entry}</li>);

    return <form className="log transitionable"
                 onSubmit={this.handleSubmit}
                 onClick={this.focusChat}>
      <div className="content">
        <ul className="messages" ref="messages">
          {messages}
        </ul>
        <input type="text" onChange={this.onChange}
               value={this.state.pendingMessage}
               ref="text"
               onKeyDown={this.onKeyDown}
               placeholder="Chat message"
               maxLength="100" />
      </div>
    </form>;
  }
});
