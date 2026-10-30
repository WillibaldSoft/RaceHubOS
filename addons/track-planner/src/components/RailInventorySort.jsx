import { useTranslation } from 'react-i18next'
export default function RailInventorySort({ value, onChange, testId = 'inventory-sort' }) {
  const { t } = useTranslation('tracks')
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      {t('inventory.sort')}{' '}
      <select
        data-testid={testId}
        className="border rounded p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {['stockDesc', 'stockAsc', 'article'].map((key) => (
          <option key={key} value={key}>
            {t(`inventory.sort_${key}`)}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">{t('inventory.stockFirst')}</span>
    </label>
  )
}
