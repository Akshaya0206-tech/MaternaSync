import { api } from './client';

export interface EmergencyNumber {
  number: string;
  label: string;
  kind: 'emergency' | 'ambulance' | 'pregnancy' | 'support';
}

export interface EmergencyProfile {
  homeLabel: string | null;
  homeLat: number | null;
  homeLon: number | null;
  hasHome: boolean;
  contactName: string | null;
  contactRelation: string | null;
  contactPhone: string | null;
  hospitalName: string | null;
  hospitalPhone: string | null;
  hospitalAddress: string | null;
  /** The number on her Mother and Child Protection card, typed by her. */
  mcpNumber: string | null;
  liveLocation: boolean;
}

export interface EmergencyInput {
  homeLabel: string | null;
  homeLat: number | null;
  homeLon: number | null;
  contactName: string | null;
  contactRelation: string | null;
  contactPhone: string | null;
  hospitalName: string | null;
  hospitalPhone: string | null;
  hospitalAddress: string | null;
  /** Leave out to keep what is saved (the Profile page's location form does not know about it). */
  mcpNumber?: string | null;
  liveLocation: boolean;
}

/** A hospital the patient's clinic recommends. */
export interface ClinicHospital {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  note: string | null;
}

/** What the clinic tells its patients about itself, and her own doctor. */
export interface ClinicInfo {
  name: string | null;
  phone: string | null;
  doctorName: string | null;
  hospitals: ClinicHospital[];
}

export interface EmergencyOverview {
  profile: EmergencyProfile;
  region: string | null;
  numbers: EmergencyNumber[];
  note: string;
  located?: boolean | null;
  /** The clinic's details and hospitals; an older server does not send them. */
  clinic?: ClinicInfo;
  /** Her own name and estimated due date, for the card she can show at a hospital. */
  me?: { name: string; edd: string | null };
}

export interface Hospital {
  name: string;
  address: string | null;
  phone: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
  emergencyDepartment: boolean;
  hospitalLike: boolean;
  directionsUrl: string;
}

export interface NearbyHospitals {
  needsLocation: boolean;
  usedPosition: { lat: number; lon: number } | null;
  awayKm: number | null;
  away: boolean;
  hospitals: Hospital[];
  error: string | null;
  region: string | null;
  numbers: EmergencyNumber[];
  note: string;
}

const BASE = '/api/v2/patient/emergency';

export const getEmergency = () => api.get<EmergencyOverview>(BASE);
export const saveEmergency = (body: EmergencyInput) => api.put<EmergencyOverview>(BASE, body);
export const getNearbyHospitals = (position?: { lat: number; lon: number } | null) =>
  api.get<NearbyHospitals>(position ? `${BASE}/nearby?lat=${position.lat}&lon=${position.lon}` : `${BASE}/nearby`);

/** Straight-line distance in kilometres between two positions. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Away from the saved home by more than this many kilometres (the server uses the same figure). */
export const AWAY_KM = 25;
