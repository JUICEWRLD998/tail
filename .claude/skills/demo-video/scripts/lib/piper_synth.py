#!/usr/bin/env python3
"""Offline neural voice for the demo-video skill (Piper). Reads text on stdin, writes a 22.05 kHz mono WAV and a JSON list
of words with estimated start/end seconds.

Piper exposes no per-word timing for most voices, so timing is estimated from the phonemes it spoke: each sentence is
synthesised as its own chunk (its real duration is known), and inside a chunk each word gets its share of the speech time
by phoneme count (long vowels and stress marks weigh more), with commas and full stops weighing as pauses.
usage: piper_synth.py MODEL.onnx OUT.wav OUT.json [length_scale] < text
"""
import json, re, sys, wave
from piper import PiperVoice, SynthesisConfig

model, out_wav, out_json = sys.argv[1:4]
length_scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.12
text = sys.stdin.read().strip()
voice = PiperVoice.load(model)
cfg = SynthesisConfig(length_scale=length_scale)

PAUSE = {',': 3.0, ';': 4.0, ':': 4.0, '.': 6.0, '!': 6.0, '?': 6.0, '—': 3.0}
def weight(ph: str) -> float:
    if ph in PAUSE: return PAUSE[ph]
    if ph == 'ˈ' or ph == 'ˌ': return 0.0
    if ph == 'ː': return 0.8
    return 1.0

samples, chunks = [], []
rate = 22050
for ch in voice.synthesize(text, cfg):
    rate = ch.sample_rate
    chunks.append((len(samples), ch.phonemes, len(ch.audio_int16_array)))
    samples.extend(ch.audio_int16_array.tolist())

with wave.open(out_wav, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    import array
    w.writeframes(array.array('h', samples).tobytes())

# words in order, as written (so captions match the script exactly)
written = re.findall(r"[^\s]+", text)
words, wi = [], 0
for offset, phonemes, n in chunks:
    t0, dur = offset / rate, n / rate
    # split this chunk's phonemes into word groups at spaces; trailing punctuation belongs to the word before it
    groups, cur = [], []
    for ph in phonemes:
        if ph == ' ':
            if cur: groups.append(cur); cur = []
        else:
            cur.append(ph)
    if cur: groups.append(cur)
    ws = [sum(weight(p) for p in g) for g in groups]
    total = sum(ws) or 1.0
    t = t0
    for g, wgt in zip(groups, ws):
        d = dur * wgt / total
        if wi < len(written):
            words.append({'text': written[wi], 'start': round(t, 3), 'end': round(t + d, 3)})
            wi += 1
        t += d
# if phonemisation merged or split words differently from the text, spread any leftover words across the tail
while wi < len(written):
    last = words[-1]['end'] if words else 0.0
    words.append({'text': written[wi], 'start': last, 'end': last + 0.2}); wi += 1
json.dump(words, open(out_json, 'w'))
print(len(samples) / rate)
