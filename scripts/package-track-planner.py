#!/usr/bin/env python3
"""Package already built planner and supplied Node runtimes. Never install."""
INSTALLER_VERSION = 1
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import tarfile
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--linux-node',required=True)
parser.add_argument('--windows-node',required=True)
parser.add_argument('--node-license',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=root/'addons/track-planner'
output=Path(args.output).resolve()
output.mkdir(parents=True,exist_ok=True)
stage=Path(tempfile.mkdtemp(prefix='planner-packaging-',dir=root.parent))

def common(target):
 target.mkdir(parents=True)
 shutil.copytree(source/'dist',target/'dist')
 for name in ['standalone-server.mjs','launcher.mjs','README.md']:shutil.copy2(source/name,target/name)
 shutil.copy2(source/'LICENSE',target/'LICENSE')
 shutil.copy2(args.node_license,target/'NODE-LICENSE')
 notices=source/'dist/THIRD-PARTY-NOTICES.txt'
 if notices.exists():shutil.copy2(notices,target/'THIRD-PARTY-NOTICES.txt')

linux=stage/'racehubos-track-planner-linux-x64'
common(linux)
shutil.copy2(args.linux_node,linux/'node');(linux/'node').chmod(0o755)
(linux/'Start.sh').write_text('#!/bin/sh\ncd -- "$(dirname -- "$0")" || exit 1\nexec ./node launcher.mjs\n')
(linux/'Start.sh').chmod(0o755)
with tarfile.open(output/'RaceHubOS-Streckenplaner-Linux-x64.tar.gz','w:gz') as archive:archive.add(linux,arcname=linux.name)
windows=stage/'RaceHubOS-Streckenplaner-Windows-x64'
common(windows)
shutil.copy2(args.windows_node,windows/'node.exe')
(windows/'Start.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nnode.exe launcher.mjs\r\nif errorlevel 1 pause\r\n')
with zipfile.ZipFile(output/'RaceHubOS-Streckenplaner-Windows-x64.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for p in windows.rglob('*'):
  if p.is_file():archive.write(p,p.relative_to(stage))
deb=stage/'deb'
app=deb/'opt/racehubos-track-planner'
shutil.copytree(linux,app)
launcher=deb/'usr/bin/racehubos-track-planner';launcher.parent.mkdir(parents=True)
launcher.write_text('#!/bin/sh\nexec /opt/racehubos-track-planner/node /opt/racehubos-track-planner/launcher.mjs\n');launcher.chmod(0o755)
desktop=deb/'usr/share/applications/racehubos-track-planner.desktop';desktop.parent.mkdir(parents=True)
desktop.write_text('[Desktop Entry]\nType=Application\nName=RaceHubOS Track Planner\nName[de]=RaceHubOS Streckenplaner\nExec=racehubos-track-planner\nTerminal=true\nCategories=Game;Graphics;\n')
control=deb/'DEBIAN';control.mkdir()
(control/'control').write_text('Package: racehubos-track-planner\nVersion: 1.0.0\nArchitecture: amd64\nSection: games\nPriority: optional\nMaintainer: RaceHubOS contributors <noreply@localhost>\nDepends: libc6 (>= 2.28), libstdc++6, libgcc-s1, xdg-utils\nDescription: Independent offline track planner for Carrera layouts\n Separate optional planner with its own local plans and stock.\n No RaceHubOS installation or Python runtime required.\n')
subprocess.run(['dpkg-deb','--threads-max=1','-Zgzip','-z6','--root-owner-group','--build',str(deb),str(output/'racehubos-track-planner_1.0.0_amd64.deb')],check=True)
shutil.copy2(source/'track-planner.racehub-addon.json',output/'track-planner.racehub-addon.json')
print(output)
