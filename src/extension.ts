import * as vscode from "vscode";
import * as childProcess from "child_process";
import { squashProcessing } from "./squashProcessor";

const squashCommand = "sqashmaster.squashCommits";

const getCommitQuickPickItems = async (
  repoPath: string
): Promise<vscode.QuickPickItem[]> => {
  return new Promise<vscode.QuickPickItem[]>((resolve, reject) => {
    // getting all log data from local git
    childProcess.exec(
      `git log --oneline --format="%h~/~/~%an~/~/~%s"`,
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
            const spaceSplitCommit = rawCommit.split("~/~/~");
            const commitId = spaceSplitCommit.shift();
            const commitAuthor = spaceSplitCommit.shift();
            const commitMessage = spaceSplitCommit.shift();

            // pushing into pick item list
            quickPickItems.push({
              label: commitMessage || "",
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

const squashCommandCallback = async () => {
  // fetching all open workspaces
  const openWorkspaces = vscode.workspace.workspaceFolders;

  // guard check for no existing workspaces
  if (!openWorkspaces || openWorkspaces.length === 0) {
    vscode.window.showErrorMessage("No workspace folder found");
    return;
  }

  // fetching the first workspace as default
  let repoPath = openWorkspaces[0].uri.fsPath;

  // handling multi-workspaces
  if (openWorkspaces.length > 1) {
    const workspaceChoice = await vscode.window.showWorkspaceFolderPick({
      ignoreFocusOut: true,
      placeHolder: "Select workspace on which to run SquashMaster",
    });
    if (!!workspaceChoice) {
      repoPath = workspaceChoice.uri.fsPath;
    } else {
      vscode.window.showErrorMessage(
        "Please select a workspace to continue squashing"
      );
      return;
    }
  }
  let commitQuickPickItems: vscode.QuickPickItem[] = [];

  // getting list of commits
  await vscode.window.withProgress(
    {
      cancellable: false,
      location: vscode.ProgressLocation.Notification,
      title: "Fetching your commits...",
    },
    async () => {
      commitQuickPickItems = await getCommitQuickPickItems(repoPath);
    }
  );

  // commit list guard
  if (commitQuickPickItems.length > 1) {
    // showing quick pick menu and getting selected list
    const featureStartCommitItem = await vscode.window.showQuickPick(
      commitQuickPickItems,
      {
        canPickMany: false,
        title: "Commits",
        ignoreFocusOut: true,
        placeHolder: "Select the first commit for your feature/bug fix",
        matchOnDescription: true,
        matchOnDetail: true,
      }
    );

    // NOTE: user HAS to choose an option to proceed so no need to handle alternate case
    if (!!featureStartCommitItem) {
      // checking if there are enough commits after start commit to squash
      const indexOfFeatureStartCommitItem = commitQuickPickItems.findIndex(
        (pickItem) =>
          pickItem.description === featureStartCommitItem.description
      );
      if (indexOfFeatureStartCommitItem !== 0) {
        // getting commit message for squashed commit
        const squashedCommitMessage = await vscode.window.showInputBox({
          placeHolder: "Enter squashed commit message...",
          prompt: "The lastest commit message would be used as default",
          ignoreFocusOut: true,
          title: "Squashed Commit Message",
          value: commitQuickPickItems[0].label,
        });

        if (!!squashedCommitMessage) {
          // performing squash using rebase
          squashProcessing({
            repoPath,
            indexOfFeatureStartCommitItem,
            commitQuickPickItems,
            squashedCommitMessage,
          });
        }
      } else {
        vscode.window.showErrorMessage("Insufficient commits to squash");
        return;
      }
    }
  } else {
    vscode.window.showErrorMessage("Insufficient commits to squash");
    return;
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
    console.log(e);
    vscode.window.showErrorMessage(
      `An error has occured with "SquashMaster" extension activation. Please report to developer.`
    );
  }
}

export function deactivate() {
  // end log
  console.log(`Extension "SquashMaster" has been deactivated`);
}
