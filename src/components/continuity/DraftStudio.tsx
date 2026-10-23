import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { ROOT, languages, formatTime } from "../../api/continuity";
import type {
  Appointment,
  ClinicalOutput,
  Language,
  Resource,
  SafetyCheck,
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
              nothing is suggested. After you save, a drug safety check runs
              against the patient&apos;s recorded allergies and the reviewed,
              label-sourced lists a doctor approved in the Reference Library.
              It is not a complete interaction database, so review
              independently before signing.
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

const positionLabels: Record<string, string> = {
  within: "Within printed range",
  below: "Below printed range",
  above: "Above printed range",
  none: "No printed range",
};

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
  const [safety, setSafety] = useState<SafetyCheck | null>(null);
  const [safetyError, setSafetyError] = useState("");
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const checking = doctor && output.kind === "prescription" && output.status === "DRAFT";
  // Re-run the check whenever the saved medicines change (every save bumps the revision).
  useEffect(() => {
    if (!checking) return;
    let active = true;
    api
      .get<SafetyCheck>(`${ROOT}/outputs/${output.id}/safety-check`)
      .then((r) => {
        if (!active) return;
        setSafety(r);
        setSafetyError("");
        setAcknowledged((old) => old.filter((key) => r.alerts.some((a) => a.key === key)));
      })
      .catch((e) => {
        if (active) setSafetyError(e.message);
      });
    return () => {
      active = false;
    };
  }, [checking, output.id, output.revision]);
  const unacknowledged = safety?.alerts.filter((a) => !acknowledged.includes(a.key)) ?? [];
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
              Values read automatically from the verified report. Compare each
              row with the original line before approving.
            </caption>
            <thead>
              <tr>
                <th>Test (as printed)</th>
                <th>Value</th>
                <th>Printed range</th>
                <th>Position</th>
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
                  <td className={`continuity-pos-${row.position}`}>
                    {positionLabels[row.position]}
                    {row.printedFlag ? ` (report flag: ${row.printedFlag})` : ""}
                  </td>
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
      {output.references?.map((r) => (
        <p key={r.id} className="continuity-muted">
          Reference:{" "}
          <a href={r.sourceUrl} target="_blank" rel="noreferrer">
            {r.title}
          </a>{" "}
          · {r.issuer} · v{r.version} · {r.section}
        </p>
      ))}
      {checking && (
        <section className="continuity-section continuity-section-results" aria-label="Drug safety check">
          <h4>Drug safety check</h4>
          <p className="continuity-muted">
            Runs on the medicines you have saved in this draft. Save your edits
            to re-check.
          </p>
          {safetyError && <p role="alert" className="continuity-alert">{safetyError}</p>}
          {safety && (
            <>
              <p className="continuity-section-note">
                {safety.status === "checked"
                  ? `Checked against: ${safety.checkedAgainst.map((s) => `${s.title} v${s.version} (${s.pairs} interaction pairs, ${s.cautions} pregnancy cautions, approved by ${s.approvedBy})`).join("; ")}.`
                  : "No drug-safety list is approved yet, so interactions and pregnancy cautions are UNCHECKED. A doctor can approve the label-sourced list under Reference Library → Drug safety checks."}
                {" "}
                Allergies recorded for this patient:{" "}
                {safety.allergiesRecorded.length
                  ? safety.allergiesRecorded.join(", ")
                  : "none recorded"}
                .
              </p>
              <p className="continuity-muted">{safety.limitation}</p>
              {!safety.medicines.length && (
                <p className="continuity-muted">Enter a medicine and save to run the check.</p>
              )}
              {safety.medicines.length > 0 && !safety.alerts.length && (
                <p className="continuity-success">
                  No alert for: {safety.medicines.join(", ")}. This is not a statement that the
                  combination is safe.
                </p>
              )}
              {safety.alerts.map((a) => (
                <div key={a.key} className="continuity-note" style={{ borderLeftColor: a.severity === "major" ? "var(--rose-urgent)" : "var(--amber-pending)" }}>
                  <strong>
                    {a.kind === "allergy" ? "Allergy" : a.kind === "pregnancy" ? "Pregnancy caution" : "Interaction"} ·{" "}
                    {a.severity.toUpperCase()} · {a.drugs.join(" + ")}
                    {a.withEarlier ? " (with an earlier prescription)" : ""}
                  </strong>
                  <p>{a.message}</p>
                  {a.management && <p className="continuity-muted">{a.management}</p>}
                  {a.quote && <p className="continuity-muted">Label wording: “{a.quote}”</p>}
                  <p className="continuity-muted">
                    {a.setTitle}
                    {a.sourceUrl && (
                      <>
                        {" · "}
                        <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                          Product label
                        </a>
                      </>
                    )}
                  </p>
                  <label className="continuity-check">
                    <input
                      type="checkbox"
                      checked={acknowledged.includes(a.key)}
                      onChange={(e) =>
                        setAcknowledged((old) =>
                          e.target.checked ? [...old, a.key] : old.filter((k) => k !== a.key),
                        )
                      }
                    />
                    I have read this alert and decided how to proceed.
                  </label>
                </div>
              ))}
            </>
          )}
        </section>
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
                disabled={action.busy || !confirmed || unacknowledged.length > 0}
                title={unacknowledged.length ? "Acknowledge every drug-safety alert first" : undefined}
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
                            acknowledgedAlerts: acknowledged,
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
