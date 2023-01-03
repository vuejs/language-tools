import * as vscode from 'vscode';

export async function readFile(uri: vscode.Uri) {
	const data = await vscode.workspace.fs.readFile(uri);
	return new TextDecoder('utf8').decode(data);
}

export async function exists(uri: vscode.Uri) {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	}
	catch {
		return false;
	}
}
