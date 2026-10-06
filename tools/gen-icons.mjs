// Generates the ten maneuver icons as original SVGs.
// Run once; the output is committed. Kept out of the module itself.
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });

const BG = '#1b1e24';
const GLYPH = '#f4f6f9';
const POWERFUL = '#d4793f';
const DEFT = '#4fa8bd';
// Grapple belongs to neither group, so it gets its own accent rather than
// borrowing one and implying a membership it does not have.
const GRAPPLE = '#a577d0';

const wrap = (accent, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect x="1.5" y="1.5" width="61" height="61" rx="13" fill="${BG}" stroke="${accent}" stroke-width="3"/>
  <g fill="none" stroke="${GLYPH}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
${body.split('\n').map((l) => (l.trim() ? '    ' + l.trim() : '')).filter(Boolean).join('\n')}
  </g>
</svg>
`;

const ICONS = {
  // Powerful: shoving a mass straight back.
  'bull-rush': [POWERFUL, `
    <path d="M14 22 L24 32 L14 42"/>
    <path d="M26 22 L36 32 L26 42"/>
    <path d="M46 16 V48"/>
  `],
  // Deft: an eye, struck blind.
  'dirty-trick': [DEFT, `
    <path d="M13 32 C21 21 43 21 51 32 C43 43 21 43 13 32 Z"/>
    <circle cx="32" cy="32" r="4.5" fill="${GLYPH}" stroke="none"/>
    <path d="M17 48 L47 16"/>
  `],
  // Deft: a blade knocked loose, with motion lines behind it.
  disarm: [DEFT, `
    <path d="M25 41 L47 19"/>
    <path d="M32 24 L42 34"/>
    <path d="M15 24 C18 31 18 37 15 44"/>
    <path d="M22 21 C25 29 25 35 22 43"/>
  `],
  // Powerful: hauling a mass toward you.
  drag: [POWERFUL, `
    <path d="M46 32 H19"/>
    <path d="M27 24 L19 32 L27 40"/>
    <path d="M52 16 V48"/>
  `],
  // Its own thing: locked together.
  grapple: [GRAPPLE, `
    <circle cx="25" cy="32" r="12"/>
    <circle cx="39" cy="32" r="12"/>
  `],
  // Powerful: driving straight over.
  overrun: [POWERFUL, `
    <path d="M21 15 L32 26 L43 15"/>
    <path d="M21 28 L32 39 L43 28"/>
    <path d="M16 49 H48"/>
  `],
  // Deft: moved around you.
  reposition: [DEFT, `
    <path d="M46 24 A16 16 0 1 0 48 34"/>
    <path d="M38 22 L47 23 L46 32"/>
    <circle cx="32" cy="32" r="4" fill="${GLYPH}" stroke="none"/>
  `],
  // Deft: lifted clean away.
  steal: [DEFT, `
    <circle cx="42" cy="21" r="8"/>
    <path d="M13 50 C17 36 27 27 37 24"/>
    <path d="M29 20 L38 24 L35 33"/>
  `],
  // Powerful: their gear broken.
  sunder: [POWERFUL, `
    <path d="M32 13 L49 20 V33 C49 44 32 51 32 51 C32 51 15 44 15 33 V20 Z"/>
    <path d="M33 17 L27 31 L37 35 L30 48"/>
  `],
  // Deft: swept off their feet.
  trip: [DEFT, `
    <path d="M20 13 L42 36"/>
    <path d="M42 36 L50 33"/>
    <path d="M13 47 C25 53 39 53 51 47"/>
  `],
};

for (const [name, [accent, body]] of Object.entries(ICONS)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), wrap(accent, body), 'utf8');
}
console.log(`wrote ${Object.keys(ICONS).length} icons to ${OUT}`);
