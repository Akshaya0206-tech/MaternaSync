// No auth headers — the External Hospital Simulator is deliberately
// unauthenticated (see backend/app/routers/external_simulator.py for why).
// This module intentionally does NOT import the shared `api` client, since
// that one always attaches a bearer token; the simulator must work
// identically whether or not the operator happens to be logged in as one
// of MaternaSync's own users.

export interface SimulatorReferral {
  referenceCode: string;
  patientName: string;
  referralType: string;
  destination: string | null;
  status: string;
  createdDate: string;
  doctorName: string;
  careCoordinatorName: string | null;
  message: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let message = 'Something went wrong.';
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') message = data.detail;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export function fetchIncomingReferrals(): Promise<SimulatorReferral[]> {
  return request<SimulatorReferral[]>('/api/v2/external-simulator/referrals');
}

export function fetchIncomingReferral(referenceCode: string): Promise<SimulatorReferral> {
  return request<SimulatorReferral>(`/api/v2/external-simulator/referrals/${referenceCode}`);
}

export function acknowledgeReferral(referenceCode: string): Promise<SimulatorReferral> {
  return request<SimulatorReferral>(`/api/v2/external-simulator/referrals/${referenceCode}/acknowledge`, {
    method: 'POST', body: JSON.stringify({}),
  });
}

export function scheduleAppointment(referenceCode: string, appointmentDate: string, appointmentTime: string, externalProvider: string): Promise<SimulatorReferral> {
  return request<SimulatorReferral>(`/api/v2/external-simulator/referrals/${referenceCode}/appointment`, {
    method: 'POST', body: JSON.stringify({ appointmentDate, appointmentTime, externalProvider }),
  });
}

export function sendResponse(referenceCode: string, responseText: string): Promise<SimulatorReferral> {
  return request<SimulatorReferral>(`/api/v2/external-simulator/referrals/${referenceCode}/response`, {
    method: 'POST', body: JSON.stringify({ responseText }),
  });
}
