import test from 'node:test';
import assert from 'node:assert/strict';
import { WRITING_EXERCISES, writingPatternQuestions, writingPurposeQuestions } from '../src/writingExercises.js';

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

test('writing exercises have unique identifiers and complete scenarios', () => {
  assert.equal(WRITING_EXERCISES.length, 4);
  assert.equal(new Set(WRITING_EXERCISES.map((exercise) => exercise.id)).size, WRITING_EXERCISES.length);
  for (const exercise of WRITING_EXERCISES) {
    assert.ok(nonempty(exercise.id));
    assert.ok(nonempty(exercise.title));
    assert.ok(nonempty(exercise.brief));
    assert.ok(['formal', 'informal'].includes(exercise.register));
    assert.equal(exercise.points.length, 4);
    assert.ok(exercise.points.every(nonempty));
    assert.equal(new Set(exercise.points.map((point) => point.trim().toLowerCase())).size, 4);
    assert.equal(exercise.patterns.length, 4);
    assert.ok(exercise.patterns.every((pattern) => nonempty(pattern.german) && nonempty(pattern.english) && nonempty(pattern.purpose)));
    assert.equal(new Set(exercise.patterns.map((pattern) => pattern.german.trim().toLowerCase())).size, 4);
    assert.equal(new Set(exercise.patterns.map((pattern) => pattern.english.trim().toLowerCase())).size, 4);
  }
});

test('each communication goal has one matching German line and varied answer position', () => {
  for (const exercise of WRITING_EXERCISES) {
    const questions = writingPurposeQuestions(exercise);
    assert.equal(new Set(questions.map((question) => question.options.indexOf(question.answer))).size, exercise.patterns.length);
    for (const [index, question] of questions.entries()) {
      assert.equal(question.purpose, exercise.patterns[index].purpose);
      assert.equal(question.answer, exercise.patterns[index].german);
      assert.equal(question.options.filter((option) => option === question.answer).length, 1);
    }
  }
});

test('practice includes both formal and informal registers', () => {
  assert.deepEqual(new Set(WRITING_EXERCISES.map((exercise) => exercise.register)), new Set(['formal', 'informal']));
});

test('pattern questions preserve each translation and vary the correct option', () => {
  for (const exercise of WRITING_EXERCISES) {
    const questions = writingPatternQuestions(exercise);
    assert.equal(questions.length, exercise.patterns.length);
    assert.equal(new Set(questions.map((question) => question.options.indexOf(question.answer))).size, questions.length);
    for (const [index, question] of questions.entries()) {
      assert.equal(question.answer, exercise.patterns[index].english);
      assert.equal(question.options.filter((option) => option === question.answer).length, 1);
    }
  }
});

test('feedback validation rejects missing or malformed coverage', async () => {
  const { validateWritingFeedback } = await import('../src/writingExercises.js');
  assert.equal(validateWritingFeedback({ corrected: 'Text', changes: [], coverage: ['only one'] }), null);
  assert.equal(validateWritingFeedback({ corrected: 'Text', changes: [null], coverage: ['a', 'b', 'c', 'd'] }), null);
  assert.deepEqual(validateWritingFeedback({ corrected: 'Text', changes: [], coverage: ['a', 'b', 'c', 'd'] }), { corrected: 'Text', changes: [], coverage: ['a', 'b', 'c', 'd'] });
});
