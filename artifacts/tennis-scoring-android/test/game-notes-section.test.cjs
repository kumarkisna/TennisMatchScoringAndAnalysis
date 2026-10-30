const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const matchScreen = fs.readFileSync(
  path.join(__dirname, '../app/matches/[id].tsx'),
  'utf8',
);
const notesStart = matchScreen.indexOf('testID="toggle-game-notes"');
const reviewStart = matchScreen.indexOf(
  'testID="toggle-set-review"',
  notesStart,
);
assert.notEqual(notesStart, -1, 'Game-note toggle should be present.');
assert.notEqual(reviewStart, -1, 'Game-note section should end before set review.');
const gameNotesSection = matchScreen.slice(notesStart, reviewStart);

test('game-note section starts collapsed and exposes accessible toggle state', () => {
  assert.match(
    matchScreen,
    /const \[isGameNotesExpanded, setIsGameNotesExpanded\] = useState\(false\);/,
  );
  assert.ok(gameNotesSection.includes('accessibilityRole="button"'));
  assert.ok(
    gameNotesSection.includes(
      'accessibilityLabel={`Set ${viewedSet.setNumber} game notes`}',
    ),
  );
  assert.ok(
    gameNotesSection.includes(
      'accessibilityState={{ expanded: isGameNotesExpanded }}',
    ),
  );
  assert.ok(
    gameNotesSection.includes(
      'onPress={() => setIsGameNotesExpanded((current) => !current)}',
    ),
  );
  assert.ok(
    gameNotesSection.includes(
      "name={isGameNotesExpanded ? 'chevron-up' : 'chevron-down'}",
    ),
  );
});

test('expanding reveals editable game-note rows and collapsing hides them', () => {
  assert.ok(gameNotesSection.includes('{isGameNotesExpanded ? ('));
  assert.ok(gameNotesSection.includes('reviewGameNumbers.map((gameNumber) => {'));
  assert.ok(
    gameNotesSection.includes(
      'testID={`edit-game-note-${viewedSet.setNumber}-${gameNumber}`}',
    ),
  );
  assert.ok(
    gameNotesSection.includes(
      'onPress={() => openGameNoteEditor(viewedSet.setNumber, gameNumber)}',
    ),
  );
});
