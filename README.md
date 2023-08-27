<br />

![Logo](https://github.com/shimorojune/SqashMaster/blob/main/assets/images/transparent-logo.png?raw=true)

# SquashMaster

Extension to help quickly and reliably squash consecutive commits into one commit to improve commit history readability for features and bugs.
Features and bugs usually introduce multiple commits during the development process as checkpoints and thus, tend to pollute the commit history of a repository. By squashing all the commits of a feature or bug together into one commit before pushing to a remote repo, all changes relating to the feature or bug is trackable and cherry pickable with one commit Id.

## Features

- Squash "n" consecutive commits without dealing with soft resets.
- Automate the process of force updating remote repository or publishing new repositories post-squash.

## How to use

1. Install the extension.
2. Open command palette (`F1` key by default) and type `Squash Commits`.
3. List of all commits for current workspace would open up. Choose the commit upto which the squash operation has to be performed.
4. Enter the squashed commit message.
5. Squash process will initiate and complete, with notification asking if the changes should be force pushed to remote of current branch.

## Demo
