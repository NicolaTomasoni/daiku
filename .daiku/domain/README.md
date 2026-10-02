# Domain context for the skills

A file in here is named after the **role** a skill cites (`.daiku/domain/<role>.md`): the file
name is the address, the content is this project's domain and judgement. Whoever writes here
answers a question a skill asks; whoever reads a skill never finds the answer written twice.

**Everything in this folder is yours.** The first time `/init` runs, it writes a role here as a
pointer to the file where your project already answers it, or drops the package's default where
there is one and your project has no answer; it never touches them again: no package update
overwrites what you changed. If a default does not suit you, rewrite it. If you delete it, the skill that cites it
degrades and says so — it does not break.

Shape, citation convention and the degradation rule live in the Daiku package, in its `contracts/project-contract.md`.

## The roles this package's skills cite

None is mandatory: a skill that does not find its domain file **does less** and declares it in its
report (§6 of the package's project contract). This table says which question each file answers — the answer is not
here, and that is the point.

| Role | Which question it answers | Who asks | Default |
|---|---|---|---|
| `commit-convention.md` | which commit types this project allows and when each is used, what shape a message has, what goes into the changelog, which version bump is allowed | `commit` | **yes** |
| `changelog.md` | what a version section of the changelog looks like, and which release references get aligned when a new one appears | `commit` | no |
| `memory-contract.md` | which shapes a memory may take, how the corpus is mutated, when the index is updated, and which artefact owns what | `update-memory` | **yes** |
| `test-strategy.md` | what the macro-categories are, how to read the output of the measurement commands, what each runner actually covers, which conventions the existing tests follow, and from which structural strength each layer is tested | `test-coverage` | no |
| `perf.md` | which technologies occupy the levels the investigation inspects and where each one pays, which costs show up at rest, and how the runtime is observed | `perf` | no |

**Why those two have a default.** A commit convention is fine until it annoys you, and starting
from a written one beats starting from nothing. The memory contract is there for a harder reason:
that corpus has two writers from day one — the host, which writes on its own initiative, and
`/update-memory` on every commit — and without a shape declared somewhere they diverge within the
first week, in the same folder, with nobody noticing. Neither file depends on your stack, which is
what makes shipping them honest.

Test macro-categories and performance hot spots do depend on it, and on your architecture: a
default there would be an invention dressed up as a rule, and the right thing is for it to be
missing until you write it.

A new role appears when a new skill asks a new question: add the row here and the citation in the
skill, in the form of §5.4 of the package's project contract — never the content inside the skill.
