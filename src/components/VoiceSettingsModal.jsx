'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  loadVoices,
  getVoicesForLanguage,
  guessGenderForVoice,
  getVoiceOverride,
  setVoiceOverride,
  speakWithVoice,
  stopSpeaking,
} from '../utils/ttsHelper';

const SAMPLE_TEXT = {
  en: 'Hello, this is a preview of this voice.',
  hi: 'नमस्ते, यह आवाज़ का पूर्वावलोकन है।',
};

const ROWS = [
  { lang: 'en', gender: 'male', label: '🇬🇧 English — Male sender' },
  { lang: 'en', gender: 'female', label: '🇬🇧 English — Female sender' },
  { lang: 'hi', gender: 'male', label: '🇮🇳 Hindi — Male sender' },
  { lang: 'hi', gender: 'female', label: '🇮🇳 Hindi — Female sender' },
];

function voiceId(voice) {
  return `${voice.name}::${voice.lang}`;
}

/**
 * The automatic gender heuristic (see ttsHelper.js) is best-effort, since
 * SpeechSynthesis exposes no real gender field and voice-name conventions
 * vary by device. This panel lets the user pin an exact installed voice
 * per language + gender so playback is always correct on their device,
 * regardless of how the voice happens to be named.
 */
export default function VoiceSettingsModal({ open, onClose }) {
  const [allVoices, setAllVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  // { "en-male": "Voice Name::en-US", ... } — '' / undefined means Auto
  const [overrides, setOverrides] = useState({});
  const [testingKey, setTestingKey] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingVoices(true);

    loadVoices().then((voices) => {
      if (cancelled) return;
      setAllVoices(voices || []);
      setLoadingVoices(false);

      const initial = {};
      ROWS.forEach(({ lang, gender }) => {
        const stored = getVoiceOverride(lang, gender);
        if (stored) initial[`${lang}-${gender}`] = stored;
      });
      setOverrides(initial);
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    // Stop any test playback if the panel is closed mid-preview.
    if (!open) stopSpeaking();
  }, [open]);

  const voicesByLang = useMemo(() => ({
    en: getVoicesForLanguage(allVoices, 'en'),
    hi: getVoicesForLanguage(allVoices, 'hi'),
  }), [allVoices]);

  if (!open) return null;

  const handleChange = (lang, gender, value) => {
    const key = `${lang}-${gender}`;
    setOverrides((prev) => ({ ...prev, [key]: value }));

    if (!value) {
      setVoiceOverride(lang, gender, null);
      return;
    }
    const matched = voicesByLang[lang].find((v) => voiceId(v) === value);
    setVoiceOverride(lang, gender, matched || null);
  };

  const handleTest = (lang, gender) => {
    const key = `${lang}-${gender}`;
    const selectedId = overrides[key];
    const candidates = voicesByLang[lang];
    const voice = selectedId
      ? candidates.find((v) => voiceId(v) === selectedId)
      : candidates.find((v) => guessGenderForVoice(v) === gender) || candidates[0];

    if (!voice) return;
    setTestingKey(key);
    speakWithVoice(SAMPLE_TEXT[lang], voice, lang, {
      onEnd: () => setTestingKey(null),
      onError: () => setTestingKey(null),
    });
  };

  return (
    <div className="fixed inset-0 bg-[#FFFFFF]/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
      <div className="w-full max-w-md bg-vk-surface border border-[#2A3155] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] relative animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-vk-border flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-vk-white">Voice Settings</h3>
            <p className="text-[11px] text-vk-text-muted font-body mt-0.5">
              Choose exactly which voice reads messages aloud for each sender gender.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-vk-text-muted hover:text-vk-white text-sm font-bold bg-vk-elevated w-7 h-7 rounded-full flex items-center justify-center border border-[#2A3155] shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {loadingVoices ? (
            <p className="text-xs text-vk-text-muted font-body">Loading available voices…</p>
          ) : (
            ROWS.map(({ lang, gender, label }) => {
              const key = `${lang}-${gender}`;
              const candidates = voicesByLang[lang];
              return (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs uppercase font-bold text-vk-text-muted block tracking-wide font-body">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={overrides[key] || ''}
                      onChange={(e) => handleChange(lang, gender, e.target.value)}
                      className="flex-1 bg-vk-bg border border-vk-border rounded-xl px-3 py-2 text-xs text-vk-white focus:outline-none focus:border-vk-primary font-body"
                    >
                      <option value="">Auto (recommended)</option>
                      {candidates.map((v) => (
                        <option key={voiceId(v)} value={voiceId(v)}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleTest(lang, gender)}
                      disabled={candidates.length === 0}
                      title="Test this voice"
                      className="shrink-0 px-3 py-2 rounded-xl text-xs font-display font-bold bg-vk-primary/15 border border-vk-primary/30 text-[#6C3CFF] hover:bg-vk-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {testingKey === key ? '▶ …' : '▶ Test'}
                    </button>
                  </div>
                  {candidates.length === 0 && (
                    <p className="text-[10px] text-vk-text-muted font-body">
                      No {lang === 'hi' ? 'Hindi' : 'English'} voices found on this device/browser.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-3 border-t border-vk-border">
          <p className="text-[10px] text-vk-text-muted font-body">
            Saved on this device/browser only. "Auto" uses the best guess VibeKey can make from the voice's name.
          </p>
        </div>
      </div>
    </div>
  );
}
