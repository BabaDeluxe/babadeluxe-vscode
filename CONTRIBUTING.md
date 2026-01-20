# CONTRIBUTING

## Git Workflow for Solo Developers

This repository follows a professional Git workflow designed for solo developers. It ensures clean history, easy rollbacks, and compatibility with automated tooling.

### Branch Structure

- **master**: Production branch. Always deployable. Never commit directly here.
- **dev**: Staging branch. Collects finished features for the next release.
- **feat/**, **fix/**, **refactor/**, **chore/**, **docs/**, **test/**: Short-lived feature branches.

### Starting a New Feature

```bash
# Update dev
git switch dev
git pull origin dev

# Create feature branch with conventional prefix
git switch -c feat/my-feature-name        # New functionality
git switch -c fix/bug-description         # Bug fix
git switch -c refactor/cleanup-auth       # Code cleanup/performance
git switch -c chore/update-deps           # Maintenance/CI/build

# Work and commit
git add .
git commit -m "feat: :sparkles: Added Google OAuth login"
git push -u origin feat/my-feature-name
```

### Commit Message Rules

- **Format**: `gitmoji type(scope): Description`
- **Tense**: Past tense ("Added", "Fixed", "Refactored")
- **Capitalization**: Start with capital letter
- **Examples**:

  ```bash
  git commit -m "feat: :sparkles: Added Google OAuth login"
  git commit -m "fix: :bug: Corrected mobile menu overlap"
  git commit -m "refactor: :recycle: Refactored optimized database queries"
  git commit -m "chore: :wrench: Updated React to v19"
  ```

### Merging to Dev

```bash
git switch dev
git pull origin dev
git merge --no-ff feat/my-feature-name    # Creates merge commit
git push origin dev
git branch -d feat/my-feature-name
git push origin --delete feat/my-feature-name
```

**Never use rebase** on shared branches.

### Releasing to Master

When `dev` is ready for production:

```bash
git switch master
git pull origin master
# Open PR: dev → master
# Select "Squash and merge"
git switch master
git pull origin master
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0
```

### Emergency Hotfix

```bash
git switch master
git pull origin master
git switch -c hotfix/critical-bug
# Fix and commit
git push -u origin hotfix/critical-bug
# Open PR hotfix → master (squash merge)
git switch dev
git merge master
git push origin dev
```

### Allowed Types

| Type         | Gitmoji     | Commit? | Use For                                                   |
| ------------ | ----------- | ------- | --------------------------------------------------------- |
| **feat**     | :sparkles:  | Yes     | New features, initial commits, breaking changes (`feat!`) |
| **fix**      | :bug:       | Yes     | Bug fixes                                                 |
| **refactor** | :recycle:   | Yes     | Code cleanup, performance improvements                    |
| **chore**    | :wrench:    | Yes     | Dependencies, build config, CI changes                    |
| **docs**     | :memo:      | Yes     | Documentation updates                                     |
| **test**     | :test_tube: | Yes     | Adding tests                                              |
| **revert**   | :rewind:    | Yes     | Undoing commits                                           |

**Forbidden**: `ci`, `build`, `perf` (use `chore` or `refactor` instead), `style` (use `refactor` instead).

### Feature Branch Size

- **Good**: 1–3 days, 50–200 lines, one commit type
- **Too big**: Mixes types, touches unrelated files, takes >1 week
- **Rule**: If you need bullet points in the PR description, split it

### Glossary

**master**: Production branch. Always deployable, squash-merged only.
**dev**: Staging branch. Collects features via merge commits.
**feature branch**: Short-lived branch for one task (e.g., `feat/login`).
**hotfix**: Emergency branch from master.
**squash merge**: Combines all commits into one before merging to master.
**rebase**: Forbidden. Rewrites history.
