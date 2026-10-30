#!/usr/bin/python3
"""Offline desktop launcher; package files stay immutable, data belongs to user."""
INSTALLER_VERSION = 1

import fcntl
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request


def main():
    os.umask(0o077)
    root = Path(os.environ.get('RACEHUBOS_PACKAGE_ROOT', '/opt/racehubos-experimental'))
    base = Path(os.environ.get('XDG_DATA_HOME', str(Path.home() / '.local/share'))) / 'racehubos-experimental'
    base.mkdir(parents=True, exist_ok=True, mode=0o700)
    port = int(os.environ.get('RACEHUBOS_PORT', '3002'))
    url = f'http://localhost:{port}'
    lock = (base / 'launcher.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX)
    marker = base / 'server.json'

    def running():
        try:
            info = json.loads(marker.read_text())
            if info['port'] != port:
                raise RuntimeError('RaceHubOS läuft bereits auf einem anderen Port.')
            os.kill(info['pid'], 0)
            process = Path('/proc') / str(info['pid'])
            if Path(os.readlink(process / 'cwd')) != base / 'RaceHubOS/packages/backend':
                return False
            if Path(os.readlink(process / 'exe')) != (root / 'runtime/bin/node').resolve():
                return False
            with urllib.request.urlopen(url + '/health', timeout=1) as response:
                return json.load(response).get('status') == 'ok'
        except (OSError, ValueError, KeyError):
            return False

    if '--stop' in sys.argv:
        if running():
            info = json.loads(marker.read_text())
            os.killpg(info['pid'], signal.SIGTERM)
        marker.unlink(missing_ok=True)
        return
    if not running():
        # Never overwrite or attach to the existing, separately installed server.
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', port)) == 0:
                raise RuntimeError(f'Port {port} ist belegt. Bitte die bisherige Anwendung zuerst beenden.')
        version = (root / 'VERSION').read_text().strip()
        app = base / 'RaceHubOS'
        data = base / 'data'
        data.mkdir(exist_ok=True)
        db = data / 'racehubos.db'
        if not db.exists():
            shutil.copyfile(root / 'empty.db', db)
        import sqlite3
        def schema(filename):
            with sqlite3.connect('file:' + str(filename) + '?mode=ro', uri=True) as connection:
                return connection.execute("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
        if schema(db) != schema(root / 'empty.db'):
            raise RuntimeError('Die Datenbankstruktur passt nicht zu diesem Paket. Bitte zuerst eine kompatible Version verwenden und die Datenmigration prüfen.')
        if not (app / '.package-version').exists() or (app / '.package-version').read_text() != version:
            # Back up user database before switching application code on upgrades.
            if app.exists():
                saved = base / 'installation/datensicherungen'
                saved.mkdir(parents=True, exist_ok=True)
                with sqlite3.connect(db) as source, sqlite3.connect(saved / f'vor-paketupdate-{time.time_ns()}.sqlite') as dest:
                    source.backup(dest)
            stage = base / 'RaceHubOS.new'
            if stage.exists():
                shutil.rmtree(stage)
            shutil.copytree(root / 'RaceHubOS', stage, symlinks=True, ignore=shutil.ignore_patterns('node_modules'))
            (stage / 'node_modules').symlink_to(root / 'RaceHubOS/node_modules', target_is_directory=True)
            uploads = data / 'uploads'
            uploads.mkdir(exist_ok=True)
            public = stage / 'packages/backend/public'
            public.mkdir(parents=True, exist_ok=True)
            if (public / 'uploads').exists():
                shutil.rmtree(public / 'uploads')
            (public / 'uploads').symlink_to(uploads, target_is_directory=True)
            (stage / '.package-version').write_text(version)
            old = base / 'RaceHubOS.previous'
            if old.exists():
                shutil.rmtree(old)
            if app.exists():
                app.rename(old)
            stage.rename(app)
        installation = base / 'installation'
        installation.mkdir(exist_ok=True)
        voice = installation / 'piper'
        if not voice.exists() and not voice.is_symlink() and (root / 'installation/piper').exists():
            voice.symlink_to(root / 'installation/piper', target_is_directory=True)
        from catalog_seed import seed_catalog
        seed_catalog(root, db, data / 'uploads')
        env = dict(os.environ, PORT=str(port), DATABASE_URL='file:' + str(db), NODE_ENV='production')
        env['PATH'] = str(root / 'runtime/bin') + ':' + env.get('PATH', '')
        env['FRONTEND_URL'] = url
        env['RACEHUBOS_ADDONS_DIR'] = str(root / 'addons')
        with (base / 'racehubos.log').open('ab') as log:
            child = subprocess.Popen([str(root / 'runtime/bin/node'), 'src/index.js'],
                                     cwd=app / 'packages/backend', env=env,
                                     stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
        marker.write_text(json.dumps({'pid': child.pid, 'port': port, 'version': version}))
        for _ in range(120):
            if child.poll() is not None:
                raise RuntimeError(f'RaceHubOS konnte nicht starten. Protokoll: {base / "racehubos.log"}')
            if running():
                break
            time.sleep(0.5)
        else:
            os.killpg(child.pid, signal.SIGTERM)
            raise RuntimeError('Start dauert zu lange. Bitte das Protokoll prüfen.')
    print(url)
    if '--no-browser' not in sys.argv:
        subprocess.Popen(['xdg-open', url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        if not os.environ.get('RACEHUBOS_TEST') and shutil.which('zenity'):
            subprocess.run(['zenity', '--error', '--title=RaceHubOS', '--text=' + str(error)])
        sys.exit(1)
