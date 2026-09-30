/**
 * Speech-to-text for describing meals by voice.
 * - Android app: the system recogniser via @capacitor-community/speech-recognition (no Web Speech API in the WebView).
 * - Browsers with Web Speech (Chrome, Edge): SpeechRecognition.
 * - Elsewhere (Windows/Tauri WebView2): record audio and transcribe with Gemini or OpenAI, if that key is set.
 */
import type { AiProviderId, Settings } from '@/db/types';
import { isNativeApp } from './platform';

export type SpeechMethod = 'native' | 'web' | 'record' | 'none';
export type SpeechLang = Exclude<Settings['voiceLanguage'], 'auto'>;

export interface ListenOptions {
  lang: SpeechLang;
  onPartial?: (text: string) => void;
  /** final transcript (may be empty) */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  /** for the record-and-transcribe fallback */
  provider: AiProviderId;
  apiKey?: string;
}

export interface SpeechSession {
  stop: () => void;
}

type WebRecognitionCtor = new () => {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};

function webRecognition(): WebRecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: WebRecognitionCtor; webkitSpeechRecognition?: WebRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Device language mapped to a supported recognition language. */
export function resolveLang(setting: Settings['voiceLanguage']): SpeechLang {
  if (setting !== 'auto') return setting;
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  return nav.startsWith('bg') ? 'bg-BG' : nav.startsWith('nl') ? 'nl-NL' : 'en-US';
}

export function speechMethod(provider: AiProviderId, apiKey?: string): SpeechMethod {
  if (isNativeApp()) return 'native';
  if (webRecognition() && !('__TAURI_INTERNALS__' in window)) return 'web';
  const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  // Claude has no audio input, so recording only helps with a Gemini or OpenAI key.
  if (canRecord && apiKey && (provider === 'gemini' || provider === 'openai')) return 'record';
  return 'none';
}

export async function startListening(o: ListenOptions): Promise<SpeechSession> {
  const method = speechMethod(o.provider, o.apiKey);
  if (method === 'native') return startNative(o);
  if (method === 'web') return startWeb(o);
  if (method === 'record') return startRecording(o);
  throw new Error('Voice input needs Chrome, the Android app, or a Gemini/OpenAI key on this device.');
}

/** Joins recognised segments into one transcript without doubled spaces. */
export function joinSegments(segments: string[]): string {
  return segments.map((s) => s.trim()).filter(Boolean).join(' ');
}

/** Recognisers end a session after a short pause; restart until the user taps Stop, up to this many times. */
const MAX_RESTARTS = 30;
/** Two silent sessions in a row end listening on their own. */
const MAX_SILENT = 2;

/**
 * Android's recogniser stops after about a second of silence, which used to cut a description off at
 * the first pause. Each session's text is kept as a segment and listening restarts until Stop.
 */
async function startNative(o: ListenOptions): Promise<SpeechSession> {
  const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
  if (!(await SpeechRecognition.available()).available) throw new Error('Speech recognition is not available on this phone.');
  let perm = await SpeechRecognition.checkPermissions();
  if (perm.speechRecognition !== 'granted') perm = await SpeechRecognition.requestPermissions();
  if (perm.speechRecognition !== 'granted') throw new Error('Allow microphone access for MacroTrack to describe meals by voice.');
  const segments: string[] = [];
  let current = '';
  let done = false;
  let userStopped = false;
  let silent = 0;
  let restarts = 0;
  const commit = () => {
    if (current.trim()) { segments.push(current); silent = 0; } else silent++;
    current = '';
  };
  const finish = async () => {
    if (done) return;
    done = true;
    if (current.trim()) segments.push(current);
    await SpeechRecognition.removeAllListeners();
    o.onFinal(joinSegments(segments));
  };
  const listen = () => {
    SpeechRecognition.start({ language: o.lang, partialResults: true, popup: false, maxResults: 1 }).catch((e: unknown) => {
      if (done) return;
      // "No match" after silence is not a failure: it just means nothing (more) was said.
      if (restarts > 0 || segments.length > 0 || /no match|didn't understand|^7$/i.test(String(e instanceof Error ? e.message : e))) { void finish(); return; }
      done = true;
      void SpeechRecognition.removeAllListeners();
      o.onError(e instanceof Error ? e.message : 'Speech recognition failed.');
    });
  };
  await SpeechRecognition.addListener('partialResults', (d) => {
    current = d.matches?.[0] ?? current;
    o.onPartial?.(joinSegments([...segments, current]));
  });
  await SpeechRecognition.addListener('listeningState', (d) => {
    if (d.status !== 'stopped' || done) return;
    commit();
    if (userStopped || silent >= MAX_SILENT || restarts >= MAX_RESTARTS) { void finish(); return; }
    restarts++;
    listen();
  });
  listen();
  return { stop: () => { userStopped = true; void SpeechRecognition.stop().catch(() => undefined).finally(() => void finish()); } };
}

function startWeb(o: ListenOptions): SpeechSession {
  const Ctor = webRecognition()!;
  const rec = new Ctor();
  rec.lang = o.lang;
  rec.interimResults = true;
  rec.continuous = true;
  const segments: string[] = [];
  let session = '';
  let stopped = false;
  let failed = false;
  let silent = 0;
  let restarts = 0;
  rec.onresult = (e) => {
    session = Array.from(e.results).map((r) => r[0].transcript).join(' ');
    o.onPartial?.(joinSegments([...segments, session]));
  };
  rec.onerror = (e) => {
    // Silence and our own stop are normal ends; onend still delivers the text.
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    failed = true;
    o.onError(e.error === 'not-allowed' ? 'Allow microphone access to describe meals by voice.' : `Speech recognition error: ${e.error}`);
  };
  rec.onend = () => {
    if (failed) return;
    if (session.trim()) { segments.push(session); silent = 0; } else silent++;
    session = '';
    if (!stopped && silent < MAX_SILENT && restarts < MAX_RESTARTS) {
      restarts++;
      try { rec.start(); return; } catch { /* fall through to finishing */ }
    }
    o.onFinal(joinSegments(segments));
  };
  rec.start();
  return { stop: () => { stopped = true; rec.stop(); } };
}

async function startRecording(o: ListenOptions): Promise<SpeechSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    try {
      o.onPartial?.('Transcribing…');
      o.onFinal(await transcribe(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), o));
    } catch (e) {
      o.onError(e instanceof Error ? e.message : 'The recording could not be transcribed.');
    }
  };
  recorder.start();
  return { stop: () => recorder.state !== 'inactive' && recorder.stop() };
}

/** Speech-to-text through the user's provider key (Windows app and browsers without Web Speech). */
export async function transcribe(audio: Blob, o: Pick<ListenOptions, 'provider' | 'apiKey' | 'lang'>, fetcher: typeof fetch = fetch): Promise<string> {
  const key = o.apiKey?.trim();
  if (!key) throw new Error('Add a Gemini or OpenAI key in Settings for voice input on this device.');
  if (o.provider === 'openai') {
    const form = new FormData();
    form.append('file', audio, 'meal.webm');
    form.append('model', 'gpt-4o-mini-transcribe');
    form.append('language', o.lang.slice(0, 2));
    const r = await fetcher('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
    if (!r.ok) throw new Error(`Transcription failed (${r.status}).`);
    return ((await r.json()) as { text?: string }).text?.trim() ?? '';
  }
  if (o.provider === 'gemini') {
    const base64 = await blobToBase64(audio);
    const r = await fetcher('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: audio.type || 'audio/webm', data: base64 } }, { text: 'Transcribe this audio exactly, in the language spoken. Return only the transcript.' }] }] }),
    });
    if (!r.ok) throw new Error(`Transcription failed (${r.status}).`);
    const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? '';
  }
  throw new Error('Voice input on this device needs a Gemini or OpenAI key.');
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('The recording could not be read.'));
    reader.readAsDataURL(blob);
  });
}
