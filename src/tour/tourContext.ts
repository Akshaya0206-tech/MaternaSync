import { createContext, useContext } from 'react';

export interface TourStep {
  /** The page this step is about; the tour opens it and highlights its sidebar item. */
  to: string;
  title: string;
  text: string;
}

export interface TourLabels {
  welcomeTitle: string;
  welcomeText: string;
  start: string;
  later: string;
  next: string;
  back: string;
  finish: string;
  skip: string;
  stepOf: (step: number, total: number) => string;
}

/** 'pending': a brand-new account that has not been offered the tour yet. 'done': finished or skipped. */
export type TourStatus = 'pending' | 'done' | null;

export interface TourValue {
  status: TourStatus;
  running: boolean;
  start: () => void;
}

export const TourContext = createContext<TourValue>({ status: null, running: false, start: () => undefined });

export const useTour = () => useContext(TourContext);

const key = (userId: string) => `maternasync_tour_${userId}`;

export function readTour(userId: string): TourStatus {
  try {
    const value = localStorage.getItem(key(userId));
    return value === 'pending' || value === 'done' ? value : null;
  } catch {
    return null;
  }
}

export function writeTour(userId: string, status: 'pending' | 'done'): void {
  try {
    localStorage.setItem(key(userId), status);
  } catch {
    /* without storage the tour is simply offered again next time */
  }
}

/** Called once, when a brand-new patient or doctor account is created, so the first sign-in offers the tour. */
export function offerTourToNewAccount(userId: string): void {
  writeTour(userId, 'pending');
}
