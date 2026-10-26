import { useSearchParams } from 'react-router-dom';
import { Page } from '../../components/continuity/shared';
import { tx, useLanguage } from '../../i18n';
import { AboutWebsiteView } from './AboutWebsiteView';
import { GuidelineSearchView, GuidelineSourcesView } from './GuidelinesPage';
import { ReferenceLibraryView } from './ReferenceLibraryPage';
import { PatientInformationView } from './PatientInformationView';

type Tab = 'library' | 'guidelines' | 'sources' | 'patient' | 'about';

// One menu item, five tabs. The old addresses /doctor/library and /doctor/guidelines lead here (see AppRoutes).
const TABS: [Tab, string][] = [
  ['library', tx('Reference Library')],
  ['guidelines', tx('Guideline search')],
  ['sources', tx('Guideline sources')],
  ['patient', tx('Patient information')],
  ['about', tx('About Website')],
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
      subtitle={tab === 'about'
        ? t('A guide for a doctor who is new to MaternaSync: what it is for, where things are and what it will never do.')
        : tab === 'patient'
          ? t('The topics on the patient References page. Mark a topic as reviewed once your clinic has read it, and patients see who reviewed it and when.')
          : t('Real, published documents to look things up in. A search shows the passage and its page; it does not answer a clinical question for you.')}
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
      {tab === 'patient' && <PatientInformationView />}
      {tab === 'about' && <AboutWebsiteView />}
    </Page>
  );
}
