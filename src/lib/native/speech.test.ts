import { afterEach, describe, expect, it, vi } from 'vitest';
import { joinSegments, startListening } from './speech';

class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  interimResults = false;
  continuous = false;
  starts = 0;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() { FakeRecognition.last = this; }
  start() { this.starts++; }
  stop() { this.onend?.(); }
  say(text: string) {
    const result = Object.assign([{ transcript: text }], { isFinal: true });
    this.onresult?.({ results: [result] });
  }
}

afterEach(() => {
  delete (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
});

describe('voice input', () => {
  it('joins segments without doubled spaces', () => {
    expect(joinSegments([' 200 g rice ', '', 'and chicken'])).toBe('200 g rice and chicken');
  });

  it('keeps listening over a pause and returns the whole description once', async () => {
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
    const onFinal = vi.fn();
    const onError = vi.fn();
    const partials: string[] = [];
    const session = await startListening({ lang: 'en-US', provider: 'claude', onFinal, onError, onPartial: (t) => partials.push(t) });
    const rec = FakeRecognition.last;
    rec.say('I made a pot of rice');
    rec.onend?.(); // the browser ended the session after a pause
    expect(rec.starts).toBe(2);
    expect(onFinal).not.toHaveBeenCalled();
    rec.say('that serves four');
    expect(partials.at(-1)).toBe('I made a pot of rice that serves four');
    session.stop();
    expect(onFinal).toHaveBeenCalledOnce();
    expect(onFinal).toHaveBeenCalledWith('I made a pot of rice that serves four');
  });

  it('treats silence as the end, not an error', async () => {
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition = FakeRecognition;
    const onFinal = vi.fn();
    const onError = vi.fn();
    await startListening({ lang: 'en-US', provider: 'claude', onFinal, onError });
    const rec = FakeRecognition.last;
    rec.onerror?.({ error: 'no-speech' });
    rec.onend?.();
    rec.onerror?.({ error: 'no-speech' });
    rec.onend?.();
    expect(onError).not.toHaveBeenCalled();
    expect(onFinal).toHaveBeenCalledWith('');
  });
});
