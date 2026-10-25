import type { CSSProperties, ReactNode } from 'react';

// Pieces of the Profile page (profile.css). Everything drawn here is decoration and hidden from screen readers; only the text it is given is read.

/** The heading of a card: a tinted icon tile, the title and a line saying what the card is for. */
export function CardHeading({ icon, title, subtitle, id }: { icon: ReactNode; title: string; subtitle?: ReactNode; id?: string }) {
  return (
    <div className="pf-card-head">
      <span className="pf-card-icon" aria-hidden="true">{icon}</span>
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

/** One field: an icon tile, a small label and the box. The whole tile is the label, so a tap anywhere on it goes to the box. */
export function FieldTile({ icon, label, index = 0, children }: { icon: ReactNode; label: string; index?: number; children: ReactNode }) {
  return (
    <label className="pf-tile" style={{ '--pf-t': index } as CSSProperties}>
      <span className="pf-tile-icon" aria-hidden="true">{icon}</span>
      <span className="pf-tile-body">
        <span className="pf-tile-label">{label}</span>
        {children}
      </span>
    </label>
  );
}

/** A heartbeat line ending in a heart, behind the name. */
export function HeartbeatLine() {
  return (
    <svg className="pf-heartbeat" viewBox="0 0 300 90" fill="none" aria-hidden="true" focusable="false">
      <path pathLength={1} d="M0 52 H72 L88 52 L100 22 L116 80 L130 8 L144 62 L156 52 H212" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path className="pf-heart" d="M248 74 C226 58 218 46 224 36 C230 27 243 28 248 38 C253 28 266 27 272 36 C278 46 270 58 248 74 Z" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
    </svg>
  );
}

/** The skyline behind the saved place. */
export function Skyline() {
  return (
    <svg className="pf-skyline" viewBox="0 0 150 40" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M0 40V24h12V14h10v26h8V20h14v20h10V8h12v32h10V26h14v14h10V16h10v24h8V22h12v18z" />
    </svg>
  );
}

/** The map beside the Location title: a small hospital, two trees and a pin. While the device is asked for its position the pin bobs
 *  and rings spread from its foot; when the position is found the rings ping once. */
export function LocationArt({ locating, found }: { locating: boolean; found: boolean }) {
  return (
    <svg className={`pf-location-art${locating ? ' is-locating' : ''}${found ? ' is-found' : ''}`} viewBox="0 0 260 120" aria-hidden="true" focusable="false">
      <ellipse cx="130" cy="101" rx="124" ry="15" fill="var(--sage-muted)" opacity="0.55" />
      <ellipse cx="130" cy="99" rx="106" ry="11" fill="var(--mint-soft)" />
      <path d="M44 98 Q130 88 218 100" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
      {/* the tree on the left */}
      <rect x="67" y="80" width="5" height="19" rx="2" fill="var(--forest-deep)" />
      <circle cx="70" cy="69" r="15" fill="var(--teal-primary)" opacity="0.92" />
      <circle cx="60" cy="79" r="10" fill="var(--sage-muted)" />
      {/* the hospital */}
      <rect x="104" y="36" width="66" height="63" rx="7" fill="#fff" stroke="rgba(18,60,53,0.18)" />
      <rect x="118" y="21" width="38" height="19" rx="5" fill="#fff" stroke="rgba(18,60,53,0.18)" />
      <rect x="135" y="24" width="4" height="13" rx="1" fill="var(--terracotta)" />
      <rect x="130.5" y="28.5" width="13" height="4" rx="1" fill="var(--terracotta)" />
      <g fill="var(--teal-primary)" opacity="0.72">
        {[44, 60].flatMap((y) => [114, 132, 150].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="10" height="9" rx="2" />))}
      </g>
      <rect x="128" y="78" width="14" height="21" rx="3" fill="var(--teal-primary)" />
      {/* the tree on the right */}
      <rect x="215" y="84" width="4" height="15" rx="2" fill="var(--forest-deep)" />
      <circle cx="217" cy="76" r="11" fill="var(--teal-primary)" opacity="0.85" />
      {/* rings at the foot of the pin, then the pin */}
      <g transform="translate(190 99)">
        <ellipse className="pf-art-ring" cx="0" cy="0" rx="12" ry="4.5" />
        <ellipse className="pf-art-ring" cx="0" cy="0" rx="12" ry="4.5" />
        <ellipse className="pf-art-ring" cx="0" cy="0" rx="12" ry="4.5" />
        <g className="pf-pin">
          <path d="M0 0 C-3 -5 -13 -14 -13 -24 C-13 -31 -7 -37 0 -37 C7 -37 13 -31 13 -24 C13 -14 3 -5 0 0 Z" fill="var(--teal-primary)" stroke="#fff" strokeWidth="2.5" />
          <circle cx="0" cy="-24" r="5" fill="#fff" />
        </g>
      </g>
    </svg>
  );
}

/** A tick in a circle that draws itself. */
export function SuccessCheck({ size = 22 }: { size?: number }) {
  return (
    <svg className="pf-check" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle className="pf-check-ring" pathLength={1} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path className="pf-check-tick" pathLength={1} d="M7.5 12.5 L10.5 15.5 L16.5 9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Where each piece of the burst goes, how far it turns and which of the app's colours it is. Fixed, so the burst looks the same every time.
const PIECES: { x: number; y: number; r: number; c: string }[] = [
  { x: -54, y: -26, r: 200, c: '--teal-primary' }, { x: -38, y: -44, r: -160, c: '--terracotta' }, { x: -14, y: -52, r: 120, c: '--sage-muted' },
  { x: 14, y: -50, r: -210, c: '--forest-deep' }, { x: 40, y: -42, r: 170, c: '--peach-muted' }, { x: 58, y: -22, r: -120, c: '--teal-primary' },
  { x: 60, y: 6, r: 240, c: '--terracotta' }, { x: 44, y: 30, r: -180, c: '--sage-muted' }, { x: 16, y: 40, r: 150, c: '--forest-deep' },
  { x: -16, y: 40, r: -140, c: '--peach-muted' }, { x: -44, y: 30, r: 190, c: '--teal-primary' }, { x: -60, y: 4, r: -230, c: '--terracotta' },
];

/** A brief burst of the app's colours round a saved tick. Only drawn when motion is allowed (profile.css). */
export function Confetti() {
  return (
    <span className="pf-confetti" aria-hidden="true">
      {PIECES.map((piece, index) => (
        <i key={index} style={{ '--x': `${piece.x}px`, '--y': `${piece.y}px`, '--r': `${piece.r}deg`, '--c': `var(${piece.c})`, '--d': `${index * 22}ms` } as CSSProperties} />
      ))}
    </span>
  );
}

/** "Saved": the tick draws itself and a burst of colour glows round it. Mount it again (change its key) to play it again. */
export function SavedBadge({ children, className = 'pf-saved' }: { children: ReactNode; className?: string }) {
  return (
    <span className={className} role="status">
      <Confetti />
      <SuccessCheck />
      {children}
    </span>
  );
}

/** Rings that spread from a dot while a position is being looked for. It is named for screen readers; the words are not repeated beside it. */
export function Radar({ label }: { label: string }) {
  return (
    <span className="pf-radar" role="status" aria-label={label}>
      <i /><i /><i />
      <b />
    </span>
  );
}
