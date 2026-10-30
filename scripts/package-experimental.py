#!/usr/bin/env python3
"""Build isolated experimental DEB/NSIS installers from local, supplied inputs.
No downloads, installation or live database access. See packaging/README.md.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import zipfile

INSTALLER_VERSION = 4
ROOT = Path(__file__).resolve().parents[1]


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def source_tree(target):
    tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    for name in filter(None, tracked):
        # Local working notes/images/history are available in the private Git backup.
        if name.startswith('local-carrera/'):
            continue
        if (ROOT / name).is_file():
            copy(ROOT / name, target / name)
    shutil.copytree(ROOT / 'packages/frontend/dist', target / 'packages/frontend/dist')


def pack_deb(stage, output, name, version, depends, description):
    control = stage / 'DEBIAN'
    control.mkdir()
    size = sum(p.stat().st_size for p in stage.rglob('*') if p.is_file() and not p.is_symlink()) // 1024
    (control / 'control').write_text(f'''Package: {name}
Version: {version}
Architecture: amd64
Section: games
Priority: optional
Maintainer: RaceHubOS contributors <noreply@localhost>
Installed-Size: {size}
Depends: {depends}
Description: {description}
 Experimental, optional package. Personal race data is not included.
''')
    for directory, _, files in os.walk(stage):
        Path(directory).chmod(0o755)
        for name_on_disk in files:
            p = Path(directory) / name_on_disk
            if not p.is_symlink():
                p.chmod(0o755 if os.access(p, os.X_OK) else 0o644)
    sums = [hashlib.md5(p.read_bytes()).hexdigest() + '  ' + str(p.relative_to(stage))
            for p in sorted(stage.rglob('*')) if p.is_file() and not p.is_symlink() and control not in p.parents]
    (control / 'md5sums').write_text('\n'.join(sums) + '\n')
    result = output / f'{name}_{version}_amd64.deb'
    subprocess.run(['dpkg-deb', '--root-owner-group', '--threads-max=1', '-Zzstd', '-z3', '--build', str(stage), str(result)], check=True)
    return result


def nsis(payload, output, slug, label, folder, makensis, launch=None):
    """Fixed per-user application directory, component-owned uninstaller only.
    Shared Piper directory is safe: each component deletes only its own files.
    No profile/data directories are placed inside these application directories.
    """
    installer = output / (slug + '-Setup-x64.exe')
    marker = f'.{slug}-installed'
    uninstaller = f'Uninstall-{slug}.exe'
    files = sorted(p.relative_to(payload).as_posix() for p in payload.rglob('*') if p.is_file())
    # Input path/file names are trusted, but reject NSIS interpolation/quoting characters.
    for value in [str(payload), str(installer), label, folder, *files]:
        if any(c in value for c in ['$', '"', '\n', '\r']):
            raise ValueError('Unsupported NSIS path: ' + value)
    script = f'''Unicode true
RequestExecutionLevel user
!include "LogicLib.nsh"
!include "x64.nsh"
!include "MUI2.nsh"
Name "{label} (Experimental)"
OutFile "{installer}"
InstallDir "$LOCALAPPDATA\\Programs\\{folder}"
SetCompressor /SOLID lzma
SetCompressorDictSize 16
CRCCheck force
ShowInstDetails show
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "French"
Function .onInit
  ${{IfNot}} ${{RunningX64}}
    MessageBox MB_ICONSTOP "Windows x64 required."
    Abort
  ${{EndIf}}
  ; Ignore /D: only the owned per-user program directory may be modified.
  StrCpy $INSTDIR "$LOCALAPPDATA\\Programs\\{folder}"
FunctionEnd
Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "{payload}/*"
  FileOpen $0 "$INSTDIR\\{marker}" w
  FileWrite $0 "{slug}"
  FileClose $0
  WriteUninstaller "$INSTDIR\\{uninstaller}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{slug}" "DisplayName" "{label} (Experimental)"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{slug}" "UninstallString" '$\\"$INSTDIR\\{uninstaller}$\\"'
'''
    if launch:
        script += f'  CreateShortcut "$SMPROGRAMS\\{label}.lnk" "$INSTDIR\\{launch}"\n'
    script += f'''SectionEnd
Function un.onInit
  IfFileExists "$INSTDIR\\{marker}" +3 0
    MessageBox MB_ICONSTOP "Installation marker missing. No files removed."
    Abort
FunctionEnd
Section "Uninstall"
  SetShellVarContext current
'''
    if launch:
        script += f'  Delete "$SMPROGRAMS\\{label}.lnk"\n'
    for name in files:
        script += '  Delete "$INSTDIR\\' + name.replace('/', '\\') + '"\n'
    directories = sorted({str(Path(f).parent).replace('/', '\\') for f in files if str(Path(f).parent) != '.'}, key=len, reverse=True)
    # RMDir without /r only removes empty directories; user-created files survive.
    for directory in directories:
        script += f'  RMDir "$INSTDIR\\{directory}"\n'
    script += f'''  Delete "$INSTDIR\\{marker}"
  Delete "$INSTDIR\\{uninstaller}"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{slug}"
SectionEnd
'''
    nsi = payload.parent / (slug + '.nsi')
    nsi.write_text(script)
    subprocess.run([str(makensis), '-V2', str(nsi)], check=True)
    return installer


def addon_tree(target):
    pkg = json.loads((ROOT / 'addons/track-planner/track-planner.racehub-addon.json').read_text())
    manifest = pkg['manifest']
    target.mkdir(parents=True)
    for name, digest in manifest['files'].items():
        rel = Path(name)
        if rel.is_absolute() or '..' in rel.parts or '\\' in name:
            raise ValueError('Unsafe add-on path')
        data = base64.b64decode(pkg['files'][name], validate=True)
        if hashlib.sha256(data).hexdigest() != digest:
            raise ValueError('Add-on hash mismatch')
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    (target / 'manifest.json').write_text(json.dumps(manifest, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ['output', 'seed-home', 'linux-node', 'node-license', 'windows-node-zip', 'planner-windows-zip', 'makensis', 'piper-runtime', 'windows-python-zip', 'windows-wheels']:
        parser.add_argument('--' + arg, type=Path, required=True)
    parser.add_argument('--vcredist', type=Path)
    parser.add_argument('--version', default=json.loads((ROOT / 'package.json').read_text())['version'] + '+experimental.20261030.1')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='experimental-packaging-', dir=ROOT.parent))
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    # Only an already reviewed empty/public seed is accepted, never the personal DB.
    with sqlite3.connect(f'file:{args.seed_home / "empty.db"}?mode=ro', uri=True) as db:
        for name, in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '_prisma_migrations'"):
            if db.execute('SELECT count(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0]:
                raise ValueError('Seed must have zero application records: ' + name)
    linux = stage / 'host-deb'
    app = linux / 'opt/racehubos-experimental'
    source_tree(app / 'RaceHubOS')
    shutil.copytree(ROOT / 'node_modules', app / 'RaceHubOS/node_modules', symlinks=True,
                    ignore=shutil.ignore_patterns('__pycache__', '.cache'))
    copy(args.linux_node, app / 'runtime/bin/node')
    (app / 'runtime/bin/node').chmod(0o755)
    copy(args.node_license, app / 'runtime/LICENSE-Node.txt')
    for name in ['empty.db', 'catalog-seed.json']:
        copy(args.seed_home / name, app / name)
    shutil.copytree(args.seed_home / 'catalog-images', app / 'catalog-images')
    copy(ROOT / 'local-carrera/debian/catalog_seed.py', app / 'catalog_seed.py')
    copy(ROOT / 'scripts/packaging/experimental-launcher.py', app / 'launcher.py')
    (app / 'VERSION').write_text(args.version + '\n')
    (app / 'BUILD.json').write_text(json.dumps({'version': args.version, 'commit': commit, 'experimental': True, 'personalData': False, 'node': '22.23.4'}, indent=2))
    launch = linux / 'usr/bin/racehubos-experimental'
    launch.parent.mkdir(parents=True)
    launch.write_text('#!/bin/sh\nexec /usr/bin/python3 /opt/racehubos-experimental/launcher.py "$@"\n')
    launch.chmod(0o755)
    desktop = linux / 'usr/share/applications/racehubos-experimental.desktop'
    desktop.parent.mkdir(parents=True)
    desktop.write_text('[Desktop Entry]\nType=Application\nName=RaceHubOS Experimental\nExec=racehubos-experimental\nTerminal=false\nCategories=Game;\n')
    pack_deb(linux, output, 'racehubos-carrera-experimental', args.version,
             'libc6 (>= 2.35), libstdc++6 (>= 12), libgcc-s1, libusb-1.0-0, libudev1, bluez, python3-dbus, python3-gi, python3, xdg-utils',
             'Experimental RaceHubOS host with optional planner API and lap speed')
    addon = stage / 'addon-deb'
    addon_tree(addon / 'opt/racehubos-experimental/addons/track-planner')
    pack_deb(addon, output, 'racehubos-track-planner-addon', '1.0.0', 'racehubos-carrera-experimental (>= ' + args.version + ')',
             'Optional track planner add-on for experimental RaceHubOS host')
    planner = stage / 'planner-windows'
    with zipfile.ZipFile(args.planner_windows_zip) as archive:
        archive.extractall(planner)
    planner = next(planner.iterdir())
    nsis(planner, output, 'RaceHubOS-Streckenplaner', 'RaceHubOS Track Planner', 'RaceHubOS-TrackPlanner', args.makensis, 'Start.cmd')
    addonwin = stage / 'addon-windows'
    addon_tree(addonwin / 'track-planner')
    nsis(addonwin, output, 'RaceHubOS-Streckenplaner-Addon', 'RaceHubOS Track Planner Add-on', 'RaceHubOS-Experimental-Addons', args.makensis)
    windows = stage / 'host-windows'
    source_tree(windows / 'RaceHubOS')
    with zipfile.ZipFile(args.windows_node_zip) as archive:
        archive.extractall(stage / 'node-windows')
    shutil.copytree(next((stage / 'node-windows').iterdir()), windows / 'runtime')
    copy(args.seed_home / 'empty.db', windows / 'empty.db')
    copy(ROOT / 'scripts/packaging/windows-host.mjs', windows / 'launcher.mjs')
    (windows / 'Start.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\n"runtime\\node.exe" launcher.mjs\r\nif errorlevel 1 pause\r\n')
    (windows / 'README.txt').write_text('EXPERIMENTAL - Windows x64\nOnline setup on first launch: internet, Python 3 and Visual Studio C++ Build Tools required for native Bluetooth dependencies.\nNo native Windows/CU test has been performed.\nSeparate data: %LOCALAPPDATA%/racehubos-experimental. Port 3002.\nThe public catalogue is not automatically seeded on Windows.\nKeep this console open while racing. Ctrl+C stops the server.\n')
    nsis(windows, output, 'RaceHubOS-Experimental-Online', 'RaceHubOS Experimental Online Setup', 'RaceHubOS-Experimental', args.makensis, 'Start.cmd')
    piper = stage / 'piper-windows'
    python = piper / 'venv/Scripts'
    python.mkdir(parents=True)
    with zipfile.ZipFile(args.windows_python_zip) as archive:
        archive.extractall(python)
    site = python / 'site-packages'
    site.mkdir()
    for whl in sorted(args.windows_wheels.glob('*.whl')):
        with zipfile.ZipFile(whl) as archive:
            archive.extractall(site)
    (python / 'python312._pth').write_text('python312.zip\n.\nsite-packages\nimport site\n')
    for name in ['worker-multilang.py', 'speak.py', 'voices.json']:
        copy(ROOT / 'scripts/piper' / name, piper / name)
    if args.vcredist:
        copy(args.vcredist, piper / 'VC_redist.x64.exe')
        (piper / 'VCRuntime-Install.cmd').write_bytes(b'@echo off\r\nstart \"\" /wait \"%~dp0VC_redist.x64.exe\" /install /passive /norestart\r\n')
    (piper / 'README-Piper.txt').write_text('Experimental Windows x64 Piper. Install runtime and at least one language package.\nIf Microsoft Visual C++ Runtime is missing, run VC_redist.x64.exe in this folder (Microsoft installer may request administrator permission).\nNo native Windows execution test was performed.\n')
    copy(Path('/usr/share/common-licenses/Apache-2.0'), piper / 'LICENSE-RaceHubOS')
    copy(Path('/usr/share/common-licenses/GPL-3'), piper / 'LICENSE-Piper-GPL-3')
    nsis(piper, output, 'RaceHubOS-Piper-Runtime', 'RaceHubOS Piper Runtime', 'RaceHubOS-Piper', args.makensis)
    voices = json.loads((ROOT / 'scripts/piper/voices.json').read_text())
    for voice in voices['voices']:
        language = voice['language']
        payload = stage / ('piper-' + language)
        for filename, info in voice['files'].items():
            name = voice['id'] + '-MODEL_CARD' if filename == 'MODEL_CARD' else filename
            src = args.piper_runtime / 'voices' / name
            if hashlib.sha256(src.read_bytes()).hexdigest() != info['sha256']:
                raise ValueError('Voice checksum mismatch: ' + name)
            copy(src, payload / 'voices' / name)
        nsis(payload, output, 'RaceHubOS-Piper-' + language.upper(), 'RaceHubOS Piper ' + language.upper(), 'RaceHubOS-Piper', args.makensis)
    print(json.dumps({'output': str(output), 'stage': str(stage), 'commit': commit}), flush=True)


if __name__ == '__main__':
    main()
