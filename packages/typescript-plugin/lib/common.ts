import { type Language, type VueCompilerOptions, VueVirtualCode } from '@vue/language-core';
import { capitalize, isGloballyAllowed } from '@vue/shared';
import type * as ts from 'typescript';

const windowsPathReg = /\\/g;

export function createVueLanguageServiceProxy<T>(
	ts: typeof import('typescript'),
	language: Language<T>,
	languageService: ts.LanguageService,
	vueOptions: VueCompilerOptions,
	asScriptId: (fileName: string) => T,
) {
	const proxyCache = new Map<string | symbol, Function | undefined>();
	const getProxyMethod = (target: ts.LanguageService, p: string | symbol): Function | undefined => {
		switch (p) {
			case 'getCompletionsAtPosition':
				return getCompletionsAtPosition(ts, language, asScriptId, vueOptions, target[p]);
			case 'getCompletionEntryDetails':
				return getCompletionEntryDetails(language, target[p]);
			case 'getCodeFixesAtPosition':
				return getCodeFixesAtPosition(target[p]);
			case 'getDefinitionAndBoundSpan':
				return getDefinitionAndBoundSpan(ts, language, asScriptId, languageService, vueOptions, target[p]);
		}
	};

	return new Proxy(languageService, {
		get(target, p, receiver) {
			if (!proxyCache.has(p)) {
				proxyCache.set(p, getProxyMethod(target, p));
			}
			const proxyMethod = proxyCache.get(p);
			if (proxyMethod) {
				return proxyMethod;
			}
			return Reflect.get(target, p, receiver);
		},
		set(target, p, value, receiver) {
			return Reflect.set(target, p, value, receiver);
		},
	});
}

function getCompletionsAtPosition<T>(
	ts: typeof import('typescript'),
	language: Language<T>,
	asScriptId: (fileName: string) => T,
	vueOptions: VueCompilerOptions,
	getCompletionsAtPosition: ts.LanguageService['getCompletionsAtPosition'],
): ts.LanguageService['getCompletionsAtPosition'] {
	return (filePath, position, options, formattingSettings) => {
		const fileName = filePath.replace(windowsPathReg, '/');
		const result = getCompletionsAtPosition(fileName, position, options, formattingSettings);
		if (result) {
			// filter __VLS_
			result.entries = result.entries.filter(
				entry =>
					!entry.name.includes('__VLS_')
					&& !entry.labelDetails?.description?.includes('__VLS_'),
			);

			// filter global variables in template and styles
			const sourceScript = language.scripts.get(asScriptId(fileName));
			const root = sourceScript?.generated?.root;
			if (root instanceof VueVirtualCode) {
				const blocks = [
					root.sfc.template,
					...root.sfc.styles,
				];
				const ranges = blocks.filter(Boolean).map(block =>
					[
						block!.startTagEnd,
						block!.endTagStart,
					] as const
				);

				if (ranges.some(([start, end]) => position >= start && position <= end)) {
					const globalKinds = new Set(['var', 'function', 'module']);
					const globalsOrKeywords = (ts as any).Completions.SortText.GlobalsOrKeywords;
					const sortTexts = new Set([
						globalsOrKeywords,
						'z' + globalsOrKeywords,
						globalsOrKeywords + '1',
					]);

					result.entries = result.entries.filter(entry =>
						!(entry.kind === 'const' && entry.name in vueOptions.macros) && (
							!globalKinds.has(entry.kind)
							|| !sortTexts.has(entry.sortText)
							|| isGloballyAllowed(entry.name)
						)
					);
				}
			}

			// modify label
			for (const item of result.entries) {
				if (item.source) {
					const originalName = item.name;
					for (const vueExt of vueOptions.extensions) {
						const suffix = capitalize(vueExt.slice(1)); // .vue -> Vue
						if (item.source.endsWith(vueExt) && item.name.endsWith(suffix)) {
							item.name = capitalize(item.name.slice(0, -suffix.length));
							if (item.insertText) {
								// #2286
								item.insertText = item.insertText.replace(`${suffix}$1`, '$1');
							}
							if (item.data) {
								// @ts-expect-error
								item.data.__isComponentAutoImport = {
									ext: vueExt,
									suffix,
									originalName,
									newName: item.insertText,
								};
							}
							break;
						}
					}
					if (item.data) {
						// @ts-expect-error
						item.data.__isAutoImport = {
							fileName,
						};
					}
				}
			}
		}
		return result;
	};
}

function getCompletionEntryDetails<T>(
	language: Language<T>,
	getCompletionEntryDetails: ts.LanguageService['getCompletionEntryDetails'],
): ts.LanguageService['getCompletionEntryDetails'] {
	return (...args) => {
		const details = getCompletionEntryDetails(...args);
		// modify import statement
		// @ts-expect-error
		if (args[6]?.__isComponentAutoImport) {
			// @ts-expect-error
			const { originalName, newName } = args[6].__isComponentAutoImport;
			for (const codeAction of details?.codeActions ?? []) {
				for (const change of codeAction.changes) {
					for (const textChange of change.textChanges) {
						textChange.newText = textChange.newText.replace(
							'import ' + originalName + ' from ',
							'import ' + newName + ' from ',
						);
					}
				}
			}
		}
		// @ts-expect-error
		if (args[6]?.__isAutoImport) {
			// @ts-expect-error
			const { fileName } = args[6].__isAutoImport;
			const sourceScript = language.scripts.get(fileName);
			if (sourceScript?.generated?.root instanceof VueVirtualCode) {
				const sfc = sourceScript.generated.root.vueSfc;
				if (!sfc?.descriptor.script && !sfc?.descriptor.scriptSetup) {
					for (const codeAction of details?.codeActions ?? []) {
						for (const change of codeAction.changes) {
							for (const textChange of change.textChanges) {
								textChange.newText = `<script setup lang="ts">${textChange.newText}</script>\n\n`;
								break;
							}
							break;
						}
						break;
					}
				}
			}
		}
		return details;
	};
}

function getCodeFixesAtPosition(
	getCodeFixesAtPosition: ts.LanguageService['getCodeFixesAtPosition'],
): ts.LanguageService['getCodeFixesAtPosition'] {
	return (...args) => {
		let result = getCodeFixesAtPosition(...args);
		// filter __VLS_
		result = result.filter(entry => !entry.description.includes('__VLS_'));
		return result;
	};
}

function getDefinitionAndBoundSpan<T>(
	ts: typeof import('typescript'),
	language: Language<T>,
	asScriptId: (fileName: string) => T,
	languageService: ts.LanguageService,
	vueOptions: VueCompilerOptions,
	getDefinitionAndBoundSpan: ts.LanguageService['getDefinitionAndBoundSpan'],
): ts.LanguageService['getDefinitionAndBoundSpan'] {
	return (fileName, position) => {
		const result = getDefinitionAndBoundSpan(fileName, position);
		if (!result?.definitions?.length) {
			return result;
		}

		const program = languageService.getProgram()!;
		const sourceScript = language.scripts.get(asScriptId(fileName));
		if (!sourceScript?.generated) {
			return result;
		}

		const root = sourceScript.generated.root;
		if (!(root instanceof VueVirtualCode)) {
			return result;
		}

		if (
			!root.sfc.template
			|| position < root.sfc.template.startTagEnd
			|| position > root.sfc.template.endTagStart
		) {
			return result;
		}

		const definitions = new Set<ts.DefinitionInfo>(result.definitions);
		const skippedDefinitions: ts.DefinitionInfo[] = [];

		// #5275
		if (result.definitions.length >= 2) {
			for (const definition of result.definitions) {
				if (
					root.sfc.content[definition.textSpan.start - 1] === '@'
					|| root.sfc.content.slice(definition.textSpan.start - 5, definition.textSpan.start) === 'v-on:'
				) {
					skippedDefinitions.push(definition);
				}
			}
		}

		for (const definition of result.definitions) {
			if (vueOptions.extensions.some(ext => definition.fileName.endsWith(ext))) {
				continue;
			}

			const sourceFile = program.getSourceFile(definition.fileName);
			if (!sourceFile) {
				continue;
			}

			visit(sourceFile, definition, sourceFile);
		}

		for (const definition of skippedDefinitions) {
			definitions.delete(definition);
		}

		return {
			definitions: [...definitions],
			textSpan: result.textSpan,
		};

		function visit(
			node: ts.Node,
			definition: ts.DefinitionInfo,
			sourceFile: ts.SourceFile,
		) {
			if (ts.isPropertySignature(node) && node.type) {
				proxy(node.name, node.type, definition, sourceFile);
			}
			else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.type && !node.initializer) {
				proxy(node.name, node.type, definition, sourceFile);
			}
			else {
				ts.forEachChild(node, child => visit(child, definition, sourceFile));
			}
		}

		function proxy(
			name: ts.PropertyName,
			type: ts.TypeNode,
			definition: ts.DefinitionInfo,
			sourceFile: ts.SourceFile,
		) {
			const { textSpan, fileName } = definition;
			const start = name.getStart(sourceFile);
			const end = name.getEnd();

			if (start !== textSpan.start || end - start !== textSpan.length) {
				return;
			}

			if (!ts.isIndexedAccessTypeNode(type)) {
				return;
			}

			const pos = type.indexType.getStart(sourceFile);
			const res = getDefinitionAndBoundSpan(fileName, pos);
			if (res?.definitions?.length) {
				for (const definition of res.definitions) {
					definitions.add(definition);
				}
				skippedDefinitions.push(definition);
			}
		}
	};
}
