/**
 * The decisions an outline leaves to the client (output/questions.json, written by the plan pass).
 * A render is the expensive step, so it cannot start while a question without a safe default is
 * unanswered: the answers travel to the build pass as the client's notes.
 */
import {existsSync, readFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {jobDir} from './jobs.mjs';

const file = (jobId) => join(jobDir(jobId), 'output', 'questions.json');
// A placeholder the editor left in the outline despite being told to ask instead.
const PLACEHOLDER = /\[[^\]]*\bTBC\b[^\]]*\]|\bTBC\b|\bXXX\b|\?\?\?/;

const clean = (q, i) => ({
  id: String(q.id || `q${i + 1}`).slice(0, 40),
  question: String(q.question || '').slice(0, 400),
  why: q.why ? String(q.why).slice(0, 400) : null,
  options: Array.isArray(q.options) ? q.options.map((o) => String(o).slice(0, 200)).filter(Boolean).slice(0, 8) : null,
  default: q.default === null || q.default === undefined || q.default === '' ? null : String(q.default).slice(0, 200),
});

export function readQuestions(jobId) {
  let questions = [];
  try {
    if (existsSync(file(jobId))) questions = (JSON.parse(readFileSync(file(jobId), 'utf8')).questions || []).map(clean).filter((q) => q.question);
  } catch {
    // A broken file is treated like a missing one; the placeholder check below still applies.
  }
  const plan = join(jobDir(jobId), 'output', 'plan.md');
  if (!questions.some((q) => q.default === null) && existsSync(plan) && PLACEHOLDER.test(readFileSync(plan, 'utf8'))) {
    questions.push({id: 'placeholder', question: 'The outline has a part marked "TBC". What should it say?', why: 'The editor could not confirm it, and it would show in the video as it is.', options: null, default: null});
  }
  return questions;
}

/** A new outline replaces the old one's questions. */
export const clearQuestions = (jobId) => rmSync(file(jobId), {force: true});

/** The client's answers as notes for the build pass. Throws if one with no default is unanswered. */
export function answersAsNotes(jobId, answers = {}, notes = '') {
  const questions = readQuestions(jobId);
  const missing = questions.filter((q) => q.default === null && !String(answers[q.id] || '').trim());
  if (missing.length) throw new Error(`Answer ${missing.length === 1 ? 'the question' : `the ${missing.length} questions`} on the outline first: ${missing.map((q) => q.question).join(' / ')}`);
  const lines = questions.map((q) => `- ${q.question} → ${String(answers[q.id] || '').trim() || `${q.default} (default)`}`);
  return [lines.length ? `Answers to the outline's questions:\n${lines.join('\n')}` : '', notes.trim()].filter(Boolean).join('\n\n');
}
