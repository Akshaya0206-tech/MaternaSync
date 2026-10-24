import { createContext, useContext } from 'react';
import type { EmergencyProfile } from '../../api/emergency';

export interface Position {
  lat: number;
  lon: number;
  accuracy: number;
  at: number;
}

export type LocationStatus = 'idle' | 'asking' | 'ready' | 'denied' | 'unavailable';

export interface LocationValue {
  position: Position | null;
  status: LocationStatus;
  /** The patient chose to keep their position up to date while the app is open. */
  tracking: boolean;
  setTracking: (on: boolean) => void;
  /** Ask the device for the current position once (the browser asks the patient for permission). */
  locate: () => Promise<Position | null>;
  home: EmergencyProfile | null;
  setHome: (profile: EmergencyProfile) => void;
  /** Kilometres from the saved home, when both are known. */
  awayKm: number | null;
  away: boolean;
}

export const LocationContext = createContext<LocationValue | null>(null);
export const TRACKING_KEY = 'maternasync_live_location';

export function usePatientLocation(): LocationValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error('usePatientLocation must be used inside LocationProvider');
  return value;
}
