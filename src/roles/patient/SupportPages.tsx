import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import {
  ROOT,
  languages,
  formatTime,
  localDateTime,
} from "../../api/continuity";
import type { Language, Resource, Workspace } from "../../api/continuity";
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

export function ConsentPage() {
  const w = useWorkspace();
  const action = useAction();
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("reminders");
  const [expires, setExpires] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [history, setHistory] = useState<
    { id: string; title: string; timestamp: string }[]
  >([]);
  return (
    <Page
      title="Sharing & consent"
      subtitle="Choose who may receive a minimal WhatsApp notification, for what purpose, and for how long."
    >
      <Feedback error={w.error || action.error} message={action.message} />
      <div className="continuity-note">
        Messages contain only a prompt to sign in. Your records, medicines and
        health details are not included. Revoking permission stops future
        sharing; it cannot retract a message already sent outside MaternaSync.
      </div>
      {w.data && (
        <>
          <Panel title="Give sharing permission">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api.post(`${ROOT}/episodes/${w.episodeId}/consents`, {
                    recipient,
                    purpose,
                    expiresAt: new Date(expires).toISOString(),
                  });
                  setConfirmed(false);
                  await w.reload();
                }, "Sharing permission recorded.");
              }}
            >
              <div className="continuity-fields">
                <Field label="Recipient phone with country code">
                  <input
                    required
                    type="tel"
                    placeholder="+919876543210"
                    pattern="\+[1-9][0-9]{7,14}"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </Field>
                <Field label="Purpose">
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  >
                    <option value="reminders">Care reminders</option>
                    <option value="approved_documents">
                      Approved document notifications
                    </option>
                  </select>
                </Field>
                <Field label="Permission expires">
                  <input
                    required
                    type="datetime-local"
                    min={localDateTime()}
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                  />
                </Field>
              </div>
              <label className="continuity-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  required
                />
                I confirm this recipient and permit notifications for the
                selected purpose until the expiry date.
              </label>
              <button
                className="btn-primary"
                disabled={action.busy || !confirmed}
              >
                Save permission
              </button>
            </form>
          </Panel>
          <Panel title="Your permissions">
            {!w.data.consents.length && (
              <Empty>No external sharing permissions granted.</Empty>
            )}
            {w.data.consents.map((c) => (
              <div key={c.id} className="continuity-item">
                <h3>
                  {c.recipient}{" "}
                  <Badge>
                    {c.revokedAt ? "Revoked" : c.active ? "Active" : "Expired"}
                  </Badge>
                </h3>
                <p>
                  {c.purpose.replaceAll("_", " ")} · Expires{" "}
                  {formatTime(c.expiresAt)}
                </p>
                {c.active && (
                  <button
                    className="btn-secondary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await api.post(`${ROOT}/consents/${c.id}/revoke`);
                        await w.reload();
                      }, "Permission revoked. Future sharing is blocked.")
                    }
                  >
                    Revoke / opt out
                  </button>
                )}
              </div>
            ))}
            <div className="continuity-actions">
              <button
                className="btn-secondary"
                onClick={() =>
                  action.run(
                    async () =>
                      setHistory(
                        await api.get(
                          `${ROOT}/episodes/${w.episodeId}/consent-history`,
                        ),
                      ),
                    "",
                  )
                }
              >
                View consent history
              </button>
            </div>
            {history.map((h) => (
              <p key={h.id} className="continuity-muted">
                {formatTime(h.timestamp)} · {h.title}
              </p>
            ))}
          </Panel>
        </>
      )}
    </Page>
  );
}

export function SummaryList({
  data,
  appointmentId,
}: {
  data: Workspace;
  appointmentId?: string;
}) {
  const outputs = data.outputs.filter(
    (o) => !appointmentId || o.appointmentId === appointmentId,
  );
  return (
    <>
      {!outputs.length && (
        <Empty>
          No approved summaries or documents have been released yet.
        </Empty>
      )}
      {outputs.map((o) => (
        <article key={o.id} className="continuity-item">
          <h3>
            {o.title} <Badge>Approved</Badge>
          </h3>
          <p className="continuity-muted">
            Reviewed by {o.approvedByName} · {formatTime(o.approvedAt)} ·{" "}
            {languages[o.language]}
          </p>
          {o.appointmentId && (
            <p className="continuity-muted">
              Visit:{" "}
              {formatTime(
                data.appointments.find((a) => a.id === o.appointmentId)
                  ?.scheduledAt ?? null,
              )}
            </p>
          )}
          <div className="continuity-copy" lang={o.language}>
            {o.content}
          </div>
          {o.structuredData &&
            Object.entries(o.structuredData).map(([key, value]) => (
              <p key={key}>
                <strong>{key}:</strong> {value}
              </p>
            ))}
        </article>
      ))}
    </>
  );
}

export function CarePlanPage() {
  const w = useWorkspace();
  const action = useAction();
  const [filter, setFilter] = useState("pending");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("Consultation");
  const [notes, setNotes] = useState("");
  return (
    <Page
      title="My care plan"
      subtitle="Follow the reminders your care team has approved, request a visit, and read your released summaries."
    >
      <Feedback error={w.error || action.error} message={action.message} />
      {w.data && (
        <>
          <Panel
            title="Medicine, vaccine & visit reminders"
            aside={
              <select
                aria-label="Reminder status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="all">All reminders</option>
              </select>
            }
          >
            {!w.data.reminders.filter(
              (r) => filter === "all" || r.status === filter,
            ).length && (
              <Empty>
                No reminders in this view. Schedules are entered by your care
                team.
              </Empty>
            )}
            {w.data.reminders
              .filter((r) => filter === "all" || r.status === filter)
              .map((r) => (
                <article key={r.id} className="continuity-item">
                  <h3>
                    {r.title} <Badge>{r.status.replaceAll("_", " ")}</Badge>
                  </h3>
                  <p>
                    {formatTime(r.scheduledAt)} · {r.kind.replaceAll("_", " ")}
                  </p>
                  <div className="continuity-copy">{r.instructions}</div>
                  <p className="continuity-muted">
                    Approved by {r.approvedByName}
                  </p>
                  {r.status === "pending" && (
                    <div className="continuity-actions">
                      {[
                        ["done", "Done"],
                        ["skipped", "Skipped"],
                        ["needs_help", "I need help"],
                      ].map(([status, label]) => (
                        <button
                          key={status}
                          className="btn-secondary"
                          disabled={action.busy}
                          onClick={() =>
                            action.run(
                              async () => {
                                await api.post(
                                  `${ROOT}/reminders/${r.id}/respond`,
                                  { status },
                                );
                                await w.reload();
                              },
                              status === "needs_help"
                                ? "Your care team has been asked to follow up."
                                : "Response saved.",
                            )
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}
          </Panel>
          <Panel title="Request an appointment">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action.run(async () => {
                  await api.post(
                    `${ROOT}/episodes/${w.episodeId}/appointments`,
                    {
                      scheduledAt: new Date(time).toISOString(),
                      appointmentType: reason,
                      notes,
                    },
                  );
                  setNotes("");
                  await w.reload();
                }, "Request sent. Your care team will confirm the time.");
              }}
            >
              <div className="continuity-fields">
                <Field label="Preferred date and time">
                  <input
                    required
                    type="datetime-local"
                    min={localDateTime()}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Field>
                <Field label="Visit type">
                  <input
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Notes for your care team">
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <button className="btn-primary" disabled={action.busy}>
                Request visit
              </button>
            </form>
            {w.data.appointments
              .filter((a) => a.status === "requested")
              .map((a) => (
                <p key={a.id} className="continuity-muted">
                  Requested: {formatTime(a.scheduledAt)} · {a.appointmentType} ·
                  Waiting for confirmation
                </p>
              ))}
          </Panel>
          <Panel title="Approved summaries & instructions">
            <SummaryList data={w.data} />
          </Panel>
        </>
      )}
    </Page>
  );
}

const navigation = {
  en: {
    title: "Care companion",
    description:
      "Find your way, learn from reviewed information, and ask your care team.",
    questions: "Ask my care team",
    records: "My records",
    log: "Daily check-in",
    plan: "My care plan",
    prompt:
      "Medical questions go to your care team for review. This companion does not diagnose or recommend treatment.",
  },
  hi: {
    title: "देखभाल साथी",
    description: "स्वीकृत जानकारी पढ़ें और अपनी देखभाल टीम से प्रश्न पूछें।",
    questions: "मेरी देखभाल टीम से पूछें",
    records: "मेरे रिकॉर्ड",
    log: "दैनिक जानकारी",
    plan: "मेरी देखभाल योजना",
    prompt:
      "चिकित्सा प्रश्न समीक्षा के लिए आपकी देखभाल टीम को भेजे जाते हैं। यह साथी निदान या उपचार की सलाह नहीं देता।",
  },
  ta: {
    title: "பராமரிப்புத் துணை",
    description:
      "மதிப்பாய்வு செய்யப்பட்ட தகவல்களைப் படித்து, உங்கள் பராமரிப்புக் குழுவிடம் கேளுங்கள்.",
    questions: "எனது பராமரிப்புக் குழுவிடம் கேளுங்கள்",
    records: "எனது பதிவுகள்",
    log: "தினசரிப் பதிவு",
    plan: "எனது பராமரிப்புத் திட்டம்",
    prompt:
      "மருத்துவக் கேள்விகள் உங்கள் பராமரிப்புக் குழுவின் மதிப்பாய்விற்கு அனுப்பப்படும். இந்தத் துணை நோயறிதலோ சிகிச்சைப் பரிந்துரையோ வழங்காது.",
  },
  te: {
    title: "సంరక్షణ తోడు",
    description:
      "సమీక్షించిన సమాచారాన్ని చదవండి, మీ సంరక్షణ బృందాన్ని ప్రశ్నలు అడగండి.",
    questions: "నా సంరక్షణ బృందాన్ని అడగండి",
    records: "నా రికార్డులు",
    log: "రోజువారీ నమోదు",
    plan: "నా సంరక్షణ ప్రణాళిక",
    prompt:
      "వైద్య ప్రశ్నలు సమీక్ష కోసం మీ సంరక్షణ బృందానికి పంపబడతాయి. ఈ తోడు రోగ నిర్ధారణ లేదా చికిత్స సలహా ఇవ్వదు.",
  },
};
export function CompanionPage() {
  const w = useWorkspace();
  const action = useAction();
  const [language, setLanguage] = useState<Language>("en");
  const [stage, setStage] = useState("all");
  const [modules, setModules] = useState<Resource[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (w.context) setLanguage(w.context.language);
  }, [w.context]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api
      .get<Resource[]>(
        `/api/v2/library/education?language=${language}&stage=${stage}`,
      )
      .then((r) => {
        if (active) setModules(r);
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
  }, [language, stage]);
  const t = navigation[language];
  return (
    <Page title={t.title} subtitle={t.description}>
      <Feedback
        error={w.error || action.error || error}
        message={action.message}
      />
      <div className="continuity-fields">
        <Field label="Language / भाषा / மொழி / భాష">
          <select
            value={language}
            onChange={(e) => {
              const next = e.target.value as Language;
              void action.run(async () => {
                await api.patch(`${ROOT}/preferences`, { language: next });
                setLanguage(next);
              }, "");
            }}
          >
            {Object.entries(languages).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pregnancy stage">
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            {["all", "first", "second", "third", "postpartum"].map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? "All stages"
                  : s === "postpartum"
                    ? "Postpartum"
                    : `${s} trimester`}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div lang={language}>
        <div className="continuity-note">{t.prompt}</div>
        <div className="continuity-actions">
          <Link className="btn-primary" to="/patient/questions">
            {t.questions}
          </Link>
          <Link className="btn-secondary" to="/patient/records">
            {t.records}
          </Link>
          <Link className="btn-secondary" to="/patient/daily-log">
            {t.log}
          </Link>
          <Link className="btn-secondary" to="/patient/care-plan">
            {t.plan}
          </Link>
        </div>
        <Panel title="Reviewed education">
          {loading ? (
            <p role="status">Loading…</p>
          ) : !modules.length ? (
            <Empty>
              No current reviewed modules are available in this language and
              stage. Ask your care team for information in your preferred
              language.
            </Empty>
          ) : (
            modules.map((m) => (
              <article key={m.id} className="continuity-item">
                <h3>{m.title}</h3>
                <div className="continuity-copy">{m.content}</div>
                <p className="continuity-muted">
                  {m.issuer} · v{m.version} · Reviewed by {m.approvedByName} ·{" "}
                  {formatTime(m.lastCheckedAt)} · Review due {m.reviewDue}
                </p>
                <a href={m.sourceUrl} target="_blank" rel="noreferrer">
                  Original source · {m.section}
                </a>
              </article>
            ))
          )}
        </Panel>
      </div>
    </Page>
  );
}
