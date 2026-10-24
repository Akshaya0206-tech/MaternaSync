import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { api, fetchBlobWithAuth } from "../../api/client";
import { getLibrary, languages, formatTime } from "../../api/continuity";
import type { Language, Resource } from "../../api/continuity";
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
  rule: "Review rules",
  coding: "ICD-10 code sets",
  interaction: "Drug safety checks",
  education: "Patient education",
  pathway: "Care pathways",
  template: "Note templates",
};

export function LibraryPage() {
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
      title="Clinical settings"
      subtitle="The lists other parts of the app read from: review rules, ICD-10 code sets, drug safety checks, patient education, care pathways and note layouts. A doctor approves each one before it is used, and every approval records the reviewer and version."
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
            {label}
          </button>
        ))}
      </div>
      <div className="continuity-note">
        These lists change what the app flags, suggests or shows to patients, so
        only a current, approved version is used. Starter entries are drafts: check
        the source, the wording and whether it applies to your patients before
        approving. Looking something up? Use the <Link to="/doctor/library">Reference Library</Link>.
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
          }, `Showing ${results.length} matching references.`);
        }}
      >
        <div className="continuity-fields">
          <Field label="Search title, topic or passage">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </Field>
          <Field label="Issuing organization">
            <select value={issuer} onChange={(e) => setIssuer(e.target.value)}>
              <option value="">All organizations</option>
              {[...new Set(items.map((r) => r.issuer))].sort().map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Topic">
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">All topics</option>
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
          <Field label="Jurisdiction">
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            >
              <option value="">All jurisdictions</option>
              {[...new Set(items.map((r) => r.jurisdiction))]
                .sort()
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </Field>
          <Field label="Review status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {["DRAFT", "APPROVED", "SUPERSEDED", "RETIRED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Published on or after">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        </div>
        <div className="continuity-actions">
          <button className="btn-secondary" disabled={action.busy}>
            Search references
          </button>
          {doctor && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setEditor("new")}
            >
              Add resource
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
        <Panel title={`${results.length} resources`}>
          {loading && <p role="status">Loading library…</p>}
          {!loading && !results.length && (
            <Empty>
              No matching resources. Clear filters or add a reviewed source.
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
                Select all {drafts.length} drafts in this view
              </label>
              <label className="continuity-check">
                <input
                  type="checkbox"
                  checked={bulkConfirmed}
                  onChange={(e) => setBulkConfirmed(e.target.checked)}
                />
                I read each selected resource, its source and its review date,
                and approve it with my professional signature.
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
                        `${result.approved.length} approved. ${result.failed.length} could not be approved: ${[...new Set(result.failed.map((f) => f.reason))].join("; ")}`,
                      );
                  }, `Approved ${chosen.length} resources. Each approval records you as the reviewer.`)
                }
              >
                Approve {chosen.length} selected
              </button>
            </div>
          )}
          {results.map((r) => (
            <article className="continuity-item" key={r.id}>
              <h3>{r.title}</h3>
              <p className="continuity-muted">
                {r.issuer} · {r.jurisdiction} · v{r.version} ·{" "}
                {r.publicationDate || "Publication date unverified"}
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
                  Select for approval
                </label>
              )}
              <Badge>
                {r.status}
                {r.status === "APPROVED" && !r.usable
                  ? " · review overdue"
                  : ""}
              </Badge>
              <p className="continuity-muted">
                {r.content.slice(0, 220)}
                {r.content.length > 220 ? "…" : ""}
              </p>
              <button className="btn-secondary" onClick={() => choose(r)}>
                Read source & history
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
                Open official source ↗
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
                    Open the document ↗
                  </a>
                </>
              )}
            <p className="continuity-muted">
              Review: {selected.status} ·{" "}
              {selected.approvedByName || "No reviewer yet"}
              <br />
              Last checked: {formatTime(selected.lastCheckedAt)} · Review due:{" "}
              {selected.reviewDue || "Not set"}
              <br />
              Usage rights: {selected.rightsNote || "Not recorded"}
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
                  {i + 1}. {step.title} · day {step.days}
                </p>
              ))}
            {selected.kind === "template" && (
              <p className="continuity-muted">
                Fields: {selected.configuration.fields?.join(" · ")}
              </p>
            )}
            {selected.kind === "rule" && (
              <p className="continuity-muted">
                Flags when {String(selected.configuration.metric).replaceAll("_", " ")}{" "}
                {selected.configuration.operator === "gt" ? ">" : "<"}{" "}
                {String(selected.configuration.threshold)} · Review priority:{" "}
                {String(selected.configuration.tier ?? "routine")}
                {selected.configuration.nextAction
                  ? ` · Next action: ${selected.configuration.nextAction}`
                  : ""}
              </p>
            )}
            {selected.kind === "coding" && (
              <p className="continuity-muted">
                {(selected.configuration.entries as unknown[] | undefined)?.length ?? 0}{" "}
                phrase-to-code entries. Review the phrases before approving; a
                phrase only suggests a candidate and never assigns a code.
              </p>
            )}
            {selected.kind === "interaction" && (
              <div>
                <p className="continuity-muted">
                  Every entry cites the product label it came from. This is a
                  limited reviewed list, not a complete interaction database.
                </p>
                {(
                  (selected.configuration.pairs as
                    | { a: { name: string }; b: { name: string }; severity: string; effect: string; sourceUrl: string }[]
                    | undefined) ?? []
                ).map((p, i) => (
                  <p key={`p${i}`}>
                    <strong>
                      {p.a.name} + {p.b.name}
                    </strong>{" "}
                    · {p.severity} · {p.effect}{" "}
                    <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                      label
                    </a>
                  </p>
                ))}
                {(
                  (selected.configuration.cautions as
                    | { name: string; severity: string; statement: string; sourceUrl: string }[]
                    | undefined) ?? []
                ).map((c, i) => (
                  <p key={`c${i}`}>
                    <strong>{c.name}</strong> · pregnancy · {c.severity} ·{" "}
                    {c.statement}{" "}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                      label
                    </a>
                  </p>
                ))}
              </div>
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
                  Download original PDF
                </button>
              )}
              {doctor && (
                <button
                  className="btn-secondary"
                  onClick={() => setEditor(selected)}
                >
                  Create next version
                </button>
              )}
            </div>
            {doctor && selected.status === "DRAFT" && (
              <>
                <p className="continuity-muted">
                  Approve only after checking the original source, permissions,
                  version and applicability. This records your professional
                  review.
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
                    }, "Resource approved. Its version and reviewer are recorded.")
                  }
                >
                  Confirm review & approve
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
                  }, "Resource retired. Existing citations retain their original version.")
                }
              >
                Retire resource
              </button>
            )}
            <details>
              <summary className="continuity-muted">Version history</summary>
              {items
                .filter((r) => r.familyId === selected.familyId)
                .map((r) => (
                  <p key={r.id}>
                    v{r.version} · {r.status} ·{" "}
                    {r.approvedByName || "Unreviewed"}
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
  const [tier, setTier] = useState(String(initial?.configuration.tier || "routine"));
  const [nextAction, setNextAction] = useState(
    String(initial?.configuration.nextAction || ""),
  );
  const [interactionJson, setInteractionJson] = useState(
    JSON.stringify(
      {
        pairs: initial?.configuration.pairs ?? [],
        cautions: initial?.configuration.cautions ?? [],
      },
      null,
      2,
    ),
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
    <Panel title={initial ? `New version of ${initial.title}` : `Add ${type}`}>
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
                    ? { metric, operator, threshold: Number(threshold), tier, nextAction }
                    : type === "interaction"
                      ? JSON.parse(interactionJson)
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
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label="Issuing body / clinical owner">
            <input
              required
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
            />
          </Field>
          <Field label="Topic">
            <input
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </Field>
          <Field label="Jurisdiction">
            <input
              required
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            />
          </Field>
          <Field label="Official source URL">
            <input
              type="url"
              required={type !== "template"}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://"
            />
          </Field>
          <Field label="Section / page">
            <input
              value={section}
              required={type === "guideline"}
              onChange={(e) => setSection(e.target.value)}
            />
          </Field>
          <Field label="Publication / update date">
            <input
              type="date"
              value={published}
              onChange={(e) => setPublished(e.target.value)}
            />
          </Field>
          <Field label="Next clinical review date">
            <input
              type="date"
              required
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
          </Field>
          <Field label="Language">
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
            <Field label="Stage">
              <select value={stage} onChange={(e) => setStage(e.target.value)}>
                {["all", "first", "second", "third", "postpartum"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field
          label={
            type === "guideline"
              ? "Permitted source passage / document text"
              : "Reviewed content / description"
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
          <Field label="Usage rights / permission to store original">
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
              <Field label="Field names, one per line">
                <textarea
                  rows={4}
                  required
                  value={fields}
                  onChange={(e) => setFields(e.target.value)}
                />
              </Field>
              <Field label="Required fields, one per line">
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
              Use as an organization default
            </label>
          </>
        )}
        {type === "pathway" && (
          <>
            <div className="continuity-note">
              Administrative coordination tasks only. Clinical orders and
              treatment decisions must be documented separately by the
              clinician.
            </div>
            {steps.map((step, i) => (
              <div className="continuity-fields" key={i}>
                <Field label={`Task ${i + 1}`}>
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
                <Field label="Days after start">
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
              Add task
            </button>
          </>
        )}
        {type === "rule" && (
          <>
            <div className="continuity-note">
              Thresholds must come from a protocol your clinic validated. A rule
              shows flags only after a doctor approves it, and a flag asks a
              clinician to look; it does not diagnose, message the patient or
              assign work by itself.
            </div>
            <div className="continuity-fields">
              <Field label="Recorded metric">
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                >
                  {[
                    ["overdue_task_days", "Overdue task (days)"],
                    ["missing_days", "Missing agreed check-in (days)"],
                    ["systolic", "Systolic BP (mmHg)"],
                    ["diastolic", "Diastolic BP (mmHg)"],
                    ["weight_kg", "Weight (kg)"],
                  ].map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Comparison">
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                >
                  <option value="gt">Greater than</option>
                  <option value="lt">Less than</option>
                </select>
              </Field>
              <Field label="Validated threshold">
                <input
                  type="number"
                  step="any"
                  required
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
              </Field>
              <Field label="Review priority when it flags">
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="urgent">Urgent review</option>
                  <option value="soon">Review soon</option>
                  <option value="routine">Routine review</option>
                </select>
              </Field>
            </div>
            <Field label="Next action shown to the doctor (administrative wording, up to 300 characters)">
              <input
                maxLength={300}
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
            </Field>
          </>
        )}
        {type === "interaction" && (
          <>
            <div className="continuity-note">
              Only statements you can see in the official product label belong
              here. Each pair needs two named drugs (with aliases), a severity,
              the effect and an https source URL; each pregnancy caution needs a
              drug name, a severity, the label statement and a source URL.
            </div>
            <Field label="Interaction pairs and pregnancy cautions (JSON)">
              <textarea
                rows={12}
                required
                value={interactionJson}
                onChange={(e) => setInteractionJson(e.target.value)}
                style={{ fontFamily: "monospace" }}
              />
            </Field>
          </>
        )}
        {type === "coding" && (
          <Field label="Verified code | label | phrase to match (one entry per line)">
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
            Save draft for review
          </button>
          <button type="button" className="btn-secondary" onClick={close}>
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}
