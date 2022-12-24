import { FileRangeCapabilities } from '@volar/language-core';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceMapWithDocuments } from '../documents';
import type { LanguageServiceRuntimeContext } from '../types';
import * as dedupe from '../utils/dedupe';
import { languageFeatureWorker } from '../utils/featureWorkers';

export function updateRange(
	range: vscode.Range,
	change: {
		range: vscode.Range,
		newEnd: vscode.Position;
	},
) {
	if (!updatePosition(range.start, change, false)) {
		return;
	}
	if (!updatePosition(range.end, change, true)) {
		return;
	}
	if (range.end.line === range.start.line && range.end.character <= range.start.character) {
		range.end.character++;
	}
	return range;
}

function updatePosition(
	position: vscode.Position,
	change: {
		range: vscode.Range,
		newEnd: vscode.Position;
	},
	isEnd: boolean,
) {
	if (change.range.end.line > position.line) {
		if (change.newEnd.line > position.line) {
			// No change
			return true;
		}
		else if (change.newEnd.line === position.line) {
			position.character = Math.min(position.character, change.newEnd.character);
			return true;
		}
		else if (change.newEnd.line < position.line) {
			position.line = change.newEnd.line;
			position.character = change.newEnd.character;
			return true;
		}
	}
	else if (change.range.end.line === position.line) {
		const characterDiff = change.newEnd.character - change.range.end.character;
		if (position.character >= change.range.end.character) {
			if (change.newEnd.line !== change.range.end.line) {
				position.line = change.newEnd.line;
				position.character = change.newEnd.character + position.character - change.range.end.character;
			}
			else {
				if (isEnd ? change.range.end.character < position.character : change.range.end.character <= position.character) {
					position.character += characterDiff;
				}
				else {
					const offset = change.range.end.character - position.character;
					if (-characterDiff > offset) {
						position.character += characterDiff + offset;
					}
				}
			}
			return true;
		}
		else {
			if (change.newEnd.line === change.range.end.line) {
				const offset = change.range.end.character - position.character;
				if (-characterDiff > offset) {
					position.character += characterDiff + offset;
				}
			}
			else if (change.newEnd.line < change.range.end.line) {
				position.line = change.newEnd.line;
				position.character = change.newEnd.character;
			}
			else {
				// No change
			}
			return true;
		}
	}
	else if (change.range.end.line < position.line) {
		position.line += change.newEnd.line - change.range.end.line;
		return true;
	}
	return false;
}

export function register(context: LanguageServiceRuntimeContext) {

	interface Cache {
		snapshot: ts.IScriptSnapshot | undefined;
		errors: vscode.Diagnostic[];
	}
	const responseCache = new Map<
		string,
		{ [key in 'nonTs' | 'tsSemantic' | 'tsDeclaration' | 'tsSyntactic' | 'tsSuggestion']: Cache }
	>();
	const nonTsCache = new Map<
		number,
		Map<
			string,
			{
				documentVersion: number,
				tsProjectVersion: string | undefined,
				errors: vscode.Diagnostic[] | undefined | null,
			}
		>
	>();
	const scriptTsCache_semantic: typeof nonTsCache = new Map();
	const scriptTsCache_declaration: typeof nonTsCache = new Map();
	const scriptTsCache_syntactic: typeof nonTsCache = new Map();
	const scriptTsCache_suggestion: typeof nonTsCache = new Map();

	return async (uri: string, token?: vscode.CancellationToken, response?: (result: vscode.Diagnostic[]) => void) => {

		const cache = responseCache.get(uri) ?? responseCache.set(uri, {
			nonTs: { snapshot: undefined, errors: [] },
			tsSemantic: { snapshot: undefined, errors: [] },
			tsDeclaration: { snapshot: undefined, errors: [] },
			tsSuggestion: { snapshot: undefined, errors: [] },
			tsSyntactic: { snapshot: undefined, errors: [] },
		}).get(uri)!;
		const newSnapshot = context.host.getScriptSnapshot(shared.getPathOfUri(uri));
		const newDocument = newSnapshot ? TextDocument.create('file://a.txt', 'txt', 0, newSnapshot.getText(0, newSnapshot.getLength())) : undefined;

		let failedToUpdateRange = false;
		let errorsUpdated = false;
		let lastCheckCancelAt = 0;

		for (const _cache of Object.values(cache)) {

			const oldSnapshot = _cache.snapshot;
			const change = oldSnapshot ? newSnapshot?.getChangeRange(oldSnapshot) : undefined;

			_cache.snapshot = newSnapshot;

			if (!failedToUpdateRange && newDocument && oldSnapshot && newSnapshot && change) {
				const oldDocument = TextDocument.create('file://a.txt', 'txt', 0, oldSnapshot.getText(0, oldSnapshot.getLength()));
				const changeRange = {
					range: {
						start: oldDocument.positionAt(change.span.start),
						end: oldDocument.positionAt(change.span.start + change.span.length),
					},
					newEnd: newDocument.positionAt(change.span.start + change.newLength),
				};
				for (const error of _cache.errors) {
					if (!updateRange(error.range, changeRange)) {
						failedToUpdateRange = true;
						break;
					}
				}
			}
		}

		await worker('onSyntactic', scriptTsCache_syntactic, cache.tsSyntactic);
		doResponse();
		await worker('onSuggestion', scriptTsCache_suggestion, cache.tsSuggestion);
		doResponse();
		await worker('onSemantic', scriptTsCache_semantic, cache.tsSemantic);
		doResponse();
		await worker('onDeclaration', scriptTsCache_declaration, cache.tsDeclaration);

		return getErrors();

		function doResponse() {
			if (errorsUpdated && !failedToUpdateRange) {
				response?.(getErrors());
				errorsUpdated = false;
			}
		}

		function getErrors() {
			return Object.values(cache).flatMap(({ errors }) => errors);
		}

		async function worker(
			mode: 'onSemantic' | 'onSyntactic' | 'onSuggestion' | 'onDeclaration',
			cacheMap: typeof nonTsCache,
			cache: Cache,
		) {
			const result = await languageFeatureWorker(
				context,
				uri,
				true,
				function* (arg, _, file) {
					if (file.capabilities.diagnostic) {
						yield arg;
					}
				},
				async (plugin, document) => {

					if (token) {

						if (Date.now() - lastCheckCancelAt >= 5) {
							await shared.sleep(5); // wait for LSP event polling
							lastCheckCancelAt = Date.now();
						}

						if (token.isCancellationRequested)
							return;
					}

					const pluginId = context.plugins.indexOf(plugin);
					const pluginCache = cacheMap.get(pluginId) ?? cacheMap.set(pluginId, new Map()).get(pluginId)!;
					const cache = pluginCache.get(document.uri);
					const tsProjectVersion = (mode === 'onDeclaration' || mode === 'onSemantic') ? context.core.typescript.languageServiceHost.getProjectVersion?.() : undefined;

					if (mode === 'onDeclaration' || mode === 'onSemantic') {
						if (cache && cache.documentVersion === document.version && cache.tsProjectVersion === tsProjectVersion) {
							return cache.errors;
						}
					}
					else {
						if (cache && cache.documentVersion === document.version) {
							return cache.errors;
						}
					}

					const errors = await plugin.validation?.[mode]?.(document);

					errorsUpdated = true;

					pluginCache.set(document.uri, {
						documentVersion: document.version,
						errors,
						tsProjectVersion,
					});

					return errors;
				},
				(errors, map) => transformErrorRange(map, errors),
				arr => dedupe.withDiagnostics(arr.flat()),
			);

			if (result) {
				cache.errors = result;
				cache.snapshot = newSnapshot;
			}
		}
	};

	function transformErrorRange(map: SourceMapWithDocuments<FileRangeCapabilities> | undefined, errors: vscode.Diagnostic[]) {

		const result: vscode.Diagnostic[] = [];

		for (const error of errors) {

			// clone it to avoid modify cache
			let _error: vscode.Diagnostic = { ...error };

			if (map) {
				const range = map.toSourceRange(error.range, data => !!data.diagnostic);
				if (!range) {
					continue;
				}
				_error.range = range;
			}

			if (_error.relatedInformation) {

				const relatedInfos: vscode.DiagnosticRelatedInformation[] = [];

				for (const info of _error.relatedInformation) {
					if (context.documents.getVirtualFileByUri(info.location.uri)) {
						for (const [_, map] of context.documents.getMapsByVirtualFileUri(info.location.uri)) {
							const range = map.toSourceRange(info.location.range, data => !!data.diagnostic);
							if (range) {
								relatedInfos.push({
									location: {
										uri: map.sourceFileDocument.uri,
										range,
									},
									message: info.message,
								});
							}
						}
					}
					else {
						relatedInfos.push(info);
					}
				}

				_error.relatedInformation = relatedInfos;
			}

			result.push(_error);
		}

		return result;
	}
}
