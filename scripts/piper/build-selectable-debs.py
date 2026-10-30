#!/usr/bin/env python3
"""Offline Piper runtime and independently installable DE/EN/FR models. Never install."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import shutil
import subprocess
import sys

INSTALLER_VERSION = 1
SOURCE = Path(__file__).resolve().parent
HOME = Path('opt/racehubos-piper-select')


def pack(stage, output, name, version, architecture, depends, description):
    control = stage / 'DEBIAN'
    control.mkdir()
    for parent, dirs, files in __import__('os').walk(stage):
        Path(parent).chmod(0o755)
        for name_on_disk in files:
            p = Path(parent) / name_on_disk
            if not p.is_symlink():
                p.chmod(0o755 if __import__('os').access(p, __import__('os').X_OK) else 0o644)
    size = sum(p.stat().st_size for p in stage.rglob('*') if p.is_file() and not p.is_symlink()) // 1024
    (control / 'control').write_text(f'''Package: {name}
Version: {version}
Architecture: {architecture}
Section: sound
Priority: optional
Maintainer: RaceHubOS contributors <noreply@localhost>
Installed-Size: {size}
Depends: {depends}
Description: {description}
 Optional offline component for RaceHubOS. No service or install-time downloads.
 Existing Piper installations and personal RaceHubOS data are untouched.
''')
    (control / 'md5sums').write_text(''.join(hashlib.md5(p.read_bytes()).hexdigest() + '  ' + str(p.relative_to(stage)) + '\n' for p in sorted(stage.rglob('*')) if p.is_file() and not p.is_symlink() and control not in p.parents))
    target = output / f'{name}_{version}_{architecture}.deb'
    subprocess.run(['dpkg-deb', '--root-owner-group', '-Zzstd', '-z8', '--threads-max=2', '--build', str(stage), str(target)], check=True)
    return target


def build(runtime, output, version):
    if platform.system() != 'Linux' or platform.machine() not in ('x86_64', 'amd64') or sys.version_info[:2] != (3, 12):
        raise ValueError('Target: Linux amd64 / Python 3.12')
    manifest = json.loads((SOURCE / 'voices.json').read_text())
    # Check every model/card before producing even the runtime package.
    for voice in manifest['voices']:
        for filename, info in voice['files'].items():
            name = voice['id'] + '-MODEL_CARD' if filename == 'MODEL_CARD' else filename
            p = runtime / 'voices' / name
            if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest() != info['sha256']:
                raise ValueError('Model/card checksum mismatch: ' + name)
    output.mkdir(parents=True, exist_ok=True)
    work = output / 'piper-stages'
    work.mkdir(exist_ok=False)
    stage = work / 'runtime'
    home = stage / HOME
    home.mkdir(parents=True)
    shutil.copytree(runtime / 'venv', home / 'venv', symlinks=True, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for p in (home / 'venv/bin').iterdir():
        if not p.is_symlink():
            p.unlink()
    (home / 'venv/pyvenv.cfg').write_text('home = /usr/bin\ninclude-system-site-packages = false\nversion = 3.12\n')
    for name in ['worker-multilang.py', 'speak.py', 'voices.json']:
        shutil.copyfile(SOURCE / name, home / name)
    launcher = stage / 'usr/bin/racehubos-piper-select'
    launcher.parent.mkdir(parents=True)
    launcher.write_text('#!/bin/sh\nexec /usr/bin/python3 /opt/racehubos-piper-select/speak.py "$@"\n')
    launcher.chmod(0o755)
    docs = stage / 'usr/share/doc/racehubos-piper-runtime'
    docs.mkdir(parents=True)
    shutil.copyfile('/usr/share/common-licenses/GPL-3', docs / 'GPL-3')
    (docs / 'copyright').write_text('Piper 1.8.0: GPL-3.0, https://github.com/OHF-Voice/piper1-gpl\nPython dependency licences: /opt/racehubos-piper-select/venv/lib/python3.12/site-packages/*dist-info/.\nWorker/installer: Apache-2.0. Voice models/cards are in separate language packages.\n')
    shutil.copyfile('/usr/share/common-licenses/Apache-2.0', docs / 'Apache-2.0')
    result = [pack(stage, output, 'racehubos-piper-runtime', version, 'amd64', 'python3 (>= 3.12), python3 (<< 3.13), libc6 (>= 2.35), libstdc++6 (>= 12), libgcc-s1, zlib1g', 'Optional local Piper speech runtime for RaceHubOS')]
    for voice in manifest['voices']:
        name = 'racehubos-piper-' + voice['language']
        stage = work / voice['language']
        dest = stage / HOME / 'voices'
        dest.mkdir(parents=True)
        for filename in voice['files']:
            filename = voice['id'] + '-MODEL_CARD' if filename == 'MODEL_CARD' else filename
            shutil.copyfile(runtime / 'voices' / filename, dest / filename)
        docs = stage / 'usr/share/doc' / name
        docs.mkdir(parents=True)
        (docs / 'copyright').write_text(f"Voice: {voice['name']} / {voice['id']}\nDataset/model licence notice: {voice['license']}\nOriginal model card: /{HOME}/voices/{voice['id']}-MODEL_CARD\nSource and checksums: /{HOME}/voices.json\n")
        shutil.copyfile(runtime / 'voices' / (voice['id'] + '-MODEL_CARD'), docs / 'MODEL_CARD')
        if voice['language'] == 'fr':
            (docs / 'SOURCE.txt').write_text(voice['files']['MODEL_CARD']['url'] + '\n')
        result.append(pack(stage, output, name, version, 'all', 'racehubos-piper-runtime (= ' + version + ')', f"Optional {voice['language']} Piper voice {voice['name']} for RaceHubOS"))
    for p in result:
        Path(str(p) + '.sha256').write_text(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-home', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    for result in build(args.runtime_home.resolve(), args.output.resolve(), args.version):
        print(result)
