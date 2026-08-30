# Notion Database Audit Template

## Audit Structure (13 Parts)

### Part 1 — Database Audit
| Database | Purpose | Keep/Rename/Merge/Remove | Reason |
|---|---|---|---|

### Part 2 — Property Audit (per database)
| Current Property | Type | Keep/Rename/Remove | Recommended Name | Reason |

Classify: KEEP / RENAME / REMOVE / OPTIONAL / MISSING

### Part 3 — Source of Truth
| Information | Source of Truth | Why |

### Part 4 — Relation Audit
| Relation | Keep/Remove | Reason |

### Part 5 — Rollup Audit
| Rollup | Useful? | Used? | Calc Correct? | Name Clear? | Keep? |

### Part 6 — Data Quality
| Problem | Affected | Recommended Fix |

### Part 7 — Naming Simplification
| Current | Recommended | Reason |

### Part 8 — Minimal Database Architecture
CURRENT → RECOMMENDED → OPTIONAL → REMOVE/MERGE

### Part 9 — Minimal Property Architecture
Per database: Required / Optional properties

### Part 10 — User Workflow Test
Scenario simulations with exact steps

### Part 11 — Dashboard Audit
KEEP / REMOVE / RENAME / ADD / REORDER

### Part 12 — Future Expansion
Multi-entity support without new DBs

### Part 13 — Final Recommendation
A. KEEP EXACTLY AS IS
B. RENAME
C. REMOVE/MERGE
D. ADD PROPERTY
E. ADD RELATION
F. REMOVE RELATION
G. KEEP OPTIONAL
H. DASHBOARD CHANGES

## Principles (Embedded in Skill)
- **Minimal** — prefer fewer DBs, fewer properties
- **Relational** — one source of truth, relations over duplication
- **Scalable** — generic names for multi-entity support
- **Conservative** — never delete legacy, skip ambiguous
- **Read-only first** — audit before any changes