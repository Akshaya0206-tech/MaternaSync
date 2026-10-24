export type Lang = 'en' | 'hi' | 'ta' | 'te';
export type Say = Record<Lang, string>;
export type SayList = Record<Lang, string[]>;

export interface ReferenceSource {
  label: string;
  publisher: string;
  url: string;
}

export interface ReferenceTopic {
  id: string;
  category: string;
  title: Say;
  summary: Say;
  keyPoints: SayList;
  seekHelp: SayList;
  keywords: string[];
  sources: ReferenceSource[];
}

export interface Helpline {
  number: string;
  label: Say;
  note: Say;
  source: { label: string; url: string };
}

export interface PatientReferences {
  generatedFrom: string;
  categories: { id: string; title: Say }[];
  topics: ReferenceTopic[];
  helplines: Helpline[];
}
