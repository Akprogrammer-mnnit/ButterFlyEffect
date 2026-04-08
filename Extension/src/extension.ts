import * as vscode from 'vscode';
import * as cp from 'child_process';
import axios from 'axios';

function getChangedLines(filePath: string, workspacePath: string): number[] {
	try {
		const diff = cp.execSync(`git diff -U0 HEAD -- "${filePath}"`, { cwd: workspacePath }).toString();
		const changedLines: number[] = [];
		const diffRegex = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/g;

		let match;
		while ((match = diffRegex.exec(diff)) !== null) {
			const startLine = parseInt(match[1], 10) - 1; // 0-indexed for VS Code
			const lineCount = match[2] ? parseInt(match[2], 10) : 1;

			for (let i = 0; i < lineCount; i++) {
				changedLines.push(startLine + i);
			}
		}
		return changedLines;
	} catch (e) {
		return [];
	}
}

class ImpactCodeLensProvider implements vscode.CodeLensProvider {

	private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

	constructor() {
		vscode.workspace.onDidSaveTextDocument(() => {
			this._onDidChangeCodeLenses.fire();
		});
	}

	async provideCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
		const lenses: vscode.CodeLens[] = [];
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!workspaceFolder) return [];

		let relativePath = vscode.workspace.asRelativePath(document.uri, false);
		relativePath = relativePath.replace(/\\/g, '/');

		const changedLines = getChangedLines(document.uri.fsPath, workspaceFolder.uri.fsPath);
		if (changedLines.length === 0) return [];

		const symbols: vscode.DocumentSymbol[] | undefined = await vscode.commands.executeCommand(
			'vscode.executeDocumentSymbolProvider',
			document.uri
		);

		if (!symbols) return [];

		for (const symbol of symbols) {
			if (symbol.kind === vscode.SymbolKind.Function || symbol.kind === vscode.SymbolKind.Method) {
				const startLine = symbol.range.start.line;
				const endLine = symbol.range.end.line;

				const isChanged = changedLines.some(line => line >= startLine && line <= endLine);

				if (isChanged) {
					const functionId = `${relativePath}::${symbol.name}`;
					const functionCode = document.getText(symbol.range);

					const lens = new vscode.CodeLens(symbol.range);
					lens.command = {
						title: "🔍 Analyze Impact",
						tooltip: "Check the blast radius of this change",
						command: "butterfly.analyzeFunction",
						arguments: [functionId, functionCode]
					};
					lenses.push(lens);
				}
			}
		}
		return lenses;
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Butterfly Effect extension is now active!');


	const lensProvider = new ImpactCodeLensProvider();
	vscode.languages.registerCodeLensProvider({ scheme: 'file' }, lensProvider);

	const analyzeCommand = vscode.commands.registerCommand(
		'butterfly.analyzeFunction',
		async (functionId: string, functionCode: string) => {

			vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: "Analyzing blast radius...",
				cancellable: false
			}, async (progress) => {
				try {
					console.log(`Analyzing impact for ${functionId}...`);

					const response = await axios.post('http://localhost:5555/api/impact/analyze', {
						targetFunctionIds: [functionId],
						code: functionCode
					});
					console.log(`Received response for ${functionId}:`, response.data);

					const data = response.data;
					// JOIN WITH PRASHANT CODE 
					if (data.totalDependencies === 0) {
						vscode.window.showInformationMessage(`Safe to commit! No dependencies found for ${functionId}.`);
					} else {
						vscode.window.showWarningMessage(`Warning: This change might break ${data.impactCount} functions! Check the output panel for details.`);
					}
				} catch (error) {
					vscode.window.showErrorMessage(`Failed to analyze impact. Is your backend running?`);
					console.error(error);
				}
			});
		}
	);

	context.subscriptions.push(analyzeCommand);
}

export function deactivate() { }