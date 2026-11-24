import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyVocabInput, parseVocabList } from '../src/vocabInput.js';

test('classifies blank, single words, and intact phrases', () => {
  for (const value of ['', '  \n ']) assert.equal(classifyVocabInput(value), 'empty');
  for (const value of ['Frist', 'die Frist', 'sich bewerben', 'einen Termin vereinbaren']) assert.equal(classifyVocabInput(value), 'word');
  assert.deepEqual(parseVocabList('sich bewerben'), []);
});

test('splits explicit comma and newline lists without splitting phrases', () => {
  assert.deepEqual(parseVocabList(' Termin, Bewerbung, zuverlässig '), ['Termin', 'Bewerbung', 'zuverlässig']);
  assert.deepEqual(parseVocabList('die Frist\r\nsich bewerben, einen Termin vereinbaren\n'), ['die Frist', 'sich bewerben', 'einen Termin vereinbaren']);
  assert.equal(classifyVocabInput('eins,, zwei'), 'list');
  assert.deepEqual(parseVocabList('eins,, zwei'), ['eins', 'zwei']);
});

test('does not split common sentences at commas or newlines', () => {
  for (const value of [
    'Hallo, wie geht es dir?',
    'Ich suche eine Wohnung, morgen habe ich einen Termin',
    'Obwohl ich müde bin, gehe ich zur Arbeit',
    'Ich bewerbe mich um eine Stelle.',
    'Ich suche eine Wohnung.\nMorgen habe ich einen Termin.',
    'Wir treffen uns morgen',
    'Ich komme, du gehst',
  ]) {
    assert.equal(classifyVocabInput(value), 'sentence', value);
    assert.deepEqual(parseVocabList(value), [], value);
  }
});

test('segments text for individual analysis without dropping punctuation', async () => {
  const { splitSentences } = await import('../src/vocabInput.js');
  assert.deepEqual(splitSentences('Ich suche eine Wohnung. Morgen habe ich einen Termin.'), ['Ich suche eine Wohnung.', 'Morgen habe ich einen Termin.']);
  assert.deepEqual(splitSentences('Ist das möglich? Ja!'), ['Ist das möglich?', 'Ja!']);
  assert.deepEqual(splitSentences('sich bewerben'), ['sich bewerben']);
  assert.deepEqual(splitSentences('  '), []);
});

test('explicit list override keeps a punctuation-classified input reviewable', async () => {
  const { parseSeparatedItems } = await import('../src/vocabInput.js');
  const input = 'Brot, Milch, Wasser.';
  assert.equal(classifyVocabInput(input), 'sentence');
  assert.deepEqual(parseSeparatedItems(input), ['Brot', 'Milch', 'Wasser.']);
});
