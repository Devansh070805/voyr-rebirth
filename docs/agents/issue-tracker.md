# Issue tracker

**Tracker:** GitHub Issues

**CLI:** `gh` (GitHub CLI)

**Repo:** `raioquantum-commits/Voyr`

---

## Commands

| Action           | Command                                             |
| ---------------- | --------------------------------------------------- |
| List open issues | `gh issue list`                                     |
| Create an issue  | `gh issue create --title "<title>" --body "<body>"` |
| View an issue    | `gh issue view <number>`                            |
| Close an issue   | `gh issue close <number>`                           |
| Add label        | `gh issue edit <number> --add-label "<label>"`      |
| Assign           | `gh issue edit <number> --assignee @me`             |

---

## Workflow

1. **Create** — via `gh issue create` or manually on GitHub
2. **Triage** — apply `needs-triage` → evaluate → reassign
3. **Develop** — `ready-for-agent` or `ready-for-human`
4. **Close** — `wontfix` or resolved + close
