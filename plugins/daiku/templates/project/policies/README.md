# Area policies

A file in here carries the **architectural rules of one part of the project**: the boundaries
between layers, the allowed direction of dependencies, the conventions a review must be able to
verify. Universal invariants live in the project's instructions file; what belongs here is what
holds for one area only.

The file name is free and describes the area (`backend-architecture.md`, `dependency-flow.md`).
What is not free is the frontmatter: **every file declares `paths`**, the list of patterns it
covers. That is the address a skill uses to decide whether to open it, and a file without `paths`
is never opened by anyone.

```markdown
---
paths:
  - "<pattern covering the area's sources>"
  - "<pattern covering its tests>"
---

# <Area name>

…
```

A rule is written as a **verifiable invariant**, not as advice: "layer X never imports Y"
translates into a check, "keep the backend clean" does not. Whoever reads these rules re-reads
them on every run and does not trust a memorised list: if the text changes, what gets verified
changes with it.

The name `policies/` is not a fancy synonym for `rules/`: on Codex, `rules/` is already a host
security concept — Starlark files governing command execution — and reusing that name would
collide two things that have nothing to do with each other.

Shape, citation convention and the degradation rule live in `contracts/project-contract.md`.
