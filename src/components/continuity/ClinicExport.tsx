import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer } from "lucide-react";
import { useAuth } from "../../auth/AuthContext";
import { recordClinicExport } from "../../api/doctorOverview";
import { formatTime } from "../../api/continuity";
import type { Clinic } from "../../api/continuity";
import { useLanguage } from "../../i18n";
import { Feedback, useAction } from "./shared";

/** A spreadsheet reads a cell that starts with = + - or @ as a formula, so free text that starts that way gets a quote in front. */
const safeText = (value: string | null | undefined) => {
  const text = value ?? "";
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};
const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const stamp = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type Shown = Clinic["patients"];

interface Props {
  data: Clinic;
  /** The patients on screen (after the clinician and work-queue choices): what is printed or downloaded. */
  shown: Shown;
  range: { from: string; to: string } | null;
  /** Already worded in the reader's language. */
  rangeLabel: string;
  clinicianLabel: string;
  queueLabel: string;
}

/** The clinic overview as a plain sheet for the weekly clinic meeting, to print (or save as a PDF) or to open in a spreadsheet.
 *  Counts and dates only: no scores, no ranking. Each print or download is recorded on the server. */
export function ClinicExport({ data, shown, range, rangeLabel, clinicianLabel, queueLabel }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const action = useAction();
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const done = () => document.body.classList.remove("printing-entries");
    window.addEventListener("afterprint", done);
    return () => { window.removeEventListener("afterprint", done); done(); };
  }, []);

  const rate = (value: number, total: number) => (total ? `${Math.round((value / total) * 100)}% (${value}/${total})` : t("No recorded data"));
  const rightNow = [
    [t("Authorized patients"), data.patients.length],
    [t("Overdue administrative tasks"), data.patients.reduce((n, p) => n + p.overdue, 0)],
    [t("Agreed check-ins needing follow-up"), data.patients.filter((p) => p.missingCheckIn).length],
    [t("Visits in the next 7 days"), data.patients.reduce((n, p) => n + p.upcomingVisits, 0)],
  ] as const;
  const inTheRange = [
    [t("Visits in the range"), data.periodTotals.visits],
    [t("Check-ins recorded in the range"), data.periodTotals.checkIns],
    [t("Tasks created in the range"), data.periodTotals.tasksCreated],
    [t("Tasks completed in the range"), data.periodTotals.tasksCompleted],
  ] as const;
  const outcomes = [
    [t("On-time recorded scans"), rate(data.metrics.onTimeScans, data.metrics.recordedScans)],
    [t("No-show rate"), rate(data.metrics.noShows, data.metrics.attendedOrNoShow)],
    [t("Documented delivery outcomes"), data.metrics.recordedDeliveries],
    ...Object.entries(data.metrics.deliveryOutcomes).map(([value, count]) => [value, count] as const),
  ];
  const followUp = (p: Shown[number]) =>
    p.missingCheckIn ? t("Missing agreed check-in") : p.checkInDue ? t("Within agreed schedule") : t("No monitoring agreement");

  const record = (kind: "print" | "csv") => recordClinicExport({ kind, fromDate: range?.from ?? null, toDate: range?.to ?? null, patients: shown.length });

  const print = () =>
    action.run(async () => {
      await record("print");
      setSheet(true);
      // The sheet is drawn first; the print window opens on the next turn so it has something to print.
      window.setTimeout(() => { document.body.classList.add("printing-entries"); window.print(); }, 60);
    }, "");

  const download = () =>
    action.run(async () => {
      await record("csv");
      const info: (string | number)[][] = [
        [t("Clinic summary")],
        [t("Clinic"), safeText(data.clinic.name)],
        [t("Clinic phone"), safeText(data.clinic.phone)],
        [t("Dates"), rangeLabel],
        [t("Clinician"), clinicianLabel],
        [t("Work queue"), queueLabel],
        [t("Prepared on"), stamp(new Date().toISOString())],
        [t("Prepared by"), safeText(user?.fullName)],
        [],
        [t("Right now")],
        ...rightNow.map(([label, value]) => [label, value]),
        [],
        [range ? t("In the range") : t("Across all recorded dates")],
        ...inTheRange.map(([label, value]) => [label, value]),
        [],
      ];
      const header = [t("Patient"), t("Follow-up flags waiting"), t("Clinicians"), t("Open tasks"), t("Overdue tasks"), t("Unassigned tasks"), t("Last check-in"), t("Follow-up"),
        t("Follow-up owner"), t("Next check-in due"), t("Visits in the next 7 days"), t("Visit requests waiting"), t("Visits in the range"), t("Check-ins recorded in the range"),
        t("Tasks created in the range"), t("Tasks completed in the range")];
      const lines = shown.map((p) => [safeText(p.patientName), p.openFlagCount, safeText(p.doctors.join("; ")), p.openTasks, p.overdue, p.unassigned, stamp(p.lastCheckIn), followUp(p),
        safeText(p.monitoringOwner), stamp(p.checkInDue), p.upcomingVisits, p.appointmentRequests, p.inRange.visits, p.inRange.checkIns, p.inRange.tasksCreated, p.inRange.tasksCompleted]);
      const tail: (string | number)[][] = [[], [t("Operational outcomes")], [t(data.definition)], ...outcomes.map(([label, value]) => [label, value])];
      // The byte-order mark makes a spreadsheet open Hindi, Tamil and Telugu text correctly.
      const text = [...info.map((r) => r.map(cell).join(",")), header.map(cell).join(","), ...lines.map((r) => r.map(cell).join(",")), ...tail.map((r) => r.map(cell).join(","))].join("\r\n");
      const blob = new Blob(["﻿" + text + "\r\n"], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clinic-summary-${range ? `${range.from}-to-${range.to}` : new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, t("The file was saved to your downloads."));

  return (
    <>
      <div className="continuity-actions clinic-export">
        <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void print()}>
          <Printer size={15} aria-hidden="true" /> {t("Print summary")}
        </button>
        <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void download()}>
          <Download size={15} aria-hidden="true" /> {t("Download CSV")}
        </button>
      </div>
      <Feedback error={action.error} message={action.message} />
      {sheet && createPortal(
        <section className="entries-sheet clinic-sheet" aria-label={t("Clinic summary")}>
          <h2>{t("Clinic summary")}</h2>
          <p>{data.clinic.name ? `${data.clinic.name}${data.clinic.phone ? ` · ${data.clinic.phone}` : ""}` : t("Clinic name not set")}</p>
          <p>{t("Dates")}: {rangeLabel} · {t("Clinician")}: {clinicianLabel} · {t("Work queue")}: {queueLabel}</p>
          <p>{t("Printed on {date}", { date: formatTime(new Date().toISOString()) })}{user?.fullName ? ` · ${user.fullName}` : ""}</p>
          <p>{t("Counts and dates only. Nothing here scores, ranks or grades a patient.")}</p>
          <h3>{t("Right now")}</h3>
          <ul className="clinic-sheet-stats">{rightNow.map(([label, value]) => <li key={label}><strong>{value}</strong> {label}</li>)}</ul>
          <h3>{range ? t("In the range") : t("Across all recorded dates")}</h3>
          <ul className="clinic-sheet-stats">{inTheRange.map(([label, value]) => <li key={label}><strong>{value}</strong> {label}</li>)}</ul>
          <h3>{t("Caseload & follow-up queue")}</h3>
          <p>{t("Missing logs indicate missing information, not a diagnosis or evidence of non-adherence. Only explicitly agreed check-in schedules trigger follow-up.")}</p>
          {shown.length === 0 ? (
            <p>{t("No patients match this queue.")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("Patient")}</th><th scope="col">{t("Follow-up flags")}</th><th scope="col">{t("Clinicians")}</th><th scope="col">{t("Open / overdue / unassigned")}</th>
                  <th scope="col">{t("Last check-in")}</th><th scope="col">{t("Follow-up")}</th><th scope="col">{t("Visits / requests")}</th><th scope="col">{t("In the range")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.episodeId}>
                    <td>{p.patientName}</td>
                    <td>{p.openFlagCount === 0 ? t("Nothing waiting") : t("{count} waiting", { count: p.openFlagCount })}</td>
                    <td>{p.doctors.join(", ")}</td>
                    <td>{p.openTasks} / {p.overdue} / {p.unassigned}</td>
                    <td>{p.lastCheckIn ? formatTime(p.lastCheckIn) : "–"}</td>
                    <td>{followUp(p)}{p.monitoringOwner ? ` · ${p.monitoringOwner}` : ""}{p.checkInDue ? ` · ${formatTime(p.checkInDue)}` : ""}</td>
                    <td>{p.upcomingVisits} / {p.appointmentRequests}</td>
                    <td>{p.inRange.visits} / {p.inRange.checkIns} / {p.inRange.tasksCreated} / {p.inRange.tasksCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3>{t("Operational outcomes")}</h3>
          <p>{t(data.definition)}</p>
          <ul className="clinic-sheet-stats">{outcomes.map(([label, value]) => <li key={label}><strong>{value}</strong> {label}</li>)}</ul>
        </section>,
        document.body,
      )}
    </>
  );
}
