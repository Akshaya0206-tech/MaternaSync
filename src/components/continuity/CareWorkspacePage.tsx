import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api } from "../../api/client";
import {
  ROOT,
  getLibrary,
  formatTime,
  localDateTime,
} from "../../api/continuity";
import type {
  EpisodeChoice,
  Resource,
  Task,
  Workspace,
} from "../../api/continuity";
import {
  Badge,
  Empty,
  Feedback,
  Field,
  Page,
  Panel,
  PatientSelect,
  useAction,
  useWorkspace,
} from "./shared";
import { DraftStudio } from "./DraftStudio";
import { TrendsPanel } from "./TrendsPanel";

export function CareWorkspacePage({
  initialTab = "trends",
}: {
  initialTab?: string;
}) {
  const w = useWorkspace();
  const { user } = useAuth();
  const [tab, setTab] = useState(initialTab);
  const [resources, setResources] = useState<Resource[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    let active = true;
    getLibrary()
      .then((r) => {
        if (active) setResources(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const doctor = user?.role === "doctor";
  return (
    <Page
      title="Connected care workspace"
      subtitle="Patient-reported information, accountable follow-up, reviewed documents, and controlled outreach in one place."
    >
      <PatientSelect workspace={w} />
      <Feedback error={error} />
      <div className="continuity-tabs">
        {[
          ["trends", "Trends & pathways"],
          ["drafts", "Document studio"],
          ["reminders", "Reminders & outreach"],
          ["operations", "Tasks, visits & outcomes"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {w.data && w.selectedEpisode && (
        <div key={`${w.episodeId}-${tab}`}>
          {tab === "trends" && (
            <>
              <TrendsPanel episodeId={w.episodeId} initial={w.data.trends} />
              <Pathways
                data={w.data}
                episode={w.selectedEpisode}
                resources={resources}
                doctor={doctor}
                reload={w.reload}
              />
            </>
          )}
          {tab === "drafts" && (
            <DraftStudio
              data={w.data}
              resources={resources}
              doctor={doctor}
              reload={w.reload}
            />
          )}
          {tab === "reminders" && (
            <Reminders data={w.data} doctor={doctor} reload={w.reload} />
          )}
          {tab === "operations" && (
            <Operations
              data={w.data}
              episode={w.selectedEpisode}
              reload={w.reload}
            />
          )}
        </div>
      )}
    </Page>
  );
}

function Pathways({
  data,
  episode,
  resources,
  doctor,
  reload,
}: {
  data: Workspace;
  episode: EpisodeChoice;
  resources: Resource[];
  doctor: boolean;
  reload: () => Promise<void>;
}) {
  const action = useAction();
  const [pathway, setPathway] = useState("");
  const [owner, setOwner] = useState(
    data.monitoring?.ownerUserId || episode.members[0]?.id || "",
  );
  const [start, setStart] = useState(localDateTime().slice(0, 10));
  const [days, setDays] = useState(data.monitoring?.intervalDays || 1);
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const pathways = resources.filter((r) => r.kind === "pathway" && r.usable);
  const chosen = pathways.find((p) => p.id === pathway);
  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <Panel title="Agreed check-in follow-up">
        <p className="continuity-muted">
          A missed-log queue is created only after the team records an agreed
          follow-up schedule. Missing information is separate from clinical
          concern.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.post(`${ROOT}/episodes/${data.episodeId}/monitoring`, {
                intervalDays: days,
                ownerUserId: owner,
                active: true,
                patientAgreed: true,
              });
              setAgreed(false);
              await reload();
            }, "Agreed check-in plan saved.");
          }}
        >
          <div className="continuity-fields">
            <Field label="Follow-up owner">
              <select
                required
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
              >
                {episode.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Check-in interval (days)">
              <input
                type="number"
                required
                min="1"
                max="90"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
              />
            </Field>
          </div>
          <label className="continuity-check">
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            The patient and care team have agreed to this follow-up schedule.
          </label>
          <div className="continuity-actions">
            <button className="btn-primary" disabled={action.busy || !agreed}>
              Save agreed schedule
            </button>
            {data.monitoring?.active && (
              <button
                type="button"
                className="btn-secondary"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api.post(
                      `${ROOT}/episodes/${data.episodeId}/monitoring`,
                      {
                        intervalDays: days,
                        ownerUserId: owner,
                        active: false,
                        patientAgreed: true,
                      },
                    );
                    await reload();
                  }, "Monitoring follow-up stopped.")
                }
              >
                Stop this schedule
              </button>
            )}
          </div>
        </form>
      </Panel>
      <Panel title="Clinician-approved pathways">
        {doctor ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                await api.post(`${ROOT}/episodes/${data.episodeId}/pathways`, {
                  resourceId: pathway,
                  ownerUserId: owner,
                  startDate: start,
                  confirmed: true,
                });
                setConfirmed(false);
                await reload();
              }, "Administrative tasks created with an owner and due dates.");
            }}
          >
            <div className="continuity-fields">
              <Field label="Approved pathway">
                <select
                  required
                  value={pathway}
                  onChange={(e) => setPathway(e.target.value)}
                >
                  <option value="">Select a pathway</option>
                  {pathways.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · v{p.version}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start date">
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="Task owner">
                <select
                  required
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  {episode.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {chosen && (
              <>
                <p className="continuity-muted">
                  {chosen.content} · Reviewed by {chosen.approvedByName}
                </p>
                {chosen.configuration.steps?.map((s, i) => (
                  <p key={i}>
                    {s.title} · day {s.days}
                  </p>
                ))}
                <a href={chosen.sourceUrl} target="_blank" rel="noreferrer">
                  Pathway source
                </a>
              </>
            )}
            <label className="continuity-check">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                required
              />
              I confirm this version and its administrative tasks apply to this
              patient’s documented plan.
            </label>
            <button
              className="btn-primary"
              disabled={action.busy || !pathway || !confirmed}
            >
              Confirm & generate tasks
            </button>
            {!pathways.length && (
              <Empty>
                Review and approve a pathway in the clinical library before
                enrollment.
              </Empty>
            )}
          </form>
        ) : (
          <p className="continuity-muted">
            The assigned doctor confirms pathway enrollment. Generated tasks
            appear in your task queue.
          </p>
        )}
        {data.enrollments?.map((e) => (
          <p className="continuity-muted" key={e.id}>
            {e.title} · Applied {formatTime(e.createdAt)}
          </p>
        ))}
      </Panel>
    </>
  );
}

function Reminders({
  data,
  doctor,
  reload,
}: {
  data: Workspace;
  doctor: boolean;
  reload: () => Promise<void>;
}) {
  const action = useAction();
  const [kind, setKind] = useState("appointment");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [time, setTime] = useState("");
  const [source, setSource] = useState("");
  const [repeat, setRepeat] = useState(0);
  const [occurrences, setOccurrences] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [consentId, setConsentId] = useState("");
  const [outreachType, setOutreachType] = useState("reminder");
  const [outreachSource, setOutreachSource] = useState("");
  const [recipient, setRecipient] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [readyLink, setReadyLink] = useState("");
  useEffect(() => {
    api
      .get<Task[]>(`${ROOT}/episodes/${data.episodeId}/tasks`)
      .then(setTasks)
      .catch((e) => action.setError(e.message));
  }, [data.episodeId]);
  const sources =
    kind === "appointment"
      ? data.appointments
          .filter((a) => a.status === "scheduled")
          .map((a) => ({
            id: a.id,
            title: `${a.appointmentType} · ${formatTime(a.scheduledAt)}`,
          }))
      : kind === "follow_up"
        ? tasks.map((t) => ({ id: t.id, title: t.title }))
        : data.sources?.filter((s) => s.type === "consultation") || [];
  const consent = data.consents.find((c) => c.id === consentId);
  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <Panel title="Approve a reminder schedule">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.post(`${ROOT}/episodes/${data.episodeId}/reminders`, {
                kind,
                title,
                instructions,
                scheduledAt: new Date(time).toISOString(),
                sourceId: source,
                repeatDays: repeat,
                occurrences,
              });
              await reload();
            }, "Reminders added to the patient’s care plan.");
          }}
        >
          <div className="continuity-fields">
            <Field label="Reminder type">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setSource("");
                }}
              >
                {(doctor
                  ? ["appointment", "follow_up", "medicine", "vaccine"]
                  : ["appointment", "follow_up"]
                ).map((k) => (
                  <option key={k} value={k}>
                    {k.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source plan / visit">
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Select source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reminder title">
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label="First reminder">
              <input
                type="datetime-local"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
            <Field label="Repeat every (days; 0 for once)">
              <input
                type="number"
                min="0"
                max="365"
                value={repeat}
                onChange={(e) => setRepeat(Number(e.target.value))}
              />
            </Field>
            <Field label="Number of reminders">
              <input
                type="number"
                min="1"
                max="90"
                value={occurrences}
                onChange={(e) => setOccurrences(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label="Instructions from the documented plan">
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <button className="btn-primary" disabled={action.busy}>
            Approve reminder schedule
          </button>
        </form>
      </Panel>
      <Panel title="Reminder responses">
        {!data.reminders.length && <Empty>No reminder schedule yet.</Empty>}
        {data.reminders.map((r) => (
          <div key={r.id} className="continuity-item">
            <h3>
              {r.title} <Badge>{r.status.replaceAll("_", " ")}</Badge>
            </h3>
            <p className="continuity-muted">
              {formatTime(r.scheduledAt)} · {r.approvedByName}
            </p>
          </div>
        ))}
      </Panel>
      <Panel title="WhatsApp outreach">
        <div className="continuity-note">
          Recipients must have active permission for this purpose, and every
          message is only a prompt to sign in: no names, results or medicines.{" "}
          {data.whatsapp?.mode === "cloud_api" &&
            "Messages are sent through the WhatsApp Business Cloud API, and sent, delivered and read are reported by the provider. A recipient who replies STOP withdraws permission automatically."}
          {data.whatsapp?.mode === "simulator" && (
            <strong>
              SIMULATED: no message leaves this server and no phone receives
              anything. Statuses are generated so the flow can be demonstrated.
              Set MATERNASYNC_WHATSAPP_PROVIDER=cloud_api with WhatsApp Business
              credentials to send for real.
            </strong>
          )}
          {data.whatsapp?.mode === "manual" &&
            "Automatic sending is not configured. Prepare the composer link, send from your own WhatsApp, then record it as sent. Delivery stays unconfirmed."}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.post(`${ROOT}/episodes/${data.episodeId}/outreach`, {
                consentId,
                sourceType: outreachType,
                sourceId: outreachSource,
                recipient,
                confirmed: true,
              });
              setConfirmed(false);
              setReadyLink("");
              await reload();
            }, "Notification prepared. Open WhatsApp to review and send.");
          }}
        >
          <div className="continuity-fields">
            <Field label="Notification type">
              <select
                value={outreachType}
                onChange={(e) => {
                  setOutreachType(e.target.value);
                  setConsentId("");
                  setOutreachSource("");
                }}
              >
                <option value="reminder">Reminder</option>
                <option value="output">Approved document</option>
              </select>
            </Field>
            <Field label="Approved item">
              <select
                required
                value={outreachSource}
                onChange={(e) => setOutreachSource(e.target.value)}
              >
                <option value="">Select item</option>
                {(outreachType === "reminder"
                  ? data.reminders
                  : data.outputs.filter(
                      (o) => o.status === "APPROVED" && o.visibleToPatient,
                    )
                ).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Active patient permission">
              <select
                required
                value={consentId}
                onChange={(e) => {
                  setConsentId(e.target.value);
                  setRecipient("");
                  setConfirmed(false);
                }}
              >
                <option value="">Select permission</option>
                {data.consents
                  .filter(
                    (c) =>
                      c.active &&
                      c.purpose ===
                        (outreachType === "reminder"
                          ? "reminders"
                          : "approved_documents"),
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.recipient} · Expires {formatTime(c.expiresAt)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Confirm recipient phone">
              <input
                required
                type="tel"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Re-enter the consented number"
              />
            </Field>
          </div>
          <label className="continuity-check">
            <input
              type="checkbox"
              required
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I verified the recipient and reviewed the minimal notification.
          </label>
          <button
            className="btn-primary"
            disabled={
              action.busy ||
              !confirmed ||
              !consent ||
              recipient !== consent.recipient
            }
          >
            Prepare notification
          </button>
        </form>
        {data.outreach?.map((o) => (
          <div key={o.id} className="continuity-item">
            <h3>
              {o.recipient} <Badge>{o.status.replaceAll("_", " ")}</Badge>{" "}
              {o.provider === "simulator" && <Badge>SIMULATED</Badge>}
            </h3>
            <p>{o.message}</p>
            <p className="continuity-muted">
              Prepared {formatTime(o.createdAt)}
              {o.sentAt && ` · Sent ${formatTime(o.sentAt)}`}
              {o.deliveredAt && ` · Delivered ${formatTime(o.deliveredAt)}`}
              {o.readAt && ` · Read ${formatTime(o.readAt)}`}
              <br />
              Delivery:{" "}
              {o.status === "DELIVERED" || o.status === "READ"
                ? o.provider === "simulator"
                  ? "simulated, nothing was delivered to a phone"
                  : "confirmed by the WhatsApp provider"
                : o.status === "SENT"
                  ? "sent, waiting for the provider to confirm delivery"
                  : o.status === "MANUALLY_SENT"
                    ? "sent by staff from the composer, not confirmed"
                    : o.status === "FAILED"
                      ? "failed"
                      : o.status === "CANCELLED"
                        ? "cancelled, permission was withdrawn"
                        : "not sent yet"}
            </p>
            {o.failedReason && (
              <p role="alert" className="continuity-alert">
                {o.failedReason}
              </p>
            )}
            <div className="continuity-actions">
              {data.whatsapp?.automatic &&
                ["PREPARED", "COMPOSER_LINK_READY", "FAILED"].includes(o.status) && (
                  <button
                    className="btn-primary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        try {
                          await api.post(`${ROOT}/outreach/${o.id}/send`);
                        } finally {
                          await reload();
                        }
                      }, data.whatsapp?.mode === "simulator" ? "Simulated send recorded. No real message was sent." : "Message handed to WhatsApp. Delivery status will update.")
                    }
                  >
                    {o.status === "FAILED" ? "Try sending again" : "Send now"}
                  </button>
                )}
              {["PREPARED", "COMPOSER_LINK_READY"].includes(o.status) && (
                <button
                  className="btn-secondary"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      const result = await api.post<{ url: string }>(
                        `${ROOT}/outreach/${o.id}/open`,
                      );
                      setReadyLink(result.url);
                      await reload();
                    }, "")
                  }
                >
                  Verify consent & prepare WhatsApp link
                </button>
              )}
              {o.status === "COMPOSER_LINK_READY" && (
                <button
                  className="btn-secondary"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      await api.post(`${ROOT}/outreach/${o.id}/mark-sent`);
                      await reload();
                    }, "Recorded as sent by staff. Delivery is unconfirmed.")
                  }
                >
                  I sent it from WhatsApp
                </button>
              )}
            </div>
          </div>
        ))}
        {readyLink && (
          <div className="continuity-actions">
            <a
              className="btn-primary"
              href={readyLink}
              target="_blank"
              rel="noreferrer"
              onClick={() => setReadyLink("")}
            >
              Continue to WhatsApp ↗
            </a>
          </div>
        )}
      </Panel>
    </>
  );
}

function Operations({
  data,
  episode,
  reload,
}: {
  data: Workspace;
  episode: EpisodeChoice;
  reload: () => Promise<void>;
}) {
  const action = useAction();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("open");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [outcome, setOutcome] = useState("scan");
  const [value, setValue] = useState("on_time");
  const [date, setDate] = useState(localDateTime().slice(0, 10));
  const [source, setSource] = useState("");
  const loadTasks = async () =>
    setTasks(await api.get(`${ROOT}/episodes/${data.episodeId}/tasks`));
  useEffect(() => {
    void loadTasks().catch((e) => action.setError(e.message));
  }, [data.episodeId]);
  const shown = tasks.filter(
    (t) =>
      (!ownerFilter || t.ownerUserId === ownerFilter) &&
      (filter === "all" || filter === "overdue"
        ? filter === "all" ||
          (!!t.dueDate &&
            t.dueDate < localDateTime().slice(0, 10) &&
            !["COMPLETED", "CANCELLED"].includes(t.status))
        : !["COMPLETED", "CANCELLED"].includes(t.status)),
  );
  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <Panel title="Task ownership & history">
        <div className="continuity-fields">
          <Field label="Queue filter">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">Open tasks</option>
              <option value="overdue">Overdue</option>
              <option value="all">All tasks</option>
            </select>
          </Field>
          <Field label="Owner">
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">All owners</option>
              {episode.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!shown.length && <Empty>No tasks in this queue.</Empty>}
        {shown.map((t) => (
          <TaskRow
            key={`${t.id}-${t.ownerUserId}-${t.dueDate}`}
            task={t}
            members={episode.members}
            saved={loadTasks}
          />
        ))}
      </Panel>
      <Panel title="Appointments & requests">
        {data.appointments.map((a) => (
          <article key={a.id} className="continuity-item">
            <h3>
              {a.appointmentType} <Badge>{a.status.replaceAll("_", " ")}</Badge>
            </h3>
            <p>
              {formatTime(a.scheduledAt)} · {a.notes}
            </p>
            <div className="continuity-actions">
              {(a.status === "requested"
                ? ["scheduled", "cancelled"]
                : a.status === "scheduled"
                  ? ["completed", "no_show", "cancelled"]
                  : []
              ).map((status) => (
                <button
                  key={status}
                  className="btn-secondary"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      await api.patch(`${ROOT}/appointments/${a.id}`, {
                        status,
                      });
                      await reload();
                    }, "Appointment updated.")
                  }
                >
                  {status === "scheduled"
                    ? "Confirm visit"
                    : status.replaceAll("_", " ")}
                </button>
              ))}
            </div>
          </article>
        ))}
      </Panel>
      <Panel title="Record a documented outcome">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              await api.post(`${ROOT}/episodes/${data.episodeId}/outcomes`, {
                kind: outcome,
                value,
                eventDate: date,
                sourceDocumentId: source,
              });
              await reload();
            }, "Documented outcome added to authorized clinic reporting.");
          }}
        >
          <div className="continuity-fields">
            <Field label="Outcome type">
              <select
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  setValue(e.target.value === "scan" ? "on_time" : "");
                }}
              >
                <option value="scan">Scan completion</option>
                <option value="delivery">Recorded delivery outcome</option>
              </select>
            </Field>
            <Field label="Recorded outcome">
              {outcome === "scan" ? (
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                >
                  <option value="on_time">On time</option>
                  <option value="late">Late</option>
                </select>
              ) : (
                <input
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
            <Field label="Event date">
              <input
                type="date"
                required
                max={localDateTime().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Verified source document">
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Choose source</option>
                {data.sources
                  ?.filter((s) => s.type === "document")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <button className="btn-primary" disabled={action.busy}>
            Record outcome
          </button>
        </form>
        {data.outcomes?.map((o) => (
          <p className="continuity-muted" key={o.id}>
            {o.eventDate} · {o.kind} · {o.value.replaceAll("_", " ")}
          </p>
        ))}
      </Panel>
    </>
  );
}

function TaskRow({
  task,
  members,
  saved,
}: {
  task: Task;
  members: EpisodeChoice["members"];
  saved: () => Promise<void>;
}) {
  const action = useAction();
  const [owner, setOwner] = useState(task.ownerUserId || "");
  const [date, setDate] = useState(task.dueDate || "");
  return (
    <article className="continuity-item">
      <h3>
        {task.title} <Badge>{task.status}</Badge>
      </h3>
      <Feedback error={action.error} message={action.message} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await api.patch(`${ROOT}/tasks/${task.id}/assignment`, {
              ownerUserId: owner,
              dueDate: date || null,
            });
            await saved();
          }, "Assignment saved.");
        }}
      >
        <div className="continuity-fields">
          <Field label="Assigned owner">
            <select
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <button className="btn-secondary" disabled={action.busy}>
          Save owner & due date
        </button>
      </form>
      <details>
        <summary className="continuity-muted">
          Reassignment history ({task.history.length})
        </summary>
        {task.history.map((h, i) => (
          <p className="continuity-muted" key={i}>
            {formatTime(h.at)} · {h.name} · assigned by {h.by}
          </p>
        ))}
      </details>
    </article>
  );
}

export function CareWorkspaceLink({
  episodeId,
  role,
}: {
  episodeId: string;
  role: string;
}) {
  return (
    <Link
      className="btn-secondary"
      to={`/${role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${episodeId}`}
    >
      Connected care workspace
    </Link>
  );
}
