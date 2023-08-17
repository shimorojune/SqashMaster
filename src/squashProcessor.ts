import * as vscode from "vscode";
import * as childProcess from "child_process";

const handlePushToRemote = async (data: { repoPath: string }) => {
  const { repoPath } = data;

  // git extension to run a few commands more efficiently
  const gitExtension = vscode.extensions.getExtension("vscode.git");

  // require installation of git extension from here on out
  if (!!gitExtension) {
    const git = gitExtension.exports.getAPI(1);
    const repository = git.repositories[0];
    if (!!repository) {
      const branchName = repository?.state?.HEAD?.name || "";
      // using two different ways to check if branch has been pushed to remote
      const upstreamURL =
        repository?.state?.HEAD?.upstream ||
        repository?.state?.refs?.find(
          (ref: { name: string }) =>
            ref.name === `refs/remotes/origin/${branchName}`
        ) ||
        "";
      if (!!branchName) {
        // checking if repo has already been pushed
        if (!!upstreamURL) {
          // warning for remote git history overwrite
          const response = await vscode.window.showWarningMessage(
            `Be advised - This action will ovewrite the commit history of your remote repository, which might impact other developers who depend on the '${branchName}' branch`,
            "Cancel",
            "Proceed"
          );
          if (response === "Proceed") {
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                cancellable: false,
                title: "Pushing to remote branch...",
              },
              async (progress) => {
                // force push current branch to repo
                childProcess.execSync(`git push -f`, {
                  cwd: repoPath,
                });
                progress.report({ increment: 100 });
              }
            );
            vscode.window.showInformationMessage(
              `Changes have been pushed to '${branchName}' branch`
            );
          }
        } else {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              cancellable: false,
              title: "Publishing branch in remote and pushing changes...",
            },
            async (progress) => {
              // Push the local branch to the remote
              await repository.push("origin", `refs/heads/${branchName}`, true);
              progress.report({ increment: 100 });
            }
          );
          vscode.window.showInformationMessage(
            `Branch '${branchName}' has been published and pushed`
          );
          return "";
        }
      } else {
        vscode.window.showErrorMessage(
          `Unable to retrieve current branch. Please contact developer.`
        );
        return "";
      }
    }
  } else {
    vscode.window.showErrorMessage(
      `Please install the git extension to continue with this action`
    );
    return "";
  }
  return "";
};

export const squashProcessing = async (data: {
  repoPath: string;
  commitQuickPickItems: vscode.QuickPickItem[];
  indexOfFeatureStartCommitItem: number;
  squashedCommitMessage?: string;
}) => {
  // DATA
  const {
    repoPath,
    commitQuickPickItems,
    indexOfFeatureStartCommitItem,
    squashedCommitMessage,
  } = data;

  /**
   * functioning logic: inspired from https://stackoverflow.com/a/5201642
   * we "soft reset" the user to the commit before the user specified commit
   * then we create a new commit with the message provided by the user
   * this would have created a single squashed commit
   */

  // finding the previous commit (reset target commit) for selected commit
  const previousCommitIndex = indexOfFeatureStartCommitItem + 1;
  const resetTargetCommit = commitQuickPickItems[previousCommitIndex];
  const commitMessage = squashedCommitMessage || commitQuickPickItems[0].label;
  const numberOfCommitsSquashed = previousCommitIndex;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      cancellable: false,
      title: `Uniting all ${numberOfCommitsSquashed} commits into one...`,
    },
    async (progress) => {
      try {
        if (!!resetTargetCommit) {
          progress.report({ increment: 20 });
          // soft resetting current branch to specified commit
          childProcess.execSync(
            `git reset --soft ${resetTargetCommit.description}`,
            { cwd: repoPath }
          );
          progress.report({ increment: 60 });
          childProcess.execSync(`git commit -m "${commitMessage}"`, {
            cwd: repoPath,
          });
          progress.report({ increment: 100 });
        }
        return "";
      } catch (e) {
        console.log(e);
        vscode.window.showErrorMessage(
          `An error has occured while squashing commits. Please contact developer.`
        );
        return "";
      }
    }
  );
  const response = await vscode.window.showInformationMessage(
    `All ${numberOfCommitsSquashed} commits squashed into '${commitMessage}'`,
    {
      modal: false,
    },
    "Push to Remote"
  );
  if (response === "Push to Remote") {
    handlePushToRemote({
      repoPath,
    });
  }
  return "";
};
