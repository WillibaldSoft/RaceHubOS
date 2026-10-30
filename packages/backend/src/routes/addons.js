import express from 'express';
import { createPrismaClient } from '../lib/prisma.js';
import { ADDON_ENABLED_KEY, readAddonInstallation } from '../lib/addons.js';
const prisma = createPrismaClient();
const router = express.Router();
async function state() {
  const installation = await readAddonInstallation();
  const pref = await prisma.preference.findUnique({
    where: { key: ADDON_ENABLED_KEY },
  });
  return {
    ...installation,
    enabled: installation.compatible && pref?.value === 'true',
  };
}
router.get('/track-planner', async (req, res, next) => {
  try {
    const { installed, compatible, enabled, version } = await state();
    res.set('Cache-Control', 'no-store').json({
      success: true,
      data: {
        installed,
        compatible,
        enabled,
        version,
        entry: enabled ? '/api/addons/track-planner/assets/index.html' : null,
      },
    });
  } catch (error) {
    next(error);
  }
});
router.put('/track-planner', async (req, res, next) => {
  try {
    if (typeof req.body.enabled !== 'boolean')
      return res.status(400).json({ success: false, error: 'Invalid activation flag' });
    if (req.body.enabled && !(await readAddonInstallation()).compatible)
      return res.status(409).json({
        success: false,
        error: 'Install a compatible track planner first',
      });
    await prisma.preference.upsert({
      where: { key: ADDON_ENABLED_KEY },
      create: {
        key: ADDON_ENABLED_KEY,
        value: JSON.stringify(req.body.enabled),
      },
      update: { value: JSON.stringify(req.body.enabled) },
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
router.get('/track-planner/assets/*asset', async (req, res, next) => {
  try {
    const installation = await state();
    const asset = req.params.asset.join('/');
    if (!installation.enabled || !Object.hasOwn(installation.manifest.files, asset)) return res.sendStatus(404);
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.sendFile(asset, { root: installation.directory });
  } catch (error) {
    next(error);
  }
});
export default router;
