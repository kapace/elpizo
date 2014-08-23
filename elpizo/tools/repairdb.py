import logging

from elpizo import server
from elpizo.server import store
from elpizo.server import config
from elpizo.util import green


def repair(server):
  input("Please MAKE SURE that no other instances of the server are running. "
        "Proceeding will BREAK THE LOCK! Press ENTER to continue or Ctrl+C "
        "to abort. ")

  green.await_coro(server.store.redis.delete([
      store.GameStore._G_LOCK.encode("utf-8")]))
  logging.info("Lock broken.")

  server.store.lock()


def main():
  server.Server(config.make_parser().parse_args()).once(repair)


if __name__ == "__main__":
  main()