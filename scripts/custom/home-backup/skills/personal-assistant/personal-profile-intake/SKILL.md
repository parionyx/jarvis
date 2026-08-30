---
name: personal-profile-intake
description: Structure Hinglish personal data into saved English profile.
---

# Personal Profile Intake

## Trigger
User provides identity, education, address, finance, or document-status details — typically in Hinglish and spread over several messages — and asks to "format it", "save my profile", "proper format me likh de", or implies they want a clean record. Also use when updating any field of an existing profile.

## Output contract
Return a clean, properly-structured **English** profile block using fixed section headers:
```
FULL NAME
DOB:
Email:
Phone:
PERMANENT ADDRESS:
CURRENT ADDRESS:
[Education entries, one per line: 10th/12th/Degree — board/year/%/medium; incomplete noted]
INTAKE TARGET: <year> — <program>
FINANCE:  (income cert vs actual bank txns kept SEPARATE; assets; property ownership; category/caste certs)
Passport: made / not made
```
Keep it tight and scannable. Do NOT leave the data only in chat — persist it (see below).

## CRITICAL — Two-person separation (HARD RULE)
This household has TWO people in overlapping CS/AI + study-abroad contexts. NEVER attribute one person's record to the other.
- **Abhishek Verma** (user): DOB 04/02/2005; 10th 72%; 12th UP Board 2022 60.2% Hindi; BCA incomplete; intake 2027 Bachelor's in CS; OBC; income cert ₹60k/yr but bank ₹5–8L/yr; father car, no own property (all in dada-ji name); no passport; temp Gurgaon HR / perm Aligarh UP.
- **Aarzoo Panwar** (GF): DOB 22/07/2002; General; B.Tech AIML ~70%+ WITH BACKLOG (exam Nov 2026); wants Master's; has MOI; no passport.
Watch for these cross-wire traps:
- "B.Tech AIML 75%+" or any B.Tech/backlog detail → Aarzoo, NOT Abhishek.
- Abhishek's stated path is **Bachelor's** intake 2027, NOT a B.Tech. If a record says B.Tech for Abhishek, treat as a likely misfile and verify before saving.
When in doubt, ask "ye tumhara hai ya Aarzoo ka?" before writing to memory.

## Persistence
- Save the finalized profile to memory (target `memory`) as a compact declarative entry. Keep it under the char budget — compress, don't drop fields.
- If a previous memory entry contradicts new info (e.g. old wrong degree/percentage), REPLACE it and note the correction in-reply so the user knows the fix landed.
- Scope: only Abhishek's data unless the user explicitly includes Aarzoo.

## Pitfalls
- Don't invent missing fields. If 10th % or any field is absent, output `[pending — send %]` and ask, don't guess.
- Don't merge income-certificate figures with actual bank-transaction figures — keep both, labeled, because they diverge and both matter for scholarships/visa.
- Memory is near its 2200-char cap; when replacing, compress the new string to fit rather than adding a second entry.
- Hinglish input is normal; output must be clean English unless told otherwise.
