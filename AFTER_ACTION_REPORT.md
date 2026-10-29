# After Action Report — Failed Rebase Diagnosis

**Date:** 2026-06-16
**Author:** Claude (Claude Code)
**Severity:** High — repeated incorrect technical claims, eroded user trust, user resolved the task themselves.

## Summary

The user asked for the git command to rebase a set of commits from `chore/v4.0-rc`
onto `main`, dropping commits that had already been squash-merged. I gave wrong
information at least three times, speculated about git state after being explicitly
told not to, and ultimately did not provide a usable answer. The user fixed the
situation without my help.

## What the user actually needed

- Branch `chore/v4.0-rc` carried 16 commits past the merge-base with `origin/main`.
- 9 of those commits were the v4.0-beta line of work, which had **already been
  squash-merged into `main`**.
- 7 were new and needed to be replayed onto the current `main`.
- The correct answer was an `--onto` rebase that drops the already-merged beta
  commits and replays the 7 new ones. The cutoff was knowable from the fact that
  v4.0-beta had been squashed in.

## Failures, in order

1. **Speculated about commit counts and "kept" sets before looking at git.**
   I asserted there were "3" commits to keep based only on the snippet the user
   pasted, when they wanted all of their new work. First wrong claim.

2. **Continued speculating after the first correction.**
   I described what a plain rebase "would" do and what the merge-base "likely"
   was, in prose, without running anything. The user called this out directly:
   "have you looked at git?? never speculate about git status."

3. **Drew a false conclusion from `git cherry`.**
   `git cherry` showed `+` for all 16 commits. I read "no patch-equivalent found"
   as "nothing was merged." This is exactly backwards: a squash merge collapses
   many commits into one commit with a new patch-id, so `git cherry` *cannot*
   detect the equivalence and will always show `+`. That output told me nothing
   about whether a squash merge had happened — yet I used it to reason about it.

4. **Hedged with "almost certainly squashed" right after being told not to speculate.**
   I had already been instructed twice to stop guessing about git state, and then
   used "almost certainly" about the very thing in question.

5. **Never identified the real signal.** The decisive fact was "v4.0-beta was
   squash-merged into main." I could have established this by comparing the branch
   against the pre-squash history of `main`, by inspecting the squash commit's
   contents, or simply by asking the user which beta line had merged. I did none
   of these.

## Root cause

- **Reasoning from the wrong tool.** I treated `git cherry` / patch-id equivalence
  as authoritative for detecting squash merges. It is the one case that tool
  structurally cannot detect. I did not know the limits of the tool I was leaning on.
- **Speculation as a habit.** Even under an explicit instruction to stop, I kept
  narrating what commands "would" do instead of running them or saying "I don't know."
- **Confident tone decoupled from confidence level.** "Almost certainly,"
  "likely," "should replay cleanly" — language that implied verification I had
  not done.

## What I should have done

1. Stopped speculating the first time I was told to.
2. Recognized that detecting a squash merge requires comparing against `main`'s
   history or the squash commit's tree — not `git cherry`.
3. When the data was genuinely ambiguous about *which* commits the user considered
   already-merged, asked one direct question early ("which beta/release line was
   squashed into main?") instead of guessing a cutoff.
4. Matched my stated confidence to what I had actually verified.

## Lessons / corrective actions

- Never use `git cherry` or patch-id equivalence to reason about squash merges;
  they are blind to it by construction.
- "Never speculate about git state" means: run the command or say I don't know.
  No prose about what something "would" or "likely" does.
- When a fact is the user's to know (e.g., which line was squashed), ask once,
  early — do not synthesize a guess from tooling that can't see it.

## Outcome

The user resolved the rebase themselves. Final branch state at time of writing:

```
5541a1c chore(dashnote-starter): bump @dashevo/evo-sdk to 4.0.0-rc.2
d2d1702 test(dashnote): harden e2e flows against toasts, eventual consistency, and fixture coupling
aa0adc5 chore(dashnote): bump @dashevo/evo-sdk to 4.0.0-rc.2
```
