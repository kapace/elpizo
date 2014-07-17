import logging
import os
import pika

from tornado.web import Application, StaticFileHandler, RequestHandler
from pika.adapters.tornado_connection import TornadoConnection
from sockjs.tornado import SockJSRouter
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from .models import Base
from .net import makeMultiplexConnection

from .chat import CHANNELS as CHAT_CHANNELS
from .explore import CHANNELS as EXPLORE_CHANNELS, \
                     ROUTES as EXPLORE_ROUTES
from .player import ROUTES as PLAYER_ROUTES


class SockJSRouter(SockJSRouter):
  def __init__(self, application, *args, **kwargs):
    self.application = application
    super().__init__(*args, **kwargs)


class BackdoorAuthHandler(RequestHandler):
  def get(self):
    from .models import User, Player

    user_name = self.get_argument("user")
    player_name = self.get_argument("player")

    player = self.application.sqla_session.query(Player) \
        .filter((Player.name == player_name) &
                (Player.user_id == User.id) &
                (User.name == user_name)) \
        .one()

    user = player.user
    user.current_player = player

    self.application.sqla_session.commit()

    self.set_secure_cookie("elpizo_user", str(user.id))
    self.finish("ok, set your elpizo_user to {id} ({user_name}, {player_name})".format(
        id=user.id,
        user_name=user.name,
        player_name=user.current_player.name))


class Application(Application):
  def __init__(self, **kwargs):
    routes = [
      (r"/static/(.*)", StaticFileHandler, {
          "path": os.path.join(os.path.dirname(__file__), "static")
      })
    ]

    channels = {}
    channels.update(CHAT_CHANNELS)
    channels.update(EXPLORE_CHANNELS)

    routes += PLAYER_ROUTES
    routes += EXPLORE_ROUTES

    routes += SockJSRouter(self, makeMultiplexConnection(channels),
                           "/events").urls

    if kwargs["debug"]:
      logging.warning("""

WARNING! WARNING! WARNING! WARNING! WARNING! WARNING! WARNING! WARNING! WARNING!

Backdoor auth route is ENABLED. This is a MAJOR SECURITY RISK! Please ensure
this is switched OFF in production!

WARNING! WARNING! WARNING! WARNING! WARNING! WARNING! WARNING! WARNING! WARNING!
""")
      routes += [
        (r"/_backdoor_auth", BackdoorAuthHandler)
      ]

    super().__init__(routes, **kwargs)

    self.amqp = TornadoConnection(pika.ConnectionParameters(
        self.settings["amqp_server"]), stop_ioloop_on_close=False)

    engine = create_engine(self.settings["dsn"])
    Session = sessionmaker(bind=engine)

    self.sqla_session = Session()
