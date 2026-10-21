## Description: <br>
Attacker red-teams skills, designs, arguments, code, or knowledge bases through five independent lenses, reporting proven findings and flags without modifying the target. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[vincentjiang06](https://clawhub.ai/user/vincentjiang06) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
Developers, reviewers, and agent operators use this skill to run an independent critique pass against a target and separate reproducible findings from lower-confidence flags. It is intended for red-team review and audit handoff, not for repairing the target. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The skill may propose reproduction commands while attacking a target. <br>
Mitigation: Review commands before execution, especially on sensitive repositories or systems. <br>
Risk: The Evidence lens may use web search, which can expose target details if confidential material is included in queries. <br>
Mitigation: Use an internal-only evidence pass for confidential targets and record the reduced coverage in coverage_gaps. <br>
Risk: Findings and ledger records may contain sensitive project information. <br>
Mitigation: Write findings only to approved local or repository locations and review access controls before sharing. <br>


## Reference(s): <br>
- [ClawHub skill page](https://clawhub.ai/vincentjiang06/skills/attacker) <br>
- [PROVE-OR-FLAG rubric](artifact/references/prove-or-flag.md) <br>
- [Seed recipes](artifact/references/seed-recipes.md) <br>
- [Fix-audit rotation](artifact/references/fix-audit.md) <br>
- [Output schema](artifact/schemas/output.json) <br>


## Skill Output: <br>
**Output Type(s):** [Text, Markdown, Shell commands, Configuration, Guidance] <br>
**Output Format:** [JSON matching artifact/schemas/output.json, with Markdown formats in lens-specific prompts] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [Includes findings, flags, stop reason, coverage gaps, and notes about unmet coverage or independence requirements.] <br>

## Skill Version(s): <br>
0.7.0 (source: server release evidence and skill frontmatter) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
