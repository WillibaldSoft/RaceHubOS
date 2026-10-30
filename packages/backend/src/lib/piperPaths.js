import { existsSync } from 'node:fs';
import path from 'node:path';

export function findPiperInstallation(candidates, exists = existsSync) {
  for (const home of candidates.filter(Boolean)) {
    const installation = {
      home,
      python: path.join(home, 'venv/bin/python3'),
      script: path.join(home, 'worker.py'),
      model: path.join(home, 'voices/de_DE-thorsten-medium.onnx'),
    };
    if ([installation.python, installation.script, installation.model, installation.model + '.json'].every(exists))
      return installation;
  }
  return null;
}
