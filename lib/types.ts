export type GlossaryItem = {
  term: string;
  simple_meaning: string;
  example_sentence: string;
};

export type QuizItem = {
  question: string;
  options: string[];
  correct_index: number;
  why: string;
  term?: string;
};

export type Lesson = {
  sentences: string[];
  glossary: GlossaryItem[];
  key_points: string[];
  quiz: QuizItem[];
};

export type Meter = {
  calls: number;
  tokens: number;
  ttsChars: number;
  asrSeconds: number;
  spendUsd: number;
  budgetUsd: number;
};
