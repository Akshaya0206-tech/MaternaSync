import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ROOT, languages, formatTime } from "../../api/continuity";
import type {
  Appointment,
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
          {kind === "lab_explanation" && (
            <div className="continuity-note">
              The draft lists the results read from the verified report, a
              general “what this test measures” note for each, and where each
              value sits against the range printed on the report. What the
              results mean for this patient, and the next steps, are left for
              you to write. Nothing is released until you do and sign.
            </div>
          )}
          {kind === "visit_summary" && (
            <div className="continuity-note">
              The draft is pre-filled from the approved consultation: plain
              wording with abbreviations explained once, reviewed general
              information in the chosen language, the next appointment and the
              patient’s open questions. Confirm every statement, and write the
              next steps if none were documented. Nothing is released until you
              sign.
            </div>
          )}
          {kind === "explanation" && (
            <div className="continuity-note">
              The draft finds the conditions this note actually discusses
              (gestational diabetes, high blood pressure, anaemia, scans) and
              adds the clinic-approved plain-language explanation of each, in the
              chosen language, next to what you recorded. A condition with no
              approved explanation is flagged, not invented. Nothing is released
              until you sign.
            </div>
          )}
          {kind === "prescription" && (
            <div className="continuity-note">
              Enter the medicine, dose, route, frequency and duration yourself;
              nothing is suggested. MaternaSync does not check medicines, doses,
              allergies or interactions. The prescription is yours to write,
              check and sign, so use a full drug reference before signing.
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
          appointments={data.appointments}
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
  appointments,
  doctor,
  onChange,
  close,
}: {
  output: ClinicalOutput;
  appointments: Appointment[];
  doctor: boolean;
  onChange: (o: ClinicalOutput) => Promise<void>;
  close: () => void;
}) {
  const action = useAction();
  const [content, setContent] = useState(output.content);
  const [structured, setStructured] = useState(output.structuredData || {});
  const [appointmentId, setAppointmentId] = useState(output.appointmentId ?? "");
  const parsed = output.sourceSnapshot?.parsedResults ?? [];
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
      appointmentId,
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
      {draft && !!output.reviewNotes?.length && (
        <ul className="continuity-review" aria-label="Review checklist">
          {output.reviewNotes.map((note, index) => (
            <li key={index} className={note.level}>
              <strong>
                {note.level === "blocker"
                  ? "Must fix before approval: "
                  : note.level === "warning"
                    ? "Check: "
                    : "Note: "}
              </strong>
              {note.text}
            </li>
          ))}
        </ul>
      )}
      {parsed.length > 0 && (
        <div className="continuity-table-wrap">
          <table className="continuity-table">
            <caption className="continuity-muted">
              Values read automatically from the verified report, beside the
              range printed on it. They are not labelled normal or abnormal.
              Compare each row with the original line before approving.
            </caption>
            <thead>
              <tr>
                <th>Test (as printed)</th>
                <th>Value</th>
                <th>Printed range</th>
                <th>Original line</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((row, index) => (
                <tr key={index}>
                  <td>{row.name}</td>
                  <td>
                    {row.valueText} {row.unit ?? ""}
                  </td>
                  <td>{row.rangeText || "—"}</td>
                  <td>{row.originalLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      {draft && canEdit && (
        <Field label="Linked visit (shown with the summary in the patient's Appointments)">
          <select
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
          >
            <option value="">Not linked to a visit</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {formatTime(a.scheduledAt)} · {a.appointmentType}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div
        className={`continuity-fields${output.sectionKinds ? " continuity-fields-wide" : ""}`}
      >
        {Object.entries(structured).map(([key, value]) => (
          <Field label={key} key={key}>
            <textarea
              rows={output.sectionKinds ? 5 : 3}
              lang={output.language}
              value={value}
              readOnly={!draft || !canEdit}
              onChange={(e) =>
                setStructured((old) => ({ ...old, [key]: e.target.value }))
              }
            />
          </Field>
        ))}
      </div>
      {doctor && output.kind === "prescription" && draft && (
        <p className="continuity-note">
          The allergies recorded for this patient are shown at the top of the
          draft for your reference. MaternaSync does not check this prescription
          for allergies, interactions or doses. Check a full drug reference
          before you sign.
        </p>
      )}
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
          <Link to="/doctor/clinical-settings">
            Manage note layouts and other lists in Clinical Settings
          </Link>
        </p>
      )}
    </Panel>
  );
}
