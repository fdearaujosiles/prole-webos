#!/usr/bin/env python3
"""Tiny receiver for probe reports, run on the TV itself.

Listens on 127.0.0.1:8765 and appends every report (POST body or ?d= query)
to /tmp/reportd.log, one line each.
"""
import datetime
import json
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

LOG = "/tmp/reportd.log"


class Handler(BaseHTTPRequestHandler):
    def _append(self, text):
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps({"at": datetime.datetime.now().isoformat(timespec="seconds"),
                                "data": text}) + "\n")
            f.flush()

    def _ok(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8", "replace") if length else ""
        self._append(body)
        self._ok()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/report":
            data = parse_qs(parsed.query).get("d", [""])[0]
            if data:
                self._append(data)
            self._ok()
            return
        self.send_response(200)
        self.send_header("Content-Length", "5")
        self.end_headers()
        self.wfile.write(b"alive")

    def log_message(self, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    open(LOG, "a", encoding="utf-8").close()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.serve_forever()


if __name__ == "__main__":
    main()
