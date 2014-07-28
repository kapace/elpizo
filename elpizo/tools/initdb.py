import logging
from lxml import etree
from itertools import product
import json
import sys

from elpizo import make_application
from elpizo.models import Base, User, Player, Realm, Region, Actor, ActorKind
from elpizo.tools import mapgen


def initialize_schema(app):
  engine = app.sqla_session.bind

  Base.metadata.drop_all(bind=engine)
  Base.metadata.create_all(bind=engine)
  logging.info("Initialized database schema.")


def initialize_actor_kinds(app):
  for kind in ["human", "cow"]:
    actor_kind = ActorKind(name=kind)
    app.sqla_session.add(actor_kind)
  app.sqla_session.commit()

  logging.info("Created actor kinds.")


def initialize_realm(app):
  realm = Realm(name="Windvale", width=128, height=128)
  app.sqla_session.add(realm)

  logging.info("Created realm.")

  for ary in range(realm.height // Region.SIZE):
    for arx in range(realm.width // Region.SIZE):
      region = Region(arx=arx, ary=ary, realm=realm,
                      corners=[0] * ((realm.height + 1) * (realm.width + 1)))
      app.sqla_session.add(region)
  logging.info("Created realm regions.")

  app.sqla_session.commit()
  return realm


def initialize_players(app, realm):
  human = app.sqla_session.query(ActorKind) \
      .filter(ActorKind.name == "human") \
      .one()

  victor_hugo = User(name="victor_hugo")
  app.sqla_session.add(victor_hugo)

  valjean = Player(user=victor_hugo,
                   actor=Actor(name="Valjean", kind=human, variant=1, level=1,
                               hp=100, mp=100, xp=100,
                               realm=realm, arx=0, ary=0, rx=0, ry=0))
  app.sqla_session.add(valjean)

  dumas = User(name="dumas")
  app.sqla_session.add(dumas)

  athos = Player(user=dumas,
                 actor=Actor(name="Athos", kind=human, variant=1, level=1,
                             hp=100, mp=100, xp=10,
                             realm=realm, arx=0, ary=0, rx=0, ry=0))
  app.sqla_session.add(athos)

  aramis = Player(user=dumas,
                  actor=Actor(name="Aramis", kind=human, variant=1, level=1,
                              hp=100, mp=100, xp=10,
                              realm=realm, arx=0, ary=0, rx=0, ry=0))
  app.sqla_session.add(aramis)

  porthos = Player(user=dumas,
                   actor=Actor(name="Porthos", kind=human, variant=1, level=1,
                               hp=100, mp=100, xp=10,
                               realm=realm, arx=0, ary=0, rx=0, ry=0))
  app.sqla_session.add(porthos)

  app.sqla_session.commit()

  logging.info("Created test users.")


def main():
  if len(sys.argv) != 2:
    sys.stderr.write("usage: {} <mapgen2 xml>\n".format(sys.argv[0]))
    sys.exit(1)

  app = make_application()

  input("This will DELETE ALL DATA! Press ENTER to continue or CTRL+C to abort. ")

  initialize_schema(app)
  initialize_actor_kinds(app)
  realm = initialize_realm(app)
  initialize_players(app, realm)


if __name__ == "__main__":
  main()
