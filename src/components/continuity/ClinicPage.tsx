import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { formatTime, getClinic } from "../../api/continuity";
import type { Clinic } from "../../api/continuity";
import { tx, useLanguage } from "../../i18n";
import { Badge, Empty, Feedback, Field, Page, Panel } from "./shared";
import { ClinicExport } from "./ClinicExport";

const WORK_QUEUES = [
  ["all", tx("All patients")],
  ["missing", tx("Missing agreed check-in")],
  ["overdue", tx("Overdue tasks")],
  ["unassigned", tx("Unassigned work")],
  ["requests", tx("Appointment requests")],
];
const QUICK_RANGES = [
  ["7", tx("Last 7 days")],
  ["30", tx("Last 30 days")],
  ["all", tx("All time")],
];
// What each column of the caseload table counts, in plain words. Shown above the table and as a tooltip on the heading.
const COLUMNS = [
  [tx("Patient"), tx("The patient. Choose her name to open her connected care workspace.")],
  [tx("Follow-up flags"), tx("Missed agreed check-ins and overdue tasks, under rules a doctor approved. Never about a blood pressure, a weight or any other value.")],
  [tx("Clinicians"), tx("The doctors assigned to her.")],
  [tx("Open / overdue / unassigned"), tx("Open tasks for her, how many are past their due date, and how many have no owner. This is how things stand now.")],
  [tx("Last check-in"), tx("The most recent check-in she recorded. A skipped day is not counted.")],
  [tx("Follow-up"), tx("Whether she has an agreed check-in schedule, whether one is missing under it, who owns it and when the next one is due.")],
  [tx("Visits / requests"), tx("Visits booked in the next 7 days, and visit requests still waiting for an answer. This is how things stand now.")],
  [tx("In the range"), tx("Inside the chosen dates, in this order: visits (booked, completed or missed) / check-ins recorded / tasks created / tasks now completed. With no dates chosen, all recorded dates.")],
] as const;

/** A calendar day in UTC, `back` days before today (the clinic pages count days in UTC). */
const day = (back = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
};

export function ClinicPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [data, setData] = useState<Clinic | null>(null);
  const [error, setError] = useState("");
  const [doctor, setDoctor] = useState("");
  const [filter, setFilter] = useState("all");
  // The dates the figures are counted over. Null means all recorded dates.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [quick, setQuick] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rangeError, setRangeError] = useState("");
  const [loading, setLoading] = useState(false);
  const from_ = range?.from;
  const to_ = range?.to;
  useEffect(() => {
    let active = true;
    setLoading(true);
    getClinic(from_ && to_ ? { from: from_, to: to_ } : null)
      .then((r) => {
        if (active) { setData(r); setError(""); }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from_, to_]);

  const choose = (key: string) => {
    setQuick(key);
    setRangeError("");
    if (key === "all") {
      setRange(null);
      setFrom("");
      setTo("");
      return;
    }
    const first = day(Number(key) - 1);
    const last = day(0);
    setFrom(first);
    setTo(last);
    setRange({ from: first, to: last });
  };
  const applyDates = () => {
    if (!from || !to) return setRangeError(t("Choose both dates."));
    if (from > to) return setRangeError(t("The first date must not be after the last date."));
    setRangeError("");
    setQuick("custom");
    setRange({ from, to });
  };

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
  const rangeLabel = range ? `${range.from} – ${range.to}` : t("All recorded dates");
  const who = `/${user?.role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=`;
  const queueLabel = t((WORK_QUEUES.find(([key]) => key === filter) ?? WORK_QUEUES[0])[1]);
  return (
    <Page
      title={t("Shared clinic overview")}
      subtitle={t("Workload, agreed follow-up, visits and recorded outcomes across your authorized caseload.")}
    >
      <Feedback error={t(error)} />
      {!data && !error && <p role="status">{t("Loading clinic…")}</p>}
      {data && (
        <>
          <Panel title={t("Dates")}>
            <div className="clinic-range">
              <div className="continuity-actions" role="group" aria-label={t("Quick choices")}>
                {QUICK_RANGES.map(([key, label]) => (
                  <button key={key} type="button" className={quick === key ? "btn-primary" : "btn-secondary"} aria-pressed={quick === key} onClick={() => choose(key)}>
                    {t(label)}
                  </button>
                ))}
              </div>
              <div className="continuity-fields clinic-range-fields">
                <Field label={t("From")} error={rangeError && (!from || from > to) ? rangeError : undefined}>
                  <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label={t("To")} error={rangeError && !to ? rangeError : undefined}>
                  <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
                </Field>
                <div className="clinic-range-apply">
                  <button type="button" className="btn-secondary" disabled={loading} onClick={applyDates}>{t("Show these dates")}</button>
                </div>
              </div>
            </div>
            <p role="status" className="continuity-muted">
              {t("Showing")}: <strong>{rangeLabel}</strong>{loading ? ` · ${t("Loading clinic…")}` : ""}
            </p>
            <p className="continuity-muted">
              {t("Visits, check-ins, tasks created or completed, and recorded outcomes count what happened inside the dates. Open tasks, overdue tasks, agreed check-ins needing follow-up and visits in the next 7 days show how things stand right now and do not change with the dates. Days are counted in UTC.")}
            </p>
            <ClinicExport
              data={data}
              shown={patients}
              range={range}
              rangeLabel={rangeLabel}
              clinicianLabel={doctor || t("All authorized clinicians")}
              queueLabel={queueLabel}
            />
          </Panel>
          <h2 className="clinic-group-title" id="clinic-now">{t("Right now")}</h2>
          <div className="continuity-grid" role="group" aria-labelledby="clinic-now">
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
          <h2 className="clinic-group-title" id="clinic-range">{data.range ? t("In the range") : t("Across all recorded dates")}</h2>
          <div className="continuity-grid" role="group" aria-labelledby="clinic-range">
            <div className="continuity-stat">
              <strong>{data.periodTotals.visits}</strong>
              <span>{t("Visits in the range")}</span>
            </div>
            <div className="continuity-stat">
              <strong>{data.periodTotals.checkIns}</strong>
              <span>{t("Check-ins recorded in the range")}</span>
            </div>
            <div className="continuity-stat">
              <strong>{data.periodTotals.tasksCreated}</strong>
              <span>{t("Tasks created in the range")}</span>
            </div>
            <div className="continuity-stat">
              <strong>{data.periodTotals.tasksCompleted}</strong>
              <span>{t("Tasks completed in the range")}</span>
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
            <details className="clinic-columns-help">
              <summary>{t("What the columns mean")}</summary>
              <dl>
                {COLUMNS.map(([name, meaning]) => (
                  <div key={name}>
                    <dt>{t(name)}</dt>
                    <dd>{t(meaning)}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <div className="continuity-table-wrap" tabIndex={0} role="region" aria-label={t("Caseload & follow-up queue")}>
              <table className="continuity-table">
                <thead>
                  <tr>
                    {COLUMNS.map(([name, meaning]) => (
                      <th key={name} scope="col" title={t(meaning)}>{t(name)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.episodeId}>
                      <td>
                        <Link to={`${who}${p.episodeId}`}>
                          {p.patientName}
                        </Link>
                      </td>
                      <td>
                        {p.openFlagCount === 0 ? (
                          t("Nothing waiting")
                        ) : (
                          <Link to={`${who}${p.episodeId}`}>
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
                      <td>
                        {p.inRange.visits} / {p.inRange.checkIns} / {p.inRange.tasksCreated} / {p.inRange.tasksCompleted}
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
