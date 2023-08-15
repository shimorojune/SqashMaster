import * as vscode from "vscode";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";

const squashCommand = "sqashmaster.squashCommits";

const getCommitQuickPickItems = async (
  repoPath: string
): Promise<vscode.QuickPickItem[]> => {
  return new Promise<vscode.QuickPickItem[]>((resolve, reject) => {
    // getting all log data from local git
    childProcess.exec(
      `git log --oneline --format="%h %an %s"`,
      { cwd: repoPath },
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          // processing data to extract required information
          // split output into each commit
          const rawCommitsList = stdout.trim().split("\n");
          const quickPickItems: vscode.QuickPickItem[] = [];

          // extracting data from message log
          rawCommitsList.map((rawCommit) => {
            const spaceSplitCommit = rawCommit.split(" ");
            const commitId = spaceSplitCommit.shift();
            const commitAuthor = spaceSplitCommit.shift();
            const commitMessage = spaceSplitCommit.join(" ");

            // pushing into pick item list
            quickPickItems.push({
              label: commitMessage,
              description: commitId,
              detail: commitAuthor,
            });
          });
          resolve(quickPickItems);
        }
      }
    );
  });
};

const rebaseProcessing = async (data: {
  repoPath: string;
  selectedCommitItems: vscode.QuickPickItem[];
  squashedCommitMessage?: string;
}) => {
  // DATA
  const { repoPath, selectedCommitItems, squashedCommitMessage } = data;

  /**
   * "rebase interactive" is required to rebase commits that might not be consecutive
   * but since it is interactive, it requires user action to modify a file specifying
   * which file to squash and pick. We need to automate this process, so we are creating
   * a temporary file with auto-generated content to use in place of user interaction.
   */

  // rebase file content store
  let rebaseFileGeneratedContent = "";

  // generating rebase file content
  selectedCommitItems.map((selectedCommitItem, index) => {
    let contentForItem = "";
    // need to setup the first line to be the one that is picked for squash
    if (index === 0) {
      // replacing default commit message with user specified string
      if (!!squashedCommitMessage) {
        // format `pick commit_sha commit_message\n`;
        contentForItem = `pick ${selectedCommitItem.description} ${squashedCommitMessage}\n`;
      } else {
        // format `pick commit_sha commit_message\n`;
        contentForItem = `pick ${selectedCommitItem.description} ${selectedCommitItem.label}\n`;
      }
    } else {
      // setting all other selected commits to squash
      // format `squash commit_sha commit_message\n`;
      contentForItem = `squash ${selectedCommitItem.description} ${selectedCommitItem.label}\n`;
    }
    // pushing to rebase file content store
    rebaseFileGeneratedContent =
      rebaseFileGeneratedContent.concat(contentForItem);
  });

  console.log({ rebaseFileGeneratedContent });

  // create a temporary file path
  const tempFilePath = path.join(repoPath, "temp-rebase-file.txt");

  // write content to the temporary file
  fs.writeFileSync(tempFilePath, rebaseFileGeneratedContent, "utf-8");

  // execute git rebase command
  try {
    const rebaseCommand = `git rebase -i < ${tempFilePath}`;
    childProcess.execSync(rebaseCommand, { cwd: repoPath });
	vscode.window.showInformationMessage("Squash process completed");
  } catch (e) {
    console.log({ e });
	vscode.window.showErrorMessage("Error occurred during squash. Please contact developer.");
  }

  // clean up the temporary file
  fs.unlinkSync(tempFilePath);
};

const squashCommandCallback = async () => {
  // fetching all open workspaces
  const openWorkspaces = vscode.workspace.workspaceFolders;

  // guard check for no existing workspaces
  if (!openWorkspaces || openWorkspaces.length === 0) {
    vscode.window.showErrorMessage("No workspace folder found");
    return;
  }

  // fetching the first workspace
  // TODO: add support for multi workspaces
  const repoPath = openWorkspaces[0].uri.fsPath;

  // getting list of commits
  const commitQuickPickItems = await getCommitQuickPickItems(repoPath);

  // showing quick pick menu and getting selected list
  const selectedCommitItems = await vscode.window.showQuickPick(
    commitQuickPickItems,
    {
      canPickMany: true,
      title: "Commits",
      ignoreFocusOut: true,
      placeHolder: "Select the commits that need to be squashed",
    }
  );

  if (!!selectedCommitItems) {
    const minimumNoOfCommitsForSquash = 2;
    if (selectedCommitItems.length >= minimumNoOfCommitsForSquash) {
      // getting commit message for squashed commit
      const squashedCommitMessage = await vscode.window.showInputBox({
        placeHolder: "Enter squashed commit message...",
        prompt: "The lastest commit message would be used as default",
        ignoreFocusOut: true,
      });

      // performing squash using rebase
      rebaseProcessing({
        repoPath,
        selectedCommitItems,
        squashedCommitMessage,
      });
    } else {
      vscode.window.showErrorMessage(
        `Please select two or more commits to squash`
      );
    }
  }
};

export function activate(context: vscode.ExtensionContext) {
  try {
    // init log
    console.log(`Extension "SquashMaster" is now active`);

    // "squashCommits" command registration
    const disposable = vscode.commands.registerCommand(
      squashCommand,
      squashCommandCallback
    );

    // adding command subscriptions
    context.subscriptions.push(disposable);
  } catch (e) {
    vscode.window.showErrorMessage(
      `An error has occured with "SquashMaster" extension activation. Please report to developer.`
    );
  }
}

export function deactivate() {
  // end log
  console.log(`Extension "SquashMaster" has been deactivated`);
}
