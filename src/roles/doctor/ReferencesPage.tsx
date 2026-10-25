import { useSearchParams } from 'react-router-dom';
import { Page } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';
import { GuidelineSearchView, GuidelineSourcesView } from './GuidelinesPage';
import { ReferenceLibraryView } from './ReferenceLibraryPage';

type Tab = 'library' | 'guidelines' | 'sources';

// One menu item, three tabs. The old addresses /doctor/library and /doctor/guidelines lead here (see AppRoutes).
const TABS: [Tab, string][] = [
  ['library', tx('Reference Library')],
  ['guidelines', tx('Guideline search')],
  ['sources', tx('Guideline sources')],
];

export function ReferencesPage() {
  const { t } = useLanguage();
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const tab: Tab = TABS.some(([key]) => key === asked) ? (asked as Tab) : 'library';
  const open = (next: Tab) => setParams(next === 'library' ? {} : { tab: next }, { replace: true });

  return (
    <Page
      title={t('References')}
      subtitle={t('Real, published documents to look things up in. A search shows the passage and its page; it does not answer a clinical question for you.')}
    >
      <div className="continuity-tabs">
        {TABS.map(([key, label]) => (
          <button key={key} aria-pressed={tab === key} onClick={() => open(key)}>{t(label)}</button>
        ))}
      </div>
      {/* The library is only hidden while another tab is open, so what you were typing is still there when you come back. The other two are
          loaded fresh each time: an approval made under Guideline sources is then already in Guideline search. */}
      <div hidden={tab !== 'library'}><ReferenceLibraryView /></div>
      {tab === 'guidelines' && <GuidelineSearchView onOpenSources={() => open('sources')} onOpenLibrary={() => open('library')} />}
      {tab === 'sources' && <GuidelineSourcesView />}
    </Page>
  );
}
