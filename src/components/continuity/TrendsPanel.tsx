import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
import { ROOT, formatTime, getContext } from "../../api/continuity";
import type { DailyLog, Flag, Trends } from "../../api/continuity";
import { currentLanguage, currentLocale, tx, useLanguage } from "../../i18n";
import { Badge, Empty, Feedback, Panel, useAction } from "./shared";
import { EntriesExport } from "./EntriesExport";
import { sentence } from "./careLabels";

// Codes the server sends, shown as words. The English wording is exactly what this panel always showed.
const WORDS: Record<string, string> = {
  not_recorded: tx("Not recorded"),
  good: tx("Good"),
  okay: tx("Okay"),
  low: tx("Low"),
  anxious: tx("Anxious"),
  done: tx("Done"),
  skipped: tx("Skipped"),
  needs_help: tx("Needs help"),
  not_applicable: tx("Not applicable"),
  missing_days: tx("Missing days"),
  overdue_task_days: tx("Overdue task days"),
};
type Translate = ReturnType<typeof useLanguage>["t"];
const word = (t: Translate, value: string) => t(Object.hasOwn(WORDS, value) ? WORDS[value] : sentence(value));

// Dates keep the browser's own format in English; the other languages use their locale.
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(
    currentLanguage() === "en" ? undefined : currentLocale(),
  );

// The server writes this sentence in English: the task title is the only part that varies.
const flagContext = (t: Translate, context: string) => {
  if (context === "Follow-up flag about check-ins or tasks only.")
    return t("Follow-up flag about check-ins or tasks only.");
  const task =
    /^Task: ([\s\S]*)\. Follow-up flag about check-ins or tasks only\.$/.exec(
      context,
    );
  return task
    ? t("Task: {title}. Follow-up flag about check-ins or tasks only.", {
        title: task[1],
      })
    : context;
};

function Chart({
  logs,
  metric,
  label,
}: {
  logs: DailyLog[];
  metric: "systolic" | "weightKg";
  label: string;
}) {
  const { t } = useLanguage();
  const points = logs.filter((l) => !l.skipped && l[metric] != null);
  if (points.length < 2)
    return (
      <Empty>
        {t("{label}: at least two dated values are needed to draw a trend.", {
          label,
        })}
      </Empty>
    );
  const min = Math.min(...points.map((p) => p[metric]!));
  const max = Math.max(...points.map((p) => p[metric]!));
  const first = new Date(points[0].recordedAt).getTime();
  const range = Math.max(
    1,
    new Date(points[points.length - 1].recordedAt).getTime() - first,
  );
  const x = (p: DailyLog) =>
    42 + ((new Date(p.recordedAt).getTime() - first) / range) * 500;
  const y = (p: DailyLog) => 112 - ((p[metric]! - min) / (max - min || 1)) * 75;
  return (
    <figure style={{ margin: "10px 0" }}>
      <figcaption className="continuity-muted">
        {t("{label} · patient-reported · lowest–highest entered {min}–{max}", {
          label,
          min,
          max,
        })}
      </figcaption>
      <svg
        className="continuity-chart"
        viewBox="0 0 580 150"
        role="img"
        aria-label={t(
          "{label} over recorded dates. All values are available in the table below.",
          { label },
        )}
      >
        <line x1="42" x2="542" y1="120" y2="120" stroke="var(--border-color)" />
        <polyline
          points={points.map((p) => `${x(p)},${y(p)}`).join(" ")}
          fill="none"
          stroke="var(--teal-primary)"
          strokeWidth="2.5"
        />
        {points.map((p) => (
          <circle
            key={p.id}
            cx={x(p)}
            cy={y(p)}
            r="4"
            fill="var(--teal-primary)"
          >
            <title>
              {formatTime(p.recordedAt)}: {p[metric]}
            </title>
          </circle>
        ))}
        <text x="42" y="142" fill="currentColor" fontSize="10">
          {shortDate(points[0].recordedAt)}
        </text>
        <text
          x="542"
          y="142"
          textAnchor="end"
          fill="currentColor"
          fontSize="10"
        >
          {shortDate(points[points.length - 1].recordedAt)}
        </text>
      </svg>
    </figure>
  );
}

function FlagCard({
  flag: f,
  members,
  canConfirm,
  busy,
  confirm,
}: {
  flag: Flag;
  members: { id: string; name: string }[];
  canConfirm: boolean;
  busy: boolean;
  confirm: (body: {
    decision: "create_task" | "no_action_needed";
    ownerUserId: string | null;
    note: string;
  }) => Promise<void>;
}) {
  const { t } = useLanguage();
  const [decision, setDecision] = useState<"create_task" | "no_action_needed">(
    "create_task",
  );
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  return (
    <div className="continuity-note" id={`flag-${f.id}`}>
      <strong>
        {f.ruleTitle} · v{f.version}
      </strong>
      <p>
        {word(t, f.metric)}: {f.value}{" "}
        {f.operator === "gt" ? ">" : "<"} {f.threshold} ·{" "}
        {formatTime(f.recordedAt)}
      </p>
      {f.nextAction && (
        <p>
          <strong>{t("Follow-up in the rule:")}</strong> {f.nextAction}
        </p>
      )}
      <p className="continuity-muted">
        {t("Rule approved by {name}.", { name: f.reviewer })}{" "}
        {flagContext(t, f.context)}
      </p>
      {f.sourceUrl && (
        <a href={f.sourceUrl} target="_blank" rel="noreferrer">
          {t("Rule source")}
        </a>
      )}
      {f.confirmed && (
        <p className="continuity-success" style={{ marginBottom: 0 }}>
          {t("Reviewed by {name} on {time}", {
            name: f.confirmed.by,
            time: formatTime(f.confirmed.at),
          })}{" "}
          ·{" "}
          {f.confirmed.decision === "create_task"
            ? t("follow-up task created")
            : t("no action needed")}
          {f.confirmed.note ? ` · “${f.confirmed.note}”` : ""}
        </p>
      )}
      {!f.confirmed && canConfirm && (
        <form
          style={{ marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void confirm({
              decision,
              ownerUserId: decision === "create_task" ? owner : null,
              note,
            });
          }}
        >
          <div className="continuity-fields">
            <label className="continuity-field">
              <span>{t("Your decision")}</span>
              <select
                value={decision}
                onChange={(e) =>
                  setDecision(e.target.value as "create_task" | "no_action_needed")
                }
              >
                <option value="create_task">{t("Create a follow-up task")}</option>
                <option value="no_action_needed">{t("No action needed")}</option>
              </select>
            </label>
            {decision === "create_task" && (
              <label className="continuity-field">
                <span>{t("Task owner")}</span>
                <select
                  required
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="">{t("Choose who follows up")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="continuity-field">
              <span>
                {decision === "create_task"
                  ? t("Note for the task (optional)")
                  : t("Why no action is needed")}
              </span>
              <input
                required={decision === "no_action_needed"}
                minLength={decision === "no_action_needed" ? 3 : undefined}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
          <label className="continuity-check">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            {t("I reviewed this flag. This is my decision.")}
          </label>
          <button className="btn-primary" disabled={busy || !reviewed}>
            {t("Record my decision")}
          </button>
        </form>
      )}
    </div>
  );
}

export function TrendsPanel({
  episodeId,
  initial,
}: {
  episodeId: string;
  initial?: Trends;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const action = useAction();
  const [data, setData] = useState<Trends | null>(initial ?? null);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [patientName, setPatientName] = useState("");
  useEffect(() => {
    let active = true;
    getContext()
      .then((c) => {
        if (active) {
          setMembers(c.episodes.find((e) => e.id === episodeId)?.members ?? []);
          setPatientName(c.episodes.find((e) => e.id === episodeId)?.patientName ?? "");
        }
      })
      .catch(() => {
        /* the owner list is only needed to assign a follow-up */
      });
    return () => {
      active = false;
    };
  }, [episodeId]);
  useEffect(() => {
    let active = true;
    if (initial) {
      setData(initial);
      return;
    }
    setData(null);
    setError("");
    api
      .get<Trends>(`${ROOT}/episodes/${episodeId}/trends`)
      .then((r) => {
        if (active) setData(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [episodeId, initial]);
  return (
    <Panel
      title={t("Last 30 days · patient-reported trends")}
      aside={<Badge>{t("For review")}</Badge>}
    >
      <Feedback error={error} />
      {!data && !error && <p role="status">{t("Loading trends…")}</p>}
      {data && (
        <>
          <p className="continuity-muted">
            {t(
              "Shown as entered. MaternaSync does not interpret these values or compare them with a range. That is for the doctor.",
            )}
          </p>
          <p className="continuity-muted">
            {t(
              "{logged} days with entries · {missing} days without entries. Missing data does not establish non-adherence or a clinical problem. Corrections replace plotted values and retain their audit history.",
              { logged: data.daysWithLogs, missing: data.missingDays },
            )}
          </p>
          <div className="continuity-grid">
            <Chart
              logs={data.logs}
              metric="systolic"
              label={t("Systolic BP (mmHg)")}
            />
            <Chart
              logs={data.logs}
              metric="weightKg"
              label={t("Weight (kg)")}
            />
          </div>
          <div className="continuity-table-wrap" tabIndex={0} role="region" aria-label={t("Last 30 days · patient-reported trends")}>
            <table className="continuity-table">
              <thead>
                <tr>
                  <th>{t("Source / date")}</th>
                  <th>{t("BP · mmHg")}</th>
                  <th>{t("Weight · kg")}</th>
                  <th>{t("Symptoms / mood")}</th>
                  <th>{t("Movements")}</th>
                  <th>{t("Adherence")}</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id} id={`trend-${log.id}`}>
                    <td>
                      <a href={`#trend-${log.id}`}>
                        {formatTime(log.recordedAt)}
                      </a>
                      <br />
                      <small>
                        {t("Patient log · v{revision}", {
                          revision: log.revision,
                        })}
                        {log.skipped ? ` · ${t("Skipped")}` : ""}
                        {log.enteredWithHelp
                          ? ` · ${t("with help from {name}", { name: log.enteredWithHelp })}`
                          : ""}
                      </small>
                    </td>
                    <td>
                      {log.systolic != null
                        ? `${log.systolic}/${log.diastolic}`
                        : t("Missing")}
                    </td>
                    <td>{log.weightKg ?? t("Missing")}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 140 }}>
                      {log.symptoms || t("Not recorded")} /{" "}
                      {word(t, log.mood)}
                    </td>
                    <td>
                      {log.movementCount != null
                        ? t("{count} in {minutes} min", {
                            count: log.movementCount,
                            minutes: log.movementMinutes ?? "",
                          })
                        : t("Missing")}
                    </td>
                    <td>{word(t, log.adherence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.logs.length && (
            <Empty>{t("No entries during this period.")}</Empty>
          )}
          <EntriesExport episodeId={episodeId} logs={data.logs} patientName={patientName} />
          <h3 style={{ marginTop: 20 }} id="follow-up-flags">
            {t("Follow-up flags · check-ins and tasks that need attention")}
          </h3>
          <p className="continuity-muted">
            {t(
              "Flags come only from rules a doctor approved in Clinical Settings, and only about missed check-ins and overdue tasks. They never look at a blood pressure, a weight or any other clinical value, they do not rank patients by urgency or risk, and they do not diagnose. Nothing is sent to the patient or assigned until a doctor confirms.",
            )}
          </p>
          {data.activeRuleCount > 0 && (
            <p>
              <strong>{t("Waiting for a doctor:")} </strong>
              <Badge>
                {data.openFlagCount === 0
                  ? t("Nothing waiting")
                  : data.openFlagCount === 1
                    ? t("{count} flag", { count: data.openFlagCount })
                    : t("{count} flags", { count: data.openFlagCount })}
              </Badge>
            </p>
          )}
          <Feedback error={action.error} message={action.message} />
          {!data.activeRuleCount && (
            <Empty>
              {t(
                "No follow-up rules are approved. A doctor can approve the starter rules under Clinical Settings → Follow-up rules.",
              )}
            </Empty>
          )}
          {data.activeRuleCount > 0 && !data.flags.length && (
            <Empty>
              {t(
                "No missed check-in or overdue task needs following up right now. This is not a clinical assessment.",
              )}
            </Empty>
          )}
          {data.flags.map((f) => (
            <FlagCard
              key={f.id}
              flag={f}
              members={members}
              canConfirm={user?.role === "doctor"}
              busy={action.busy}
              confirm={(body) =>
                action.run(async () => {
                  await api.post(`${ROOT}/episodes/${episodeId}/follow-up-flags/confirm`, {
                    flagId: f.id,
                    confirmed: true,
                    ...body,
                  });
                  setData(await api.get<Trends>(`${ROOT}/episodes/${episodeId}/trends`));
                }, body.decision === "create_task" ? t("Follow-up task created and assigned.") : t("Decision recorded."))
              }
            />
          ))}
          <div className="continuity-actions">
            <Link
              className="btn-secondary"
              to={`/${user?.role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${episodeId}`}
            >
              {t("Open connected care workspace")}
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}
