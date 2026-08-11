import { LOCALE_LABEL, LOCALES, type Locale } from "@/i18n"
import { setLocaleAction } from "@/i18n/actions"

/**
 * The language switcher.
 *
 * Two buttons rather than a select: there are two languages, and a driver in
 * sunlight should not have to open a dropdown to find the one he reads. The
 * inactive one is a form submit; the active one is inert text.
 */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  return (
    <div className="lang">
      {LOCALES.map((option) =>
        option === locale ? (
          <span key={option} className="lang-current" aria-current="true">
            {LOCALE_LABEL[option]}
          </span>
        ) : (
          <form key={option} action={setLocaleAction}>
            <input type="hidden" name="locale" value={option} />
            <button type="submit" className="lang-switch">
              {LOCALE_LABEL[option]}
            </button>
          </form>
        ),
      )}
    </div>
  )
}
