import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
import { ROOT, formatTime } from "../../api/continuity";
import type { DailyLog, Trends } from "../../api/continuity";
import { Badge, Empty, Feedback, Panel } from "./shared";

function Chart({
  logs,
  metric,
  label,
}: {
  logs: DailyLog[];
  metric: "systolic" | "weightKg";
  label: string;
}) {
  const points = logs.filter((l) => !l.skipped && l[metric] != null);
  if (points.length < 2)
    return (
      <Empty>
        {label}: at least two dated values are needed to draw a trend.
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
        {label} · patient-reported · observed range {min}–{max}
      </figcaption>
      <svg
        className="continuity-chart"
        viewBox="0 0 580 150"
        role="img"
        aria-label={`${label} over recorded dates. All values are available in the table below.`}
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
          {new Date(points[0].recordedAt).toLocaleDateString()}
        </text>
        <text
          x="542"
          y="142"
          textAnchor="end"
          fill="currentColor"
          fontSize="10"
        >
          {new Date(points[points.length - 1].recordedAt).toLocaleDateString()}
        </text>
      </svg>
    </figure>
  );
}

export function TrendsPanel({
  episodeId,
  initial,
}: {
  episodeId: string;
  initial?: Trends;
}) {
  const { user } = useAuth();
  const [data, setData] = useState<Trends | null>(initial ?? null);
  const [error, setError] = useState("");
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
      title="Last 30 days · patient-reported trends"
      aside={<Badge>For review</Badge>}
    >
      <Feedback error={error} />
      {!data && !error && <p role="status">Loading trends…</p>}
      {data && (
        <>
          <p className="continuity-muted">
            {data.daysWithLogs} days with entries · {data.missingDays} days
            without entries. Missing data does not establish non-adherence or a
            clinical problem. Corrections replace plotted values and retain
            their audit history.
          </p>
          <div className="continuity-grid">
            <Chart
              logs={data.logs}
              metric="systolic"
              label="Systolic BP (mmHg)"
            />
            <Chart logs={data.logs} metric="weightKg" label="Weight (kg)" />
          </div>
          <div className="continuity-table-wrap">
            <table className="continuity-table">
              <thead>
                <tr>
                  <th>Source / date</th>
                  <th>BP · mmHg</th>
                  <th>Weight · kg</th>
                  <th>Symptoms / mood</th>
                  <th>Movements</th>
                  <th>Adherence</th>
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
                        Patient log · v{log.revision}
                        {log.skipped ? " · skipped" : ""}
                      </small>
                    </td>
                    <td>
                      {log.systolic != null
                        ? `${log.systolic}/${log.diastolic}`
                        : "Missing"}
                    </td>
                    <td>{log.weightKg ?? "Missing"}</td>
                    <td style={{ whiteSpace: "normal", minWidth: 140 }}>
                      {log.symptoms || "Not recorded"} /{" "}
                      {log.mood.replaceAll("_", " ")}
                    </td>
                    <td>
                      {log.movementCount != null
                        ? `${log.movementCount} in ${log.movementMinutes} min`
                        : "Missing"}
                    </td>
                    <td>{log.adherence.replaceAll("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.logs.length && <Empty>No entries during this period.</Empty>}
          <h3 style={{ marginTop: 20 }}>Configured review flags</h3>
          {!data.activeRuleCount && (
            <Empty>
              No current approved thresholds or workflow rules are configured.
            </Empty>
          )}
          {data.activeRuleCount > 0 && !data.flags.length && (
            <Empty>
              No configured rule matched recorded values. This is not a clinical
              assessment.
            </Empty>
          )}
          {data.flags.map((f, i) => (
            <div key={`${f.ruleId}-${i}`} className="continuity-note">
              <strong>
                {f.ruleTitle} · v{f.version}
              </strong>
              <p>
                {f.metric.replaceAll("_", " ")}: {f.value}{" "}
                {f.operator === "gt" ? ">" : "<"} {f.threshold} ·{" "}
                {formatTime(f.recordedAt)}
              </p>
              <p className="continuity-muted">
                Reviewed by {f.reviewer}. {f.context}
              </p>
              <a href={f.sourceUrl} target="_blank" rel="noreferrer">
                Rule source
              </a>
              {f.sourceId && f.metric !== "overdue_task_days" && (
                <>
                  {" "}
                  · <a href={`#trend-${f.sourceId}`}>Recorded value</a>
                </>
              )}
            </div>
          ))}
          <div className="continuity-actions">
            <Link
              className="btn-secondary"
              to={`/${user?.role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${episodeId}`}
            >
              Open connected care workspace
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}
