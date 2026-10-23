import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ROOT, formatTime, localDateTime } from "../../api/continuity";
import type { DailyLog } from "../../api/continuity";
import { tx, useLanguage } from "../../i18n";
import {
  Badge,
  Empty,
  Feedback,
  Field,
  Page,
  Panel,
  useAction,
  useWorkspace,
} from "../../components/continuity/shared";

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
  needs_help: tx("I need help"),
  not_applicable: tx("Not applicable"),
};

const HISTORY_ACTIONS: Record<string, string> = {
  patient_log_recorded: tx("Entry recorded"),
  patient_log_corrected: tx("Entry corrected"),
};

const empty = () => ({
  recordedAt: localDateTime(),
  systolic: "",
  diastolic: "",
  weightKg: "",
  symptoms: "",
  mood: "not_recorded",
  adherence: "not_recorded",
  movementCount: "",
  movementMinutes: "",
  correctionReason: "",
});

export function DailyLogPage() {
  const { t } = useLanguage();
  const workspace = useWorkspace();
  const action = useAction();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [count, setCount] = useState(0);
  const [history, setHistory] = useState<
    { timestamp: string; action: string; newState: DailyLog | null }[]
  >([]);
  useEffect(() => {
    if (!start) return;
    const interval = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [start]);
  const set = (key: keyof typeof form, value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  const save = (skipped = false) =>
    action.run(
      async () => {
        const payload = {
          ...form,
          recordedAt: new Date(form.recordedAt).toISOString(),
          skipped,
          systolic: skipped || !form.systolic ? null : Number(form.systolic),
          diastolic: skipped || !form.diastolic ? null : Number(form.diastolic),
          weightKg: skipped || !form.weightKg ? null : Number(form.weightKg),
          movementCount:
            skipped || !form.movementCount ? null : Number(form.movementCount),
          movementMinutes:
            skipped || !form.movementMinutes
              ? null
              : Number(form.movementMinutes),
          ...(skipped
            ? { symptoms: "", mood: "not_recorded", adherence: "not_recorded" }
            : {}),
        };
        if (editing) await api.patch(`${ROOT}/logs/${editing}`, payload);
        else
          await api.post(
            `${ROOT}/episodes/${workspace.episodeId}/logs`,
            payload,
          );
        setEditing(null);
        setForm(empty());
        await workspace.reload();
      },
      skipped
        ? t("Check-in skipped. No clinical conclusion has been recorded.")
        : t("Your check-in was saved for your care team."),
    );
  function edit(log: DailyLog) {
    setEditing(log.id);
    setForm({
      recordedAt: localDateTime(new Date(log.recordedAt)),
      systolic: String(log.systolic ?? ""),
      diastolic: String(log.diastolic ?? ""),
      weightKg: String(log.weightKg ?? ""),
      symptoms: log.symptoms,
      mood: log.mood,
      adherence: log.adherence,
      movementCount: String(log.movementCount ?? ""),
      movementMinutes: String(log.movementMinutes ?? ""),
      correctionReason: "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  return (
    <Page
      title={t("Daily check-in")}
      subtitle={t(
        "A few optional details to help your team understand how you’ve been between visits.",
      )}
    >
      <Feedback
        error={workspace.error || action.error}
        message={action.message}
      />
      {workspace.loading && <p role="status">{t("Loading your check-ins…")}</p>}
      {workspace.data && (
        <>
          <div className="continuity-note">
            {t(
              "Your entries are patient-reported and are not monitored continuously. If you are concerned about your health or your baby’s movements, contact your maternity team.",
            )}{" "}
            <Link to="/patient/questions">{t("Ask your care team")}</Link>.
          </div>
          <Panel
            title={editing ? t("Correct a check-in") : t("How are you today?")}
            aside={<Badge>{t("Optional · about 2 minutes")}</Badge>}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="continuity-fields">
                <Field label={t("Recorded at")}>
                  <input
                    type="datetime-local"
                    required
                    max={localDateTime()}
                    value={form.recordedAt}
                    onChange={(e) => set("recordedAt", e.target.value)}
                  />
                </Field>
                <Field label={t("Systolic BP (mmHg)")}>
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={form.systolic}
                    onChange={(e) => set("systolic", e.target.value)}
                  />
                </Field>
                <Field label={t("Diastolic BP (mmHg)")}>
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={form.diastolic}
                    onChange={(e) => set("diastolic", e.target.value)}
                  />
                </Field>
                <Field label={t("Weight (kg)")}>
                  <input
                    type="number"
                    min="20"
                    max="400"
                    step="0.1"
                    value={form.weightKg}
                    onChange={(e) => set("weightKg", e.target.value)}
                  />
                </Field>
                <Field label={t("Mood")}>
                  <select
                    value={form.mood}
                    onChange={(e) => set("mood", e.target.value)}
                  >
                    {Object.entries(MOODS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Medicine adherence")}>
                  <select
                    value={form.adherence}
                    onChange={(e) => set("adherence", e.target.value)}
                  >
                    {Object.entries(ADHERENCE).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label={t("Symptoms or anything you want your team to know")}>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={form.symptoms}
                  onChange={(e) => set("symptoms", e.target.value)}
                />
              </Field>
              <div className="continuity-fields">
                <Field label={t("Movements recorded (optional)")}>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={form.movementCount}
                    onChange={(e) => set("movementCount", e.target.value)}
                  />
                </Field>
                <Field label={t("Observation duration (minutes)")}>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={form.movementMinutes}
                    onChange={(e) => set("movementMinutes", e.target.value)}
                  />
                </Field>
              </div>
              {editing && (
                <Field label={t("Reason for correction")}>
                  <input
                    required
                    value={form.correctionReason}
                    onChange={(e) => set("correctionReason", e.target.value)}
                  />
                </Field>
              )}
              <div className="continuity-actions">
                <button className="btn-primary" disabled={action.busy}>
                  {t("Save check-in")}
                </button>
                {!editing && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={action.busy}
                    onClick={() => void save(true)}
                  >
                    {t("Skip today")}
                  </button>
                )}
                {editing && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setEditing(null);
                      setForm(empty());
                    }}
                  >
                    {t("Cancel correction")}
                  </button>
                )}
              </div>
            </form>
          </Panel>
          <Panel
            title={t("Movement counter")}
            aside={<Badge>{t("Observation only")}</Badge>}
          >
            <p className="continuity-muted">
              {t(
                "Use the instructions your maternity team has given you. This counter records movements and time; it does not interpret a count or indicate that everything is well.",
              )}
            </p>
            <div className="continuity-count" aria-live="polite">
              {count}
            </div>
            <p className="continuity-muted" style={{ textAlign: "center" }}>
              {t("{minutes}m {seconds}s elapsed", {
                minutes: Math.floor(elapsed / 60),
                seconds: elapsed % 60,
              })}
            </p>
            <div className="continuity-actions">
              {start ? (
                <>
                  <button
                    className="btn-primary"
                    onClick={() => setCount((c) => c + 1)}
                  >
                    {t("Record a movement")}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        movementCount: String(count),
                        movementMinutes: String(
                          Math.max(1, Math.ceil(elapsed / 60)),
                        ),
                      }));
                      setStart(null);
                    }}
                  >
                    {t("Use count in check-in")}
                  </button>
                </>
              ) : (
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setCount(0);
                    setElapsed(0);
                    setStart(Date.now());
                  }}
                >
                  {t("Start observation")}
                </button>
              )}
            </div>
          </Panel>
          <Panel title={t("Your entries")}>
            {!workspace.data.logs.length && (
              <Empty>
                {t("No check-ins yet. It’s okay to leave measurements blank.")}
              </Empty>
            )}
            {workspace.data.logs.map((log) => (
              <article
                key={log.id}
                className="continuity-item"
                id={`log-${log.id}`}
              >
                <h3>
                  {formatTime(log.recordedAt)}{" "}
                  <Badge>
                    {log.skipped ? t("Skipped") : t("Patient-reported")} · v
                    {log.revision}
                  </Badge>
                </h3>
                <p>
                  {t("BP")}:{" "}
                  {log.systolic != null
                    ? `${log.systolic}/${log.diastolic} mmHg`
                    : t("Not recorded")}{" "}
                  · {t("Weight")}:{" "}
                  {log.weightKg != null ? `${log.weightKg} kg` : t("Not recorded")}
                </p>
                <p>
                  {log.symptoms || t("No symptoms entered")} · {t("Mood")}:{" "}
                  {t(MOODS[log.mood] ?? log.mood)} · {t("Adherence")}:{" "}
                  {t(ADHERENCE[log.adherence] ?? log.adherence)}
                </p>
                {log.movementCount != null && (
                  <p>
                    {t("{count} movements over {minutes} minutes", {
                      count: log.movementCount,
                      minutes: log.movementMinutes ?? 0,
                    })}
                  </p>
                )}
                <div className="continuity-actions">
                  <button className="btn-secondary" onClick={() => edit(log)}>
                    {t("Correct entry")}
                  </button>
                  <button
                    className="btn-secondary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        async () =>
                          setHistory(
                            await api.get(`${ROOT}/logs/${log.id}/history`),
                          ),
                        "",
                      )
                    }
                  >
                    {t("View correction history")}
                  </button>
                </div>
              </article>
            ))}
          </Panel>
          {history.length > 0 && (
            <Panel title={t("Entry history")}>
              {history.map((h, i) => (
                <p key={i} className="continuity-muted">
                  {formatTime(h.timestamp)} ·{" "}
                  {t(HISTORY_ACTIONS[h.action] ?? h.action.replaceAll("_", " "))} ·{" "}
                  {h.newState?.correctionReason || t("Original entry")}
                </p>
              ))}
            </Panel>
          )}
        </>
      )}
    </Page>
  );
}
