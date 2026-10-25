import { api, fetchBlobWithAuth } from './client';

export interface Reference {
  id: string;
  title: string;
  issuer: string | null;
  topic: string | null;
  category: string | null;
  jurisdiction: string | null;
  publicationDate: string | null;
  editionNote: string | null;
  sourceUrl: string | null;
  documentUrl: string | null;
  summary: string;
  notes: string;
  rightsNote: string | null;
  tags: string[];
  hasPdf: boolean;
  pageCount: number | null;
  mine: boolean;
  bundled: boolean;
  myNote: string;
  searchTerms: string[];
  matchedOn?: string[];
  foundInPdf?: boolean;
  passages?: number;
}

export interface Passage {
  itemId: string;
  title: string;
  issuer: string | null;
  page: number | null;
  section: string | null;
  text: string;
  marks: string[];
  score: number;
  /** How it was found: by the words typed, by what it says (any language), or both. */
  matchedBy?: 'words' | 'meaning' | 'both';
}

export interface ReferenceSearch {
  query: string;
  items: Reference[];
  passages: Passage[];
  total: number;
  /** True when the server also searches by meaning, so a question in Hindi, Tamil or Telugu finds the English passage. */
  semantic?: boolean;
  interpretation: { corrections: { from: string; to: string }[]; alsoSearched: string[]; words: string[] } | null;
}

export interface ReferenceInput {
  title: string;
  issuer: string;
  topic: string;
  category: string;
  jurisdiction: string;
  publicationDate: string;
  sourceUrl: string;
  summary: string;
  notes: string;
  tags: string[];
}

const BASE = '/api/v2/references';

export function searchReferences(params: { q?: string; category?: string; issuer?: string; mine?: boolean; hasPdf?: boolean }): Promise<ReferenceSearch> {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.category) query.set('category', params.category);
  if (params.issuer) query.set('issuer', params.issuer);
  if (params.mine) query.set('mine', 'true');
  if (params.hasPdf) query.set('has_pdf', 'true');
  const text = query.toString();
  return api.get<ReferenceSearch>(text ? `${BASE}?${text}` : BASE);
}

/** Empty fields are sent as null so the server stores "nothing", not an empty string. */
const clean = (body: ReferenceInput) => ({
  ...body,
  issuer: body.issuer.trim() || null,
  topic: body.topic.trim() || null,
  category: body.category || null,
  jurisdiction: body.jurisdiction.trim() || null,
  publicationDate: body.publicationDate.trim() || null,
  sourceUrl: body.sourceUrl.trim() || null,
});

export const addReference = (body: ReferenceInput) => api.post<Reference>(BASE, clean(body));
export const changeReference = (id: string, body: ReferenceInput) => api.put<Reference>(`${BASE}/${id}`, clean(body));
export const deleteReference = (id: string) => api.delete<{ deleted: string }>(`${BASE}/${id}`);
export const saveReferenceNote = (id: string, text: string) => api.put<{ id: string; myNote: string }>(`${BASE}/${id}/note`, { text });
export const attachReferencePdf = (id: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api.upload<Reference>(`${BASE}/${id}/file`, form);
};
export const detachReferencePdf = (id: string) => api.delete<Reference>(`${BASE}/${id}/file`);

/** Opens the PDF kept on the server in a new tab, at the page that answered the search when one is given. */
export async function openReferencePdf(id: string, page?: number | null): Promise<void> {
  const blob = await fetchBlobWithAuth(`${BASE}/${id}/file`);
  window.open(`${URL.createObjectURL(blob)}${page ? `#page=${page}` : ''}`, '_blank', 'noopener');
}
