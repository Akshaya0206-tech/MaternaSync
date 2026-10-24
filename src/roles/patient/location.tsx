import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AWAY_KM, distanceKm, getEmergency } from '../../api/emergency';
import type { EmergencyProfile } from '../../api/emergency';
import { LocationContext, TRACKING_KEY } from './locationContext';
import type { LocationStatus, LocationValue, Position } from './locationContext';

function readTracking(): boolean {
  try {
    return localStorage.getItem(TRACKING_KEY) === '1';
  } catch {
    return false;
  }
}

/** The patient's position, only ever read from the device with their permission and only while the app is open.
 *  It stays in this browser: it is sent to the server only when asking for nearby hospitals, and never stored. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState<Position | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [tracking, setTrackingState] = useState(readTracking);
  const [home, setHome] = useState<EmergencyProfile | null>(null);
  const watch = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    getEmergency()
      .then((overview) => {
        if (!active) return;
        setHome(overview.profile);
        // The saved choice follows the patient to another device.
        if (overview.profile.liveLocation && !readTracking()) setTrackingState(true);
      })
      .catch(() => { /* the emergency page loads its own copy and shows the error */ });
    return () => { active = false; };
  }, []);

  const accept = useCallback((p: GeolocationPosition): Position => {
    const next = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy, at: p.timestamp };
    setPosition(next);
    setStatus('ready');
    return next;
  }, []);

  const fail = useCallback((error: GeolocationPositionError) => {
    setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
  }, []);

  const locate = useCallback(
    () =>
      new Promise<Position | null>((resolve) => {
        if (!('geolocation' in navigator)) {
          setStatus('unavailable');
          resolve(null);
          return;
        }
        setStatus('asking');
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(accept(p)),
          (error) => { fail(error); resolve(null); },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
        );
      }),
    [accept, fail],
  );

  const setTracking = useCallback((on: boolean) => {
    setTrackingState(on);
    try {
      localStorage.setItem(TRACKING_KEY, on ? '1' : '0');
    } catch {
      /* the choice just does not survive a reload */
    }
  }, []);

  useEffect(() => {
    if (!tracking || !('geolocation' in navigator)) return;
    watch.current = navigator.geolocation.watchPosition(accept, fail, { enableHighAccuracy: false, maximumAge: 120000, timeout: 20000 });
    return () => {
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      watch.current = null;
    };
  }, [tracking, accept, fail]);

  const awayKm = useMemo(
    () => (position && home?.hasHome && home.homeLat !== null && home.homeLon !== null ? distanceKm(home.homeLat, home.homeLon, position.lat, position.lon) : null),
    [position, home],
  );

  const value: LocationValue = { position, status, tracking, setTracking, locate, home, setHome, awayKm, away: awayKm !== null && awayKm > AWAY_KM };
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
