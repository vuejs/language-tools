import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as lsp from 'vscode-languageclient';
import * as shared from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, clients: lsp.CommonLanguageClient[]) {

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.genWhitelist', async () => {

		const clientDeps = Object.keys(require.cache);
		const serversDeps = await Promise.all(clients.map(client => client.sendRequest(shared.DepsRequest.type)));
		const rootPath = context.extensionPath; // path.resolve(__dirname, '..', '..', '..', '..');
		// const extPath = path.resolve(__dirname, '..', '..');
		const all = new Set([
			...clientDeps,
			...serversDeps.flat(),
		].filter(file => file.endsWith('.js')));

		const rootDeps = [...all]
			.map(file => path.relative(rootPath, file))
			.filter(file => !file.startsWith('..'))
			.map(convertMonorepoFileToNodeModeulsFile)
			.filter(file => file.startsWith('node_modules/'))
		// const extDeps = [...all]
		// 	.map(file => path.relative(extPath, file))
		// 	.filter(file => !file.startsWith('..'))
		// 	.filter(file => file.startsWith('node_modules/'))

		const rootFinal = getFinal(rootDeps, rootPath);
		// const extFinal = getFinal(extDeps, extPath);
		const final = [...new Set([
			'node_modules/prettier/parser-postcss.js', // patch
			...rootFinal,
			// ...extFinal,
		])]
			.sort()
			.map(file => '!' + file)

		const document = await vscode.workspace.openTextDocument({ content: final.join('\n') });
		await vscode.window.showTextDocument(document);

		function getFinal(files: string[], root: string) {

			const dirs: Record<string, {
				dirname: string,
				all: number,
				useds: string[],
			}> = {};

			for (const file of files) {

				const dir = path.dirname(root + '/' + file);

				let dirStat = dirs[dir];
				if (!dirStat) {
					dirStat = {
						dirname: path.dirname(file),
						all: fs.readdirSync(dir).filter(file => file.endsWith('.js')).length,
						useds: [],
					};
					dirs[dir] = dirStat;
				}

				dirStat.useds.push(file);
			}

			let final: string[] = [];

			for (const dir in dirs) {
				const dirStat = dirs[dir];
				if (dirStat.all === dirStat.useds.length) {
					final.push(dirStat.dirname + '/*.js');
				}
				else {
					for (const file of dirStat.useds) {
						final.push(file);
					}
				}
			}

			return final;
		}
		function convertMonorepoFileToNodeModeulsFile(file: string) {
			if (file.startsWith('packages/')) {
				const parts = file.split('/');
				if (parts.length >= 2) {
					const packageJsonFile = rootPath + '/' + parts[0] + '/' + parts[1] + '/package.json';
					try {
						if (fs.existsSync(packageJsonFile)) {
							const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8')); // TODO: cache this
							const newPath = 'node_modules/' + packageJson.name + '/' + parts.slice(2).join('/');
							return newPath;
						}
					} catch { }
				}
			}
			return file;
		}
	}));
}
