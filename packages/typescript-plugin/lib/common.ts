import {
	toGeneratedOffset,
	toGeneratedRange,
	toSourceOffsets,
	toSourceRanges,
} from '@volar/typescript/lib/node/transform';
import { getServiceScript } from '@volar/typescript/lib/node/utils';
import { type Language, type VueCodeInformation, type VueCompilerOptions, VueVirtualCode } from '@vue/language-core';
import { capitalize, isGloballyAllowed } from '@vue/shared';
import type * as ts from 'typescript';

const windowsPathReg = /\\/g;

export function preprocessLanguageService(
	languageService: ts.LanguageService,
	getLanguage: () => Language<any> | undefined,
) {
	const {
		getQuickInfoAtPosition,
		getSuggestionDiagnostics,
		getCompletionsAtPosition,
		getCodeFixesAtPosition,
	} = languageService;

	languageService.getQuickInfoAtPosition = (fileName, position, ...rests) => {
		const result = getQuickInfoAtPosition(fileName, position, ...rests);
		if (!result) {
			return result;
		}
		const language = getLanguage();
		if (!language) {
			return result;
		}
		const [serviceScript, _targetScript, sourceScript] = getServiceScript(language, fileName);
		if (!serviceScript || !(sourceScript?.generated?.root instanceof VueVirtualCode)) {
			return result;
		}
		for (
			const sourceOffset of toSourceOffsets(
				sourceScript,
				language,
				serviceScript,
				position,
				() => true,
			)
		) {
			const generatedOffset2 = toGeneratedOffset(
				language,
				serviceScript,
				sourceScript,
				sourceOffset[1],
				(data: VueCodeInformation) => !!data.__importCompletion,
			);
			if (generatedOffset2 !== undefined) {
				const extraInfo = getQuickInfoAtPosition(fileName, generatedOffset2, ...rests);
				if (extraInfo) {
					result.tags ??= [];
					result.tags.push(...extraInfo.tags ?? []);
				}
			}
		}
		return result;
	};
	languageService.getSuggestionDiagnostics = (fileName, ...rests) => {
		const result = getSuggestionDiagnostics(fileName, ...rests);
		const language = getLanguage();
		if (!language) {
			return result;
		}
		const [serviceScript, _targetScript, sourceScript] = getServiceScript(language, fileName);
		if (!serviceScript || !(sourceScript?.generated?.root instanceof VueVirtualCode)) {
			return result;
		}
		for (const diagnostic of result) {
			for (
				const sourceRange of toSourceRanges(
					sourceScript,
					language,
					serviceScript,
					diagnostic.start,
					diagnostic.start + diagnostic.length,
					true,
					(data: VueCodeInformation) => !!data.__importCompletion,
				)
			) {
				const generateRange2 = toGeneratedRange(
					language,
					serviceScript,
					sourceScript,
					sourceRange[1],
					sourceRange[2],
					(data: VueCodeInformation) => !data.__importCompletion,
				);
				if (generateRange2 !== undefined) {
					diagnostic.start = generateRange2[0];
					diagnostic.length = generateRange2[1] - generateRange2[0];
					break;
				}
			}
		}
		return result;
	};
	languageService.getCompletionsAtPosition = (fileName, position, ...rests) => {
		const result = getCompletionsAtPosition(fileName, position, ...rests);
		if (!result) {
			return result;
		}
		const language = getLanguage();
		if (!language) {
			return result;
		}
		const [serviceScript, _targetScript, sourceScript] = getServiceScript(language, fileName);
		if (!serviceScript || !(sourceScript?.generated?.root instanceof VueVirtualCode)) {
			return result;
		}
		for (
			const sourceOffset of toSourceOffsets(
				sourceScript,
				language,
				serviceScript,
				position,
				() => true,
			)
		) {
			const generatedOffset2 = toGeneratedOffset(
				language,
				serviceScript,
				sourceScript,
				sourceOffset[1],
				(data: VueCodeInformation) => !!data.__importCompletion,
			);
			if (generatedOffset2 !== undefined) {
				const completion2 = getCompletionsAtPosition(fileName, generatedOffset2, ...rests);
				if (completion2) {
					const nameToIndex = new Map(result.entries.map((entry, index) => [entry.name, index]));
					for (const entry of completion2.entries) {
						if (entry.kind === 'warning') {
							continue;
						}
						if (nameToIndex.has(entry.name)) {
							const index = nameToIndex.get(entry.name)!;
							const existingEntry = result.entries[index]!;
							if (existingEntry.kind === 'warning') {
								result.entries[index] = entry;
							}
						}
						else {
							result.entries.push(entry);
						}
					}
				}
			}
		}
		return result;
	};
	languageService.getCodeFixesAtPosition = (fileName, start, end, errorCodes, ...rests) => {
		let result = getCodeFixesAtPosition(fileName, start, end, errorCodes, ...rests);
		// Property 'xxx' does not exist on type 'yyy'.ts(2339)
		if (!errorCodes.includes(2339)) {
			return result;
		}
		const language = getLanguage();
		if (!language) {
			return result;
		}
		const [serviceScript, _targetScript, sourceScript] = getServiceScript(language, fileName);
		if (!serviceScript || !(sourceScript?.generated?.root instanceof VueVirtualCode)) {
			return result;
		}
		for (
			const sourceRange of toSourceRanges(
				sourceScript,
				language,
				serviceScript,
				start,
				end,
				true,
				() => true,
			)
		) {
			const generateRange2 = toGeneratedRange(
				language,
				serviceScript,
				sourceScript,
				sourceRange[1],
				sourceRange[2],
				(data: VueCodeInformation) => !!data.__importCompletion,
			);
			if (generateRange2 !== undefined) {
				let importFixes = getCodeFixesAtPosition(
					fileName,
					generateRange2[0],
					generateRange2[1],
					[2304], // Cannot find name 'xxx'.ts(2304)
					...rests,
				);
				importFixes = importFixes.filter(fix => fix.fixName === 'import');
				result = result.concat(importFixes);
			}
		}
		return result;
	};
}

export function postprocessLanguageService<T>(
	ts: typeof import('typescript'),
	language: Language<T>,
	languageService: ts.LanguageService,
	vueOptions: VueCompilerOptions,
	asScriptId: (fileName: string) => T,
) {
	const proxyCache = new Map<string | symbol, Function | undefined>();
	const getProxyMethod = (target: ts.LanguageService, p: string | symbol): Function | undefined => {
		switch (p) {
			case 'findReferences':
				return findReferences(target[p]);
			case 'getCompletionsAtPosition':
				return getCompletionsAtPosition(target[p]);
			case 'getCompletionEntryDetails':
				return getCompletionEntryDetails(target[p]);
			case 'getCodeFixesAtPosition':
				return getCodeFixesAtPosition(target[p]);
			case 'getDefinitionAndBoundSpan':
				return getDefinitionAndBoundSpan(target[p]);
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

	function findReferences(
		findReferences: ts.LanguageService['findReferences'],
	): ts.LanguageService['findReferences'] {
		return (fileName, ...rest) => {
			const result = findReferences(fileName, ...rest);
			if (!result) {
				return result;
			}
			// #5719
			for (const { references } of result) {
				for (const reference of references) {
					const sourceScript = language.scripts.get(asScriptId(reference.fileName));
					const root = sourceScript?.generated?.root;
					if (!sourceScript || !(root instanceof VueVirtualCode)) {
						continue;
					}
					const styles = root.sfc.styles;
					if (!styles.length) {
						return result;
					}
					const isInStyle = styles.some(style =>
						reference.textSpan.start >= style.startTagEnd
						&& reference.textSpan.start + reference.textSpan.length <= style.endTagStart
					);
					if (!isInStyle) {
						continue;
					}
					const leadingChar = sourceScript.snapshot.getText(reference.textSpan.start - 1, reference.textSpan.start);
					if (leadingChar === '.') {
						reference.textSpan.start--;
						reference.textSpan.length++;
					}
				}
			}
			return result;
		};
	}

	function getCompletionsAtPosition(
		getCompletionsAtPosition: ts.LanguageService['getCompletionsAtPosition'],
	): ts.LanguageService['getCompletionsAtPosition'] {
		return (filePath, position, ...rests) => {
			const fileName = filePath.replace(windowsPathReg, '/');
			const result = getCompletionsAtPosition(fileName, position, ...rests);
			if (result) {
				resolveCompletionResult(
					ts,
					language,
					asScriptId,
					vueOptions,
					fileName,
					position,
					result,
				);
			}
			return result;
		};
	}

	function getCompletionEntryDetails(
		getCompletionEntryDetails: ts.LanguageService['getCompletionEntryDetails'],
	): ts.LanguageService['getCompletionEntryDetails'] {
		return (...args) => {
			const details = getCompletionEntryDetails(...args);
			if (details) {
				resolveCompletionEntryDetails(language, details, args[6]);
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

	function getDefinitionAndBoundSpan(
		getDefinitionAndBoundSpan: ts.LanguageService['getDefinitionAndBoundSpan'],
	): ts.LanguageService['getDefinitionAndBoundSpan'] {
		return (fileName, position, ...rests) => {
			const result = getDefinitionAndBoundSpan(fileName, position, ...rests);

			const program = languageService.getProgram()!;
			const sourceScript = language.scripts.get(asScriptId(fileName));
			const root = sourceScript?.generated?.root;
			if (!(root instanceof VueVirtualCode)) {
				return result;
			}

			if (!result?.definitions?.length) {
				return;
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
						definitions.delete(definition);
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

				if (ts.isIndexedAccessTypeNode(type)) {
					const pos = type.indexType.getStart(sourceFile);
					const res = getDefinitionAndBoundSpan(fileName, pos, ...rests);
					if (res?.definitions?.length) {
						for (const definition of res.definitions) {
							definitions.add(definition);
						}
						skippedDefinitions.push(definition);
					}
				}
				else if (ts.isImportTypeNode(type)) {
					const pos = type.argument.getStart(sourceFile);
					const res = getDefinitionAndBoundSpan(fileName, pos, ...rests);
					if (res?.definitions?.length) {
						for (const definition of res.definitions) {
							definitions.add(definition);
						}
						skippedDefinitions.push(definition);
					}
				}
			}
		};
	}
}

export function resolveCompletionResult<T>(
	ts: typeof import('typescript'),
	language: Language<T>,
	asScriptId: (fileName: string) => T,
	vueOptions: VueCompilerOptions,
	fileName: string,
	position: number,
	result: ts.CompletionInfo,
) {
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
			const data = item.data as VueCompletionData;
			const oldName = item.name;
			for (const vueExt of vueOptions.extensions) {
				const suffix = capitalize(vueExt.slice(1)); // .vue -> Vue
				if (item.source.endsWith(vueExt) && item.name.endsWith(suffix)) {
					item.name = capitalize(item.name.slice(0, -suffix.length));
					if (item.insertText) {
						// #2286
						item.insertText = item.insertText.replace(`${suffix}$1`, '$1');
					}
					if (data) {
						data.__vue__componentAutoImport = {
							oldName,
							newName: item.name,
						};
					}
					break;
				}
			}
			if (data) {
				data.__vue__autoImport = {
					fileName,
				};
			}
		}
	}
}

export type VueCompletionData =
	| ts.CompletionEntryData & {
		__vue__componentAutoImport?: {
			oldName: string;
			newName: string;
		};
		__vue__autoImport?: {
			fileName: string;
		};
		__vue__autoImportSuggestions?: {
			fileName: string;
			position: number;
			entryName: string;
			source: string | undefined;
		};
	}
	| undefined;

export function resolveCompletionEntryDetails(
	language: Language<any>,
	details: ts.CompletionEntryDetails,
	data: VueCompletionData,
) {
	// modify import statement
	if (data?.__vue__componentAutoImport) {
		const { oldName, newName } = data.__vue__componentAutoImport;
		for (const codeAction of details?.codeActions ?? []) {
			for (const change of codeAction.changes) {
				for (const textChange of change.textChanges) {
					textChange.newText = textChange.newText.replace(
						'import ' + oldName + ' from ',
						'import ' + newName + ' from ',
					);
				}
			}
		}
	}
	// #5874
	if (data?.__vue__autoImportSuggestions) {
		for (const codeAction of details?.codeActions ?? []) {
			for (const change of codeAction.changes) {
				for (const textChange of change.textChanges) {
					if (data.__vue__componentAutoImport) {
						const { oldName, newName } = data.__vue__componentAutoImport;
						textChange.newText = textChange.newText.replace(
							'import type ' + oldName + ' from ',
							'import ' + newName + ' from ',
						);
					}
					const { entryName } = data.__vue__autoImportSuggestions;
					textChange.newText = textChange.newText.replace(
						'import type { ' + entryName + ' } from ',
						'import { ' + entryName + ' } from ',
					);
				}
			}
		}
	}
	if (data?.__vue__autoImport) {
		const { fileName } = data.__vue__autoImport;
		const sourceScript = language.scripts.get(fileName);
		if (sourceScript?.generated?.root instanceof VueVirtualCode) {
			const { vueSfc } = sourceScript.generated.root;
			if (!vueSfc?.descriptor.script && !vueSfc?.descriptor.scriptSetup) {
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
}
