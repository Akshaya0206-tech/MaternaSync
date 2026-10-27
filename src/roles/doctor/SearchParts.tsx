import { highlightParts } from './searchText';

/** `text` with the part that matches what was typed in bold. */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((part, index) => (part.match ? <mark key={index} className="gs-mark">{part.text}</mark> : <span key={index}>{part.text}</span>))}
    </>
  );
}
