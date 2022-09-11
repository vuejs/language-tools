import * as tsFaster from '@volar/typescript-faster';
import * as vue from '@volar/vue-language-core';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { getProgram } from './getProgram';
import * as embedded from '@volar/language-core';

export function createLanguageService(host: vue.LanguageServiceHost) {

	const mods = [vue.createEmbeddedLanguageModule(
		host.getTypeScriptModule(),
		host.getCurrentDirectory(),
		host.getCompilationSettings(),
		host.getVueCompilationSettings(),
	)];
	const core = embedded.createEmbeddedLanguageServiceHost(host, mods);
	const ts = host.getTypeScriptModule();
	const ls = ts.createLanguageService(core.typescriptLanguageServiceHost);

	tsFaster.decorate(ts, core.typescriptLanguageServiceHost, ls);

	const proxy: Partial<ts.LanguageService> = {
		organizeImports,

		// only support for .ts for now, not support for .vue
		getCompletionsAtPosition,
		getDefinitionAtPosition,
		getDefinitionAndBoundSpan,
		getTypeDefinitionAtPosition,
		getImplementationAtPosition,
		findRenameLocations,
		getReferencesAtPosition,
		findReferences,

		// TODO: now is handled by vue server
		// prepareCallHierarchy: tsLanguageService.rawLs.prepareCallHierarchy,
		// provideCallHierarchyIncomingCalls: tsLanguageService.rawLs.provideCallHierarchyIncomingCalls,
		// provideCallHierarchyOutgoingCalls: tsLanguageService.rawLs.provideCallHierarchyOutgoingCalls,
		// getEditsForFileRename: tsLanguageService.rawLs.getEditsForFileRename,

		// TODO
		// getCodeFixesAtPosition: tsLanguageService.rawLs.getCodeFixesAtPosition,
		// getCombinedCodeFix: tsLanguageService.rawLs.getCombinedCodeFix,
		// applyCodeActionCommand: tsLanguageService.rawLs.applyCodeActionCommand,
		// getApplicableRefactors: tsLanguageService.rawLs.getApplicableRefactors,
		// getEditsForRefactor: tsLanguageService.rawLs.getEditsForRefactor,

		getProgram: () => getProgram(ts, core, ls),
	};

	return new Proxy(ls, {
		get: (target: any, property: keyof ts.LanguageService) => {
			if (property in proxy) {
				return proxy[property];
			}
			return target[property];
		},
	});

	// apis
	function organizeImports(args: ts.OrganizeImportsArgs, formatOptions: ts.FormatCodeSettings, preferences: ts.UserPreferences | undefined): ReturnType<ts.LanguageService['organizeImports']> {
		const file = core.mapper.get(args.fileName);
		let edits: readonly ts.FileTextChanges[] = [];
		if (file) {
			embedded.forEachEmbeddeds(file[0], embedded => {
				if (embedded.isTsHostFile && embedded.capabilities.codeActions) {
					edits = edits.concat(ls.organizeImports({
						...args,
						fileName: embedded.fileName,
					}, formatOptions, preferences));
				}
			});
		}
		else {
			return ls.organizeImports(args, formatOptions, preferences);
		}
		return edits.map(transformFileTextChanges).filter(notEmpty);
	}
	function getCompletionsAtPosition(fileName: string, position: number, options: ts.GetCompletionsAtPositionOptions | undefined): ReturnType<ts.LanguageService['getCompletionsAtPosition']> {
		const finalResult = ls.getCompletionsAtPosition(fileName, position, options);
		if (finalResult) {
			finalResult.entries = finalResult.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
		}
		return finalResult;
	}
	function getReferencesAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getReferencesAtPosition']> {
		return findLocations(fileName, position, 'references') as ts.ReferenceEntry[];
	}
	function getDefinitionAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getDefinitionAtPosition']> {
		return findLocations(fileName, position, 'definition') as ts.DefinitionInfo[];
	}
	function getTypeDefinitionAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getDefinitionAtPosition']> {
		return findLocations(fileName, position, 'typeDefinition') as ts.DefinitionInfo[];
	}
	function getImplementationAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getImplementationAtPosition']> {
		return findLocations(fileName, position, 'implementation') as ts.ImplementationLocation[];
	}
	function findRenameLocations(fileName: string, position: number, findInStrings: boolean, findInComments: boolean, providePrefixAndSuffixTextForRename?: boolean): ReturnType<ts.LanguageService['findRenameLocations']> {
		return findLocations(fileName, position, 'rename', findInStrings, findInComments, providePrefixAndSuffixTextForRename) as ts.RenameLocation[];
	}
	function findLocations(
		fileName: string,
		position: number,
		mode: 'definition' | 'typeDefinition' | 'references' | 'implementation' | 'rename',
		findInStrings = false,
		findInComments = false,
		providePrefixAndSuffixTextForRename?: boolean
	) {

		const loopChecker = new Set<string>();
		let symbols: (ts.DefinitionInfo | ts.ReferenceEntry | ts.ImplementationLocation | ts.RenameLocation)[] = [];

		withTeleports(fileName, position);

		return symbols.map(s => transformDocumentSpanLike(s)).filter(notEmpty);

		function withTeleports(fileName: string, position: number) {
			if (loopChecker.has(fileName + ':' + position))
				return;
			loopChecker.add(fileName + ':' + position);
			const _symbols = mode === 'definition' ? ls.getDefinitionAtPosition(fileName, position)
				: mode === 'typeDefinition' ? ls.getTypeDefinitionAtPosition(fileName, position)
					: mode === 'references' ? ls.getReferencesAtPosition(fileName, position)
						: mode === 'implementation' ? ls.getImplementationAtPosition(fileName, position)
							: mode === 'rename' ? ls.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename)
								: undefined;
			if (!_symbols) return;
			symbols = symbols.concat(_symbols);
			for (const ref of _symbols) {
				loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
				const teleport = core.mapper.getTeleport(ref.fileName);

				if (!teleport)
					continue;

				for (const [teleRange] of teleport.findTeleports(
					ref.textSpan.start,
					ref.textSpan.start + ref.textSpan.length,
					sideData => {
						if ((mode === 'definition' || mode === 'typeDefinition' || mode === 'implementation') && !sideData.definitions)
							return false;
						if ((mode === 'references') && !sideData.references)
							return false;
						if ((mode === 'rename') && !sideData.rename)
							return false;
						return true;
					},
				)) {
					if (loopChecker.has(ref.fileName + ':' + teleRange.start))
						continue;
					withTeleports(ref.fileName, teleRange.start);
				}
			}
		}
	}
	function getDefinitionAndBoundSpan(fileName: string, position: number): ReturnType<ts.LanguageService['getDefinitionAndBoundSpan']> {

		const loopChecker = new Set<string>();
		let textSpan: ts.TextSpan | undefined;
		let symbols: ts.DefinitionInfo[] = [];

		withTeleports(fileName, position);

		if (!textSpan) return;
		return {
			textSpan: textSpan,
			definitions: symbols?.map(s => transformDocumentSpanLike(s)).filter(notEmpty),
		};

		function withTeleports(fileName: string, position: number) {
			if (loopChecker.has(fileName + ':' + position))
				return;
			loopChecker.add(fileName + ':' + position);
			const _symbols = ls.getDefinitionAndBoundSpan(fileName, position);
			if (!_symbols) return;
			if (!textSpan) {
				textSpan = _symbols.textSpan;
			}
			if (!_symbols.definitions) return;
			symbols = symbols.concat(_symbols.definitions);
			for (const ref of _symbols.definitions) {

				loopChecker.add(ref.fileName + ':' + ref.textSpan.start);

				const teleport = core.mapper.getTeleport(ref.fileName);
				if (!teleport)
					continue;

				for (const [teleRange] of teleport.findTeleports(
					ref.textSpan.start,
					ref.textSpan.start + ref.textSpan.length,
					sideData => !!sideData.definitions,
				)) {
					if (loopChecker.has(ref.fileName + ':' + teleRange.start))
						continue;
					withTeleports(ref.fileName, teleRange.start);
				}
			}
		}
	}
	function findReferences(fileName: string, position: number): ReturnType<ts.LanguageService['findReferences']> {

		const loopChecker = new Set<string>();
		let symbols: ts.ReferencedSymbol[] = [];

		withTeleports(fileName, position);

		return symbols.map(s => transformReferencedSymbol(s)).filter(notEmpty);

		function withTeleports(fileName: string, position: number) {
			if (loopChecker.has(fileName + ':' + position))
				return;
			loopChecker.add(fileName + ':' + position);
			const _symbols = ls.findReferences(fileName, position);
			if (!_symbols) return;
			symbols = symbols.concat(_symbols);
			for (const symbol of _symbols) {
				for (const ref of symbol.references) {

					loopChecker.add(ref.fileName + ':' + ref.textSpan.start);

					const teleport = core.mapper.getTeleport(ref.fileName);
					if (!teleport)
						continue;

					for (const [teleRange] of teleport.findTeleports(
						ref.textSpan.start,
						ref.textSpan.start + ref.textSpan.length,
						sideData => !!sideData.references,
					)) {
						if (loopChecker.has(ref.fileName + ':' + teleRange.start))
							continue;
						withTeleports(ref.fileName, teleRange.start);
					}
				}
			}
		}
	}

	// transforms
	function transformFileTextChanges(changes: ts.FileTextChanges): ts.FileTextChanges | undefined {
		const sourceFile = core.mapper.fromEmbeddedFileName(changes.fileName);
		if (sourceFile) {
			return {
				...changes,
				fileName: sourceFile.vueFile.fileName,
				textChanges: changes.textChanges.map(c => {
					const span = transformSpan(changes.fileName, c.span);
					if (span) {
						return {
							...c,
							span: span.textSpan,
						};
					}
				}).filter(notEmpty),
			};
		}
		else {
			return changes;
		}
	}
	function transformReferencedSymbol(symbol: ts.ReferencedSymbol): ts.ReferencedSymbol | undefined {
		const definition = transformDocumentSpanLike(symbol.definition);
		const references = symbol.references.map(r => transformDocumentSpanLike(r)).filter(notEmpty);
		if (definition) {
			return {
				definition,
				references,
			};
		}
		else if (references.length) { // TODO: remove patching
			return {
				definition: {
					...symbol.definition,
					fileName: references[0].fileName,
					textSpan: references[0].textSpan,
				},
				references,
			};
		}
	}
	function transformDocumentSpanLike<T extends ts.DocumentSpan>(documentSpan: T): T | undefined {
		const textSpan = transformSpan(documentSpan.fileName, documentSpan.textSpan);
		if (!textSpan) return;
		const contextSpan = transformSpan(documentSpan.fileName, documentSpan.contextSpan);
		const originalTextSpan = transformSpan(documentSpan.originalFileName, documentSpan.originalTextSpan);
		const originalContextSpan = transformSpan(documentSpan.originalFileName, documentSpan.originalContextSpan);
		return {
			...documentSpan,
			fileName: textSpan.fileName,
			textSpan: textSpan.textSpan,
			contextSpan: contextSpan?.textSpan,
			originalFileName: originalTextSpan?.fileName,
			originalTextSpan: originalTextSpan?.textSpan,
			originalContextSpan: originalContextSpan?.textSpan,
		};
	}
	function transformSpan(fileName: string | undefined, textSpan: ts.TextSpan | undefined) {
		if (!fileName) return;
		if (!textSpan) return;
		for (const vueLoc of core.mapper.fromEmbeddedLocation(fileName, textSpan.start, textSpan.start + textSpan.length)) {
			return {
				fileName: vueLoc.fileName,
				textSpan: {
					start: vueLoc.range.start,
					length: vueLoc.range.end - vueLoc.range.start,
				},
			};
		}
	}
}

function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
