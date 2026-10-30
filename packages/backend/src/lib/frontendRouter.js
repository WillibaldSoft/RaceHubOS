import express from 'express';

// Supplying an explicit root keeps hidden parent directories such as ~/.local
// outside sendFile's relative-path dotfile check, without allowing dotfiles.
export function createFrontendRouter(frontendDist) {
  const router = express.Router();
  router.use(
    express.static(frontendDist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
      },
    })
  );
  router.use('/assets', (req, res) => res.status(404).set('Cache-Control', 'no-store').end());
  router.get('{*path}', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile('index.html', { root: frontendDist });
  });
  return router;
}
