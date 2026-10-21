#!/usr/bin/env node
// Step 3b: check that plan.json tells the story (hook, problem, solution, demo, proof, close) before
// any voice is generated. tts.mjs runs the same check and stops on a FAIL. Exit 1 on a FAIL.
// usage: node story.mjs [demoDir]
import { checkStory, printStory } from './lib/story.mjs';
import { demoDir, loadPlan } from './lib/util.mjs';

const r = checkStory(loadPlan(demoDir(process.argv[2])));
printStory(r);
process.exitCode = r.fails.length ? 1 : 0;
