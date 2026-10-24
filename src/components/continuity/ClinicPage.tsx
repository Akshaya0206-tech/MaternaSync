import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
import { ROOT, formatTime } from "../../api/continuity";
import type { Clinic } from "../../api/continuity";
import { Badge, Empty, Feedback, Field, Page, Panel } from "./shared";

export function ClinicPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Clinic | null>(null);
  const [error, setError] = useState("");
  const [doctor, setDoctor] = useState("");
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    let active = true;
    api
      .get<Clinic>(`${ROOT}/clinic`)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const rate = (value: number, total: number) =>
    total
      ? `${Math.round((value / total) * 100)}% (${value}/${total})`
      : "No recorded data";
  const patients =
    data?.patients.filter(
      (p) =>
        (!doctor || p.doctors.includes(doctor)) &&
        (filter === "all" ||
          (filter === "missing" && p.missingCheckIn) ||
          (filter === "overdue" && p.overdue > 0) ||
          (filter === "unassigned" && p.unassigned > 0) ||
          (filter === "requests" && p.appointmentRequests > 0)),
    ) || [];
  return (
    <Page
      title="Shared clinic overview"
      subtitle="Workload, agreed follow-up, visits and recorded outcomes across your authorized caseload."
    >
      <Feedback error={error} />
      {!data && !error && <p role="status">Loading clinic…</p>}
      {data && (
        <>
          <div className="continuity-grid">
            <div className="continuity-stat">
              <strong>{data.patients.length}</strong>
              <span>Authorized patients</span>
            </div>
            <div className="continuity-stat">
              <strong>
                {data.patients.reduce((n, p) => n + p.overdue, 0)}
              </strong>
              <span>Overdue administrative tasks</span>
            </div>
            <div className="continuity-stat">
              <strong>
                {data.patients.filter((p) => p.missingCheckIn).length}
              </strong>
              <span>Agreed check-ins needing follow-up</span>
            </div>
            <div className="continuity-stat">
              <strong>
                {data.patients.reduce((n, p) => n + p.upcomingVisits, 0)}
              </strong>
              <span>Visits in the next 7 days</span>
            </div>
          </div>
          <Panel title="Caseload & follow-up queue">
            <div className="continuity-fields">
              <Field label="Clinician">
                <select
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                >
                  <option value="">All authorized clinicians</option>
                  {[...new Set(data.patients.flatMap((p) => p.doctors))]
                    .sort()
                    .map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                </select>
              </Field>
              <Field label="Work queue">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    ["all", "All patients"],
                    ["missing", "Missing agreed check-in"],
                    ["overdue", "Overdue tasks"],
                    ["unassigned", "Unassigned work"],
                    ["requests", "Appointment requests"],
                  ].map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="continuity-muted">
              Missing logs indicate missing information, not a diagnosis or
              evidence of non-adherence. Only explicitly agreed check-in
              schedules trigger follow-up.
            </p>
            <div className="continuity-table-wrap">
              <table className="continuity-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Follow-up flags</th>
                    <th>Clinicians</th>
                    <th>Open / overdue / unassigned</th>
                    <th>Last check-in</th>
                    <th>Follow-up</th>
                    <th>Visits / requests</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.episodeId}>
                      <td>
                        <Link
                          to={`/${user?.role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${p.episodeId}`}
                        >
                          {p.patientName}
                        </Link>
                      </td>
                      <td>
                        {p.openFlagCount === 0 ? (
                          "Nothing waiting"
                        ) : (
                          <Link
                            to={`/${user?.role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${p.episodeId}`}
                          >
                            <Badge>{p.openFlagCount} waiting</Badge>
                          </Link>
                        )}
                      </td>
                      <td>{p.doctors.join(", ")}</td>
                      <td>
                        {p.openTasks} / {p.overdue} / {p.unassigned}
                      </td>
                      <td>{formatTime(p.lastCheckIn)}</td>
                      <td>
                        {p.missingCheckIn ? (
                          <Badge>Missing agreed check-in</Badge>
                        ) : p.checkInDue ? (
                          "Within agreed schedule"
                        ) : (
                          "No monitoring agreement"
                        )}
                        <br />
                        {p.monitoringOwner}
                        <br />
                        {p.checkInDue && formatTime(p.checkInDue)}
                      </td>
                      <td>
                        {p.upcomingVisits} / {p.appointmentRequests}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!patients.length && <Empty>No patients match this queue.</Empty>}
          </Panel>
          <Panel title="Operational outcomes">
            <p className="continuity-muted">{data.definition}</p>
            <div className="continuity-grid">
              <div className="continuity-stat">
                <strong>
                  {rate(data.metrics.onTimeScans, data.metrics.recordedScans)}
                </strong>
                <span>On-time recorded scans</span>
              </div>
              <div className="continuity-stat">
                <strong>
                  {rate(data.metrics.noShows, data.metrics.attendedOrNoShow)}
                </strong>
                <span>No-show rate</span>
              </div>
              <div className="continuity-stat">
                <strong>{data.metrics.recordedDeliveries}</strong>
                <span>Documented delivery outcomes</span>
              </div>
            </div>
            {Object.entries(data.metrics.deliveryOutcomes).map(
              ([value, count]) => (
                <p key={value} className="continuity-muted">
                  {value}: {count}
                </p>
              ),
            )}
          </Panel>
        </>
      )}
    </Page>
  );
}
