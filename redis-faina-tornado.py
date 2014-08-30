#!/usr/bin/env python

import os
import logging

import tornado
import tornado.ioloop
import tornado.web
import tornado.websocket
import tornado.httpserver
import importlib
faina = importlib.import_module("redis-faina.redis-faina")
from tornadoredis import client
import ujson

# ugly monkey patch for tornado redis
client.REPLY_MAP.update({
    "MONITOR": client.make_reply_assert_msg('OK')
})


def monitor(self, callback=None, *args, **kwargs):
    self.execute_command("MONITOR", callback=callback, *args, **kwargs)


@tornado.gen.engine
def start_monitoring(self, callback=None):
    while True:
        data = yield tornado.gen.Task(self.connection.readline)
        callback(data)

client.Client.monitor = monitor
client.Client.start_monitoring = start_monitoring

redis = client.Client()

@tornado.gen.engine
def _info_collector():
    data = yield tornado.gen.Task(redis.info)
    RedimontorHandler.send_info(data)


class RedimontorHandler(tornado.websocket.WebSocketHandler):
    waiters = set()
    stats = faina.StatCounter()
    redis = client.Client()

    def __init__(self, *args, **kwargs):
        super(RedimontorHandler, self).__init__(*args, **kwargs)
        self._start_monitoring()

    @tornado.gen.engine
    def _start_monitoring(self):
        yield tornado.gen.Task(RedimontorHandler.redis.monitor)
        RedimontorHandler.redis.start_monitoring(RedimontorHandler.stat_updates)

    def open(self):
        RedimontorHandler.waiters.add(self)
        RedimontorHandler.send_stats()

    def on_close(self):
        RedimontorHandler.waiters.remove(self)

    @classmethod
    def stat_updates(cls, event):
        #print event[1:-1]
        cls.stats.process_input([event[1:-1]])

    @classmethod
    def send_stats(cls):
        #print event[1:-1]
        for waiter in cls.waiters:
            try:
                waiter.write_message(ujson.dumps({
                    "type": "stats",
                    "data": {
                        "overall" : RedimontorHandler.stats._general_stats(),
                        "prefixes": RedimontorHandler.stats._top_n(RedimontorHandler.stats.prefixes),
                        "keys"    : RedimontorHandler.stats._top_n(RedimontorHandler.stats.keys),
                        "commands": RedimontorHandler.stats._top_n(RedimontorHandler.stats.commands),
                        "times"   : RedimontorHandler.stats._time_stats(sorted(RedimontorHandler.stats.times)),
                        "heaviest": RedimontorHandler.stats._heaviest_commands(RedimontorHandler.stats.times),
                        "slowest" : RedimontorHandler.stats._slowest_commands(RedimontorHandler.stats.times)
                    }
                }))
            except:
                logging.error("Error sending stats", exc_info=True)

    @classmethod
    def send_info(cls, data):
        for waiter in cls.waiters:
            try:
                waiter.write_message(ujson.dumps({
                    "type": "info",
                    "data": data
                }))
            except:
                logging.error("Error sending info", exc_info=True)

    def on_message(self, message):
        pass


class MainHandler(tornado.web.RequestHandler):
    def get(self):
        self.render("index.html")


class RedisMonitorApplication(tornado.web.Application):
    def __init__(self):
        settings = {
            "template_path": os.path.join(os.path.dirname(__file__), "templates"),
            "static_path": os.path.join(os.path.dirname(__file__), "static"),
        }

        handlers = [
            (r"/", MainHandler),
            (r"/redimontor", RedimontorHandler),

        ]
        super(RedisMonitorApplication, self).__init__(handlers, **settings)


if __name__ == '__main__':
    http_server = tornado.httpserver.HTTPServer(RedisMonitorApplication())
    http_server.listen(8888)
    tornado.ioloop.PeriodicCallback(RedimontorHandler.send_stats, 2000).start()
    tornado.ioloop.PeriodicCallback(_info_collector, 5000).start()
    tornado.ioloop.IOLoop.instance().start()
