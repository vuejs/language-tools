import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as lsp from 'vscode-languageclient/node';
import * as shared from '@volar/shared';

export async function activate(context: vscode.ExtensionContext, clients: lsp.LanguageClient[]) {

	context.subscriptions.push(vscode.commands.registerCommand('volar.action.genWhitelist', async () => {

		const clientDeps = Object.keys(require.cache);
		const serversDeps = await Promise.all(clients.map(client => client.sendRequest(shared.DepsRequest.type)));
		const root = path.resolve(__dirname, '..', '..', '..', '..');
		const all = new Set([
			...clientDeps,
			...serversDeps.flat(),
		]
			.filter(file => file.endsWith('.js'))
			.map(file => path.relative(root, file))
			.filter(file => !file.startsWith('..'))
			.filter(file => !file.startsWith('node_modules/@vue/compiler-core/node_modules/@babel')) // use node_modules/@babel instead of
			.map(file => {
				if (file.startsWith('packages/')) {
					const parts = file.split('/');
					if (parts.length >= 2) {
						const packageJsonFile = root + '/' + parts[0] + '/' + parts[1] + '/package.json';
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
			})
		);

		// patch
		all.add('node_modules/prettier/parser-postcss.js');

		const getAllFiles = (dir: string): string[] =>
			fs.readdirSync(dir).reduce((files, file) => {
				const name = path.join(dir, file);
				const isDirectory = fs.statSync(name).isDirectory();
				return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
			}, [] as string[]);

		const dirs: Record<string, {
			dirname: string,
			all: number,
			useds: string[],
		}> = {};

		for (const file of all) {

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

		final = final.sort();
		final = final.map(file => '!' + file);

		// use node_modules/@babel instead of
		final.splice(0, 0, 'node_modules/@vue/**/@babel/**');
		final = final.filter(file => !file.startsWith('!node_modules/@vue/compiler-core/node_modules/@babel'));

		fs.writeFileSync(root + '/.vscodeignore-whitelist.txt', final.join('\n'));
	}));
}
