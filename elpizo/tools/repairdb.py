import logging

from elpizo import server
from elpizo.server import store
from elpizo.util import green


logger = logging.getLogger(__name__)


def repair(app):
  input("Please MAKE SURE that no other instances of the server are running. "
        "Proceeding will BREAK THE LOCK! Press ENTER to continue or Ctrl+C "
        "to abort. ")

  app.store.unlock()
  app.store.lock()

  logger.info("Checking for entities requiring de-indexing.")
  for realm in app.store.realms.load_all():
    for region in realm.regions.load_all():
      for entity in list(region.entities):
        if entity.bounds.intersect(region.bounds) is None:
          logger.warn(
              "Region %r indexes entity %s, but entity's bounds are %r. " +
              "De-indexing entity.",
              region.location, entity.id, entity.bounds)
          region.entities.remove(entity)

  logger.info("Checking for entities requiring indexing.")
  for entity in app.store.entities.load_all():
    for region in entity.regions:
      if entity not in region.entities:
        logger.warn(
            "Entity %s is bounded by region %r, but the entity was not " +
            "indexed in the region. Indexing entity.",
            region.location, entity.id)
        entity.region.entities.add(entity)


def main():
  server.Application(server.make_config_parser().parse_args()).once(repair)


if __name__ == "__main__":
  main()
