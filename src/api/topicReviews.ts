import { api } from './client';

/** That the clinic has read a topic on the patient References page: who, and when. A topic nobody has reviewed has no entry. */
export interface TopicReview {
  reviewedAt: string;
  reviewerName: string;
  /** Only the doctor's own screen carries the note. */
  note?: string;
}
export type TopicReviews = Record<string, TopicReview>;

export const fetchTopicReviews = () => api.get<TopicReviews>('/api/v2/patient/reference-reviews');
export const fetchDoctorTopicReviews = () => api.get<TopicReviews>('/api/v2/doctor/reference-reviews');
export const markTopicReviewed = (topicId: string, note: string) => api.put<TopicReview>(`/api/v2/doctor/reference-reviews/${topicId}`, { note });
export const clearTopicReview = (topicId: string) => api.delete<{ topicId: string; cleared: boolean }>(`/api/v2/doctor/reference-reviews/${topicId}`);
