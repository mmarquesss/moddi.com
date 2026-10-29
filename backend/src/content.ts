import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contentDir = join(__dirname, "..", "content");

export type Lesson = {
  id: string;
  topic: string;
  objectives: string[];
  vocabulary: string[];
  starter: string;
};
export type LevelGroup = { level: string; title: string; lessons: Lesson[] };
export type Curriculum = { version: number; levels: LevelGroup[] };

export type QuizQuestion = { id: string; level: string; text: string; options: string[]; answer: string };
export type Quiz = { version: number; questions: QuizQuestion[] };

export const curriculum: Curriculum = JSON.parse(readFileSync(join(contentDir, "curriculum.json"), "utf-8"));
export const quiz: Quiz = JSON.parse(readFileSync(join(contentDir, "placement-quiz.json"), "utf-8"));

const LEVEL_ORDER = curriculum.levels.map((l) => l.level);

// Varre os níveis em ordem (A1 -> C1) e para no primeiro nível onde o aluno não acertou
// nenhuma das perguntas daquele nível. O nível sugerido é o último em que ele acertou algo.
export function scoreQuiz(answers: Record<string, string>): string {
  let suggested = LEVEL_ORDER[0];

  for (const level of LEVEL_ORDER) {
    const questionsOfLevel = quiz.questions.filter((q) => q.level === level);
    const correctCount = questionsOfLevel.filter((q) => answers[q.id] === q.answer).length;
    if (correctCount === 0) break;
    suggested = level;
  }

  return suggested;
}
