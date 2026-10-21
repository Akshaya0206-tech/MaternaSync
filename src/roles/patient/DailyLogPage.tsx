import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ROOT, formatTime, localDateTime } from "../../api/continuity";
import type { DailyLog } from "../../api/continuity";
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
        ? "Check-in skipped. No clinical conclusion has been recorded."
        : "Your check-in was saved for your care team.",
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
      title="Daily check-in"
      subtitle="A few optional details to help your team understand how you’ve been between visits."
    >
      <Feedback
        error={workspace.error || action.error}
        message={action.message}
      />
      {workspace.loading && <p role="status">Loading your check-ins…</p>}
      {workspace.data && (
        <>
          <div className="continuity-note">
            Your entries are patient-reported and are not monitored
            continuously. If you are concerned about your health or your baby’s
            movements, contact your maternity team.{" "}
            <Link to="/patient/questions">Ask your care team</Link>.
          </div>
          <Panel
            title={editing ? "Correct a check-in" : "How are you today?"}
            aside={<Badge>Optional · about 2 minutes</Badge>}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="continuity-fields">
                <Field label="Recorded at">
                  <input
                    type="datetime-local"
                    required
                    max={localDateTime()}
                    value={form.recordedAt}
                    onChange={(e) => set("recordedAt", e.target.value)}
                  />
                </Field>
                <Field label="Systolic BP (mmHg)">
                  <input
                    type="number"
                    min="30"
                    max="300"
                    value={form.systolic}
                    onChange={(e) => set("systolic", e.target.value)}
                  />
                </Field>
                <Field label="Diastolic BP (mmHg)">
                  <input
                    type="number"
                    min="20"
                    max="200"
                    value={form.diastolic}
                    onChange={(e) => set("diastolic", e.target.value)}
                  />
                </Field>
                <Field label="Weight (kg)">
                  <input
                    type="number"
                    min="20"
                    max="400"
                    step="0.1"
                    value={form.weightKg}
                    onChange={(e) => set("weightKg", e.target.value)}
                  />
                </Field>
                <Field label="Mood">
                  <select
                    value={form.mood}
                    onChange={(e) => set("mood", e.target.value)}
                  >
                    {["not_recorded", "good", "okay", "low", "anxious"].map(
                      (s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Medicine adherence">
                  <select
                    value={form.adherence}
                    onChange={(e) => set("adherence", e.target.value)}
                  >
                    {[
                      "not_recorded",
                      "done",
                      "skipped",
                      "needs_help",
                      "not_applicable",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Symptoms or anything you want your team to know">
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={form.symptoms}
                  onChange={(e) => set("symptoms", e.target.value)}
                />
              </Field>
              <div className="continuity-fields">
                <Field label="Movements recorded (optional)">
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={form.movementCount}
                    onChange={(e) => set("movementCount", e.target.value)}
                  />
                </Field>
                <Field label="Observation duration (minutes)">
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
                <Field label="Reason for correction">
                  <input
                    required
                    value={form.correctionReason}
                    onChange={(e) => set("correctionReason", e.target.value)}
                  />
                </Field>
              )}
              <div className="continuity-actions">
                <button className="btn-primary" disabled={action.busy}>
                  Save check-in
                </button>
                {!editing && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={action.busy}
                    onClick={() => void save(true)}
                  >
                    Skip today
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
                    Cancel correction
                  </button>
                )}
              </div>
            </form>
          </Panel>
          <Panel
            title="Movement counter"
            aside={<Badge>Observation only</Badge>}
          >
            <p className="continuity-muted">
              Use the instructions your maternity team has given you. This
              counter records movements and time; it does not interpret a count
              or indicate that everything is well.
            </p>
            <div className="continuity-count" aria-live="polite">
              {count}
            </div>
            <p className="continuity-muted" style={{ textAlign: "center" }}>
              {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
            </p>
            <div className="continuity-actions">
              {start ? (
                <>
                  <button
                    className="btn-primary"
                    onClick={() => setCount((c) => c + 1)}
                  >
                    Record a movement
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
                    Use count in check-in
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
                  Start observation
                </button>
              )}
            </div>
          </Panel>
          <Panel title="Your entries">
            {!workspace.data.logs.length && (
              <Empty>
                No check-ins yet. It’s okay to leave measurements blank.
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
                    {log.skipped ? "Skipped" : "Patient-reported"} · v
                    {log.revision}
                  </Badge>
                </h3>
                <p>
                  BP:{" "}
                  {log.systolic != null
                    ? `${log.systolic}/${log.diastolic} mmHg`
                    : "Not recorded"}{" "}
                  · Weight:{" "}
                  {log.weightKg != null ? `${log.weightKg} kg` : "Not recorded"}
                </p>
                <p>
                  {log.symptoms || "No symptoms entered"} · Mood:{" "}
                  {log.mood.replaceAll("_", " ")} · Adherence:{" "}
                  {log.adherence.replaceAll("_", " ")}
                </p>
                {log.movementCount != null && (
                  <p>
                    {log.movementCount} movements over {log.movementMinutes}{" "}
                    minutes
                  </p>
                )}
                <div className="continuity-actions">
                  <button className="btn-secondary" onClick={() => edit(log)}>
                    Correct entry
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
                    View correction history
                  </button>
                </div>
              </article>
            ))}
          </Panel>
          {history.length > 0 && (
            <Panel title="Entry history">
              {history.map((h, i) => (
                <p key={i} className="continuity-muted">
                  {formatTime(h.timestamp)} · {h.action.replaceAll("_", " ")} ·{" "}
                  {h.newState?.correctionReason || "Original entry"}
                </p>
              ))}
            </Panel>
          )}
        </>
      )}
    </Page>
  );
}
