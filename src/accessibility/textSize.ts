export type TextSize = 'normal' | 'large' | 'xlarge';

export interface TextSizeLabels {
  title: string;
  normal: string;
  large: string;
  xlarge: string;
}

export const DEFAULT_TEXT_SIZE_LABELS: TextSizeLabels = { title: 'Text size', normal: 'Normal text', large: 'Large text', xlarge: 'Extra large text' };

const KEY = 'maternasync_text_size';

export function readTextSize(): TextSize {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'large' || value === 'xlarge' ? value : 'normal';
  } catch {
    return 'normal';
  }
}

/** Larger text is applied to the whole page by scaling the root font size (the app sizes text in rem). */
export function applyTextSize(size: TextSize = readTextSize()): void {
  document.documentElement.dataset.textSize = size;
}

export function writeTextSize(size: TextSize): void {
  try {
    localStorage.setItem(KEY, size);
  } catch {
    /* the choice just does not survive a reload */
  }
  applyTextSize(size);
}
