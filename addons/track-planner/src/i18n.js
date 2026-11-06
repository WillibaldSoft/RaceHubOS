import i18n from '@core/i18n'
import de from './locales/de.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
for (const [language, words] of Object.entries({ de, en, fr }))
  i18n.addResourceBundle(language, 'plannerIntegration', words, true, true)
export default i18n
