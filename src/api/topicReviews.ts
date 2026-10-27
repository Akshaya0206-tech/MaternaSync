import { api } from './client';

/** That the clinic has read a topic on the patient References page: who, and when. A topic nobody has reviewed has no entry. */
export interface TopicReview {
  reviewedAt: string;
  reviewerName: string;
  /** Fingerprint of the topic's text when it was reviewed (see src/data/topicFingerprint.ts). Missing for a review made before fingerprints existed. */
  contentHash?: string | null;
  /** Only the doctor's own screen carries the note. */
  note?: string;
}
export type TopicReviews = Record<string, TopicReview>;

export const fetchTopicReviews = () => api.get<TopicReviews>('/api/v2/patient/reference-reviews');
export const fetchDoctorTopicReviews = () => api.get<TopicReviews>('/api/v2/doctor/reference-reviews');
export const markTopicReviewed = (topicId: string, note: string, contentHash: string) =>
  api.put<TopicReview>(`/api/v2/doctor/reference-reviews/${topicId}`, { note, contentHash });
/** Several at once: each is marked and logged on its own, and a review that already exists keeps its private note. */
export const markTopicsReviewed = (topics: { topicId: string; contentHash: string }[]) =>
  api.post<{ reviewed: string[]; reviews: TopicReviews }>('/api/v2/doctor/reference-reviews', { topics });
export const clearTopicReview = (topicId: string) => api.delete<{ topicId: string; cleared: boolean }>(`/api/v2/doctor/reference-reviews/${topicId}`);

/** What a topic's review says now, comparing the fingerprint kept with the review against the text the app ships. */
export type ReviewState = 'none' | 'current' | 'changed' | 'untracked';
export function reviewState(review: TopicReview | undefined | false, currentHash: string): ReviewState {
  if (!review) return 'none';
  if (!review.contentHash) return 'untracked'; // reviewed before changes were tracked: nothing to compare
  return review.contentHash === currentHash ? 'current' : 'changed';
}
