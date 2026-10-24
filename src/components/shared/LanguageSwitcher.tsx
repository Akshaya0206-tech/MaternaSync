import { Languages } from 'lucide-react';
import { useLanguage } from '../../i18n';
import type { Language } from '../../i18n';

export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', hi: 'हिन्दी', ta: 'தமிழ்', te: 'తెలుగు' };

/** The language menu. "sidebar" sits at the bottom of a role's menu; "page" is for the sign-in and landing pages. */
export function LanguageSwitcher({ tone = 'sidebar' }: { tone?: 'sidebar' | 'page' }) {
  const { language, setLanguage, t } = useLanguage();
  const sidebar = tone === 'sidebar';
  return (
    <label style={sidebar
      ? { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px 8px', color: 'var(--sidebar-text)', fontSize: '0.75rem' }
      : { display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}
    >
      <Languages size={16} aria-hidden="true" />
      <span style={{ flexShrink: 0 }}>{t('Language')}</span>
      <select
        value={language}
        onChange={(event) => void setLanguage(event.target.value as Language)}
        aria-label={t('Language')}
        style={sidebar
          ? { flex: 1, minWidth: 0, padding: '5px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sidebar-border)', background: 'var(--sidebar-bg)', color: 'var(--cream-soft)', fontSize: '0.8rem' }
          : { padding: '6px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
      >
        {Object.entries(LANGUAGE_NAMES).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
    </label>
  );
}
