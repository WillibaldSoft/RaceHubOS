import { useTranslation } from 'react-i18next'
import { inventoryComparison, railRequirements, CARRERA_RAILS } from '@racehubos/shared'
export function RailRequirementsTable({ plan, inventory, allowAdditionalParts = false }) {
  const { t } = useTranslation('tracks')
  const comparison = inventory ? inventoryComparison(plan, inventory) : null
  const counts = railRequirements(plan)
  const rows = (comparison?.rows || CARRERA_RAILS.map((p) => ({ ...p, required: counts.counts[p.article] }))).filter(
    (p) => p.required
  )
  const additions = comparison?.rows.filter((p) => p.remaining < 0) || []
  return (
    <>
      <details data-testid="rail-requirements" className="border rounded p-2">
        <summary>
          {t('inventory.required')}
          {comparison
            ? ` · ${t(allowAdditionalParts && additions.length ? 'inventory.additionalRequired' : comparison.unresolved.length && comparison.quantitiesFit ? 'inventory.needsCheck' : comparison.fits ? 'inventory.fits' : 'inventory.missing')}`
            : ''}
        </summary>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left">{t('inventory.part')}</th>
              <th>{t('inventory.required')}</th>
              {inventory && (
                <>
                  <th>{t('inventory.available')}</th>
                  <th>{t('inventory.remaining')}</th>
                  <th>{t('inventory.fromStock')}</th>
                  <th>{t('inventory.additional')}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.article}>
                <td>
                  {p.article} ·{' '}
                  {t(`inventory.parts.${p.label}`, {
                    defaultValue: p.name || p.label,
                  })}
                </td>
                <td className="text-center">{p.required}</td>
                {inventory && (
                  <>
                    <td className="text-center">{p.available}</td>
                    <td className={`text-center ${p.remaining < 0 ? 'text-destructive font-bold' : ''}`}>
                      {Math.max(0, p.remaining)}
                    </td>
                    <td className="text-center">{Math.min(p.available, p.required)}</td>
                    <td className="text-center">{Math.max(0, -p.remaining)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {counts.unresolved.length > 0 && (
          <p role="alert">
            {t('inventory.unresolved')}: {counts.unresolved.join(', ')}
          </p>
        )}
      </details>
      {allowAdditionalParts && inventory && (
        <section data-testid="additional-parts" className="border rounded p-2 space-y-2">
          <h5 className="font-semibold">{t('inventory.additionalRequired')}</h5>
          {additions.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>{t('inventory.article')}</th>
                  <th>{t('inventory.part')}</th>
                  <th>{t('inventory.additional')}</th>
                </tr>
              </thead>
              <tbody>
                {additions.map((p) => (
                  <tr key={p.article}>
                    <td>{p.article}</td>
                    <td>
                      {t(`inventory.parts.${p.label}`, {
                        defaultValue: p.name || p.label,
                      })}
                    </td>
                    <td className="text-center">{-p.remaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{t('inventory.noAdditional')}</p>
          )}
          <p className="text-xs">{t('inventory.additionalDisclaimer')}</p>
        </section>
      )}
    </>
  )
}
