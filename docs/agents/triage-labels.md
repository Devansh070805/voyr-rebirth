# Triage labels

Five canonical roles — each maps 1:1 to a GitHub label.

| Role            | Label string      | Meaning                              |
| --------------- | ----------------- | ------------------------------------ |
| Needs triage    | `needs-triage`    | Maintainer needs to evaluate         |
| Needs info      | `needs-info`      | Waiting on reporter for more details |
| Ready for agent | `ready-for-agent` | Fully specified, AFK-ready           |
| Ready for human | `ready-for-human` | Needs human implementation           |
| Won't fix       | `wontfix`         | Will not be actioned                 |

---

## State machine

```
[incoming] → needs-triage → needs-info → ready-for-agent → [closed]
                  ↓                                    ↓
              wontfix                          ready-for-human → [closed]
```
