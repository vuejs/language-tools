import type * as ts from 'typescript/lib/tsserverlibrary';
import { getProgram } from './getProgram';
import * as embedded from '@volar/language-core';

export function createLanguageService(host: embedded.LanguageServiceHost, mods: embedded.LanguageModule[]) {

	type _LanguageService = {
		__internal__: {
			languageService: ts.LanguageService;
			context: embedded.EmbeddedLanguageContext;
		};
	} & ts.LanguageService;

	const core = embedded.createEmbeddedLanguageServiceHost(host, mods);
	const ts = host.getTypeScriptModule();
	const ls = ts.createLanguageService(core.typescriptLanguageServiceHost);

	return new Proxy<Partial<_LanguageService>>({
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

		__internal__: {
			context: core,
			languageService: ls,
		},
	}, {
		get: (target: any, property: keyof ts.LanguageService) => {
			if (property in target) {
				return target[property];
			}
			return ls[property];
		},
	}) as _LanguageService;

	// apis
	function organizeImports(args: ts.OrganizeImportsArgs, formatOptions: ts.FormatCodeSettings, preferences: ts.UserPreferences | undefined): ReturnType<ts.LanguageService['organizeImports']> {
		let edits: readonly ts.FileTextChanges[] = [];
		const file = core.mapper.get(args.fileName)?.[1];
		if (file) {
			embedded.forEachEmbeddedFile(file, embedded => {
				if (embedded.kind && embedded.capabilities.codeAction) {
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

				const virtualFile = core.mapper.getSourceByVirtualFileName(ref.fileName)?.[2];
				if (!virtualFile)
					continue;

				const teleport = core.mapper.getTeleport(virtualFile);
				if (!teleport)
					continue;

				for (const teleOffset of teleport.findTeleports(ref.textSpan.start, data => {
					if ((mode === 'definition' || mode === 'typeDefinition' || mode === 'implementation') && !data.definition)
						return false;
					if ((mode === 'references') && !data.references)
						return false;
					if ((mode === 'rename') && !data.rename)
						return false;
					return true;
				})) {
					if (loopChecker.has(ref.fileName + ':' + teleOffset))
						continue;
					withTeleports(ref.fileName, teleOffset);
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

				const virtualFile = core.mapper.getSourceByVirtualFileName(ref.fileName)?.[2];
				if (!virtualFile)
					continue;

				const teleport = core.mapper.getTeleport(virtualFile);
				if (!teleport)
					continue;

				for (const teleOffset of teleport.findTeleports(ref.textSpan.start, data => !!data.definition)) {
					if (loopChecker.has(ref.fileName + ':' + teleOffset))
						continue;
					withTeleports(ref.fileName, teleOffset);
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

					const virtualFile = core.mapper.getSourceByVirtualFileName(ref.fileName)?.[2];
					if (!virtualFile)
						continue;

					const teleport = core.mapper.getTeleport(virtualFile);
					if (!teleport)
						continue;

					for (const telePos of teleport.findTeleports(ref.textSpan.start, data => !!data.references)) {
						if (loopChecker.has(ref.fileName + ':' + telePos))
							continue;
						withTeleports(ref.fileName, telePos);
					}
				}
			}
		}
	}

	// transforms
	function transformFileTextChanges(changes: ts.FileTextChanges): ts.FileTextChanges | undefined {
		const source = core.mapper.getSourceByVirtualFileName(changes.fileName);
		if (source) {
			return {
				...changes,
				fileName: source[0],
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
		const source = core.mapper.getSourceByVirtualFileName(fileName);
		if (source) {
			for (const [sourceFileName, map] of core.mapper.getMaps(source[2])) {

				if (source[0] !== sourceFileName)
					continue;

				const sourceLoc = map.toSourceOffset(textSpan.start);
				if (sourceLoc) {
					return {
						fileName: source[0],
						textSpan: {
							start: sourceLoc[0],
							length: textSpan.length,
						},
					};
				}
			}
		}
		else {
			return {
				fileName,
				textSpan,
			};
		}
	}
}

function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}
