import { useState } from "react";
import { languages } from "../../api/continuity";
import type { Resource } from "../../api/continuity";
import { formatTime } from "../../api/continuity";
import { tx, useLanguage } from "../../i18n";
import { Badge, Empty } from "./shared";
import { eduGroup } from "./educationFilters";
import type { EduFilter } from "./educationFilters";

// The "Patient education" tab of Clinical Settings. The list is long (every starter note is a draft until a doctor approves it), so it has a search
// box, status chips with counts, items that fold, and a preview of what a patient would read once an item is approved. It changes nothing about
// how an item is approved, edited or retired: those buttons and the detail card are the page's own.

const statusNames: Record<string, string> = {
  DRAFT: tx("DRAFT"),
  APPROVED: tx("APPROVED"),
  SUPERSEDED: tx("SUPERSEDED"),
  RETIRED: tx("RETIRED"),
};

interface Props {
  results: Resource[];
  counts: Record<EduFilter, number>;
  query: string;
  onQuery: (query: string) => void;
  filter: EduFilter;
  onFilter: (filter: EduFilter) => void;
  doctor: boolean;
  picked: string[];
  onPick: (id: string, on: boolean) => void;
  onRead: (resource: Resource) => void;
}

export function EducationList({ results, counts, query, onQuery, filter, onFilter, doctor, picked, onPick, onRead }: Props) {
  const { t } = useLanguage();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState<string[]>([]);
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list.filter((item) => item !== id), id] : list.filter((item) => item !== id));
  const chips: [EduFilter, string][] = [
    ["all", t("All ({count})", { count: counts.all })],
    ["draft", t("Draft ({count})", { count: counts.draft })],
    ["approved", t("Approved ({count})", { count: counts.approved })],
    ["due", t("Review due ({count})", { count: counts.due })],
  ];
  return (
    <div className="edu-list">
      <div className="edu-controls">
        <label className="edu-search">
          <span>{t("Search patient education")}</span>
          <input type="search" value={query} placeholder={t("Title, topic or organization")} onChange={(e) => onQuery(e.target.value)} />
        </label>
        <div className="continuity-chip-row" role="group" aria-label={t("Show by status")}>
          {chips.map(([key, label]) => (
            <button key={key} type="button" className="continuity-chip" aria-pressed={filter === key} onClick={() => onFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <p className="continuity-muted edu-count" role="status">
          {t("Showing {shown} of {total} patient education items", { shown: results.length, total: counts.all })}
        </p>
        <div className="continuity-actions edu-fold-all">
          <button type="button" className="btn-secondary" disabled={!results.length} onClick={() => setOpenIds(results.map((r) => r.id))}>{t("Expand all")}</button>
          <button type="button" className="btn-secondary" disabled={!openIds.length} onClick={() => setOpenIds([])}>{t("Collapse all")}</button>
        </div>
      </div>
      {!results.length && <Empty>{t("No patient education items match. Clear the search or choose All.")}</Empty>}
      {results.map((r) => {
        const open = openIds.includes(r.id);
        return (
          <article className="continuity-item edu-item" key={r.id}>
            {doctor && r.status === "DRAFT" && (
              <label className="continuity-check edu-pick">
                <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => onPick(r.id, e.target.checked)} />
                {t("Select for approval")}
              </label>
            )}
            <details open={open} onToggle={(e) => { const now = (e.currentTarget as HTMLDetailsElement).open; setOpenIds((old) => toggle(old, r.id, now)); }}>
              <summary>
                <h3>{r.title}</h3>
                <span className="continuity-muted edu-line">
                  {r.topic} · {r.issuer} · <Badge>{statusNames[r.status] ? t(statusNames[r.status]) : r.status}{r.status === "APPROVED" && !r.usable ? ` · ${t("review overdue")}` : ""}</Badge> · v{r.version} ·{" "}
                  {r.reviewDue ? t("Review date: {date}", { date: r.reviewDue }) : t("No review date set")}
                </span>
              </summary>
              <p className="continuity-muted">
                {r.issuer} · {r.jurisdiction} · {r.publicationDate || t("Publication date unverified")} · {languages[r.language]}
              </p>
              <div className="continuity-copy edu-text" lang={r.language}>{r.content}</div>
              <div className="continuity-actions">
                <button type="button" className="btn-secondary" onClick={() => onRead(r)}>{t("Read source & history")}</button>
                <button type="button" className="btn-secondary" aria-expanded={previewing.includes(r.id)} onClick={() => setPreviewing((old) => toggle(old, r.id, !old.includes(r.id)))}>
                  {previewing.includes(r.id) ? t("Hide the preview") : t("Preview for patients")}
                </button>
              </div>
              {previewing.includes(r.id) && <PatientPreview resource={r} />}
            </details>
          </article>
        );
      })}
    </div>
  );
}

/** What a patient would read once this item is approved, and whether they can read it now. It reads the item's own data (nothing is sent anywhere).
 *  The Care Companion shows only approved items whose review date has not passed (backend/app/companion.py); the general "About this test" notes are
 *  added to a lab report explanation a doctor signs instead; a visit summary the doctor approves can carry the other approved items. */
export function PatientPreview({ resource: r }: { resource: Resource }) {
  const { t } = useLanguage();
  const labNote = r.familyId.startsWith("starter-labtest-");
  const conditionNote = r.familyId.startsWith("starter-condition-");
  const group = eduGroup(r);
  const live = group === "approved";
  return (
    <section className="edu-preview" aria-label={t("Who can see this")}>
      <h4>{t("Who can see this")}</h4>
      <p role="status">
        {live && labNote && t("Approved and in use: this is a general “About this test” note. It is added to a lab report explanation that you sign, and the Care Companion does not show it on its own. This is the wording:")}
        {live && !labNote && t("Approved and in use: the Care Companion shows this to a patient who asks about this topic, in the language of the item. This is how it appears:")}
        {group === "due" && (r.reviewDue
          ? t("Review overdue: patients cannot see this until it is reviewed again. Create the next version and approve it. This is how it would appear:")
          : t("No review date is set, so patients cannot see this yet. Create the next version with a review date and approve it. This is how it would appear:"))}
        {group === "draft" && t("Not approved yet: patients cannot see this. Once approved, this is how it would appear:")}
        {group === "other" && t("This version is no longer in use: patients cannot see it. This is what it said:")}
      </p>
      <article className={`companion-card${live ? "" : " edu-preview-off"}`} lang={r.language}>
        <h4>{r.title}</h4>
        <div>{r.content}</div>
        <small>
          {r.approvedByName && r.status !== "DRAFT"
            ? <>{t("Reviewed by {name}", { name: r.approvedByName })} · v{r.version} · {t("Review due {date}", { date: r.reviewDue ?? "" })}</>
            : <>{t("Not reviewed yet")} · v{r.version}</>}
        </small>
        {r.sourceUrl && (
          <small>
            <a href={r.sourceUrl} target="_blank" rel="noreferrer">{t("Original source")} · {r.section}</a>
          </small>
        )}
      </article>
      {r.status !== "DRAFT" && r.approvedByName && r.approvedAt && (
        <p className="continuity-muted">{t("Approved by {name} on {date}.", { name: r.approvedByName, date: formatTime(r.approvedAt) })}</p>
      )}
      {live && !labNote && !conditionNote && (
        <p className="continuity-muted">{t("It can also appear in the general information part of a visit summary you approve.")}</p>
      )}
    </section>
  );
}
