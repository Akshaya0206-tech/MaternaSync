import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { TourContext, readTour, writeTour } from './tourContext';
import type { TourLabels, TourStatus, TourStep, TourValue } from './tourContext';

/** A short guided walk through the sidebar for a new account: it opens each page in turn, highlights its menu item
 *  and explains it in a sentence or two. "Start a tour" is always available on the Profile page. */
export function TourProvider({ userId, steps, labels, children }: { userId: string; steps: TourStep[]; labels: TourLabels; children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<TourStatus>(() => readTour(userId));
  const [welcome, setWelcome] = useState(() => readTour(userId) === 'pending');
  const [index, setIndex] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const target = index === null ? null : steps[index]?.to ?? null;

  const close = useCallback(() => {
    writeTour(userId, 'done');
    setStatus('done');
    setWelcome(false);
    setIndex(null);
  }, [userId]);

  const go = useCallback((next: number) => {
    setIndex(next);
    navigate(steps[next].to);
  }, [navigate, steps]);

  const start = useCallback(() => {
    setWelcome(false);
    go(0);
  }, [go]);

  // Highlight the menu item of the page being explained.
  useEffect(() => {
    if (!target) return;
    // A data attribute, not a class: React re-renders the menu links when the page changes and would wipe a class.
    const link = document.querySelector(`aside a[href="${target}"]`);
    link?.setAttribute('data-tour-highlight', 'true');
    link?.scrollIntoView?.({ block: 'nearest' });
    return () => link?.removeAttribute('data-tour-highlight');
  }, [target]);

  useEffect(() => {
    if (index !== null) heading.current?.focus();
  }, [index]);

  useEffect(() => {
    if (!welcome && index === null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [welcome, index, close]);

  const value: TourValue = useMemo(() => ({ status, running: index !== null, start }), [status, index, start]);
  const step = index === null ? null : steps[index];

  return (
    <TourContext.Provider value={value}>
      {children}
      {welcome && (
        <div className="tour-backdrop">
          <div className="tour-welcome glass-panel" role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title">
            <h2 id="tour-welcome-title">{labels.welcomeTitle}</h2>
            <p>{labels.welcomeText}</p>
            <div className="tour-actions">
              <button className="btn-primary" onClick={start} autoFocus>{labels.start}</button>
              <button className="btn-secondary" onClick={close}>{labels.later}</button>
            </div>
          </div>
        </div>
      )}
      {step && index !== null && (
        <div className="tour-card glass-panel" role="dialog" aria-labelledby="tour-step-title" aria-live="polite">
          <div className="tour-progress">{labels.stepOf(index + 1, steps.length)}</div>
          <h2 id="tour-step-title" ref={heading} tabIndex={-1}>{step.title}</h2>
          <p>{step.text}</p>
          <div className="tour-actions">
            {index > 0 && <button className="btn-secondary" onClick={() => go(index - 1)}>{labels.back}</button>}
            {index < steps.length - 1 ? (
              <button className="btn-primary" onClick={() => go(index + 1)}>{labels.next}</button>
            ) : (
              <button className="btn-primary" onClick={close}>{labels.finish}</button>
            )}
            <button className="tour-skip" onClick={close}>{labels.skip}</button>
          </div>
        </div>
      )}
    </TourContext.Provider>
  );
}
