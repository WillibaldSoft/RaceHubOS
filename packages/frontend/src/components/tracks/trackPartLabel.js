export const labelTrackPart = (type) =>
  ({
    Pit_stop_weiche_anfang: 'Pitlane-Einfahrt · aktive Weiche',
    Pit_stop_weiche_ende: 'Pitlane-Ausfahrt · Zusammenführung',
    Startampel_3spur_hinten: 'Standardgerade · 345 mm',
    Schikane_30373: 'Schikane · 3 Module',
    Engstelle_links_30350: 'Engstelle links · 4 Module',
    Engstelle_rechts_30351: 'Engstelle rechts · 4 Module',
  })[type] ||
  type
    .replace(/^Steilkurve_(\d)_(\d+)_(.*)$/, 'Steilkurve K$1 / $2° $3')
    .replace(/^Kurve_(\d)_(\d+)_(.*)$/, 'K$1 / $2° $3')
    .replaceAll('_', ' ')
