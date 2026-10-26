import { activateAutoInsertion, activateDocumentDropEdit, createLabsInfo, middleware } from '@volar/vscode';
import * as lsp from '@volar/vscode/node';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	defineExtension,
	defineLogger,
	extensionContext,
	nextTick,
	onDeactivate,
	useActiveTextEditor,
	useCommand,
	useVisibleTextEditors,
	watch,
} from 'reactive-vscode';
import * as vscode from 'vscode';
import { config } from './config';
import { createInferredContentMapperContributions, inferredContentMappers } from './contentMappers';
import * as focusMode from './focusMode';
import * as interpolationDecorators from './interpolationDecorators';
import { restrictFormattingEditsToRange } from './rangeFormatting';
import * as reactivityVisualization from './reactivityVisualization';
import * as welcome from './welcome';

let serverPath = resolveServerPath();

/** Resolves with the first TypeScript SDK; `latestTypeScriptSdk` follows later TypeScript language server restarts. */
let typescriptSdk: Promise<TypeScriptSDK> = Promise.reject(new Error('TypeScript (Native Preview) is not installed.'));
let latestTypeScriptSdk: TypeScriptSDK | undefined;
typescriptSdk.catch(() => {});

/** Answers the Vue language server's `vue/typescriptApiConnection` request with a fresh pipe to the TypeScript API. */
async function getTypeScriptApiConnection() {
	const sdk = latestTypeScriptSdk ?? await typescriptSdk;
	if (!sdk.packageJsonPath) {
		throw new Error(
			'The selected TypeScript 7 installation has no API package. Select a `typescript` package installation in TypeScript (Native Preview).',
		);
	}
	return { pipe: await sdk.initializeAPIConnection(), packageJsonPath: sdk.packageJsonPath };
}

/** The subset of `typescript/vscode`'s `TypeScriptSDK` used to connect the Vue language server to the TypeScript API. */
interface TypeScriptSDK {
	readonly packageJsonPath: string | undefined;
	initializeAPIConnection(pipe?: string): Promise<string>;
}

interface TypeScriptNativePreviewAPI {
	onLanguageServerInitialized?(listener: (sdk: TypeScriptSDK) => unknown): vscode.Disposable;
	registerContentMappers(
		contributorId: string,
		contributions: readonly {
			extensions: readonly string[];
			inferredProjectContribution?: {
				options?: Readonly<Record<string, unknown>>;
				manifest: {
					name: string;
					version?: string;
					exec: readonly string[];
					cwd?: vscode.Uri;
					dynamicConfig?: boolean;
				};
			};
		}[],
	): vscode.Disposable;
}

for (
	const incompatibleExtensionId of [
		'johnsoncodehk.vscode-typescript-vue-plugin',
		'Vue.vscode-typescript-vue-plugin',
	]
) {
	const extension = vscode.extensions.getExtension(incompatibleExtensionId);
	if (extension) {
		vscode.window.showErrorMessage(
			`The "${incompatibleExtensionId}" extension is incompatible with the Vue extension. Please uninstall it.`,
			'Show Extension',
		).then(action => {
			if (action === 'Show Extension') {
				vscode.commands.executeCommand('workbench.extensions.search', '@id:' + incompatibleExtensionId);
			}
		});
	}
}

const logger = defineLogger('Vue Language Server');

export = defineExtension(() => {
	let client: lsp.BaseLanguageClient | undefined;

	const context = extensionContext.value!;
	registerTypeScriptContentMapper(context);
	const volarLabs = createLabsInfo();
	const activeTextEditor = useActiveTextEditor();
	const visibleTextEditors = useVisibleTextEditors();
	const { stop } = watch(activeTextEditor, () => {
		if (
			!visibleTextEditors.value.some(
				editor => vscode.languages.match(getIncludeLanguages(), editor.document),
			)
		) {
			return;
		}

		nextTick(() => stop());

		watch(() => [
			config.server.path,
			config.server.includeLanguages,
		], async () => {
			const reload = await vscode.window.showInformationMessage(
				'Please restart extension host to apply the new server settings.',
				'Restart Extension Host',
			);
			if (reload) {
				vscode.commands.executeCommand('workbench.action.restartExtensionHost');
			}
		});

		if (config.server.path) {
			if (!serverPath) {
				vscode.window.showErrorMessage('Cannot find @vue/language-server.');
				return;
			}
			vscode.window.showInformationMessage(
				`You are using a custom Vue server: ${config.server.path}. If the server fails to start, please check the path in settings.`,
				'Open Settings',
			).then(action => {
				if (action === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'vue.server.path');
				}
			});
		}

		const tsdk = resolveTsdkPath();
		if (tsdk === undefined) {
			vscode.window.showErrorMessage('Cannot find TypeScript SDK.');
			return;
		}

		if (!serverPath) {
			try {
				serverPath = require.resolve('../node_modules/@vue/language-server');
			}
			catch {
				serverPath = require.resolve('../dist/language-server.js');
			}
		}

		client = launch(serverPath, tsdk.replace(/\\/g, '/'));

		volarLabs.addLanguageClient(client);

		const selectors = getIncludeLanguages();

		activateAutoInsertion(selectors, client);
		activateDocumentDropEdit(selectors, client);

		focusMode.activate(selectors);
		interpolationDecorators.activate(selectors, client);
		reactivityVisualization.activate(selectors, client);
		welcome.activate(context);
	}, { immediate: true });

	useCommand('vue.welcome', () => welcome.execute(context));
	useCommand('vue.action.restartServer', async () => {
		await vscode.commands.executeCommand('typescript.native-preview.restart').then(undefined, () => {});
		await client?.stop();
		client?.outputChannel.clear();
		await client?.start();
	});

	onDeactivate(async () => {
		await client?.stop();
	});

	return volarLabs.extensionExports;
});

function getIncludeLanguages() {
	return config.server.includeLanguages as lsp.DocumentSelector;
}

function launch(serverPath: string, tsdk: string) {
	const args = ['--tsdk=' + tsdk];
	const client = new lsp.LanguageClient(
		'vue',
		'Vue',
		{
			run: {
				module: serverPath,
				args,
				transport: lsp.TransportKind.ipc,
				options: {},
			},
			debug: {
				module: serverPath,
				args,
				transport: lsp.TransportKind.ipc,
				options: { execArgv: ['--nolazy', '--inspect=' + 6009] },
			},
		},
		{
			middleware: {
				...middleware,
				async resolveCodeAction(item, token, next) {
					if (item.kind?.value === 'refactor.move.newFile.dumb' && config.codeActions.askNewComponentName) {
						const inputName = await vscode.window.showInputBox({ value: (item as any).data.original.data.newName });
						if (!inputName) {
							return item; // cancel
						}
						(item as any).data.original.data.newName = inputName;
					}
					return await (middleware.resolveCodeAction?.(item, token, next) ?? next(item, token));
				},
				async provideDocumentRangeFormattingEdits(document, range, options, token, next) {
					const edits = await next(document, range, options, token);
					if (edits) {
						return restrictFormattingEditsToRange(
							document,
							range,
							edits,
							(start, end, newText) =>
								new vscode.TextEdit(
									new vscode.Range(
										document.positionAt(start),
										document.positionAt(end),
									),
									newText,
								),
						);
					}
					return edits;
				},
			},
			documentSelector: getIncludeLanguages(),
			initializationOptions: { contentMappers: inferredContentMappers },
			markdown: {
				isTrusted: true,
				supportHtml: true,
			},
			outputChannel: logger.logger.value!,
		},
	);

	client.onRequest('vue/typescriptApiConnection', getTypeScriptApiConnection);
	client.start();

	return client;
}

function resolveTsdkPath() {
	const vscodeTsdk = path.join(vscode.env.appRoot, 'extensions', 'node_modules', 'typescript', 'lib');
	if (fs.existsSync(vscodeTsdk)) {
		return vscodeTsdk;
	}

	const tsExt = vscode.extensions.getExtension('vscode.typescript-language-features');
	if (tsExt) {
		// Eclipse Theia
		// see: https://github.com/eclipse-theia/vscode-builtin-extensions/blob/65c70ec636bd879ef9529d0a2da36f4b99139c40/src/package-vsix.js#L71
		const theiaTsdk = path.join(tsExt.extensionPath, 'deps', 'typescript', 'lib');
		if (fs.existsSync(theiaTsdk)) {
			return theiaTsdk;
		}
	}
}

function registerTypeScriptContentMapper(context: vscode.ExtensionContext) {
	const nativePreview = vscode.extensions.getExtension<TypeScriptNativePreviewAPI>(
		'TypeScriptTeam.native-preview',
	);
	if (!nativePreview) {
		return;
	}

	const activated = Promise.resolve(nativePreview.activate());
	typescriptSdk = activated.then(api => {
		const onLanguageServerInitialized = api?.onLanguageServerInitialized?.bind(api);
		if (!onLanguageServerInitialized) {
			throw new Error('TypeScript (Native Preview) is too old to provide its API to other extensions.');
		}
		return new Promise(resolve => {
			// Fires after every TypeScript language server (re)start
			context.subscriptions.push(onLanguageServerInitialized(sdk => {
				latestTypeScriptSdk = sdk;
				resolve(sdk);
			}));
		});
	});
	typescriptSdk.catch(() => {});

	void activated.then(api => {
		if (!api?.registerContentMappers) {
			return;
		}
		const contributions = createInferredContentMapperContributions(
			context.extensionPath,
			require('../package.json').version,
		).map(({ extensions, inferredProjectContribution: { options, manifest } }) => ({
			extensions,
			inferredProjectContribution: { options, manifest: { ...manifest, cwd: vscode.Uri.file(manifest.cwd) } },
		}));
		context.subscriptions.push(api.registerContentMappers('Vue.volar', contributions));
	}, error => logger.logger.value?.error(String(error)));
}

function resolveServerPath() {
	if (!config.server.path) {
		return;
	}

	for (
		const serverPath of path.isAbsolute(config.server.path)
			? [config.server.path]
			: vscode.workspace.workspaceFolders
				?.filter(({ uri }) => uri.scheme === 'file')
				.map(({ uri }) => path.join(uri.fsPath, config.server.path!)) ?? []
	) {
		try {
			return require.resolve('./index.js', { paths: [serverPath] });
		}
		catch {}
	}
}
