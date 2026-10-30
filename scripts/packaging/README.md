# Experimental installer builds

These builders never install packages or access a personal database. Supply the already reviewed empty database/public catalogue from the previous Linux package as `--seed-home`. Application tables must be empty. Root version, changelog and schema are unchanged.

- `package-track-planner.py` builds the independent offline planner DEB and portable Linux/Windows packages.
- `package-experimental.py` builds a separate experimental Linux host, optional planner add-on DEB, and genuine NSIS Windows installers for host, independent planner, add-on, Piper runtime and DE/EN/FR voices.
- `piper/build-selectable-debs.py` rebuilds the existing optional Linux runtime and separate voices from locally supplied, checksum-verified models.

The host Linux package uses `/opt/racehubos-experimental`, `$XDG_DATA_HOME/racehubos-experimental`, and port 3002. The existing desktop launcher/installation is retained. This local prototype still has Python-based Linux Bluetooth and the Python desktop launcher. It is separate from upstream PR #8; the add-on and independent planner have no Python runtime dependency.

Windows installs per user under `%LOCALAPPDATA%/Programs/`. The standalone planner and Piper payloads are offline. Piper may require Microsoft's Visual C++ x64 runtime on the destination PC. RaceHubOS host **Online Setup** needs internet, Python 3 and Visual Studio C++ Build Tools once to compile its pinned native dependencies, then uses its own persistent profile `%LOCALAPPDATA%/racehubos-experimental`. The Windows host does not automatically import the Linux public catalogue. Never describe this bootstrap as an offline host installer.

Install the add-on independently, then enable it in host settings. Both host launchers select the packaged add-on directory. Standalone plans are stored outside the installed program files. Uninstallers delete only enumerated component-owned files, leave personal data untouched, and check a component marker. Piper runtime and voices have separate uninstall entries in a shared program folder.

Use only trusted local inputs, including compiler and official runtimes. Build using an extracted NSIS compiler with `NSISDIR` set to its `usr/share/nsis` directory. Input archive paths must be trusted. Example arguments (all paths absolute):

```sh
python3 scripts/package-experimental.py \
  --output /path/output \
  --seed-home /path/old-package/opt/racehubos \
  --linux-node /path/node \
  --node-license /path/NODE-LICENSE \
  --windows-node-zip /path/node-v22.23.4-win-x64.zip \
  --planner-windows-zip /path/RaceHubOS-Streckenplaner-Windows-x64.zip \
  --makensis /path/nsis/usr/bin/makensis \
  --piper-runtime /path/piper-test-runtime \
  --windows-python-zip /path/python-3.12.10-embed-amd64.zip \
  --windows-wheels /path/verified-win-amd64-wheels
```

No Windows execution test is possible on this Linux builder. A successful NSIS build or PE file inspection does not prove Bluetooth works on a real Windows PC. Keep all Windows packages marked experimental until that test is complete.
