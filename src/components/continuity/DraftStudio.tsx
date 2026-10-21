import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ROOT, languages, formatTime } from "../../api/continuity";
import type {
  ClinicalOutput,
  Language,
  Resource,
  Workspace,
} from "../../api/continuity";
import { Badge, Empty, Feedback, Field, Panel, useAction } from "./shared";

const outputKinds: Record<string, string> = {
  visit_summary: "Plain-language visit summary",
  explanation: "Patient explanation",
  lab_explanation: "Lab report explanation",
  discharge_summary: "Discharge summary",
  referral_letter: "Referral letter",
  consent_form: "Consent form",
  certificate: "Medical certificate",
  operative_note: "Operative note",
  insurance: "Insurance paperwork",
  prescription: "Prescription",
  note: "Custom clinical note",
  reply: "Patient reply",
};

export function DraftStudio({
  data,
  resources,
  doctor,
  reload,
}: {
  data: Workspace;
  resources: Resource[];
  doctor: boolean;
  reload: () => Promise<void>;
}) {
  const action = useAction();
  const [kind, setKind] = useState(doctor ? "visit_summary" : "reply");
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState<Language>(data.language);
  const [appointment, setAppointment] = useState("");
  const [template, setTemplate] = useState("");
  const [selected, setSelected] = useState<ClinicalOutput | null>(null);
  const sources =
    data.sources?.filter((s) =>
      kind === "reply"
        ? s.type === "question"
        : kind === "lab_explanation"
          ? s.type === "document"
          : ["visit_summary", "explanation", "prescription"].includes(kind)
            ? s.type === "consultation"
            : s.type !== "question",
    ) || [];
  const templates = resources.filter((r) => r.kind === "template" && r.usable);
  return (
    <>
      <Feedback error={action.error} message={action.message} />
      <Panel title="Prepare a source-based draft">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const src = sources.find((s) => s.id === source);
              if (!src) throw new Error("Select a verified source.");
              const draft = await api.post<ClinicalOutput>(
                `${ROOT}/episodes/${data.episodeId}/outputs`,
                {
                  kind,
                  sourceType: src.type,
                  sourceId: src.id,
                  language,
                  appointmentId: appointment || null,
                  templateId: template || null,
                },
              );
              setSelected(draft);
              await reload();
            }, "Draft prepared. Review the source and edit before approval.");
          }}
        >
          <div className="continuity-fields">
            <Field label="Document type">
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setSource("");
                  setTemplate(
                    e.target.value === "note"
                      ? templates.find((t) => t.configuration.default)?.id || ""
                      : "",
                  );
                }}
              >
                {Object.entries(outputKinds)
                  .filter(
                    ([key]) =>
                      doctor ||
                      ["reply", "insurance", "certificate"].includes(key),
                  )
                  .map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Verified source / approved visit">
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Choose source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Output language">
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
            <Field label="Link to appointment">
              <select
                value={appointment}
                onChange={(e) => setAppointment(e.target.value)}
              >
                <option value="">No linked appointment</option>
                {data.appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatTime(a.scheduledAt)} · {a.appointmentType}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Approved note layout">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">Standard document layout</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · v{t.version}
                    {t.configuration.default ? " · default" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="continuity-muted">
            Drafts organize verified information. Review wording in the selected
            language before release. Clinical text is not automatically
            translated. Administrative reply starters are available in all four
            languages.
          </p>
          {kind === "prescription" && (
            <div className="continuity-note">
              Enter the medicine, dose, route, frequency and duration yourself.
              Drug interactions are unchecked: no verified drug database is
              connected. Review independently before signing.
            </div>
          )}
          <button className="btn-primary" disabled={action.busy || !source}>
            Create editable draft
          </button>
        </form>
      </Panel>
      {selected && (
        <OutputEditor
          key={selected.id}
          output={selected}
          doctor={doctor}
          onChange={async (updated) => {
            setSelected(updated);
            await reload();
          }}
          close={() => setSelected(null)}
        />
      )}
      <Panel title="Drafts & approved documents">
        {!data.outputs.length && (
          <Empty>No drafts yet. Choose a source above to start.</Empty>
        )}
        {data.outputs.map((o) => (
          <article key={o.id} className="continuity-item">
            <h3>
              {o.title} <Badge>{o.status}</Badge>
            </h3>
            <p className="continuity-muted">
              {languages[o.language]} · {o.sourceSnapshot?.title} ·{" "}
              {o.approvedByName
                ? `Approved by ${o.approvedByName}`
                : "Review required"}
            </p>
            <button className="btn-secondary" onClick={() => setSelected(o)}>
              {o.status === "DRAFT" ? "Review & edit" : "Read signed document"}
            </button>
          </article>
        ))}
      </Panel>
    </>
  );
}

function OutputEditor({
  output,
  doctor,
  onChange,
  close,
}: {
  output: ClinicalOutput;
  doctor: boolean;
  onChange: (o: ClinicalOutput) => Promise<void>;
  close: () => void;
}) {
  const action = useAction();
  const [content, setContent] = useState(output.content);
  const [structured, setStructured] = useState(output.structuredData || {});
  const [publish, setPublish] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [codes, setCodes] = useState<
    { code: string; label: string; match: string; sourceUrl: string }[]
  >([]);
  const [selectedCodes, setSelectedCodes] = useState(
    output.selectedCodes || [],
  );
  const draft = output.status === "DRAFT";
  const canEdit =
    doctor || ["reply", "insurance", "certificate"].includes(output.kind);
  async function save() {
    return api.patch<ClinicalOutput>(`${ROOT}/outputs/${output.id}`, {
      content,
      structuredData: structured,
      selectedCodes,
      revision: output.revision,
    });
  }
  return (
    <Panel
      title={output.title}
      aside={
        <button className="btn-secondary" onClick={close}>
          Close
        </button>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <p className="continuity-muted">
        {output.status} · v{output.revision} ·{" "}
        {output.approvedByName
          ? `Signed by ${output.approvedByName} on ${formatTime(output.approvedAt)}`
          : "Not released to the patient"}
      </p>
      <details>
        <summary>Source preserved with this draft</summary>
        <div className="continuity-copy">{output.sourceSnapshot?.text}</div>
      </details>
      <Field label={`Document text · ${languages[output.language]}`}>
        <textarea
          rows={12}
          value={content}
          readOnly={!draft || !canEdit}
          onChange={(e) => setContent(e.target.value)}
          lang={output.language}
        />
      </Field>
      <div className="continuity-fields">
        {Object.entries(structured).map(([key, value]) => (
          <Field label={key} key={key}>
            <textarea
              rows={3}
              value={value}
              readOnly={!draft || !canEdit}
              onChange={(e) =>
                setStructured((old) => ({ ...old, [key]: e.target.value }))
              }
            />
          </Field>
        ))}
      </div>
      {output.references?.map((r) => (
        <p key={r.id} className="continuity-muted">
          Reference:{" "}
          <a href={r.sourceUrl} target="_blank" rel="noreferrer">
            {r.title}
          </a>{" "}
          · {r.issuer} · v{r.version} · {r.section}
        </p>
      ))}
      {doctor && draft && (
        <>
          <button
            className="btn-secondary"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                const result = await api.get<typeof codes>(
                  `${ROOT}/outputs/${output.id}/codes`,
                );
                setCodes(result);
              }, "Candidate matching complete. Only reviewed code sets are used.")
            }
          >
            Find candidate ICD-10 codes
          </button>
          {codes.map((c, i) => (
            <label className="continuity-check" key={`${c.code}-${i}`}>
              <input
                type="checkbox"
                checked={selectedCodes.includes(c.code)}
                onChange={(e) =>
                  setSelectedCodes((previous) =>
                    e.target.checked
                      ? [...new Set([...previous, c.code])]
                      : previous.filter((code) => code !== c.code),
                  )
                }
              />
              {c.code} · {c.label} · matched “{c.match}” ·{" "}
              <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                Source
              </a>
            </label>
          ))}
          <p className="continuity-muted">
            Candidates use phrase matching against the preserved source,
            including negated or historical phrases. Confirm context before
            selecting a code. No code is assigned automatically.
          </p>
        </>
      )}
      {!draft && output.selectedCodes && (
        <p>Final selected codes: {output.selectedCodes.join(", ") || "None"}</p>
      )}
      {draft && canEdit && (
        <>
          <label className="continuity-check">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Release the approved document to the patient
          </label>
          <label className="continuity-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the source, all fields and the language. I approve this
            document with my professional signature.
          </label>
          <div className="continuity-actions">
            <button
              className="btn-secondary"
              disabled={action.busy}
              onClick={() =>
                action.run(async () => onChange(await save()), "Draft saved.")
              }
            >
              Save edits
            </button>
            {(doctor || output.kind === "reply") && (
              <button
                className="btn-primary"
                disabled={action.busy || !confirmed}
                onClick={() =>
                  action.run(
                    async () => {
                      const saved = await save();
                      try {
                        const approved = await api.post<ClinicalOutput>(
                          `${ROOT}/outputs/${output.id}/approve`,
                          {
                            confirmed: true,
                            visibleToPatient: publish,
                            revision: saved.revision,
                          },
                        );
                        await onChange(approved);
                      } catch (error) {
                        await onChange(saved);
                        throw error;
                      }
                    },
                    publish
                      ? "Approved and released to the patient."
                      : "Approved for internal use.",
                  )
                }
              >
                Save, sign & {publish ? "release" : "approve"}
              </button>
            )}
          </div>
        </>
      )}
      {doctor && (
        <p className="continuity-muted">
          <Link to="/doctor/library">
            Attach a guideline or manage templates in the reference library
          </Link>
        </p>
      )}
    </Panel>
  );
}
