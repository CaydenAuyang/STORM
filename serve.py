#!/usr/bin/env python3
"""
STORM-v2 static dev server (OCEAN / MOUNTAINS / ARCTIC environments).
See sibling folder STORM for ocean-only + latest audio-mix experiments.
"""
import argparse
import http.server
import os
import shutil
import socketserver

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8001


class StormRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def copyfile(self, source, outputfile):
        try:
            shutil.copyfileobj(source, outputfile)
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass

    def log_message(self, format, *args):
        msg = format % args
        if 'favicon.ico' in msg and '404' in msg:
            return
        super().log_message(format, *args)


class StormTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    p = argparse.ArgumentParser(description='Serve STORM-v2 (3 environments).')
    p.add_argument('-p', '--port', type=int, default=DEFAULT_PORT)
    p.add_argument('--host', default='127.0.0.1')
    args = p.parse_args()

    with StormTCPServer((args.host, args.port), StormRequestHandler) as httpd:
        print(
            f'STORM-v2 (OCEAN / MOUNTAINS / ARCTIC) → http://{args.host}:{args.port}/',
        )
        print('  no-store cache | Ctrl+C to stop')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\nStopped.')


if __name__ == '__main__':
    main()
