import type { Resource } from "../../api/continuity";

// How the Patient education list in Clinical Settings is narrowed: by the chips (a status group) and by the words typed in the search box.
export type EduFilter = "all" | "draft" | "approved" | "due";

/** Which chip an item belongs to: a draft, an approved item that is in use, an approved item whose review date is missing or has passed
 *  (patients do not see it until it is reviewed again), or none of these (an older version or a retired one, shown only under All). */
export function eduGroup(r: Resource): EduFilter | "other" {
  if (r.status === "DRAFT") return "draft";
  if (r.status === "APPROVED") return r.usable ? "approved" : "due";
  return "other";
}

/** Every word typed must be in the title, the topic or the issuing organization. */
export function eduMatches(r: Resource, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${r.title} ${r.topic} ${r.issuer}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}
