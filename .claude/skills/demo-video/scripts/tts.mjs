#!/usr/bin/env node
// Step 1 of the pipeline: synthesise the voice-over per scene and fix the timeline.
// usage: node tts.mjs [demoDir] [--force] [--skip-story]
// Provider: plan.voice.provider = "edge" (default, free) | "elevenlabs" (needs ELEVENLABS_API_KEY) | "piper" (offline; needs
// PIPER_PY and PIPER_MODEL, see lib/piper-tts.mjs). Without a key, piper is used when it is set up, else edge.
// Writes build/audio/<id>.mp3 + <id>.words.json and timeline.json { voDur, lead, target }.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { edgeSpeak } from './lib/edge-tts.mjs';
import { piperAvailable, piperSpeak } from './lib/piper-tts.mjs';
import { checkStory, printStory } from './lib/story.mjs';
import { demoDir, duration, loadPlan, loadTimeline, readJSON, saveTimeline, wordCount, writeJSON } from './lib/util.mjs';

const dir = demoDir(process.argv.slice(2).find((a) => !a.startsWith('--')));
const force = process.argv.includes('--force');
const plan = loadPlan(dir);
// Voice costs time; a plan that does not tell the story gets fixed first.
if (!process.argv.includes('--skip-story')) {
  const story = checkStory(plan);
  printStory(story);
  if (story.fails.length) { console.log('\nfix the story in plan.json first (or pass --skip-story to voice it anyway)'); process.exit(1); }
}
const voice = {
  provider: process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : piperAvailable() ? 'piper' : 'edge',
  piperLengthScale: 1.12,
  edgeVoice: 'en-US-AvaMultilingualNeural', rate: '-4%', pitch: '+0Hz',
  elevenVoice: '21m00Tcm4TlvDq8ikWAM', elevenModel: 'eleven_multilingual_v2',
  lead: 0.6, tail: 0.5,
  ...plan.voice,
};
const audioDir = path.join(dir, 'build', 'audio');
fs.mkdirSync(audioDir, { recursive: true });
const tl = loadTimeline(dir);

async function eleven(text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenVoice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: voice.elevenModel, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } }),
  });
  if (!r.ok) throw new Error(`elevenlabs ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const a = j.alignment;
  const words = [];
  let cur = null;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) { if (cur) words.push(cur); cur = null; continue; }
    if (!cur) cur = { text: '', start: a.character_start_times_seconds[i], end: 0 };
    cur.text += ch;
    cur.end = a.character_end_times_seconds[i];
  }
  if (cur) words.push(cur);
  return { audio: Buffer.from(j.audio_base64, 'base64'), words };
}

let total = 0, words = 0;
for (const s of plan.scenes) {
  const text = (s.say || s.vo || '').trim();
  const lead = s.lead ?? voice.lead;
  const tail = s.tail ?? voice.tail;
  const entry = (tl.scenes[s.id] ||= {});
  if (!text) {
    Object.assign(entry, { voFile: null, voDur: 0, lead: 0, words: [], target: s.hold ?? 2 });
  } else {
    const key = crypto.createHash('sha1').update(JSON.stringify([text, voice.provider, voice.edgeVoice, voice.rate, s.rate, voice.pitch, voice.elevenVoice, voice.piperLengthScale, process.env.PIPER_MODEL])).digest('hex').slice(0, 12);
    const mp3 = path.join(audioDir, `${s.id}.mp3`);
    const wj = path.join(audioDir, `${s.id}.words.json`);
    if (force || entry.key !== key || !fs.existsSync(mp3)) {
      const r = voice.provider === 'elevenlabs'
        ? await eleven(text)
        : voice.provider === 'piper'
          ? await piperSpeak(text, { lengthScale: s.lengthScale ?? voice.piperLengthScale })
          : await edgeSpeak(text, { voice: voice.edgeVoice, rate: s.rate || voice.rate, pitch: voice.pitch });
      fs.writeFileSync(mp3, r.audio);
      writeJSON(wj, r.words);
      process.stdout.write(`  voiced ${s.id}\n`);
    }
    const voDur = duration(mp3);
    Object.assign(entry, { key, voFile: path.relative(dir, mp3).replaceAll('\\', '/'), voDur, lead, words: readJSON(wj, []), target: +(lead + voDur + tail + (s.hold || 0)).toFixed(3) });
  }
  // A scene only needs re-recording when its length changed (new words or a new voice). Unchanged scenes keep their clip.
  if (entry.recordedTarget !== entry.target) delete entry.dur;
  total += entry.target;
  words += wordCount(s.vo);
}

const T = plan.transition ?? 0.5;
const max = plan.targetSeconds || 120;
const runtime = total - T * (plan.scenes.length - 1);
saveTimeline(dir, tl);
console.log(`\n${plan.scenes.length} scenes, ${words} words, est. runtime ${runtime.toFixed(1)}s (max ${max}s)`);
for (const s of plan.scenes) console.log(`  ${s.id.padEnd(18)} ${tl.scenes[s.id].target.toFixed(1).padStart(5)}s  ${(s.vo || '').slice(0, 70)}`);
if (runtime > max) { console.log(`\nOVER by ${(runtime - max).toFixed(1)}s: cut words, do not speed the voice up.`); process.exitCode = 3; }
