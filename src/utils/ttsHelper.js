/**
 * ttsHelper.js
 *
 * Lightweight multilingual (English / Hindi) text-to-speech helper built on
 * the browser's native Web Speech API (SpeechSynthesis). No external TTS
 * service or API key is used — everything runs on-device with whatever
 * voices the user's browser/OS exposes.
 *
 * Responsibilities:
 *  - Detect whether a message is English or Hindi (Devanagari script check).
 *  - Pick the "best" available voice for a given language + sender gender,
 *    with graceful fallback when the device doesn't expose every combo.
 *  - Speak / stop utterances, cancelling anything already in progress so
 *    messages never overlap.
 *
 * This module is intentionally decoupled from any specific component so it
 * can be reused by both the automatic "read new message aloud" flow and a
 * manual per-message "Listen" button.
 */

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

// Devanagari Unicode block — covers Hindi (and several other Indic
// languages that share the script). Presence of any character in this
// range is treated as a strong signal the message is Hindi.
const DEVANAGARI_RANGE = /[\u0900-\u097F]/;

/**
 * Detects whether a chat message should be spoken as Hindi or English.
 * @param {string} text
 * @returns {'hi'|'en'}
 */
export function detectMessageLanguage(text) {
  if (typeof text !== 'string' || !text.trim()) return 'en';
  return DEVANAGARI_RANGE.test(text) ? 'hi' : 'en';
}

/**
 * Splits a message into contiguous runs of Hindi (Devanagari) vs English
 * text, in original order, each tagged with its language.
 *
 * This exists because a message that MIXES languages — e.g.
 * "Hello userA, आप कैसे हैं" — cannot be spoken correctly as a single
 * utterance: many Hindi (hi-IN) voices silently DROP any non-Devanagari
 * text handed to them rather than mispronouncing it, so the English
 * portion goes completely unspoken (this matches what a single
 * whole-string detectMessageLanguage() + one voice would produce).
 * Splitting into segments lets each run be spoken with a voice that
 * actually matches its script, so nothing gets silently skipped.
 *
 * Whitespace/punctuation between words doesn't force a language switch
 * on its own — it stays attached to whichever segment it's adjacent to
 * — so "Hello userA," stays one segment rather than fragmenting on the
 * comma.
 *
 * @param {string} text
 * @returns {Array<{lang: 'hi'|'en', text: string}>}
 */
export function segmentMessageByLanguage(text) {
  if (typeof text !== 'string' || !text.trim()) return [];

  const segments = [];
  let currentLang = null;
  let buffer = '';

  for (const ch of Array.from(text)) {
    const isDevanagariLetter = DEVANAGARI_RANGE.test(ch);
    const isLatinLetter = /[A-Za-z]/.test(ch);

    if (!isDevanagariLetter && !isLatinLetter) {
      // Whitespace, digits, punctuation, symbols, and emoji carry no
      // language signal on their own — they attach to whichever segment
      // is currently being built rather than forcing a language switch.
      // Without this, something like "आप कैसे हैं?" would split its
      // trailing "?" into its own awkward one-character English segment.
      buffer += ch;
      continue;
    }

    const charLang = isDevanagariLetter ? 'hi' : 'en';

    if (currentLang === null || charLang === currentLang) {
      currentLang = charLang;
      buffer += ch;
    } else {
      if (buffer.trim()) segments.push({ lang: currentLang, text: buffer.trim() });
      currentLang = charLang;
      buffer = ch;
    }
  }

  if (buffer.trim()) segments.push({ lang: currentLang || 'en', text: buffer.trim() });

  return segments;
}

// ---------------------------------------------------------------------------
// Voice loading
// ---------------------------------------------------------------------------

let cachedVoicesPromise = null;

/**
 * Resolves with the list of SpeechSynthesisVoice objects the browser
 * currently exposes. Voices can load asynchronously on some browsers
 * (notably Chrome), so this waits for the `voiceschanged` event the first
 * time if the initial list comes back empty.
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
export function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve([]);
  }

  if (cachedVoicesPromise) return cachedVoicesPromise;

  cachedVoicesPromise = new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing && existing.length > 0) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(synth.getVoices() || []);
    };

    synth.addEventListener?.('voiceschanged', finish, { once: true });
    // Some browsers never fire voiceschanged if there genuinely are no
    // voices installed — don't hang forever waiting.
    setTimeout(finish, 1000);
  });

  return cachedVoicesPromise;
}

// ---------------------------------------------------------------------------
// Voice selection (language + best-effort gender matching)
// ---------------------------------------------------------------------------

// There is no standardized "gender" field on SpeechSynthesisVoice, so
// gender is inferred heuristically from the voice's name. This list
// covers the actual voice names shipped by the major engines users will
// realistically encounter — Microsoft Edge's neural voices, legacy
// Windows SAPI voices, Chrome's Google voices, Android/Google TTS, and
// Apple's voices — for both English and Hindi.
const FEMALE_NAME_HINTS = [
  'female', 'woman',
  // Microsoft neural (Edge) — English
  'aria', 'jenny', 'nancy', 'amber', 'ashley', 'cora', 'elizabeth', 'jane',
  'michelle', 'monica', 'sara', 'libby', 'sonia', 'maisie', 'neerja',
  // Microsoft neural (Edge) — Hindi
  'swara',
  // Legacy Windows / Google / Apple
  'zira', 'susan', 'samantha', 'victoria', 'karen', 'moira', 'tessa',
  'fiona', 'hazel', 'kalpana', 'heera', 'lekha', 'veena', 'aditi', 'priya',
];
const MALE_NAME_HINTS = [
  'male', 'man',
  // Microsoft neural (Edge) — English
  'guy', 'davis', 'tony', 'christopher', 'eric', 'jacob', 'jason', 'roger',
  'steffan', 'brandon', 'ryan', 'thomas', 'jasper',
  // Microsoft neural (Edge) — Hindi / Indian English
  'madhur', 'prabhat',
  // Legacy Windows / Google / Apple
  'david', 'mark', 'alex', 'daniel', 'fred', 'george', 'james', 'hemant',
  'ravi', 'rishi',
];

function guessVoiceGender(voice) {
  const name = (voice.name || '').toLowerCase();
  if (FEMALE_NAME_HINTS.some((hint) => name.includes(hint))) return 'female';
  if (MALE_NAME_HINTS.some((hint) => name.includes(hint))) return 'male';
  return 'unknown';
}

function langMatches(voice, lang) {
  const voiceLang = (voice.lang || '').toLowerCase();
  return lang === 'hi'
    ? voiceLang.startsWith('hi')
    : voiceLang.startsWith('en');
}

// Browsers/OSes expose a mix of voice engines under the same API — some
// are old-style local/formant synthesizers (robotic), others are modern
// neural/network voices (natural-sounding). There's no standard "quality"
// field either, so — same as gender — this is inferred from naming
// conventions used by the major voice packs:
//   - Chrome/Android "Google ..." voices route through Google's network
//     TTS engine and sound clearly more natural than the OS default.
//   - Edge's "... Online (Natural)" voices are Microsoft's neural voices.
//   - Names containing Neural/Natural/Enhanced/Premium are typically the
//     higher-quality tier a vendor offers alongside a legacy voice.
const QUALITY_NAME_HINTS = [
  'google', 'natural', 'neural', 'online', 'premium', 'enhanced', 'plus',
];

function isLikelyHighQualityVoice(voice) {
  const name = (voice.name || '').toLowerCase();
  if (QUALITY_NAME_HINTS.some((hint) => name.includes(hint))) return true;
  // voice.localService === false generally means the voice is served by a
  // cloud engine (e.g. Chrome's Google voices) rather than a bundled local
  // synthesizer — cloud voices are almost always the more natural ones.
  if (voice.localService === false) return true;
  return false;
}

/**
 * Picks the best available voice for the given language + preferred
 * gender. Every candidate voice is scored and the highest-scoring one
 * wins, in this priority order (each tier only breaks ties within the
 * tier above it):
 *   1. Language match (Hindi vs English) — most important, always wins
 *   2. Gender match (best-effort, see guessVoiceGender)
 *   3. Voice quality — prefers natural/neural/network voices over
 *      robotic local ones when multiple options are otherwise equal
 *   4. Browser's marked default voice, as a final tiebreaker
 * @param {SpeechSynthesisVoice[]} voices
 * @param {'hi'|'en'} lang
 * @param {'male'|'female'|undefined} preferredGender
 * @returns {SpeechSynthesisVoice|null}
 */
export function pickVoice(voices, lang, preferredGender) {
  if (!Array.isArray(voices) || voices.length === 0) return null;

  const normalizedGender = preferredGender === 'male' || preferredGender === 'female'
    ? preferredGender
    : null;

  let best = null;
  let bestScore = -1;

  for (const voice of voices) {
    let score = 0;
    if (langMatches(voice, lang)) score += 1000;
    if (normalizedGender && guessVoiceGender(voice) === normalizedGender) score += 100;
    if (isLikelyHighQualityVoice(voice)) score += 10;
    if (voice.default) score += 1;

    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return best;
}

/**
 * Returns every voice available for a given language, sorted with the
 * likely-higher-quality voices first — used to populate a manual voice
 * picker UI.
 * @param {SpeechSynthesisVoice[]} voices
 * @param {'hi'|'en'} lang
 * @returns {SpeechSynthesisVoice[]}
 */
export function getVoicesForLanguage(voices, lang) {
  if (!Array.isArray(voices)) return [];
  return voices
    .filter((v) => langMatches(v, lang))
    .slice()
    .sort((a, b) => Number(isLikelyHighQualityVoice(b)) - Number(isLikelyHighQualityVoice(a)));
}

/**
 * Best-effort guess of a voice's gender from its name, exposed so a
 * manual voice-picker UI can pre-select a sensible default per dropdown.
 * @param {SpeechSynthesisVoice} voice
 * @returns {'male'|'female'|'unknown'}
 */
export function guessGenderForVoice(voice) {
  return guessVoiceGender(voice);
}

// ---------------------------------------------------------------------------
// Manual voice overrides
// ---------------------------------------------------------------------------
//
// The gender heuristic above is inherently best-effort — SpeechSynthesis
// exposes no real gender field, and voice-name conventions vary across
// OS/browser/voice-pack combinations that can't all be predicted. Rather
// than keep guessing, VibeKey lets the user directly assign which
// installed voice plays for "male" and "female" senders in each
// language. That choice is stored locally (per-browser) and always wins
// over the heuristic when present.

const VOICE_OVERRIDE_PREFIX = 'vibekey-voice-override-';

function voiceOverrideKey(lang, gender) {
  return `${VOICE_OVERRIDE_PREFIX}${lang}-${gender}`;
}

// A voice is identified by "name::lang" since SpeechSynthesisVoice has no
// universally-stable unique id across every browser, but the combination
// of name + lang is effectively unique within a single browser's list.
function voiceIdentifier(voice) {
  return `${voice.name}::${voice.lang}`;
}

/**
 * Reads the user's manually-chosen voice for a given language + gender,
 * if one was set. Returns null if no override is stored.
 * @param {'hi'|'en'} lang
 * @param {'male'|'female'} gender
 * @returns {string|null} the stored voice identifier ("name::lang")
 */
export function getVoiceOverride(lang, gender) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(voiceOverrideKey(lang, gender));
  } catch (err) {
    return null;
  }
}

/**
 * Stores (or clears, if voice is null/undefined) the user's manually
 * chosen voice for a given language + gender.
 * @param {'hi'|'en'} lang
 * @param {'male'|'female'} gender
 * @param {SpeechSynthesisVoice|null} voice
 */
export function setVoiceOverride(lang, gender, voice) {
  if (typeof window === 'undefined') return;
  const key = voiceOverrideKey(lang, gender);
  try {
    if (voice) {
      window.localStorage.setItem(key, voiceIdentifier(voice));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('Failed to save voice override:', err);
  }
}

/**
 * Resolves the voice to actually speak with: the user's manual override
 * for this language+gender if one is set and still available on this
 * device, otherwise falls back to the automatic heuristic (pickVoice).
 * @param {SpeechSynthesisVoice[]} voices
 * @param {'hi'|'en'} lang
 * @param {'male'|'female'|undefined} preferredGender
 * @returns {SpeechSynthesisVoice|null}
 */
export function resolveVoice(voices, lang, preferredGender) {
  const normalizedGender = preferredGender === 'male' || preferredGender === 'female'
    ? preferredGender
    : null;

  if (normalizedGender) {
    const overrideId = getVoiceOverride(lang, normalizedGender);
    if (overrideId) {
      const matched = voices.find((v) => voiceIdentifier(v) === overrideId);
      if (matched) return matched;
      // Stored override no longer exists on this device (e.g. voice pack
      // changed) — fall through to the heuristic instead of failing.
    }
  }

  return pickVoice(voices, lang, preferredGender);
}

// ---------------------------------------------------------------------------
// Speak / stop
// ---------------------------------------------------------------------------

/**
 * @returns {boolean} whether the browser supports speech synthesis at all.
 */
export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Immediately stops any in-progress or queued speech from this helper.
 */
export function stopSpeaking() {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch (err) {
    console.warn('Failed to cancel speech synthesis:', err);
  }
}

/**
 * Speaks a chat message aloud using a voice matched to its detected
 * language and the sender's gender (best-effort — see pickVoice —
 * unless the user has set a manual override, see resolveVoice).
 * Cancels any speech already in progress so messages never overlap.
 *
 * Mixed-language messages (e.g. "Hello userA, आप कैसे हैं") are split
 * into per-language segments (see segmentMessageByLanguage) and each
 * segment is spoken with its own matching voice, back-to-back — a
 * single Hindi voice would otherwise silently drop the English portion
 * instead of speaking it.
 *
 * @param {string} text - the message text to read aloud.
 * @param {Object} [options]
 * @param {'male'|'female'|string} [options.gender] - sender's declared gender.
 * @param {() => void} [options.onStart] - called when the first segment starts.
 * @param {() => void} [options.onEnd] - called once every segment has finished.
 * @param {(err: any) => void} [options.onError]
 * @returns {Promise<boolean>} resolves true if speech was started.
 */
export async function speakMessage(text, options = {}) {
  const { gender, onStart, onEnd, onError } = options;

  if (!isSpeechSupported() || typeof text !== 'string' || !text.trim()) {
    return false;
  }

  const segments = segmentMessageByLanguage(text);
  if (segments.length === 0) return false;

  return playSegmentQueue(segments, gender, { onStart, onDone: onEnd, onError });
}

/**
 * Lower-level: speaks text with a specific, already-chosen voice (no
 * language detection or gender resolution). Used by speakMessage above,
 * and directly by the manual voice-picker's "Test" button so the user
 * hears exactly the voice they're about to select.
 * @param {string} text
 * @param {SpeechSynthesisVoice|null} voice
 * @param {'hi'|'en'} [lang] - used only as a fallback BCP-47 tag if voice is null.
 * @param {Object} [options]
 * @param {() => void} [options.onStart]
 * @param {() => void} [options.onEnd]
 * @param {(err: any) => void} [options.onError]
 * @returns {boolean} whether speech was started.
 */
export function speakWithVoice(text, voice, lang, options = {}) {
  const { onStart, onEnd, onError } = options;
  if (!isSpeechSupported() || typeof text !== 'string' || !text.trim()) {
    return false;
  }

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang || (lang === 'hi' ? 'hi-IN' : 'en-US');
  if (voice) utterance.voice = voice;
  utterance.rate = 1;
  utterance.pitch = 1;

  if (onStart) utterance.onstart = onStart;
  if (onEnd) utterance.onend = onEnd;
  utterance.onerror = (event) => {
    if (event?.error === 'interrupted' || event?.error === 'canceled') return;
    console.warn('Speech synthesis error:', event?.error || event);
    if (onError) onError(event);
  };

  try {
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('Failed to start speech synthesis:', err);
    if (onError) onError(err);
    return false;
  }
}

/**
 * Speaks a sequence of language-tagged segments back-to-back, waiting
 * for each to finish (via the utterance's onend) before starting the
 * next, so nothing overlaps. This is the shared engine behind both
 * speakMessage() (segments of one mixed-language message) and
 * speakMessages() (a whole batch of messages, each split into its own
 * segments and flattened into one continuous queue).
 * @param {Array<{lang: 'hi'|'en', text: string}>} segments
 * @param {'male'|'female'|string} [gender]
 * @param {Object} [options]
 * @param {() => void} [options.onStart] - called when the first segment starts.
 * @param {() => void} [options.onDone] - called once every segment finishes.
 * @param {(err: any) => void} [options.onError]
 * @returns {Promise<boolean>}
 */
async function playSegmentQueue(segments, gender, options = {}) {
  const { onStart, onDone, onError } = options;

  if (!isSpeechSupported() || !Array.isArray(segments) || segments.length === 0) {
    if (onDone) onDone();
    return false;
  }

  // Never let a fresh queue talk over anything already in progress.
  stopSpeaking();

  const voices = await loadVoices();
  const normalizedGender = typeof gender === 'string' ? gender.toLowerCase() : undefined;

  let index = 0;
  const playNext = () => {
    if (index >= segments.length) {
      if (onDone) onDone();
      return;
    }
    const segment = segments[index];
    const isFirst = index === 0;
    index += 1;

    const voice = resolveVoice(voices, segment.lang, normalizedGender);
    speakWithVoice(segment.text, voice, segment.lang, {
      onStart: isFirst ? onStart : undefined,
      onEnd: playNext,
      // Don't let one failed/unsupported segment silently stall the rest
      // of the message/batch — move on and keep reading what's left.
      onError: (event) => {
        if (onError) onError(event);
        playNext();
      },
    });
  };

  playNext();
  return true;
}

/**
 * Speaks a sequence of chat messages aloud, one after another. Each
 * message is itself split into per-language segments (see
 * segmentMessageByLanguage) so a batch containing mixed-language
 * messages is read correctly too — a batch is really just one long
 * segment queue under the hood.
 *
 * Used to read out messages that arrived while the chat was closed —
 * they're read once, in order, the moment the chat is opened — as
 * opposed to speakMessage(), which handles a single message arriving
 * live while the chat is already open.
 *
 * @param {Array<{messageText: string}>} messages - in the order to be read.
 * @param {Object} [options]
 * @param {'male'|'female'|string} [options.gender] - sender's declared gender.
 * @param {() => void} [options.onDone] - called once the whole batch finishes.
 * @returns {Promise<boolean>} resolves true if playback of the batch started.
 */
export async function speakMessages(messages, options = {}) {
  const { gender, onDone } = options;

  if (!isSpeechSupported() || !Array.isArray(messages) || messages.length === 0) {
    if (onDone) onDone();
    return false;
  }

  const texts = messages
    .map((m) => (typeof m === 'string' ? m : m?.messageText))
    .filter((t) => typeof t === 'string' && t.trim());

  const segments = texts.flatMap((text) => segmentMessageByLanguage(text));

  if (segments.length === 0) {
    if (onDone) onDone();
    return false;
  }

  return playSegmentQueue(segments, gender, { onDone });
}
