/**
 * "Paste as human" — human-paced text entry for the built-in browser.
 *
 * Why this exists: a single `insertText` or an instant clipboard paste produces
 * one input event with a 0 ms gap, identical text length and no keystroke
 * stream. Scripts and bot-detection heuristics that watch `keydown` timing,
 * `inputType`, `beforeinput` and selection ranges can flag that pattern.
 *
 * What this does NOT do: it does not defeat CAPTCHAs, does not forge a human
 * identity and does not make automation lawful where it is not. It only makes
 * manual pasting feel and behave like typing for people who paste long text
 * into forms all day. CAPTCHA challenges must be solved by a person.
 *
 * Output is a deterministic (per seed) keystroke schedule the desktop shell can
 * replay through CDP `Input.dispatchKeyEvent`, so the page sees real key events
 * rather than a synthetic insert.
 */
export interface TypingOptions {
  /** base delay between characters, ms */
  baseDelay?: number;
  /** extra random jitter per character, ms */
  jitter?: number;
  /** chance 0..1 of an occasional longer "thinking" pause */
  pauseChance?: number;
  /** length of that pause, ms range */
  pauseRange?: [number, number];
  /** chance 0..1 of a single-character correction (type, backspace, retype) */
  typoChance?: number;
  /** deterministic seed so a schedule can be reproduced and audited */
  seed?: number;
}

export interface Keystroke {
  /** character to insert; empty for Backspace/Delete */
  char: string;
  /** delay before this key, ms */
  delay: number;
  key: 'char' | 'Backspace';
}

/** Small deterministic PRNG (mulberry32) — same schedule for the same seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a keystroke schedule for `text`.
 *
 * Newlines become Enter-equivalent inserts. The total duration is bounded:
 * long pastes accelerate rather than taking minutes.
 */
export function humanPasteSchedule(text: string, options: TypingOptions = {}): Keystroke[] {
  const {
    baseDelay = 42,
    jitter = 34,
    pauseChance = 0.06,
    pauseRange = [140, 420],
    typoChance = 0.015,
    seed = 0x9e3779b9,
  } = options;

  const random = rng(seed);
  const chars = [...text];
  // Keep a long paste usable: compress delay for big blocks.
  const speed = chars.length > 400 ? 0.35 : chars.length > 120 ? 0.6 : 1;
  const schedule: Keystroke[] = [];

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    let delay = (baseDelay + random() * jitter) * speed;

    if (random() < pauseChance) {
      delay += (pauseRange[0] + random() * (pauseRange[1] - pauseRange[0])) * speed;
    }
    // A word boundary gets a slightly longer beat, like real typing.
    if (i > 0 && /\s/.test(chars[i - 1])) delay += 26 * speed;

    // Occasional correction: wrong letter, backspace, then the right one.
    if (/[a-z]/i.test(ch) && random() < typoChance) {
      const wrong = String.fromCharCode(ch.charCodeAt(0) + (random() < 0.5 ? 1 : -1));
      schedule.push({ char: wrong, delay, key: 'char' });
      schedule.push({ char: '', delay: (38 + random() * 40) * speed, key: 'Backspace' });
      delay = (30 + random() * 30) * speed;
    }

    schedule.push({ char: ch, delay: Math.max(4, Math.round(delay)), key: 'char' });
  }

  return schedule;
}

/** Total wall-clock time of a schedule, ms. */
export function scheduleDuration(schedule: Keystroke[]): number {
  return schedule.reduce((sum, k) => sum + k.delay, 0);
}

/**
 * Plain-text summary used by the UI so the user knows exactly what will happen
 * before committing — no hidden automation.
 */
export function describeSchedule(schedule: Keystroke[], options: { label?: string } = {}): string {
  const ms = scheduleDuration(schedule);
  const chars = schedule.filter((k) => k.key === 'char' && k.char !== '').length;
  const backspaces = schedule.filter((k) => k.key === 'Backspace').length;
  return `${chars} characters${options.label ? ` for ${options.label}` : ''} over ${(ms / 1000).toFixed(1)}s, ${backspaces} correction${backspaces === 1 ? '' : 's'}`;
}
