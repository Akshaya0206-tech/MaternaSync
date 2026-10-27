import { useEffect, useState } from 'react';
import { fetchPatients } from '../../api/doctorPortal';

// "Next patient" and "Previous patient" in a patient's workspace follow the order My Patients last showed (after its search, chips and sort). That order is
// kept for this browser tab only. If it was never shown, or the patient is not in it, the doctor's patients in name order are used.
const KEY = 'maternasync.doctor.patient-order';
export interface PatientStop { id: string; name: string }

export function rememberPatientOrder(order: PatientStop[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(order)); } catch { /* not kept: the name order is used */ }
}

function remembered(): PatientStop[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
  } catch {
    return [];
  }
}

/** The patient before and after this one in the list, either of which may be missing at the ends. */
export function useNeighbours(episodeId: string): { previous: PatientStop | null; next: PatientStop | null } {
  const [order, setOrder] = useState<PatientStop[]>(remembered);
  useEffect(() => {
    const saved = remembered();
    if (saved.some((stop) => stop.id === episodeId)) { setOrder(saved); return; }
    let current = true;
    fetchPatients()
      .then((rows) => {
        if (!current) return;
        setOrder([...rows].sort((a, b) => a.patientName.localeCompare(b.patientName)).map((row) => ({ id: row.episodeId, name: row.patientName })));
      })
      .catch(() => { if (current) setOrder([]); });
    return () => { current = false; };
  }, [episodeId]);
  const at = order.findIndex((stop) => stop.id === episodeId);
  return { previous: at > 0 ? order[at - 1] : null, next: at >= 0 && at < order.length - 1 ? order[at + 1] : null };
}
