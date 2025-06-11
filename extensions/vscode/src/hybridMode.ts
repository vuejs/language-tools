import * as fs from 'node:fs';
import * as path from 'node:path';
import { computed, useAllExtensions } from 'reactive-vscode';
import * as semver from 'semver';
import * as vscode from 'vscode';

const vscodeTsdkVersion = computed(() => {
	const nightly = extensions.value.find(
		({ id }) => id === 'ms-vscode.vscode-typescript-next'
	);
	if (nightly) {
		const libPath = path.join(
			nightly.extensionPath.replace(/\\/g, '/'),
			'node_modules/typescript/lib'
		);
		return getTsVersion(libPath);
	}

	if (vscode.env.appRoot) {
		const libPath = path.join(
			vscode.env.appRoot.replace(/\\/g, '/'),
			'extensions/node_modules/typescript/lib'
		);
		return getTsVersion(libPath);
	}
});

const workspaceTsdkVersion = computed(() => {
	const libPath = vscode.workspace
		.getConfiguration('typescript')
		.get<string>('tsdk')
		?.replace(/\\/g, '/');
	if (libPath) {
		return getTsVersion(libPath);
	}
});

const extensions = useAllExtensions();

export function checkCompatible() {
	for (const extension of extensions.value) {
		if (
			extension.id === 'denoland.vscode-deno'
			&& vscode.workspace.getConfiguration('deno').get<boolean>('enable')
		) {
			vscode.window.showWarningMessage(`The ${extension.packageJSON.displayName}(${extension.id}) extension is incompatible with the Vue extension. Please disable Deno in workspace to avoid issues.`);
		}
		if (
			extension.id === 'svelte.svelte-vscode'
			&& semver.lt(extension.packageJSON.version, '108.4.0')
		) {
			vscode.window.showWarningMessage(`The ${extension.packageJSON.displayName}(${extension.id}) extension is incompatible with the Vue extension. Please update ${extension.packageJSON.displayName} to the latest version to avoid issues.`);
		}
	}
	if (
		(vscodeTsdkVersion.value && !semver.gte(vscodeTsdkVersion.value, '5.3.0')) ||
		(workspaceTsdkVersion.value && !semver.gte(workspaceTsdkVersion.value, '5.3.0'))
	) {
		let msg = `TSDK >= 5.3.0 is required (VSCode TSDK: ${vscodeTsdkVersion.value}`;
		if (workspaceTsdkVersion.value) {
			msg += `, Workspace TSDK: ${workspaceTsdkVersion.value}`;
		}
		msg += `).`;
		vscode.window.showWarningMessage(msg);
	}
}

function getTsVersion(libPath: string) {
	try {
		const p = libPath.toString().split('/');
		const p2 = p.slice(0, -1);
		const modulePath = p2.join('/');
		const filePath = modulePath + '/package.json';
		const contents = fs.readFileSync(filePath, 'utf-8');

		if (contents === undefined) {
			return;
		}

		let desc: any = null;
		try {
			desc = JSON.parse(contents);
		}
		catch {
			return;
		}
		if (!desc || !desc.version) {
			return;
		}

		return desc.version as string;
	} catch { }
}
