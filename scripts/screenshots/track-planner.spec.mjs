/* global document, requestAnimationFrame */
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  emptyTrackPlan,
  enableFreePlacement,
  createPitAssembly,
  transformFreeParts,
  ungroupTrackParts,
  deletePitComponent,
  trackPlanFields,
  emptyRailInventory,
} from '../../packages/shared/src/index.js';
const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'docs/screenshots/track-planner');
const words = {
  de: { locale: 'de-DE', demo: 'Demo · Rennbahnplaner', template: 'Startbox mit zwei Tankplätzen' },
  en: { locale: 'en-GB', demo: 'Demo · Track planner', template: 'Start assembly with two fuel bays' },
  fr: {
    locale: 'fr-FR',
    demo: 'Démo · Planificateur de circuit',
    template: 'Départ avec deux postes de ravitaillement',
  },
};
const straight = (n = 6) =>
  enableFreePlacement({
    ...emptyTrackPlan(),
    pieces: Array.from({ length: n }, () => ({ type: 'Standardgerade', level: 0, jointDegrees: 0 })),
  });
for (const [language, labels] of Object.entries(words)) {
  test.describe(language, () => {
    test.use({ locale: labels.locale });
    test('capture every new planner feature with synthetic data', async ({ page, request }) => {
      const errors = [],
        manifest = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await fs.mkdir(path.join(output, language), { recursive: true });
      async function home() {
        await page.goto('/');
        await page.getByTestId('standalone-language').selectOption(language);
      }
      async function openPlan(plan) {
        const response = await request.post('/api/tracks', { data: { name: labels.demo, ...trackPlanFields(plan) } });
        expect(response.ok()).toBeTruthy();
        const { data } = await response.json();
        await home();
        await expect(page.getByTestId('standalone-track').locator(`option[value="${data.id}"]`)).toHaveCount(1);
        await page.getByTestId('standalone-track').selectOption(data.id);
      }
      async function select(index) {
        const rail = page.getByTestId('graph-track-canvas').getByTestId(`rail-${index}`);
        await rail.focus();
        await rail.press('Enter');
      }
      async function canvas() {
        await page.getByTestId('track-fit').click();
        await page.getByTestId('graph-track-canvas').scrollIntoViewIfNeeded();
      }
      async function shot(id, keepMouse = false) {
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        if (!keepMouse) await page.mouse.move(8, 8);
        const filename = `${id}.png`,
          target = path.join(output, language, filename);
        const bytes = await page.screenshot({ path: target, animations: 'disabled', caret: 'hide' });
        expect(bytes.length).toBeGreaterThan(20000);
        manifest.push({
          id,
          file: filename,
          width: 1600,
          height: 1400,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        });
      }
      await home();
      await page.getByTestId('standalone-new').click();
      await page.locator('.planner-name').fill(labels.demo);
      await expect(page.getByTestId('start-pit-create')).toBeVisible();
      await shot('01-start-setup');
      await page.getByTestId('start-pit-create').click();
      await expect(page.getByTestId('graph-track-canvas').locator('[data-testid^="fuel-detail-"]')).toHaveCount(2);
      await canvas();
      await shot('02-start-cu-two-bays');
      await select(2);
      await page.getByTestId('free-part-angle').fill('180');
      await page.getByTestId('free-part-angle').press('Tab');
      await expect(
        page
          .getByTestId('graph-track-canvas')
          .locator('[data-unit-kind="Control_unit"] text')
          .filter({ hasText: /^CONTROL UNIT$/ })
      ).toHaveAttribute('transform', 'rotate(180 172 -107)');
      await canvas();
      await shot('03-readable-rotated-cu');
      await openPlan(straight());
      await select(2);
      await page.getByTestId('tools-cu').click();
      await expect(page.getByTestId('graph-track-canvas').locator('[data-unit-kind="Control_unit"]')).toHaveCount(1);
      await canvas();
      await shot('04-cu-on-existing-straight');
      await openPlan(createPitAssembly({ includeCU: true }));
      await select(0);
      await page.getByTestId('switch-anti-collision').check();
      await page.getByTestId('show-anti-collision').check();
      await expect(page.getByTestId('graph-track-canvas').locator('[data-testid^="anti-collision-"]')).toHaveCount(1);
      await canvas();
      await shot('05-optional-aks-marker');
      await openPlan(straight(1));
      await select(0);
      await page.getByTestId('tools-box').click();
      await page.getByTestId('box-bays').selectOption('1');
      await page.getByTestId('box-side').selectOption('other');
      await page.getByTestId('box-preview').click();
      await expect(page.getByTestId('box-proposal').locator('[data-testid^="fuel-detail-"]')).toHaveCount(1);
      await expect(page.getByTestId('box-apply')).toBeVisible();
      await shot('06-pit-assistant-single-other-side');
      await page.getByTestId('tools-close').click();
      await openPlan(straight());
      await select(0);
      await page.getByTestId('tools-box').click();
      await page.getByTestId('box-placement').selectOption('replace');
      await page.getByTestId('box-bays').selectOption('2');
      await page.getByTestId('box-preview').click();
      await expect(page.getByTestId('box-proposal').locator('[data-testid^="fuel-detail-"]')).toHaveCount(2);
      await shot('07-pit-assistant-replace-six');
      await page.getByTestId('tools-close').click();
      await openPlan(transformFreeParts(straight(2), [1], { dx: 25 }));
      await select(1);
      await expect(page.getByTestId('connection-candidate')).toContainText('25.0 mm');
      await canvas();
      await shot('08-connection-gap-direction');
      await openPlan(createPitAssembly({ includeCU: true }));
      await select(2);
      await page.getByTestId('tools-templates').click();
      await page.getByTestId('template-name').fill(labels.template);
      await page.getByTestId('template-save').click();
      await expect(page.getByTestId('template-select')).toContainText(labels.template);
      await shot('09-assembly-templates');
      await page.getByTestId('tools-close').click();
      const switchPlan = enableFreePlacement({
        ...emptyTrackPlan(),
        pieces: [{ type: 'Pit_stop_weiche_anfang', level: 0, jointDegrees: 0 }],
      });
      await openPlan(switchPlan);
      await select(0);
      await canvas();
      await page.getByTestId('graph-track-canvas').getByTestId('rail-0').click({ button: 'right' });
      await expect(page.getByTestId('track-context-menu')).toBeVisible();
      await shot('10-context-menu');
      await page.keyboard.press('Escape');
      let auditPlan = ungroupTrackParts(createPitAssembly({ includeCU: true }), [0]);
      const entry = auditPlan.trackExtras.findIndex((p) => p.kind === 'pitEntry' && p.anchor === 0);
      auditPlan = transformFreeParts(deletePitComponent(auditPlan, entry), [1], { dx: -100 });
      await request.put('/api/preferences/carreraRailInventory', { data: { value: emptyRailInventory() } });
      await openPlan(auditPlan);
      await page.getByTestId('tools-audit').click();
      await page.getByTestId('audit-run').click();
      await expect(page.getByTestId('audit-conflict-0')).toBeVisible();
      await expect(page.getByTestId('audit-auxiliary-0')).toBeVisible();
      await shot('11-build-check-and-missing-parts');
      await page.getByTestId('audit-conflict-0').click();
      await expect(page.locator('[data-testid^="audit-mark-"]')).not.toHaveCount(0);
      await canvas();
      await shot('12-highlighted-overlap');
      await page.getByTestId('tools-audit').click();
      await page.getByTestId('audit-run').click();
      await page.getByTestId('audit-auxiliary-0').click();
      await expect(page.locator('[data-testid^="audit-auxiliary-mark-"]')).not.toHaveCount(0);
      await canvas();
      await shot('13-open-pit-connection');
      await openPlan(straight(1));
      await page.getByTestId('repeat-track-part').check();
      await page.getByTestId('palette-Standardgerade').click();
      await canvas();
      await page.getByTestId('track-zoom-slider').fill('40');
      const point = await page.getByTestId('graph-track-canvas').evaluate((svg) => {
        const p = svg.createSVGPoint();
        p.x = 345;
        p.y = 0;
        const screen = p.matrixTransform(svg.getScreenCTM());
        return { x: screen.x, y: screen.y };
      });
      await page.mouse.move(point.x, point.y);
      await expect(page.getByTestId('repeat-track-preview')).toBeVisible();
      await shot('14-repeat-placement', true);
      await page.keyboard.press('Escape');
      await openPlan(straight(5));
      await select(1);
      await page.getByTestId('palette-Kurve_1_60_rechts').click();
      await expect(page.getByTestId('replacement-cut-select')).toHaveValue('3');
      await canvas();
      await shot('15-replace-and-follow');
      await page.getByTestId('replacement-cut-select').selectOption('1');
      await expect(page.getByTestId('replacement-cut-marker')).toBeVisible();
      await canvas();
      await shot('16-choose-cut-point');
      await openPlan(transformFreeParts(straight(5), [2, 3, 4], { degrees: 60, dx: 800, dy: 400 }));
      await select(0);
      const movingRail = page.getByTestId('graph-track-canvas').getByTestId('rail-3');
      await movingRail.focus();
      await movingRail.press('Control+Enter');
      await expect(page.getByTestId('join-track-sections')).toBeEnabled();
      await page.getByTestId('join-sections-pair').selectOption('1:1/2:0');
      await canvas();
      await shot('17-join-sections-preview');
      await page.getByTestId('join-track-sections').click();
      await expect(page.locator('[data-testid^="open-port-"]')).toHaveCount(2);
      await canvas();
      await shot('18-joined-sections');
      await expect(page.getByTestId('planner-theme-toggle')).toHaveAttribute('data-theme', 'system');
      await page.getByTestId('planner-theme-toggle').click();
      await page.getByTestId('planner-theme-toggle').click();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await shot('19-racehubos-dark-theme');
      expect(errors).toEqual([]);
      await fs.writeFile(
        path.join(output, language, 'manifest.json'),
        JSON.stringify(
          { language, viewport: { width: 1600, height: 1400 }, syntheticData: true, screenshots: manifest },
          null,
          2
        ) + '\n'
      );
    });
  });
}
