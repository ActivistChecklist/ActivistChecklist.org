# Claude rueles

## General rules

* Use yarn to manage packages

## Git commit rules

* For each session, ask if I want to do the commits manually or I want you to do them automatically
* Do not use stash unless you have to
* Do not commit directly to main to main
* Always commit in this way: check if we're already on a dev/NAME feature branch. If not, open one. Commit changes. DO NOT include claude's name int the commit message. Do not merge into main. I will do that later on GH. If you need to use one branch for multiple different changes, thats fine. Doesnt matter if the branch name isn't perfect for the tasks at hand.
* Never include Claude's name in the commit
* Never include "Co-authored-by" lines in commits (e.g., "Co-authored-by: Cursor <...>")
