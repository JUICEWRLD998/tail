// Offline voice: Piper (https://github.com/OHF-Voice/piper1-gpl) through lib/piper_synth.py.
// Needs PIPER_PY (a python with `pip install piper-tts`) and PIPER_MODEL (a .onnx voice, e.g. en_US-hfc_female-medium
// from huggingface.co/rhasspy/piper-voices). Returns { audio: Buffer(mp3), words: [{ text, start, end }] } like edge-tts.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function piperAvailable() {
  return Boolean(process.env.PIPER_PY && process.env.PIPER_MODEL && fs.existsSync(process.env.PIPER_MODEL));
}

export async function piperSpeak(text, { lengthScale = 1.12 } = {}) {
  if (!piperAvailable()) throw new Error('set PIPER_PY and PIPER_MODEL to use the piper voice');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'piper-'));
  const wav = path.join(tmp, 'v.wav'), json = path.join(tmp, 'w.json'), mp3 = path.join(tmp, 'v.mp3');
  const r = spawnSync(process.env.PIPER_PY, [path.join(here, 'piper_synth.py'), process.env.PIPER_MODEL, wav, json, String(lengthScale)], { input: text, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`piper failed: ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  // A touch of high-pass and compression makes the small voice sit like a recorded narrator, not a synth.
  const f = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-af', 'highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=8:release=120,loudnorm=I=-16:TP=-1.5', '-ar', '44100', '-b:a', '160k', mp3]);
  if (f.status !== 0) throw new Error('ffmpeg could not encode the voice');
  const out = { audio: fs.readFileSync(mp3), words: JSON.parse(fs.readFileSync(json, 'utf8')) };
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}
