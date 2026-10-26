import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation as useRoute } from 'react-router-dom';
import { HeartPulse, FolderHeart, MessageCircle, Calendar, Bell, UserCircle, PhoneCall, BookOpen } from 'lucide-react';
import { RoleSidebar } from '../../components/shared/RoleSidebar';
import { LanguageSwitcher } from '../../components/shared/LanguageSwitcher';
import { useAuth } from '../../auth/AuthContext';
import { getContext } from '../../api/continuity';
import { usePendingCheckIns } from '../../offline/pendingCheckIns';
import { LanguageProvider, useLanguage } from '../../i18n';
import { TourProvider } from '../../tour/TourProvider';
import { TextSizeControl } from '../../accessibility/TextSizeControl';
import { LocationProvider } from './location';
import { usePatientLocation } from './locationContext';
import { patientTourLabels, patientTourSteps } from './tour';
import { PendingCheckInsNotice } from './PendingCheckInsNotice';
import { useUnreadUpdates } from './useUnreadUpdates';

// Pages that show a pregnancy record. A new account has none until the care team links one.
const NEEDS_RECORD = new Set([
  '/patient/dashboard', '/patient/daily-log', '/patient/guided-check-in', '/patient/care-plan', '/patient/consent', '/patient/records',
  '/patient/questions', '/patient/appointments', '/patient/updates', '/patient/journey',
]);

function NoRecordYet() {
  const { t } = useLanguage();
  return (
    <main className="continuity-page">
      <section className="glass-panel continuity-panel" style={{ maxWidth: 640, margin: '40px auto' }}>
        <h1 className="page-title" style={{ fontSize: '1.3rem' }}>{t('Your care record is not set up yet')}</h1>
        <p>{t('Your care team has not linked your pregnancy record yet. This page fills in once they do. Meanwhile you can use Emergency help, References and your Profile.')}</p>
        <div className="continuity-actions">
          <Link className="btn-primary" to="/patient/emergency">{t('Emergency help')}</Link>
          <Link className="btn-secondary" to="/patient/references">{t('References')}</Link>
          <Link className="btn-secondary" to="/patient/profile">{t('Profile')}</Link>
        </div>
      </section>
    </main>
  );
}

function PatientLayout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { pathname } = useRoute();
  const where = usePatientLocation();
  const [hasRecord, setHasRecord] = useState<boolean | null>(null);
  const waiting = usePendingCheckIns(user?.id ?? '');
  const unread = useUnreadUpdates(user?.id ?? '', hasRecord === true, pathname);

  // Download the check-in pages while there is a signal, so they open without one (the service worker keeps them).
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let active = true;
    void navigator.serviceWorker.ready.then(() => {
      if (!active) return;
      window.setTimeout(() => { void import('./DailyLogPage'); void import('./GuidedCheckInPage'); void import('./EmergencyPage'); }, 2000);
    });
    return () => { active = false; };
  }, []);

  const signOut = () => {
    // A check-in kept on the phone is sent the next time she signs in, so she is asked before leaving it behind.
    if (waiting.length && !window.confirm(t('A check-in is kept on this phone and has not been sent. Sign out anyway? It will be sent the next time you sign in.'))) return;
    logout();
  };

  useEffect(() => {
    let active = true;
    getContext()
      .then((context) => { if (active) setHasRecord(context.episodes.length > 0); })
      .catch(() => { if (active) setHasRecord(true); }); // if this cannot be checked, show the pages and let them report their own errors
    return () => { active = false; };
  }, []);

  const navItems = [
    { label: t('My Care'), to: '/patient/dashboard', icon: <HeartPulse size={18} /> },
    { label: t('Daily Check-in'), to: '/patient/daily-log', icon: <HeartPulse size={18} />, alsoActiveOn: ['/patient/guided-check-in'] },
    { label: t('My Care Plan'), to: '/patient/care-plan', icon: <Calendar size={18} />, dot: unread.carePlan > 0 ? t('New reminders or documents') : undefined },
    { label: t('Care Companion'), to: '/patient/companion', icon: <MessageCircle size={18} /> },
    { label: t('Sharing & Consent'), to: '/patient/consent', icon: <UserCircle size={18} /> },
    { label: t('My Records'), to: '/patient/records', icon: <FolderHeart size={18} /> },
    { label: t('My Questions'), to: '/patient/questions', icon: <MessageCircle size={18} />, dot: unread.questions > 0 ? t('New answers') : undefined },
    { label: t('Appointments'), to: '/patient/appointments', icon: <Calendar size={18} /> },
    { label: t('References'), to: '/patient/references', icon: <BookOpen size={18} /> },
    { label: t('Updates'), to: '/patient/updates', icon: <Bell size={18} />, dot: unread.total > 0 ? t('New updates') : undefined },
    { label: t('Profile'), to: '/patient/profile', icon: <UserCircle size={18} /> },
  ];
  const blocked = hasRecord === false && NEEDS_RECORD.has(pathname);
  // Do not start loading a record's pages until we know there is a record: they would only fail for a new account.
  const checking = hasRecord === null && NEEDS_RECORD.has(pathname);

  return (
    <TourProvider userId={user?.id ?? ''} steps={patientTourSteps(t)} labels={patientTourLabels(t)}>
      <div className="app-container">
        <RoleSidebar
          brandSubtitle={t('Your pregnancy journey, in one place')}
          navItems={navItems}
          userName={user?.fullName ?? ''}
          roleLabel={t('Patient')}
          onLogout={signOut}
          logoutLabel={t('Logout')}
          skipLabel={t('Skip to main content')}
          footerExtra={
            <>
              <LanguageSwitcher />
              <TextSizeControl labels={{ title: t('Text size'), normal: t('Normal text'), large: t('Large text'), xlarge: t('Extra large text') }} />
            </>
          }
          topExtra={
            <Link to="/patient/emergency" className="sidebar-emergency">
              <PhoneCall size={18} aria-hidden="true" /> {t('Emergency help')}
            </Link>
          }
        />
        <div className="app-main-column" id="main-content" tabIndex={-1}>
          <PendingCheckInsNotice userId={user?.id ?? ''} />
          {where.away && pathname !== '/patient/emergency' && (
            <div className="continuity-note away-banner" role="status">
              {t('You seem to be away from your saved location.')}{' '}
              <Link to="/patient/emergency">{t('Open Emergency help')}</Link>
            </div>
          )}
          {/* No usable location: either none was ever saved (an account made before sign-up asked for one), or the area
              typed could not be found on the map. Emergency help still works; it just cannot show hospitals near home. */}
          {where.home && !where.home.hasHome && pathname !== '/patient/profile' && (
            <div className="continuity-note away-banner location-banner" role="status">
              {where.home.homeLabel
                ? t('We could not find “{place}” on the map, so Emergency help cannot show hospitals near you yet.', { place: where.home.homeLabel })
                : t('Add where you live so Emergency help can show the hospitals near you.')}{' '}
              <Link to="/patient/profile#location">{where.home.homeLabel ? t('Correct my location') : t('Add my location')}</Link>
            </div>
          )}
          {checking ? <main className="continuity-page"><p role="status" className="continuity-muted">{t('Loading…')}</p></main> : blocked ? <NoRecordYet /> : <Outlet />}
        </div>
      </div>
    </TourProvider>
  );
}

export function PatientShell() {
  return (
    <LanguageProvider>
      <LocationProvider>
        <PatientLayout />
      </LocationProvider>
    </LanguageProvider>
  );
}
