import { FileType, ServiceEnvironment } from '@volar/language-service';
import { URI } from 'vscode-uri';
import * as fs from 'fs';

const uriToFileName = (uri: string) => URI.parse(uri).fsPath.replace(/\\/g, '/');
const fileNameToUri = (fileName: string) => URI.file(fileName).toString();


export function createMockServiceEnv(
	rootUri: URI,
	getSettings = () => ({} as any)
): ServiceEnvironment {
	return {
		workspaceFolder: {
			uri: rootUri,
			name: 'test-root',
		},
		uriToFileName,
		fileNameToUri,
		async getConfiguration(section: string) {
			const settings = getSettings();
			if (settings[section]) {
				return settings[section];
			}
			let result: Record<string, any> | undefined;
			for (const key in settings) {
				if (key.startsWith(section + '.')) {
					const newKey = key.slice(section.length + 1);
					result ??= {};
					result[newKey] = settings[key];
				}
			}
			return result;
		},
		fs: {
			stat(uri) {
				if (uri.startsWith('file://')) {
					try {
						const stats = fs.statSync(uriToFileName(uri), { throwIfNoEntry: false });
						if (stats) {
							return {
								type: stats.isFile() ? FileType.File
									: stats.isDirectory() ? FileType.Directory
										: stats.isSymbolicLink() ? FileType.SymbolicLink
											: FileType.Unknown,
								ctime: stats.ctimeMs,
								mtime: stats.mtimeMs,
								size: stats.size,
							};
						}
					}
					catch {
						return undefined;
					}
				}
			},
			readFile(uri, encoding) {
				if (uri.startsWith('file://')) {
					try {
						return fs.readFileSync(uriToFileName(uri), { encoding: encoding as 'utf-8' ?? 'utf-8' });
					}
					catch {
						return undefined;
					}
				}
			},
			readDirectory(uri) {
				if (uri.startsWith('file://')) {
					try {
						const dirName = uriToFileName(uri);
						const files = fs.readdirSync(dirName, { withFileTypes: true });
						return files.map<[string, FileType]>(file => {
							return [file.name, file.isFile() ? FileType.File
								: file.isDirectory() ? FileType.Directory
									: file.isSymbolicLink() ? FileType.SymbolicLink
										: FileType.Unknown];
						});
					}
					catch {
						return [];
					}
				}
				return [];
			},
		}
	};
}
