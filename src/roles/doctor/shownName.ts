/** How a patient sees a doctor's name: the title, then the name chosen for patients (or the account name when none is chosen). A title the name
 *  already starts with is not repeated. The server does the same thing in backend/app/doctor_names.py; this copy is only for the live preview. */
export function shownName(fullName: string, title: string, name: string): string {
  const base = name.trim() || fullName.trim();
  const prefix = title.trim();
  if (!base || !prefix || base.toLowerCase().startsWith(prefix.toLowerCase())) return base;
  return `${prefix} ${base}`;
}
