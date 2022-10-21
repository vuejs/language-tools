import * as vscode from 'vscode-languageserver';

export type CancellactionTokenHost = ReturnType<typeof createCancellactionTokenHost>;

export function createCancellactionTokenHost(_cancellationPipeName: string | undefined) {

	if (_cancellationPipeName === undefined) {
		return {
			createCancellactionToken(original: vscode.CancellationToken) {
				return original;
			},
			getMtime() {
				return -1;
			}
		};
	}

	const cancellationPipeName = _cancellationPipeName;
	const fs: typeof import('fs') = require('fs');

	return {
		createCancellactionToken,
		getMtime,
	};

	function createCancellactionToken(original: vscode.CancellationToken) {
		const mtime = getMtime();
		const token: vscode.CancellationToken = {
			get isCancellationRequested() {
				if (original.isCancellationRequested) {
					return true;
				}
				return getMtime() !== mtime;
			},
			onCancellationRequested: vscode.Event.None,
		};
		return token;
	}
	function getMtime() {
		try {
			return fs.statSync(cancellationPipeName).mtime.valueOf();
		} catch {
			return -1;
		}
	}
}
