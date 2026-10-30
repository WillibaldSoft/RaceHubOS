import { spawn } from 'node:child_process';
import { createStandaloneServer } from './standalone-server.mjs';
const port = Number(process.env.PORT) || 3180;
const address = `http://127.0.0.1:${port}`;
function open() {
  if (process.env.RACEHUBOS_NO_OPEN === '1') return;
  const program = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const child = spawn(program, [address], { stdio: 'ignore', detached: true });
  child.on('error', () => console.log(address));
  child.unref();
}
try {
  const server = await createStandaloneServer();
  server.once('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      try {
        const r = await fetch(address + '/api/planner-info', {
            signal: AbortSignal.timeout(2000),
          }),
          info = await r.json();
        if (info.application === 'racehubos-track-planner') {
          open();
          return;
        }
      } catch {}
    }
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log('RaceHubOS Track Planner: ' + address);
    open();
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
