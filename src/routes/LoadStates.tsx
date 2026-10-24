import { Component } from 'react';
import type { ReactNode } from 'react';
import { useLanguage } from '../i18n';

/** Shown while a page that is downloaded the first time it is opened is on its way. */
export function PageLoading() {
  const { t } = useLanguage();
  return (
    <main className="continuity-page">
      <p role="status" className="continuity-muted">{t('Loading…')}</p>
    </main>
  );
}

function LoadFailed() {
  const { t } = useLanguage();
  return (
    <main className="continuity-page">
      <section className="glass-panel continuity-panel" style={{ maxWidth: 560, margin: '40px auto' }}>
        <p role="alert">{t('This page could not be loaded. Check your connection and try again.')}</p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>{t('Try again')}</button>
      </section>
    </main>
  );
}

// What browsers say when the file of a page cannot be downloaded: Chrome, Firefox and Safari word it differently.
const DOWNLOAD_FAILED = /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk/i;

/** Catches a page that could not be downloaded (a weak or dropped connection, or a site updated since the tab was
 *  opened) and offers to try again. Any other error is passed on unchanged, so real bugs are not hidden behind it. */
export class LoadBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (DOWNLOAD_FAILED.test(`${error.name} ${error.message}`)) return <LoadFailed />;
    throw error;
  }
}
