"""Flagship audit helper: a minimal HTTPS static server for fa-offline-sw.js.

Serves ROOT on 127.0.0.1:PORT with the given self-signed certificate, so
Chromium (with --host-resolver-rules mapping the production host here) can run
the real sw.js on the real origin. Run with `python3 -I` from outside the
served tree.

usage: python3 -I fa-https-server.py ROOT PORT CERT KEY
"""
import functools
import http.server
import ssl
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        # Mirror GitHub Pages' revalidation behaviour closely enough that the
        # service worker, not the HTTP cache, decides what is served offline.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


def main():
    root, port, cert, key = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=root))
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert, key)
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    httpd.serve_forever()


if __name__ == '__main__':
    main()
