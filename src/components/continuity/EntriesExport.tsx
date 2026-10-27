import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer } from "lucide-react";
import { api } from "../../api/client";
import { ROOT, formatTime, getWorkspace } from "../../api/continuity";
import type { DailyLog } from "../../api/continuity";
import { tx, useLanguage } from "../../i18n";
import { Feedback, Field, useAction } from "./shared";

// What a patient wrote, as she wrote it. The words below only say what a stored code means (okay, not recorded); they say nothing about any value.
const MOODS: Record<string, string> = {
  not_recorded: tx("Not recorded"),
  good: tx("Good"),
  okay: tx("Okay"),
  low: tx("Low"),
  anxious: tx("Anxious"),
};
const ADHERENCE: Record<string, string> = {
  not_recorded: tx("Not recorded"),
  done: tx("Done"),
  skipped: tx("Skipped"),
  needs_help: tx("Needs help"),
  not_applicable: tx("Not applicable"),
};
const RANGES = [
  { value: "14", label: tx("Last 2 weeks") },
  { value: "30", label: tx("Last 30 days") },
  { value: "all", label: tx("All her entries (the latest 100)") },
];
const DAY = 86_400_000;

/** A spreadsheet reads a cell that starts with = + - or @ as a formula, so free text that starts that way gets a quote in front. */
const safeText = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);
const cell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const stamp = (iso: string) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** Print or download the patient's entries (the table above), for a clinic note or a record. The values are shown exactly as she entered them:
 *  no marks, no ranges, no comments. Each export is recorded on the server, like any other way her entries are read. */
export function EntriesExport({ episodeId, logs, patientName }: { episodeId: string; logs: DailyLog[]; patientName: string }) {
  const { t } = useLanguage();
  const action = useAction();
  const [range, setRange] = useState("30");
  const [chosen, setChosen] = useState<DailyLog[] | null>(null);

  useEffect(() => {
    const done = () => document.body.classList.remove("printing-entries");
    window.addEventListener("afterprint", done);
    return () => { window.removeEventListener("afterprint", done); done(); };
  }, []);

  // 2 weeks and 30 days come from what is already on the page; "all" asks for her latest 100 entries.
  const entries = async (): Promise<DailyLog[]> => {
    const all = range === "all" ? (await getWorkspace(episodeId)).logs : logs;
    const since = range === "all" ? 0 : Date.now() - Number(range) * DAY;
    return all.filter((log) => new Date(log.recordedAt).getTime() >= since).sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  };
  const record = (kind: "print" | "csv", count: number) => api.post(`${ROOT}/episodes/${episodeId}/entries-export`, { kind, range, count });

  const print = () =>
    action.run(async () => {
      const list = await entries();
      await record("print", list.length);
      setChosen(list);
      // The list is drawn first; the print window opens on the next turn so it has something to print.
      window.setTimeout(() => { document.body.classList.add("printing-entries"); window.print(); }, 60);
    }, "");

  const download = () =>
    action.run(async () => {
      const list = await entries();
      await record("csv", list.length);
      const header = [t("Date and time"), t("Systolic BP (mmHg)"), t("Diastolic BP (mmHg)"), t("Weight (kg)"), t("Symptoms"), t("Mood"), t("Adherence"),
        t("Movements"), t("Observation duration (minutes)"), t("Entered with help from"), t("Version"), t("Skipped")];
      const lines = list.map((log) => [
        stamp(log.recordedAt), log.systolic, log.diastolic, log.weightKg, safeText(log.symptoms ?? ""), t(MOODS[log.mood] ?? log.mood),
        t(ADHERENCE[log.adherence] ?? log.adherence), log.movementCount, log.movementMinutes, safeText(log.enteredWithHelp ?? ""), log.revision, log.skipped ? t("Yes") : t("No"),
      ].map(cell).join(","));
      // The byte-order mark makes a spreadsheet open Hindi, Tamil and Telugu text correctly.
      const blob = new Blob(["﻿" + [header.map(cell).join(","), ...lines].join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `entries-${patientName.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "patient"}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, t("The file was saved to your downloads."));

  return (
    <>
      <div className="entries-print-controls">
        <Field label={t("Entries to export")}>
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGES.map((item) => <option key={item.value} value={item.value}>{t(item.label)}</option>)}
          </select>
        </Field>
        <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void print()}>
          <Printer size={15} aria-hidden="true" /> {t("Print entries")}
        </button>
        <button type="button" className="btn-secondary" disabled={action.busy} onClick={() => void download()}>
          <Download size={15} aria-hidden="true" /> {t("Download CSV")}
        </button>
      </div>
      <Feedback error={action.error} message={action.message} />
      {chosen && createPortal(
        <section className="entries-sheet" aria-label={t("Patient entries")}>
          <h2>{t("Patient entries")}</h2>
          <p>{patientName} · {t("Printed on {date}", { date: formatTime(new Date().toISOString()) })}</p>
          <p>{t("Entered by the patient; not checked.")}</p>
          {chosen.length === 0 ? (
            <p>{t("No entries in this time.")}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">{t("Date and time")}</th><th scope="col">{t("Blood pressure (mmHg)")}</th><th scope="col">{t("Weight (kg)")}</th><th scope="col">{t("Symptoms")}</th>
                  <th scope="col">{t("Mood")}</th><th scope="col">{t("Adherence")}</th><th scope="col">{t("Movements")}</th><th scope="col">{t("Entered with help from")}</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((log) => (
                  <tr key={log.id}>
                    <td>{formatTime(log.recordedAt)}{log.revision > 1 ? ` · v${log.revision}` : ""}</td>
                    <td>{log.skipped ? t("Skipped") : log.systolic != null ? `${log.systolic}/${log.diastolic}` : "–"}</td>
                    <td>{!log.skipped && log.weightKg != null ? log.weightKg : "–"}</td>
                    <td>{log.skipped ? t("Skipped") : log.symptoms || "–"}</td>
                    <td>{log.skipped || log.mood === "not_recorded" ? "–" : t(MOODS[log.mood] ?? log.mood)}</td>
                    <td>{log.skipped || log.adherence === "not_recorded" ? "–" : t(ADHERENCE[log.adherence] ?? log.adherence)}</td>
                    <td>{log.movementCount != null ? t("{count} in {minutes} min", { count: log.movementCount, minutes: log.movementMinutes ?? "" }) : "–"}</td>
                    <td>{log.enteredWithHelp || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>,
        document.body,
      )}
    </>
  );
}
