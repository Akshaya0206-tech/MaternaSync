/** A stored value (a code such as no_show, or a free word such as "consultation") shown as a readable label: underscores become spaces and the
 *  first letter is a capital. Only the first letter changes; the rest of the text is left exactly as it was written. */
export const sentence = (value: string): string => {
  const text = value.replaceAll("_", " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
};
