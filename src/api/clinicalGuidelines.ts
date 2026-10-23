import { api } from './client';

export const GUIDELINE_CATEGORIES = [
  'ANTENATAL_CARE', 'LABOR_DELIVERY', 'POSTPARTUM', 'HIGH_RISK',
  'SCREENING', 'NUTRITION', 'MEDICATION_SAFETY', 'GENERAL',
] as const;

export const GUIDELINE_DOCUMENT_TYPES = [
  'Clinical Practice Guideline', 'Protocol', 'Position Statement', 'Factsheet', 'Other',
] as const;

export interface GuidelineSource {
  id: string;
  title: string;
  issuingOrganization: string;
  sourceUrl: string | null;
  version: string | null;
  publicationDate: string | null;
  category: string;
  documentType: string;
  jurisdiction: string | null;
  language: string | null;
  filename: string;
  isDemoContent: boolean;
  status: 'PROCESSING' | 'AWAITING_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXCLUDED';
  chunkCount: number;
  uploadedByName: string;
  uploadedAt: string;
  lastReviewedAt: string | null;
}

export interface GuidelineChunk {
  id: string;
  chunkIndex: number;
  text: string;
  pageNumber: number | null;
  sectionLabel: string | null;
}

export interface GuidelineSourceDetail extends GuidelineSource {
  chunks: GuidelineChunk[];
}

export interface GuidelineFilterOptions {
  categories: string[];
  organizations: string[];
  documentTypes: string[];
}

export interface GuidelineExcerpt {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  issuingOrganization: string;
  version: string | null;
  publicationDate: string | null;
  sourceUrl: string | null;
  documentType: string;
  category: string;
  pageNumber: number | null;
  sectionLabel: string | null;
  excerptText: string;
  similarityScore: number;
  isDemoContent: boolean;
  lastReviewedAt: string | null;
}

export interface GuidelineSearchResult {
  query: string;
  hasSufficientEvidence: boolean;
  answerText: string;
  excerpts: GuidelineExcerpt[];
  distinctSourceCount: number;
  disagreementPossible: boolean;
  searchedAt: string;
}

export function searchGuidelines(payload: { query: string; category?: string; organization?: string; documentType?: string }): Promise<GuidelineSearchResult> {
  return api.post<GuidelineSearchResult>('/api/v2/guidelines/search', payload);
}

export function fetchFilterOptions(): Promise<GuidelineFilterOptions> {
  return api.get<GuidelineFilterOptions>('/api/v2/guidelines/sources/approved/filters');
}

export function fetchSources(status?: string): Promise<GuidelineSource[]> {
  const qs = status ? `?status=${status}` : '';
  return api.get<GuidelineSource[]>(`/api/v2/guidelines/sources${qs}`);
}

export function fetchSourceDetail(sourceId: string): Promise<GuidelineSourceDetail> {
  return api.get<GuidelineSourceDetail>(`/api/v2/guidelines/sources/${sourceId}`);
}

export interface UploadSourcePayload {
  file: File;
  title: string;
  issuingOrganization: string;
  category: string;
  documentType: string;
  sourceUrl?: string;
  version?: string;
  publicationDate?: string;
  jurisdiction?: string;
}

export function uploadSource(payload: UploadSourcePayload): Promise<GuidelineSource> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('title', payload.title);
  formData.append('issuing_organization', payload.issuingOrganization);
  formData.append('category', payload.category);
  formData.append('document_type', payload.documentType);
  if (payload.sourceUrl) formData.append('source_url', payload.sourceUrl);
  if (payload.version) formData.append('version', payload.version);
  if (payload.publicationDate) formData.append('publication_date', payload.publicationDate);
  if (payload.jurisdiction) formData.append('jurisdiction', payload.jurisdiction);
  return api.upload<GuidelineSource>('/api/v2/guidelines/sources', formData);
}

export function approveSource(sourceId: string, notes?: string): Promise<GuidelineSource> {
  return api.post<GuidelineSource>(`/api/v2/guidelines/sources/${sourceId}/approve`, { notes: notes ?? null });
}

export function approveSourcesBatch(ids: string[]): Promise<{ approved: string[]; failed: { id: string; reason: string }[] }> {
  return api.post(`/api/v2/guidelines/sources/approve-batch`, { ids, confirmed: true });
}

export function rejectSource(sourceId: string, notes?: string): Promise<GuidelineSource> {
  return api.post<GuidelineSource>(`/api/v2/guidelines/sources/${sourceId}/reject`, { notes: notes ?? null });
}

export function excludeSource(sourceId: string, notes?: string): Promise<GuidelineSource> {
  return api.post<GuidelineSource>(`/api/v2/guidelines/sources/${sourceId}/exclude`, { notes: notes ?? null });
}
