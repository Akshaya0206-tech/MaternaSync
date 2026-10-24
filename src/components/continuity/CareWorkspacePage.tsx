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
import { tx, useLanguage } from "../../i18n";
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

// Codes the server sends (appointment, reminder and message statuses and so on), shown as words. The English
// wording is exactly what these pages always showed; the other languages come from the dictionary.
const WORDS: Record<string, string> = {
  appointment: tx("appointment"),
  follow_up: tx("follow up"),
  medicine: tx("medicine"),
  vaccine: tx("vaccine"),
  pending: tx("pending"),
  done: tx("done"),
  skipped: tx("skipped"),
  needs_help: tx("needs help"),
  requested: tx("requested"),
  scheduled: tx("scheduled"),
  completed: tx("completed"),
  cancelled: tx("cancelled"),
  no_show: tx("no show"),
  scan: tx("scan"),
  delivery: tx("delivery"),
  on_time: tx("on time"),
  late: tx("late"),
  PREPARED: tx("PREPARED"),
  COMPOSER_LINK_READY: tx("COMPOSER LINK READY"),
  MANUALLY_SENT: tx("MANUALLY SENT"),
  SENT: tx("SENT"),
  DELIVERED: tx("DELIVERED"),
  READ: tx("READ"),
  FAILED: tx("FAILED"),
  CANCELLED: tx("CANCELLED"),
};
// Task statuses were always shown exactly as the server sends them.
const TASK_STATUS: Record<string, string> = {
  OPEN: tx("OPEN"),
  IN_PROGRESS: tx("IN_PROGRESS"),
  WAITING: tx("WAITING"),
  COMPLETED: tx("COMPLETED"),
  CANCELLED: tx("CANCELLED"),
};
type Translate = ReturnType<typeof useLanguage>["t"];
const word = (t: Translate, value: string) =>
  t(Object.hasOwn(WORDS, value) ? WORDS[value] : value.replaceAll("_", " "));
const taskStatus = (t: Translate, value: string) =>
  t(Object.hasOwn(TASK_STATUS, value) ? TASK_STATUS[value] : value);

export function CareWorkspacePage({
  initialTab = "trends",
}: {
  initialTab?: string;
}) {
  const { t } = useLanguage();
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
      title={t("Connected care workspace")}
      subtitle={t(
        "Patient-reported information, accountable follow-up, reviewed documents, and controlled outreach in one place.",
      )}
    >
      <PatientSelect workspace={w} />
      <Feedback error={error} />
      <div className="continuity-tabs">
        {[
          ["trends", t("Trends & pathways")],
          ["drafts", t("Document studio")],
          ["reminders", t("Reminders & outreach")],
          ["operations", t("Tasks, visits & outcomes")],
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
  const { t } = useLanguage();
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
      <Panel title={t("Agreed check-in follow-up")}>
        <p className="continuity-muted">
          {t(
            "A missed-log queue is created only after the team records an agreed follow-up schedule. Missing information is separate from clinical concern.",
          )}
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
            }, t("Agreed check-in plan saved."));
          }}
        >
          <div className="continuity-fields">
            <Field label={t("Follow-up owner")}>
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
            <Field label={t("Check-in interval (days)")}>
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
            {t("The patient and care team have agreed to this follow-up schedule.")}
          </label>
          <div className="continuity-actions">
            <button className="btn-primary" disabled={action.busy || !agreed}>
              {t("Save agreed schedule")}
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
                  }, t("Monitoring follow-up stopped."))
                }
              >
                {t("Stop this schedule")}
              </button>
            )}
          </div>
        </form>
      </Panel>
      <Panel title={t("Clinician-approved pathways")}>
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
              }, t("Administrative tasks created with an owner and due dates."));
            }}
          >
            <div className="continuity-fields">
              <Field label={t("Approved pathway")}>
                <select
                  required
                  value={pathway}
                  onChange={(e) => setPathway(e.target.value)}
                >
                  <option value="">{t("Select a pathway")}</option>
                  {pathways.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} · v{p.version}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Start date")}>
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label={t("Task owner")}>
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
                  {chosen.content} ·{" "}
                  {t("Reviewed by {name}", { name: chosen.approvedByName ?? "" })}
                </p>
                {chosen.configuration.steps?.map((s, i) => (
                  <p key={i}>
                    {s.title} · {t("day {days}", { days: s.days })}
                  </p>
                ))}
                <a href={chosen.sourceUrl} target="_blank" rel="noreferrer">
                  {t("Pathway source")}
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
              {t(
                "I confirm this version and its administrative tasks apply to this patient’s documented plan.",
              )}
            </label>
            <button
              className="btn-primary"
              disabled={action.busy || !pathway || !confirmed}
            >
              {t("Confirm & generate tasks")}
            </button>
            {!pathways.length && (
              <Empty>
                {t(
                  "Review and approve a pathway in the clinical library before enrollment.",
                )}
              </Empty>
            )}
          </form>
        ) : (
          <p className="continuity-muted">
            {t(
              "The assigned doctor confirms pathway enrollment. Generated tasks appear in your task queue.",
            )}
          </p>
        )}
        {data.enrollments?.map((e) => (
          <p className="continuity-muted" key={e.id}>
            {e.title} · {t("Applied {time}", { time: formatTime(e.createdAt) })}
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
  const { t } = useLanguage();
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
        ? tasks.map((task) => ({ id: task.id, title: task.title }))
        : data.sources?.filter((s) => s.type === "consultation") || [];
  const consent = data.consents.find((c) => c.id === consentId);
  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <Panel title={t("Approve a reminder schedule")}>
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
            }, t("Reminders added to the patient’s care plan."));
          }}
        >
          <div className="continuity-fields">
            <Field label={t("Reminder type")}>
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
                    {word(t, k)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Source plan / visit")}>
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">{t("Select source")}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Reminder title")}>
              <input
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field label={t("First reminder")}>
              <input
                type="datetime-local"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
            <Field label={t("Repeat every (days; 0 for once)")}>
              <input
                type="number"
                min="0"
                max="365"
                value={repeat}
                onChange={(e) => setRepeat(Number(e.target.value))}
              />
            </Field>
            <Field label={t("Number of reminders")}>
              <input
                type="number"
                min="1"
                max="90"
                value={occurrences}
                onChange={(e) => setOccurrences(Number(e.target.value))}
              />
            </Field>
          </div>
          <Field label={t("Instructions from the documented plan")}>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Field>
          <button className="btn-primary" disabled={action.busy}>
            {t("Approve reminder schedule")}
          </button>
        </form>
      </Panel>
      <Panel title={t("Reminder responses")}>
        {!data.reminders.length && <Empty>{t("No reminder schedule yet.")}</Empty>}
        {data.reminders.map((r) => (
          <div key={r.id} className="continuity-item">
            <h3>
              {r.title} <Badge>{word(t, r.status)}</Badge>
            </h3>
            <p className="continuity-muted">
              {formatTime(r.scheduledAt)} · {r.approvedByName}
            </p>
          </div>
        ))}
      </Panel>
      <Panel title={t("WhatsApp outreach")}>
        <div className="continuity-note">
          {t(
            "Recipients must have active permission for this purpose, and every message is only a prompt to sign in: no names, results or medicines.",
          )}{" "}
          {data.whatsapp?.mode === "cloud_api" &&
            t(
              "Messages are sent through the WhatsApp Business Cloud API, and sent, delivered and read are reported by the provider. A recipient who replies STOP withdraws permission automatically.",
            )}
          {data.whatsapp?.mode === "simulator" && (
            <strong>
              {t(
                "SIMULATED: no message leaves this server and no phone receives anything. Statuses are generated so the flow can be demonstrated. Set MATERNASYNC_WHATSAPP_PROVIDER=cloud_api with WhatsApp Business credentials to send for real.",
              )}
            </strong>
          )}
          {data.whatsapp?.mode === "manual" &&
            t(
              "Automatic sending is not configured. Prepare the composer link, send from your own WhatsApp, then record it as sent. Delivery stays unconfirmed.",
            )}
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
            }, t("Notification prepared. Open WhatsApp to review and send."));
          }}
        >
          <div className="continuity-fields">
            <Field label={t("Notification type")}>
              <select
                value={outreachType}
                onChange={(e) => {
                  setOutreachType(e.target.value);
                  setConsentId("");
                  setOutreachSource("");
                }}
              >
                <option value="reminder">{t("Reminder")}</option>
                <option value="output">{t("Approved document")}</option>
              </select>
            </Field>
            <Field label={t("Approved item")}>
              <select
                required
                value={outreachSource}
                onChange={(e) => setOutreachSource(e.target.value)}
              >
                <option value="">{t("Select item")}</option>
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
            <Field label={t("Active patient permission")}>
              <select
                required
                value={consentId}
                onChange={(e) => {
                  setConsentId(e.target.value);
                  setRecipient("");
                  setConfirmed(false);
                }}
              >
                <option value="">{t("Select permission")}</option>
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
                      {c.recipient} ·{" "}
                      {t("Expires {time}", { time: formatTime(c.expiresAt) })}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("Confirm recipient phone")}>
              <input
                required
                type="tel"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={t("Re-enter the consented number")}
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
            {t("I verified the recipient and reviewed the minimal notification.")}
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
            {t("Prepare notification")}
          </button>
        </form>
        {data.outreach?.map((o) => (
          <div key={o.id} className="continuity-item">
            <h3>
              {o.recipient} <Badge>{word(t, o.status)}</Badge>{" "}
              {o.provider === "simulator" && <Badge>{t("SIMULATED")}</Badge>}
            </h3>
            <p>{o.message}</p>
            <p className="continuity-muted">
              {t("Prepared {time}", { time: formatTime(o.createdAt) })}
              {o.sentAt &&
                ` · ${t("Sent {time}", { time: formatTime(o.sentAt) })}`}
              {o.deliveredAt &&
                ` · ${t("Delivered {time}", { time: formatTime(o.deliveredAt) })}`}
              {o.readAt &&
                ` · ${t("Read {time}", { time: formatTime(o.readAt) })}`}
              <br />
              {t("Delivery:")}{" "}
              {o.status === "DELIVERED" || o.status === "READ"
                ? o.provider === "simulator"
                  ? t("simulated, nothing was delivered to a phone")
                  : t("confirmed by the WhatsApp provider")
                : o.status === "SENT"
                  ? t("sent, waiting for the provider to confirm delivery")
                  : o.status === "MANUALLY_SENT"
                    ? t("sent by staff from the composer, not confirmed")
                    : o.status === "FAILED"
                      ? t("failed")
                      : o.status === "CANCELLED"
                        ? t("cancelled, permission was withdrawn")
                        : t("not sent yet")}
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
                      }, data.whatsapp?.mode === "simulator" ? t("Simulated send recorded. No real message was sent.") : t("Message handed to WhatsApp. Delivery status will update."))
                    }
                  >
                    {o.status === "FAILED" ? t("Try sending again") : t("Send now")}
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
                  {t("Verify consent & prepare WhatsApp link")}
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
                    }, t("Recorded as sent by staff. Delivery is unconfirmed."))
                  }
                >
                  {t("I sent it from WhatsApp")}
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
              {t("Continue to WhatsApp ↗")}
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
  const { t } = useLanguage();
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
    (task) =>
      (!ownerFilter || task.ownerUserId === ownerFilter) &&
      (filter === "all" || filter === "overdue"
        ? filter === "all" ||
          (!!task.dueDate &&
            task.dueDate < localDateTime().slice(0, 10) &&
            !["COMPLETED", "CANCELLED"].includes(task.status))
        : !["COMPLETED", "CANCELLED"].includes(task.status)),
  );
  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <Panel title={t("Task ownership & history")}>
        <div className="continuity-fields">
          <Field label={t("Queue filter")}>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">{t("Open tasks")}</option>
              <option value="overdue">{t("Overdue")}</option>
              <option value="all">{t("All tasks")}</option>
            </select>
          </Field>
          <Field label={t("Owner")}>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            >
              <option value="">{t("All owners")}</option>
              {episode.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!shown.length && <Empty>{t("No tasks in this queue.")}</Empty>}
        {shown.map((task) => (
          <TaskRow
            key={`${task.id}-${task.ownerUserId}-${task.dueDate}`}
            task={task}
            members={episode.members}
            saved={loadTasks}
          />
        ))}
      </Panel>
      <Panel title={t("Appointments & requests")}>
        {data.appointments.map((a) => (
          <article key={a.id} className="continuity-item">
            <h3>
              {a.appointmentType} <Badge>{word(t, a.status)}</Badge>
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
                    }, t("Appointment updated."))
                  }
                >
                  {status === "scheduled"
                    ? t("Confirm visit")
                    : word(t, status)}
                </button>
              ))}
            </div>
          </article>
        ))}
      </Panel>
      <Panel title={t("Record a documented outcome")}>
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
            }, t("Documented outcome added to authorized clinic reporting."));
          }}
        >
          <div className="continuity-fields">
            <Field label={t("Outcome type")}>
              <select
                value={outcome}
                onChange={(e) => {
                  setOutcome(e.target.value);
                  setValue(e.target.value === "scan" ? "on_time" : "");
                }}
              >
                <option value="scan">{t("Scan completion")}</option>
                <option value="delivery">{t("Recorded delivery outcome")}</option>
              </select>
            </Field>
            <Field label={t("Recorded outcome")}>
              {outcome === "scan" ? (
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                >
                  <option value="on_time">{t("On time")}</option>
                  <option value="late">{t("Late")}</option>
                </select>
              ) : (
                <input
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              )}
            </Field>
            <Field label={t("Event date")}>
              <input
                type="date"
                required
                max={localDateTime().slice(0, 10)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label={t("Verified source document")}>
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">{t("Choose source")}</option>
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
            {t("Record outcome")}
          </button>
        </form>
        {data.outcomes?.map((o) => (
          <p className="continuity-muted" key={o.id}>
            {o.eventDate} · {word(t, o.kind)} ·{" "}
            {o.kind === "scan"
              ? word(t, o.value)
              : o.value.replaceAll("_", " ")}
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
  const { t } = useLanguage();
  const action = useAction();
  const [owner, setOwner] = useState(task.ownerUserId || "");
  const [date, setDate] = useState(task.dueDate || "");
  return (
    <article className="continuity-item">
      <h3>
        {task.title} <Badge>{taskStatus(t, task.status)}</Badge>
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
          }, t("Assignment saved."));
        }}
      >
        <div className="continuity-fields">
          <Field label={t("Assigned owner")}>
            <select
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">{t("Unassigned")}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Due date")}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <button className="btn-secondary" disabled={action.busy}>
          {t("Save owner & due date")}
        </button>
      </form>
      <details>
        <summary className="continuity-muted">
          {t("Reassignment history ({count})", { count: task.history.length })}
        </summary>
        {task.history.map((h, i) => (
          <p className="continuity-muted" key={i}>
            {formatTime(h.at)} · {h.name} ·{" "}
            {t("assigned by {name}", { name: h.by })}
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
  const { t } = useLanguage();
  return (
    <Link
      className="btn-secondary"
      to={`/${role === "doctor" ? "doctor" : "care-team"}/care-workspace?episodeId=${episodeId}`}
    >
      {t("Connected care workspace")}
    </Link>
  );
}
