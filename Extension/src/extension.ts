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
				// Replace your existing try block inside activate() with this:
				try {
					console.log(`Analyzing impact for ${functionId}...`);

					const response = await axios.post('http://localhost:5555/api/impact/analyze', {
						targetFunctionIds: [functionId],
						code: functionCode
					});

					const data = response.data.data;

					if (data.totalDependencies === 0) {
						vscode.window.showInformationMessage(`✅ Safe to commit! No dependencies found for ${functionId}.`);
					} else {
						vscode.window.showWarningMessage(`⚠️ This change affects ${data.totalDependencies} functions! Opening detailed report...`);

						ImpactReportPanel.createOrShow(data, functionId);
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


// --- 4. Webview Panel Generator ---
class ImpactReportPanel {
	public static currentPanel: ImpactReportPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(reportData: any, functionId: string) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// If we already have a panel open, show it and update it
		if (ImpactReportPanel.currentPanel) {
			ImpactReportPanel.currentPanel._panel.reveal(column);
			ImpactReportPanel.currentPanel.update(reportData, functionId);
			return;
		}

		// Otherwise, create a new panel (a new tab)
		const panel = vscode.window.createWebviewPanel(
			'impactReport',
			'🦋 Blast Radius Report',
			column || vscode.ViewColumn.Beside, // Opens in a split pane next to their code!
			{ enableScripts: true }
		);

		ImpactReportPanel.currentPanel = new ImpactReportPanel(panel, reportData, functionId);
	}

	private constructor(panel: vscode.WebviewPanel, reportData: any, functionId: string) {
		this._panel = panel;
		this.update(reportData, functionId);
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public update(reportData: any, functionId: string) {
		this._panel.webview.html = this._getHtmlForWebview(reportData, functionId);
	}

	public dispose() {
		ImpactReportPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) x.dispose();
		}
	}

	private _getHtmlForWebview(data: any, functionId: string) {
		const ai = data.aiReport;

		// Color code the risk level
		let riskColor = "var(--vscode-testing-iconPassed)"; // Green
		if (ai.risk_level === 'MEDIUM') riskColor = "var(--vscode-testing-iconQueued)"; // Yellow
		if (ai.risk_level === 'HIGH') riskColor = "var(--vscode-testing-iconFailed)"; // Red
		if (ai.risk_level === 'CRITICAL') riskColor = "var(--vscode-errorForeground)"; // Bright Red

		// Generate HTML for the Impact Breakdown
		const breakdownHtml = ai.impact_breakdown.map((item: any) => `
			<div class="card">
				<div class="card-header">
					<span class="node-name">${item.node_name}</span>
					<span class="badge ${item.may_break ? 'badge-danger' : 'badge-warning'}">
						${item.may_break ? '⚠️ Will Break' : '⚠️ Warning'}
					</span>
				</div>
				<div class="meta-info">📁 ${item.file_path} | 🔗 ${item.relationship}</div>
				<p class="impact-text">${item.impact}</p>
			</div>
		`).join('');

		// Generate HTML for Potential Bugs
		const bugsHtml = ai.potential_bugs.map((bug: string) => `
			<li class="bug-item">🐞 ${bug}</li>
		`).join('');

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Impact Analysis</title>
				<style>
					body {
						font-family: var(--vscode-font-family);
						color: var(--vscode-editor-foreground);
						background-color: var(--vscode-editor-background);
						padding: 20px;
						line-height: 1.6;
					}
					h1, h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
					.header-box {
						background: var(--vscode-editorWidget-background);
						border: 1px solid var(--vscode-widget-border);
						padding: 15px;
						border-radius: 6px;
						margin-bottom: 20px;
					}
					.risk-badge {
						display: inline-block;
						padding: 5px 12px;
						border-radius: 4px;
						font-weight: bold;
						background-color: ${riskColor};
						color: #000;
						margin-top: 10px;
					}
					.summary { font-size: 1.1em; opacity: 0.9; margin-top: 15px;}
					.card {
						background: var(--vscode-editorWidget-background);
						border: 1px solid var(--vscode-widget-border);
						padding: 15px;
						border-radius: 6px;
						margin-bottom: 15px;
					}
					.card-header { display: flex; justify-content: space-between; align-items: center; }
					.node-name { font-size: 1.2em; font-weight: bold; color: var(--vscode-symbolIcon-functionForeground); }
					.meta-info { font-size: 0.85em; opacity: 0.7; margin-bottom: 10px; margin-top: 5px; }
					.badge { padding: 3px 8px; border-radius: 3px; font-size: 0.8em; font-weight: bold; color: #000; }
					.badge-danger { background-color: var(--vscode-testing-iconFailed); }
					.badge-warning { background-color: var(--vscode-testing-iconQueued); }
					.impact-text { margin: 0; }
					.bug-list { list-style-type: none; padding: 0; }
					.bug-item {
						background: var(--vscode-inputValidation-errorBackground);
						border: 1px solid var(--vscode-inputValidation-errorBorder);
						padding: 10px;
						border-radius: 4px;
						margin-bottom: 8px;
					}
				</style>
			</head>
			<body>
				<h1>🦋 Butterfly Effect Analysis</h1>
				
				<div class="header-box">
					<div><strong>Target Function:</strong> <code>${functionId}</code></div>
					<div><strong>Total Dependencies:</strong> ${data.totalDependencies}</div>
					<div class="risk-badge">RISK LEVEL: ${ai.risk_level}</div>
					<div class="summary">${ai.summary}</div>
				</div>

				${ai.potential_bugs.length > 0 ? `
					<h2>🚨 Potential Bugs</h2>
					<ul class="bug-list">
						${bugsHtml}
					</ul>
				` : ''}

				<h2>🔍 Blast Radius Breakdown</h2>
				${breakdownHtml}
			</body>
			</html>`;
	}
}

export function deactivate() { }