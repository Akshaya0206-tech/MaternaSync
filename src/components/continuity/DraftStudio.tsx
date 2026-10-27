import { useEffect, useState } from "react";
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
import { tx, useLanguage } from "../../i18n";
import { Badge, Empty, Feedback, Field, Panel, useAction } from "./shared";

const outputKinds: Record<string, string> = {
  visit_summary: tx("Plain-language visit summary"),
  explanation: tx("Patient explanation"),
  lab_explanation: tx("Lab report explanation"),
  discharge_summary: tx("Discharge summary"),
  referral_letter: tx("Referral letter"),
  consent_form: tx("Consent form"),
  certificate: tx("Medical certificate"),
  operative_note: tx("Operative note"),
  insurance: tx("Insurance paperwork"),
  prescription: tx("Prescription"),
  note: tx("Custom clinical note"),
  reply: tx("Patient reply"),
};

// Status codes are shown as written in English; only the words are translated.
const statusLabels: Record<string, string> = {
  DRAFT: tx("DRAFT"),
  APPROVED: tx("APPROVED"),
  SUPERSEDED: tx("SUPERSEDED"),
  RETIRED: tx("RETIRED"),
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
  const { t } = useLanguage();
  const action = useAction();
  const [kind, setKind] = useState(doctor ? "visit_summary" : "reply");
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState<Language>(data.language);
  const [appointment, setAppointment] = useState("");
  const [template, setTemplate] = useState("");
  const [selected, setSelected] = useState<ClinicalOutput | null>(null);
  // For a patient explanation the doctor chooses which approved topics to explain; the note is never read to pick them.
  const [topics, setTopics] = useState<{ topic: string; title: string }[]>([]);
  const [chosenTopics, setChosenTopics] = useState<string[]>([]);
  useEffect(() => {
    if (kind !== "explanation") return;
    let active = true;
    api
      .get<{ topic: string; title: string }[]>(`${ROOT}/education-topics?language=${language}`)
      .then((list) => {
        if (!active) return;
        setTopics(list);
        setChosenTopics((previous) => previous.filter((topic) => list.some((item) => item.topic === topic)));
      })
      .catch(() => {
        if (active) setTopics([]);
      });
    return () => {
      active = false;
    };
  }, [kind, language]);
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
      <Panel title={t("Prepare a source-based draft")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              const src = sources.find((s) => s.id === source);
              if (!src) throw new Error(t("Select a verified source."));
              const draft = await api.post<ClinicalOutput>(
                `${ROOT}/episodes/${data.episodeId}/outputs`,
                {
                  kind,
                  sourceType: src.type,
                  sourceId: src.id,
                  language,
                  appointmentId: appointment || null,
                  templateId: template || null,
                  topics: kind === "explanation" ? chosenTopics : [],
                },
              );
              setSelected(draft);
              await reload();
            }, t("Draft prepared. Review the source and edit before approval."));
          }}
        >
          <div className="continuity-fields">
            <Field label={t("Document type")}>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setSource("");
                  setTemplate(
                    e.target.value === "note"
                      ? templates.find((tpl) => tpl.configuration.default)?.id || ""
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
                      {t(label)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t("Verified source / approved visit")}>
              <select
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">{t("Choose source")}</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Output language")}>
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
            <Field label={t("Link to appointment")}>
              <select
                value={appointment}
                onChange={(e) => setAppointment(e.target.value)}
              >
                <option value="">{t("No linked appointment")}</option>
                {data.appointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatTime(a.scheduledAt)} · {a.appointmentType}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Approved note layout")}>
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">{t("Standard document layout")}</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.title} · v{tpl.version}
                    {tpl.configuration.default ? ` · ${t("default")}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="continuity-muted">
            {t(
              "Drafts organize verified information. Review wording in the selected language before release. Clinical text is not automatically translated. Administrative reply starters are available in all four languages.",
            )}
          </p>
          {kind === "lab_explanation" && (
            <div className="continuity-note">
              {t(
                "The draft lists the results read from the verified report, each beside the range printed on it, with no label or comment on any value. General “About these tests” notes are added only from notes a doctor approved in Clinical Settings. What the results mean for this patient, and the next steps, are left for you to write. Nothing is released until you do and sign.",
              )}
            </div>
          )}
          {kind === "visit_summary" && (
            <div className="continuity-note">
              {t(
                "The draft is pre-filled from the approved consultation: plain wording with abbreviations explained once, reviewed general information in the chosen language, the next appointment and the patient’s open questions. Confirm every statement, and write the next steps if none were documented. Nothing is released until you sign.",
              )}
            </div>
          )}
          {kind === "explanation" && (
            <>
              <div className="continuity-note">
                {t(
                  "Choose the topics to explain. The draft adds the clinic-approved plain-language explanation of each, in the chosen language, next to what you recorded. Nothing reads the note to pick topics for you, and a topic with no approved explanation is flagged, not invented. Nothing is released until you sign.",
                )}
              </div>
              <fieldset className="continuity-topics">
                <legend>{t("Topics to explain")}</legend>
                {!topics.length && (
                  <p className="continuity-muted">
                    {t("No approved education topics exist in this language yet. Approve some in Clinical Settings (Patient education), or write the explanations yourself.")}
                  </p>
                )}
                {topics.map((item) => (
                  <label className="continuity-check" key={item.topic}>
                    <input
                      type="checkbox"
                      checked={chosenTopics.includes(item.topic)}
                      onChange={(e) =>
                        setChosenTopics((previous) =>
                          e.target.checked ? [...new Set([...previous, item.topic])] : previous.filter((topic) => topic !== item.topic),
                        )
                      }
                    />
                    {item.topic}
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {kind === "prescription" && (
            <div className="continuity-note">
              {t(
                "Enter the medicine, dose, route, frequency and duration yourself; nothing is suggested. MaternaSync does not check medicines, doses, allergies or interactions. The prescription is yours to write, check and sign, so use a full drug reference before signing.",
              )}
            </div>
          )}
          <button className="btn-primary" disabled={action.busy || !source}>
            {t("Create editable draft")}
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
      <Panel title={t("Drafts & approved documents")}>
        {!data.outputs.length && (
          <Empty>{t("No drafts yet. Choose a source above to start.")}</Empty>
        )}
        {data.outputs.map((o) => (
          <article key={o.id} className="continuity-item">
            <h3>
              {o.title} <Badge>{statusLabel(o.status, t)}</Badge>
            </h3>
            <p className="continuity-muted">
              {languages[o.language]} · {o.sourceSnapshot?.title} ·{" "}
              {o.approvedByName
                ? t("Approved by {name}", { name: o.approvedByName })
                : t("Review required")}
            </p>
            <button className="btn-secondary" onClick={() => setSelected(o)}>
              {o.status === "DRAFT"
                ? t("Review & edit")
                : t("Read signed document")}
            </button>
          </article>
        ))}
      </Panel>
    </>
  );
}

function statusLabel(status: string, t: (text: string) => string) {
  return statusLabels[status] ? t(statusLabels[status]) : status;
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
  const { t } = useLanguage();
  const action = useAction();
  const [content, setContent] = useState(output.content);
  const [structured, setStructured] = useState(output.structuredData || {});
  const [appointmentId, setAppointmentId] = useState(output.appointmentId ?? "");
  const parsed = output.sourceSnapshot?.parsedResults ?? [];
  const [publish, setPublish] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [codeQuery, setCodeQuery] = useState("");
  const [codes, setCodes] = useState<
    { code: string; label: string; match: string; sourceUrl: string }[]
  >([]);
  const [searched, setSearched] = useState(false);
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
          {t("Close")}
        </button>
      }
    >
      <Feedback error={action.error} message={action.message} />
      <p className="continuity-muted">
        {statusLabel(output.status, t)} · v{output.revision} ·{" "}
        {output.approvedByName
          ? t("Signed by {name} on {time}", {
              name: output.approvedByName,
              time: formatTime(output.approvedAt),
            })
          : t("Not released to the patient")}
      </p>
      {draft && !!output.reviewNotes?.length && (
        <ul className="continuity-review" aria-label={t("Review checklist")}>
          {output.reviewNotes.map((note, index) => (
            <li key={index} className={note.level}>
              <strong>
                {note.level === "blocker"
                  ? t("Must fix before approval:")
                  : note.level === "warning"
                    ? t("Check:")
                    : t("Note:")}{" "}
              </strong>
              {t(note.text)}
            </li>
          ))}
        </ul>
      )}
      {parsed.length > 0 && (
        <div className="continuity-table-wrap" tabIndex={0} role="region" aria-labelledby="draft-values-caption">
          <table className="continuity-table">
            <caption id="draft-values-caption" className="continuity-muted">
              {t(
                "Values read automatically from the verified report, beside the range printed on it. They are not labelled normal or abnormal. Compare each row with the original line before approving.",
              )}
            </caption>
            <thead>
              <tr>
                <th>{t("Test (as printed)")}</th>
                <th>{t("Value")}</th>
                <th>{t("Printed range")}</th>
                <th>{t("Original line")}</th>
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
        <summary>{t("Source preserved with this draft")}</summary>
        <div className="continuity-copy">{output.sourceSnapshot?.text}</div>
      </details>
      <Field
        label={t("Document text · {language}", {
          language: languages[output.language],
        })}
      >
        <textarea
          rows={12}
          value={content}
          readOnly={!draft || !canEdit}
          onChange={(e) => setContent(e.target.value)}
          lang={output.language}
        />
      </Field>
      {draft && canEdit && (
        <Field
          label={t(
            "Linked visit (shown with the summary in the patient's Appointments)",
          )}
        >
          <select
            value={appointmentId}
            onChange={(e) => setAppointmentId(e.target.value)}
          >
            <option value="">{t("Not linked to a visit")}</option>
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
          {t(
            "The allergies recorded for this patient are shown at the top of the draft for your reference. MaternaSync does not check this prescription for allergies, interactions or doses. Check a full drug reference before you sign.",
          )}
        </p>
      )}
      {doctor && draft && (
        <>
          <form
            className="continuity-code-search"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                setCodes(await api.get<typeof codes>(`${ROOT}/codes/search?q=${encodeURIComponent(codeQuery)}`));
                setSearched(true);
              }, t("Search complete."));
            }}
          >
            <Field label={t("Look up an ICD-10 code")}>
              <input
                type="search"
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder={t("Type a code or a phrase, for example O24 or gestational")}
              />
            </Field>
            <button className="btn-secondary" disabled={action.busy || codeQuery.trim().length < 2}>
              {t("Search")}
            </button>
          </form>
          {searched && !codes.length && <p className="continuity-muted">{t("No code in the approved code sets matches that.")}</p>}
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
              {c.code} · {c.label} ·{" "}
              <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                {t("Source")}
              </a>
            </label>
          ))}
          {selectedCodes.length > 0 && (
            <p>
              {t("Selected codes: {codes}", { codes: selectedCodes.join(", ") })}{" "}
              <button type="button" className="btn-secondary" onClick={() => setSelectedCodes([])}>
                {t("Clear")}
              </button>
            </p>
          )}
          <p className="continuity-muted">
            {t(
              "This is a lookup in the code sets a doctor approved. Nothing reads the note, so no code is proposed from what it says. You choose each code, and none is assigned automatically.",
            )}
          </p>
        </>
      )}
      {!draft && output.selectedCodes && (
        <p>
          {t("Final selected codes: {codes}", {
            codes: output.selectedCodes.join(", ") || t("None"),
          })}
        </p>
      )}
      {draft && canEdit && (
        <>
          <label className="continuity-check">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            {t("Release the approved document to the patient")}
          </label>
          <label className="continuity-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {t(
              "I reviewed the source, all fields and the language. I approve this document with my professional signature.",
            )}
          </label>
          <div className="continuity-actions">
            <button
              className="btn-secondary"
              disabled={action.busy}
              onClick={() =>
                action.run(
                  async () => onChange(await save()),
                  t("Draft saved."),
                )
              }
            >
              {t("Save edits")}
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
                      ? t("Approved and released to the patient.")
                      : t("Approved for internal use."),
                  )
                }
              >
                {publish
                  ? t("Save, sign & release")
                  : t("Save, sign & approve")}
              </button>
            )}
          </div>
        </>
      )}
      {doctor && (
        <p className="continuity-muted">
          <Link to="/doctor/clinical-settings">
            {t("Manage note layouts and other lists in Clinical Settings")}
          </Link>
        </p>
      )}
    </Panel>
  );
}
