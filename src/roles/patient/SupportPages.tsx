import { useState } from "react";
import { api } from "../../api/client";
import {
  ROOT,
  languages,
  formatTime,
  localDateTime,
} from "../../api/continuity";
import type { Workspace } from "../../api/continuity";
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

const PURPOSES: Record<string, string> = {
  reminders: tx("Care reminders"),
  approved_documents: tx("Approved document notifications"),
};
const REMINDER_STATUS: Record<string, string> = {
  pending: tx("Pending"),
  done: tx("Done"),
  skipped: tx("Skipped"),
  needs_help: tx("I need help"),
};
const REMINDER_KIND: Record<string, string> = {
  medicine: tx("Medicine"),
  vaccine: tx("Vaccine"),
  appointment: tx("Appointment"),
  follow_up: tx("Follow-up"),
};
// What each part of a plain-language summary or report explanation is, so patients can tell
// confirmed instructions from general information at a glance.
const SECTION_NOTES: Record<string, string> = {
  next: tx("Confirmed by your doctor"),
  about: tx("General information, not specific to you"),
  measure: tx("General information, not specific to you"),
  results: tx("Read from your report"),
  means: tx("Written by your doctor"),
};

export function ConsentPage() {
  const { t } = useLanguage();
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
      title={t("Sharing & consent")}
      subtitle={t(
        "Choose who may receive a minimal WhatsApp notification, for what purpose, and for how long.",
      )}
    >
      <Feedback error={w.error || action.error} message={action.message} />
      <div className="continuity-note">
        {t(
          "Messages contain only a prompt to sign in. Your records, medicines and health details are not included. Revoking permission stops future sharing; it cannot retract a message already sent outside MaternaSync.",
        )}
      </div>
      {w.data && (
        <>
          <Panel title={t("Give sharing permission")}>
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
                }, t("Sharing permission recorded."));
              }}
            >
              <div className="continuity-fields">
                <Field label={t("Recipient phone with country code")}>
                  <input
                    required
                    type="tel"
                    placeholder="+919876543210"
                    pattern="\+[1-9][0-9]{7,14}"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </Field>
                <Field label={t("Purpose")}>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  >
                    {Object.entries(PURPOSES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("Permission expires")}>
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
                {t(
                  "I confirm this recipient and permit notifications for the selected purpose until the expiry date.",
                )}
              </label>
              <button
                className="btn-primary"
                disabled={action.busy || !confirmed}
              >
                {t("Save permission")}
              </button>
            </form>
          </Panel>
          <Panel title={t("Your permissions")}>
            {!w.data.consents.length && (
              <Empty>{t("No external sharing permissions granted.")}</Empty>
            )}
            {w.data.consents.map((c) => (
              <div key={c.id} className="continuity-item">
                <h3>
                  {c.recipient}{" "}
                  <Badge>
                    {c.revokedAt
                      ? t("Revoked")
                      : c.active
                        ? t("Active")
                        : t("Expired")}
                  </Badge>
                </h3>
                <p>
                  {t(PURPOSES[c.purpose] ?? c.purpose.replaceAll("_", " "))} ·{" "}
                  {t("Expires {time}", { time: formatTime(c.expiresAt) })}
                </p>
                {c.active && (
                  <button
                    className="btn-secondary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(
                        async () => {
                          await api.post(`${ROOT}/consents/${c.id}/revoke`);
                          await w.reload();
                        },
                        t("Permission revoked. Future sharing is blocked."),
                      )
                    }
                  >
                    {t("Revoke / opt out")}
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
                {t("View consent history")}
              </button>
            </div>
            {history.map((h) => (
              <p key={h.id} className="continuity-muted">
                {formatTime(h.timestamp)} · {t(h.title)}
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
  data: Pick<Workspace, "outputs" | "appointments">;
  appointmentId?: string;
}) {
  const { t } = useLanguage();
  const outputs = data.outputs.filter(
    (o) => !appointmentId || o.appointmentId === appointmentId,
  );
  return (
    <>
      {!outputs.length && (
        <Empty>
          {t("No approved summaries or documents have been released yet.")}
        </Empty>
      )}
      {outputs.map((o) => {
        const sectioned = !!o.sectionKinds;
        return (
          <article key={o.id} className="continuity-item">
            <h3>
              {o.title} <Badge>{t("Approved")}</Badge>
            </h3>
            <p className="continuity-muted">
              {t("Reviewed by {name}", { name: o.approvedByName ?? "" })} ·{" "}
              {formatTime(o.approvedAt)} · {languages[o.language]}
            </p>
            {o.appointmentId && (
              <p className="continuity-muted">
                {t("Visit")}:{" "}
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
              Object.entries(o.structuredData)
                .filter(([, value]) => !sectioned || value.trim())
                .map(([key, value]) =>
                  sectioned ? (
                    <section
                      key={key}
                      className={`continuity-section continuity-section-${o.sectionKinds?.[key] ?? "plain"}`}
                      lang={o.language}
                    >
                      <h4>{key}</h4>
                      {SECTION_NOTES[o.sectionKinds?.[key] ?? ""] && (
                        <p className="continuity-section-note">
                          {t(SECTION_NOTES[o.sectionKinds?.[key] ?? ""])}
                        </p>
                      )}
                      <div className="continuity-copy">{value}</div>
                    </section>
                  ) : (
                    <p key={key}>
                      <strong>{key}:</strong> {value}
                    </p>
                  ),
                )}
          </article>
        );
      })}
    </>
  );
}

export function CarePlanPage() {
  const { t } = useLanguage();
  const w = useWorkspace();
  const action = useAction();
  const [filter, setFilter] = useState("pending");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("Consultation"); // stored as typed; staff read it as-is
  const [notes, setNotes] = useState("");
  return (
    <Page
      title={t("My care plan")}
      subtitle={t(
        "Follow the reminders your care team has approved, request a visit, and read your released summaries.",
      )}
    >
      <Feedback error={w.error || action.error} message={action.message} />
      {w.data && (
        <>
          <Panel
            title={t("Medicine, vaccine & visit reminders")}
            aside={
              <select
                aria-label={t("Reminder status")}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="pending">{t("Pending")}</option>
                <option value="all">{t("All reminders")}</option>
              </select>
            }
          >
            {!w.data.reminders.filter(
              (r) => filter === "all" || r.status === filter,
            ).length && (
              <Empty>
                {t(
                  "No reminders in this view. Schedules are entered by your care team.",
                )}
              </Empty>
            )}
            {w.data.reminders
              .filter((r) => filter === "all" || r.status === filter)
              .map((r) => (
                <article key={r.id} className="continuity-item">
                  <h3>
                    {r.title}{" "}
                    <Badge>
                      {t(REMINDER_STATUS[r.status] ?? r.status.replaceAll("_", " "))}
                    </Badge>
                  </h3>
                  <p>
                    {formatTime(r.scheduledAt)} ·{" "}
                    {t(REMINDER_KIND[r.kind] ?? r.kind.replaceAll("_", " "))}
                  </p>
                  <div className="continuity-copy">{r.instructions}</div>
                  <p className="continuity-muted">
                    {t("Approved by {name}", { name: r.approvedByName })}
                  </p>
                  {r.status === "pending" && (
                    <div className="continuity-actions">
                      {(
                        [
                          ["done", t("Done")],
                          ["skipped", t("Skipped")],
                          ["needs_help", t("I need help")],
                        ] as const
                      ).map(([status, label]) => (
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
                                ? t("Your care team has been asked to follow up.")
                                : t("Response saved."),
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
          <Panel title={t("Request an appointment")}>
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
                }, t("Request sent. Your care team will confirm the time."));
              }}
            >
              <div className="continuity-fields">
                <Field label={t("Preferred date and time")}>
                  <input
                    required
                    type="datetime-local"
                    min={localDateTime()}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </Field>
                <Field label={t("Visit type")}>
                  <input
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </div>
              <Field label={t("Notes for your care team")}>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <button className="btn-primary" disabled={action.busy}>
                {t("Request visit")}
              </button>
            </form>
            {w.data.appointments
              .filter((a) => a.status === "requested")
              .map((a) => (
                <p key={a.id} className="continuity-muted">
                  {t("Requested")}: {formatTime(a.scheduledAt)} ·{" "}
                  {a.appointmentType} · {t("Waiting for confirmation")}
                </p>
              ))}
          </Panel>
          <Panel title={t("Approved summaries & instructions")}>
            <SummaryList data={w.data} />
          </Panel>
        </>
      )}
    </Page>
  );
}
