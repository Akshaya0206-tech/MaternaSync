import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
import { ROOT, formatTime } from "../../api/continuity";
import type { Clinic } from "../../api/continuity";
import { tx, useLanguage } from "../../i18n";
import { Badge, Empty, Feedback, Field, Page, Panel } from "./shared";

const WORK_QUEUES = [
  ["all", tx("All patients")],
  ["missing", tx("Missing agreed check-in")],
  ["overdue", tx("Overdue tasks")],
  ["unassigned", tx("Unassigned work")],
  ["requests", tx("Appointment requests")],
];

export function ClinicPage() {
  const { t } = useLanguage();
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
      : t("No recorded data");
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
      title={t("Shared clinic overview")}
      subtitle={t("Workload, agreed follow-up, visits and recorded outcomes across your authorized caseload.")}
    >
      <Feedback error={t(error)} />
      {!data && !error && <p role="status">{t("Loading clinic…")}</p>}
      {data && (
        <>
          <div className="continuity-grid">
            <div className="continuity-stat">
              <strong>{data.patients.length}</strong>
              <span>{t("Authorized patients")}</span>
            </div>
            <div className="continuity-stat">
              <strong>
                {data.patients.reduce((n, p) => n + p.overdue, 0)}
              </strong>
              <span>{t("Overdue administrative tasks")}</span>
            </div>
            <div className="continuity-stat">
              <strong>
                {data.patients.filter((p) => p.missingCheckIn).length}
              </strong>
              <span>{t("Agreed check-ins needing follow-up")}</span>
            </div>
            <div className="continuity-stat">
              <strong>
                {data.patients.reduce((n, p) => n + p.upcomingVisits, 0)}
              </strong>
              <span>{t("Visits in the next 7 days")}</span>
            </div>
          </div>
          <Panel title={t("Caseload & follow-up queue")}>
            <div className="continuity-fields">
              <Field label={t("Clinician")}>
                <select
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                >
                  <option value="">{t("All authorized clinicians")}</option>
                  {[...new Set(data.patients.flatMap((p) => p.doctors))]
                    .sort()
                    .map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                </select>
              </Field>
              <Field label={t("Work queue")}>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {WORK_QUEUES.map(([key, label]) => (
                    <option key={key} value={key}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="continuity-muted">
              {t(
                "Missing logs indicate missing information, not a diagnosis or evidence of non-adherence. Only explicitly agreed check-in schedules trigger follow-up.",
              )}
            </p>
            <div className="continuity-table-wrap">
              <table className="continuity-table">
                <thead>
                  <tr>
                    <th>{t("Patient")}</th>
                    <th>{t("Follow-up flags")}</th>
                    <th>{t("Clinicians")}</th>
                    <th>{t("Open / overdue / unassigned")}</th>
                    <th>{t("Last check-in")}</th>
                    <th>{t("Follow-up")}</th>
                    <th>{t("Visits / requests")}</th>
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
                          t("Nothing waiting")
                        ) : (
                          <Link
                            to={`/${user?.role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${p.episodeId}`}
                          >
                            <Badge>{t("{count} waiting", { count: p.openFlagCount })}</Badge>
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
                          <Badge>{t("Missing agreed check-in")}</Badge>
                        ) : p.checkInDue ? (
                          t("Within agreed schedule")
                        ) : (
                          t("No monitoring agreement")
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
            {!patients.length && <Empty>{t("No patients match this queue.")}</Empty>}
          </Panel>
          <Panel title={t("Operational outcomes")}>
            {/* A fixed sentence from the server (backend/app/routers/continuity.py), translated when the dictionary has it. */}
            <p className="continuity-muted">{t(data.definition)}</p>
            <div className="continuity-grid">
              <div className="continuity-stat">
                <strong>
                  {rate(data.metrics.onTimeScans, data.metrics.recordedScans)}
                </strong>
                <span>{t("On-time recorded scans")}</span>
              </div>
              <div className="continuity-stat">
                <strong>
                  {rate(data.metrics.noShows, data.metrics.attendedOrNoShow)}
                </strong>
                <span>{t("No-show rate")}</span>
              </div>
              <div className="continuity-stat">
                <strong>{data.metrics.recordedDeliveries}</strong>
                <span>{t("Documented delivery outcomes")}</span>
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
