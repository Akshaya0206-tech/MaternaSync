import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, fetchBlobWithAuth } from "../../api/client";
import { getLibrary, languages, formatTime } from "../../api/continuity";
import type { Language, Resource } from "../../api/continuity";
import { tx, useLanguage } from "../../i18n";
import {
  Badge,
  Empty,
  Feedback,
  Field,
  Page,
  Panel,
  useAction,
} from "./shared";

// The lists other parts of the app read from. Each must be approved by a doctor before it is used.
// (Reference documents are not here: they live on the doctor's own Reference Library page.)
const kinds = {
  rule: tx("Follow-up rules"),
  coding: tx("ICD-10 code sets"),
  education: tx("Patient education"),
  pathway: tx("Care pathways"),
  template: tx("Note templates"),
};

// Status codes are shown as written in English; only the words are translated.
const statusLabels: Record<string, string> = {
  DRAFT: tx("DRAFT"),
  APPROVED: tx("APPROVED"),
  SUPERSEDED: tx("SUPERSEDED"),
  RETIRED: tx("RETIRED"),
};
const statusOptions = ["DRAFT", "APPROVED", "SUPERSEDED", "RETIRED"];
const statusLabel = (status: string, t: (text: string) => string) =>
  statusLabels[status] ? t(statusLabels[status]) : status;

const stages: Record<string, string> = {
  all: tx("all"),
  first: tx("first"),
  second: tx("second"),
  third: tx("third"),
  postpartum: tx("postpartum"),
};

const addTitles: Record<string, string> = {
  rule: tx("Add rule"),
  coding: tx("Add coding"),
  education: tx("Add education"),
  pathway: tx("Add pathway"),
  template: tx("Add template"),
};

// The two things a follow-up rule can watch, as the doctor reads them.
const metricOptions = [
  ["overdue_task_days", tx("Overdue task (days)")],
  ["missing_days", tx("Missing agreed check-in (days)")],
];
const metricNames: Record<string, string> = {
  "overdue task days": tx("overdue task days"),
  "missing days": tx("missing days"),
};

// "overdue_task_days" is read as "overdue task days"; the two known names are translated.
function ruleMetric(metric: unknown, t: (text: string) => string) {
  const name = String(metric).replaceAll("_", " ");
  return metricNames[name] ? t(metricNames[name]) : name;
}

// Puts a link into the middle of a translated sentence: the translation holds {link} where the link goes.
function withLink(text: string, link: ReactNode) {
  const [before, after = ""] = text.split("{link}");
  return (
    <>
      {before}
      {link}
      {after}
    </>
  );
}

export function LibraryPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const doctor = user?.role === "doctor";
  const action = useAction();
  const [items, setItems] = useState<Resource[]>([]);
  const [kind, setKind] = useState("rule");
  const [query, setQuery] = useState("");
  const [issuer, setIssuer] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<Resource | null>(null);
  const [editor, setEditor] = useState<Resource | "new" | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkConfirmed, setBulkConfirmed] = useState(false);
  const reload = async () => {
    const result = await getLibrary();
    setItems(result);
    return result;
  };
  useEffect(() => {
    let active = true;
    getLibrary()
      .then((r) => {
        if (active) setItems(r);
      })
      .catch((e) => {
        if (active) action.setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const results = items.filter(
    (r) =>
      r.kind === kind &&
      (!issuer || r.issuer === issuer) &&
      (!jurisdiction || r.jurisdiction === jurisdiction) &&
      (!topic || r.topic === topic) &&
      (status ? r.status === status : r.status !== "RETIRED") &&
      (!date || (r.publicationDate && r.publicationDate >= date)) &&
      `${r.title} ${r.topic} ${r.content} ${r.issuer}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const drafts = results.filter((r) => r.status === "DRAFT");
  // Only what is on screen can be approved, even if filters changed after ticking.
  const chosen = picked.filter((id) => drafts.some((d) => d.id === id));
  const choose = (resource: Resource) => setSelected(resource);
  return (
    <Page
      title={t("Clinical settings")}
      subtitle={t(
        "The lists other parts of the app read from: follow-up rules, ICD-10 code sets, patient education, care pathways and note layouts. A doctor approves each one before it is used, and every approval records the reviewer and version.",
      )}
    >
      <Feedback error={action.error} message={action.message} />
      <div className="continuity-tabs">
        {Object.entries(kinds).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={kind === key}
            onClick={() => {
              setKind(key);
              setSelected(null);
              setIssuer("");
              setTopic("");
              setPicked([]);
              setBulkConfirmed(false);
            }}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="continuity-note">
        {t(
          "These lists change what the app flags or shows to patients, so only a current, approved version is used. Starter entries are drafts: check the source, the wording and whether it applies to your patients before approving.",
        )}{" "}
        {withLink(
          t("Looking something up? Use the {link}."),
          <Link to="/doctor/library">{t("Reference Library")}</Link>,
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await getLibrary(
              new URLSearchParams({
                q: query,
                kind,
                issuer,
                jurisdiction,
                topic,
                status,
                ...(date ? { published_after: date } : {}),
              }).toString(),
            );
          }, t("Showing {count} matching references.", { count: results.length }));
        }}
      >
        <div className="continuity-fields">
          <Field label={t("Search title, topic or passage")}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label={t("Issuing organization")}>
            <select value={issuer} onChange={(e) => setIssuer(e.target.value)}>
              <option value="">{t("All organizations")}</option>
              {[...new Set(items.map((r) => r.issuer))].sort().map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label={t("Topic")}>
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">{t("All topics")}</option>
              {[
                ...new Set(
                  items.filter((r) => r.kind === kind).map((r) => r.topic),
                ),
              ]
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </Field>
          <Field label={t("Jurisdiction")}>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            >
              <option value="">{t("All jurisdictions")}</option>
              {[...new Set(items.map((r) => r.jurisdiction))]
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </Field>
          <Field label={t("Review status")}>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("All statuses")}</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("Published on or after")}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="continuity-actions">
          <button className="btn-secondary" disabled={action.busy}>
            {t("Search references")}
          </button>
          {doctor && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setEditor("new")}
            >
              {t("Add resource")}
            </button>
          )}
        </div>
      </form>
      {editor && (
        <ResourceEditor
          key={editor === "new" ? `new-${kind}` : editor.id}
          initial={editor === "new" ? null : editor}
          kind={kind}
          close={() => setEditor(null)}
          saved={async () => {
            setEditor(null);
            setSelected(null);
            await reload();
          }}
        />
      )}
      <div className="continuity-grid">
        <Panel title={t("{count} resources", { count: results.length })}>
          {loading && <p role="status">{t("Loading library…")}</p>}
          {!loading && !results.length && (
            <Empty>
              {t(
                "No matching resources. Clear filters or add a reviewed source.",
              )}
            </Empty>
          )}
          {doctor && drafts.length > 0 && (
            <div className="continuity-note">
              <label className="continuity-check">
                <input
                  type="checkbox"
                  checked={chosen.length === drafts.length}
                  onChange={(e) =>
                    setPicked(e.target.checked ? drafts.map((d) => d.id) : [])
                  }
                />
                {t("Select all {count} drafts in this view", {
                  count: drafts.length,
                })}
              </label>
              <label className="continuity-check">
                <input
                  type="checkbox"
                  checked={bulkConfirmed}
                  onChange={(e) => setBulkConfirmed(e.target.checked)}
                />
                {t(
                  "I read each selected resource, its source and its review date, and approve it with my professional signature.",
                )}
              </label>
              <button
                className="btn-primary"
                disabled={action.busy || !chosen.length || !bulkConfirmed}
                onClick={() =>
                  action.run(async () => {
                    const result = await api.post<{
                      approved: string[];
                      failed: { id: string; reason: string }[];
                    }>("/api/v2/library/approve-batch", {
                      ids: chosen,
                      confirmed: true,
                    });
                    setPicked([]);
                    setBulkConfirmed(false);
                    setSelected(null);
                    await reload();
                    if (result.failed.length)
                      throw new Error(
                        t(
                          "{approved} approved. {failed} could not be approved: {reasons}",
                          {
                            approved: result.approved.length,
                            failed: result.failed.length,
                            reasons: [
                              ...new Set(result.failed.map((f) => f.reason)),
                            ].join("; "),
                          },
                        ),
                      );
                  }, t("Approved {count} resources. Each approval records you as the reviewer.", { count: chosen.length }))
                }
              >
                {t("Approve {count} selected", { count: chosen.length })}
              </button>
            </div>
          )}
          {results.map((r) => (
            <article className="continuity-item" key={r.id}>
              <h3>{r.title}</h3>
              <p className="continuity-muted">
                {r.issuer} · {r.jurisdiction} · v{r.version} ·{" "}
                {r.publicationDate || t("Publication date unverified")}
                {r.kind === "education" && ` · ${languages[r.language]}`}
              </p>
              {doctor && r.status === "DRAFT" && (
                <label className="continuity-check">
                  <input
                    type="checkbox"
                    checked={picked.includes(r.id)}
                    onChange={(e) =>
                      setPicked((old) =>
                        e.target.checked
                          ? [...old, r.id]
                          : old.filter((id) => id !== r.id),
                      )
                    }
                  />
                  {t("Select for approval")}
                </label>
              )}
              <Badge>
                {statusLabel(r.status, t)}
                {r.status === "APPROVED" && !r.usable
                  ? ` · ${t("review overdue")}`
                  : ""}
              </Badge>
              <p className="continuity-muted">
                {r.content.slice(0, 220)}
                {r.content.length > 220 ? "…" : ""}
              </p>
              <button className="btn-secondary" onClick={() => choose(r)}>
                {t("Read source & history")}
              </button>
            </article>
          ))}
        </Panel>
        {selected && (
          <Panel
            title={selected.title}
            aside={<Badge>v{selected.version}</Badge>}
          >
            <p className="continuity-muted">
              {selected.issuer} · {selected.jurisdiction} · {selected.section}
            </p>
            {selected.sourceUrl && (
              <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                {t("Open official source ↗")}
              </a>
            )}
            {typeof selected.configuration.documentUrl === "string" &&
              selected.configuration.documentUrl && (
                <>
                  {" · "}
                  <a
                    href={selected.configuration.documentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("Open the document ↗")}
                  </a>
                </>
              )}
            <p className="continuity-muted">
              {t("Review: {status}", {
                status: statusLabel(selected.status, t),
              })}{" "}
              · {selected.approvedByName || t("No reviewer yet")}
              <br />
              {t("Last checked: {time} · Review due: {date}", {
                time: formatTime(selected.lastCheckedAt),
                date: selected.reviewDue || t("Not set"),
              })}
              <br />
              {t("Usage rights: {rights}", {
                rights: selected.rightsNote || t("Not recorded"),
              })}
            </p>
            <div
              className="continuity-copy"
              style={{ maxHeight: 420, overflowY: "auto" }}
            >
              {selected.content}
            </div>
            {selected.kind === "pathway" &&
              selected.configuration.steps?.map((step, i) => (
                <p key={i}>
                  {i + 1}. {step.title} · {t("day {days}", { days: step.days })}
                </p>
              ))}
            {selected.kind === "template" && (
              <p className="continuity-muted">
                {t("Fields: {fields}", {
                  fields: selected.configuration.fields?.join(" · ") ?? "",
                })}
              </p>
            )}
            {selected.kind === "rule" && (
              <p className="continuity-muted">
                {t("Flags when {metric} {comparison} {threshold}", {
                  metric: ruleMetric(selected.configuration.metric, t),
                  comparison: selected.configuration.operator === "gt" ? ">" : "<",
                  threshold: String(selected.configuration.threshold),
                })}
                {selected.configuration.nextAction
                  ? ` · ${t("Follow-up: {action}", { action: String(selected.configuration.nextAction) })}`
                  : ""}
              </p>
            )}
            {selected.kind === "coding" && (
              <p className="continuity-muted">
                {t(
                  "{count} phrase-to-code entries. Review the phrases before approving. A doctor looks codes up by typing a code or a phrase; nothing reads a patient's note and no code is assigned automatically.",
                  {
                    count:
                      (selected.configuration.entries as unknown[] | undefined)
                        ?.length ?? 0,
                  },
                )}
              </p>
            )}
            <div className="continuity-actions">
              {selected.hasFile && (
                <button
                  className="btn-secondary"
                  onClick={() =>
                    action.run(async () => {
                      const blob = await fetchBlobWithAuth(
                        `/api/v2/library/${selected.id}/file`,
                      );
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "guideline.pdf";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }, "")
                  }
                >
                  {t("Download original PDF")}
                </button>
              )}
              {doctor && (
                <button
                  className="btn-secondary"
                  onClick={() => setEditor(selected)}
                >
                  {t("Create next version")}
                </button>
              )}
            </div>
            {doctor && selected.status === "DRAFT" && (
              <>
                <p className="continuity-muted">
                  {t(
                    "Approve only after checking the original source, permissions, version and applicability. This records your professional review.",
                  )}
                </p>
                <button
                  className="btn-primary"
                  disabled={action.busy}
                  onClick={() =>
                    action.run(async () => {
                      const updated = await api.post<Resource>(
                        `/api/v2/library/${selected.id}/approve`,
                        { confirmed: true },
                      );
                      setSelected(updated);
                      await reload();
                    }, t("Resource approved. Its version and reviewer are recorded."))
                  }
                >
                  {t("Confirm review & approve")}
                </button>
              </>
            )}
            {doctor && selected.status === "APPROVED" && (
              <button
                className="btn-secondary"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    setSelected(
                      await api.post(`/api/v2/library/${selected.id}/retire`, {
                        confirmed: true,
                      }),
                    );
                    await reload();
                  }, t("Resource retired. Existing citations retain their original version."))
                }
              >
                {t("Retire resource")}
              </button>
            )}
            <details>
              <summary className="continuity-muted">
                {t("Version history")}
              </summary>
              {items
                .filter((r) => r.familyId === selected.familyId)
                .map((r) => (
                  <p key={r.id}>
                    v{r.version} · {statusLabel(r.status, t)} ·{" "}
                    {r.approvedByName || t("Unreviewed")}
                  </p>
                ))}
            </details>
          </Panel>
        )}
      </div>
    </Page>
  );
}

function ResourceEditor({
  initial,
  kind,
  close,
  saved,
}: {
  initial: Resource | null;
  kind: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const { t } = useLanguage();
  const action = useAction();
  const type = initial?.kind || kind;
  const [title, setTitle] = useState(initial?.title || "");
  const [issuer, setIssuer] = useState(initial?.issuer || "");
  const [topic, setTopic] = useState(initial?.topic || "");
  const [jurisdiction, setJurisdiction] = useState(
    initial?.jurisdiction || "India",
  );
  const [source, setSource] = useState(initial?.sourceUrl || "");
  const [section, setSection] = useState(initial?.section || "");
  const [content, setContent] = useState(initial?.content || "");
  const [rights, setRights] = useState(initial?.rightsNote || "");
  const [review, setReview] = useState(initial?.reviewDue || "");
  const [published, setPublished] = useState(initial?.publicationDate || "");
  const [language, setLanguage] = useState<Language>(initial?.language || "en");
  const [stage, setStage] = useState(initial?.stage || "all");
  const [fields, setFields] = useState(
    initial?.configuration.fields?.join("\n") || "",
  );
  const [required, setRequired] = useState(
    initial?.configuration.required?.join("\n") || "",
  );
  const [isDefault, setDefault] = useState(
    initial?.configuration.default || false,
  );
  const [steps, setSteps] = useState(
    initial?.configuration.steps || [{ title: "", days: 0 }],
  );
  const [metric, setMetric] = useState(
    String(initial?.configuration.metric || "overdue_task_days"),
  );
  const [operator, setOperator] = useState(
    String(initial?.configuration.operator || "gt"),
  );
  const [threshold, setThreshold] = useState(
    String(initial?.configuration.threshold ?? ""),
  );
  const [nextAction, setNextAction] = useState(
    String(initial?.configuration.nextAction || ""),
  );
  const [codes, setCodes] = useState(
    (
      initial?.configuration.entries as
        { code: string; label: string; match: string }[] | undefined
    )
      ?.map((c) => `${c.code} | ${c.label} | ${c.match}`)
      .join("\n") || "",
  );
  const lines = (s: string) =>
    s
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean);
  return (
    <Panel
      title={
        initial
          ? t("New version of {title}", { title: initial.title })
          : addTitles[type]
            ? t(addTitles[type])
            : t("Add {type}", { type })
      }
    >
      <Feedback error={action.error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            const configuration =
              type === "template"
                ? {
                    fields: lines(fields),
                    required: lines(required),
                    default: isDefault,
                  }
                : type === "pathway"
                  ? { steps }
                  : type === "rule"
                    ? { metric, operator, threshold: Number(threshold), nextAction }
                    : type === "coding"
                      ? {
                          entries: lines(codes).map((s) => {
                            const [code, label, match] = s
                              .split("|")
                              .map((v) => v.trim());
                            return { code, label, match };
                          }),
                        }
                      : {};
            await api.post("/api/v2/library", {
              kind: type,
              title,
              issuer,
              topic,
              jurisdiction,
              sourceUrl: source,
              section,
              content,
              rightsNote: rights,
              reviewDue: review || null,
              publicationDate: published || null,
              language,
              stage,
              configuration,
              previousVersionId: initial?.id || null,
            });
            await saved();
          });
        }}
      >
        <div className="continuity-fields">
          <Field label={t("Title")}>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={t("Issuing body / clinical owner")}>
            <input
              required
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
            />
          </Field>
          <Field label={t("Topic")}>
            <input
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <Field label={t("Jurisdiction")}>
            <input
              required
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            />
          </Field>
          <Field label={t("Official source URL")}>
            <input
              type="url"
              required={type !== "template" && type !== "rule"}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label={t("Section / page")}>
            <input
              value={section}
              required={type === "guideline"}
              onChange={(e) => setSection(e.target.value)}
            />
          </Field>
          <Field label={t("Publication / update date")}>
            <input
              type="date"
              value={published}
              onChange={(e) => setPublished(e.target.value)}
            />
          </Field>
          <Field label={t("Next clinical review date")}>
            <input
              type="date"
              required
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </Field>
          <Field label={t("Language")}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
            >
              {Object.entries(languages).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {type === "education" && (
            <Field label={t("Stage")}>
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                {Object.entries(stages).map(([key, label]) => (
                  <option key={key} value={key}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field
          label={
            type === "guideline"
              ? t("Permitted source passage / document text")
              : t("Reviewed content / description")
          }
        >
          <textarea
            rows={6}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Field>
        {type === "guideline" && (
          <Field label={t("Usage rights / permission to store original")}>
            <textarea
              rows={2}
              required
              value={rights}
              onChange={(e) => setRights(e.target.value)}
            />
          </Field>
        )}
        {type === "template" && (
          <>
            <div className="continuity-fields">
              <Field label={t("Field names, one per line")}>
                <textarea
                  rows={4}
                  required
                  value={fields}
                  onChange={(e) => setFields(e.target.value)}
                />
              </Field>
              <Field label={t("Required fields, one per line")}>
                <textarea
                  rows={4}
                  value={required}
                  onChange={(e) => setRequired(e.target.value)}
                />
              </Field>
            </div>
            <label className="continuity-check">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setDefault(e.target.checked)}
              />
              {t("Use as an organization default")}
            </label>
          </>
        )}
        {type === "pathway" && (
          <>
            <div className="continuity-note">
              {t(
                "Administrative coordination tasks only. Clinical orders and treatment decisions must be documented separately by the clinician.",
              )}
            </div>
            {steps.map((step, i) => (
              <div className="continuity-fields" key={i}>
                <Field label={t("Task {number}", { number: i + 1 })}>
                  <input
                    required
                    value={step.title}
                    onChange={(e) =>
                      setSteps((s) =>
                        s.map((v, n) =>
                          n === i ? { ...v, title: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={t("Days after start")}>
                  <input
                    type="number"
                    min="0"
                    max="365"
                    required
                    value={step.days}
                    onChange={(e) =>
                      setSteps((s) =>
                        s.map((v, n) =>
                          n === i ? { ...v, days: Number(e.target.value) } : v,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setSteps((s) => [...s, { title: "", days: 1 }])}
            >
              {t("Add task")}
            </button>
          </>
        )}
        {type === "rule" && (
          <>
            <div className="continuity-note">
              {t(
                "A follow-up rule watches only whether check-ins and tasks are happening. It cannot read a blood pressure, a weight or any other clinical value, and it does not rank patients by urgency or risk. A rule shows flags only after a doctor approves it, and a flag asks a person to follow up; it does not diagnose, message the patient or assign work by itself.",
              )}
            </div>
            <div className="continuity-fields">
              <Field label={t("Recorded metric")}>
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {metricOptions.map(([key, label]) => (
                    <option key={key} value={key}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Comparison")}>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                >
                  <option value="gt">{t("Greater than")}</option>
                  <option value="lt">{t("Less than")}</option>
                </select>
              </Field>
              <Field label={t("Threshold (days)")}>
                <input
                  type="number"
                  step="any"
                  required
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label={t(
                "Follow-up shown to the doctor (administrative wording, up to 300 characters)",
              )}
            >
              <input
                maxLength={300}
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
            </Field>
          </>
        )}
        {type === "coding" && (
          <Field
            label={t(
              "Verified code | label | phrase to match (one entry per line)",
            )}
          >
            <textarea
              rows={5}
              required
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
            />
          </Field>
        )}
        <div className="continuity-actions">
          <button className="btn-primary" disabled={action.busy}>
            {t("Save draft for review")}
          </button>
          <button type="button" className="btn-secondary" onClick={close}>
            {t("Cancel")}
          </button>
        </div>
      </form>
    </Panel>
  );
}
