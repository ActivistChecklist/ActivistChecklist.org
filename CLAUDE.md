# Claude rules

## General rules

* Use yarn to manage packages

## Git commit rules

* IMPORTANT: Do not do any automatic commits for this project unless explicitly instructed.
* Do not use stash unless you have to
* Do not commit directly to main
* Always commit in this way: check if we're already on a dev/NAME feature branch. If not, open one. Commit changes. DO NOT include claude's name int the commit message. Do not merge into main. I will do that later on GH. If you need to use one branch for multiple different changes, thats fine. Doesnt matter if the branch name isn't perfect for the tasks at hand.
* Never include Claude's name in the commit
* Never include "Co-authored-by" lines in commits (e.g., "Co-authored-by: Cursor <...>")

## Coding principles

* Always make sure to write code with security as a core principle. Don't be excessive (ex: lots of try/catch loops), but do use thinking time to consider how an attacker could mount a meaningful attack.
* Never hardcode secrets — use environment variables.
* Use parameterized queries — never interpolate into SQL.
* Use constant-time comparison for tokens and hashes.
* Never log secrets, tokens, or PII.
