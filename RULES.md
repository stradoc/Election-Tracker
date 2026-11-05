# Project Rules

These are the working rules for TippingPoint, set by the project owner. They apply to every
contributor, human or AI agent. This file is the only place they are written down. Other docs
link here instead of repeating them.

---

## 1. No commits or pushes without a change list and summary

- Commit or push only when the owner asks.
- Every commit or push comes with:
  - a **list of changes** (files added / changed / removed, one line each), and
  - a **short summary** of what the work does and why.
- Give the list and summary to the owner in chat when the commit is made, and put the same
  summary in the commit message body.
- Don't commit straight to `main`. Work on a feature branch (for example
  `phase-1-foundation`) and merge only when asked.

## 2. Don't touch files outside this directory

- Everything this project reads or writes stays inside the repository folder.
- No global installs (`npm i -g`, `pip install --user`, system packages).
  - Dependencies go in the workspace `node_modules/`.
  - npm's cache and logs are redirected to `./.npm-cache` by the project `.npmrc`. Don't
    remove that setting.
- Downloaded data goes to `data/raw/<source>/`. Generated data goes to `data/processed/`.
- No writing to home-directory configs, global git config, editor settings, or agent memory
  folders outside the repo. Notes for the next contributor go in `CHANGELOG.md` and `AGENTS.md`.
- Temporary files go in a gitignored folder inside the repo (`.tmp/`), not `/tmp`.

## 3. Streamlined and modular: pipelines, not visuals at any cost

- **Each feature has exactly one implementation.** If something is rewritten, delete the old
  version in the same change. No `v2` files, no dead code paths kept around just in case.
- New data comes in through the **pipeline** (`scripts/data`): source → normalize → join →
  derive → emit. The UI only displays what the pipeline produced. It never quietly fixes data.
- Adding a year, office, data source, or analysis means adding an entry to a **registry** and
  one module. It never means copying an existing feature and editing it.
- Shared math (swing, electoral votes, ratings, colors) lives once, in `packages/shared`, and
  is imported everywhere else.
- A good-looking feature with untraceable data is not done. Every number on screen can be
  traced to a source listed in the pipeline.

## 4. Readable, commented, visible code

- Every file starts with a header comment saying **what it does** and **where it sits** in
  the pipeline or app.
- Every exported function, type, and component has a JSDoc comment.
- Comments explain _why_ (data quirks, design decisions), not just _what_.
- Prefer plain, explicit code over clever one-liners. Name things for what they mean.
- Configuration lives in visible files in the repo, not hidden in environment variables:
  - The registries are TypeScript.
  - The reference tables they load are JSON in `packages/shared/data/`, so numbers like
    electoral votes are data, not literals in code.
  - `.env` is only for secrets such as API keys.

## 5. Keep `CHANGELOG.md` and agent instructions current

- Every change adds a dated entry to the top of `CHANGELOG.md` with:
  - **Changed:** what was done
  - **Files:** files added, changed, or removed
  - **Next steps / open issues:** what the next person should pick up
- When a feature is added, update `AGENTS.md` (the architecture map and the "how to add …"
  recipes) so another agent can read it and continue the work without re-reading the code.
- If the docs and the code disagree, fix the docs in the same change.
