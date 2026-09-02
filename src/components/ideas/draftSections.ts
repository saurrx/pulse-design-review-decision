/**
 * The shape of a disclosure questionnaire: sections, each holding questions.
 *
 * These two interfaces used to live in `DraftCreationContent.tsx` — a 2,245-line
 * screen that nothing rendered any more. Two live files imported the type from
 * it and nothing imported its component, which is precisely why the dead screen
 * survived every import-graph sweep: a type-only edge is erased at build, so the
 * file looked reachable while contributing no code to the bundle.
 *
 * They live here so the shape can outlive any one screen that renders it.
 */
export interface Question {
  id: string;
  text: string;
  answer: string;
}

export interface Section {
  CheckDraftSoreLog: any;
  score: number;
  id: string;
  title: string;
  description: string;
  questions: Question[];
}
