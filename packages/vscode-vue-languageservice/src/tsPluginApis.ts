import type { ApiLanguageServiceContext } from './types';
import type * as ts from 'typescript';
import { fsPathToUri, notEmpty, uriToFsPath } from '@volar/shared';

export function register({ sourceFiles, getTsLs, scriptTsLs }: ApiLanguageServiceContext) {

    return {
        getCompletionsAtPosition,
        getDefinitionAtPosition,
        getDefinitionAndBoundSpan,
        getTypeDefinitionAtPosition,
        getImplementationAtPosition,
        findRenameLocations,
        getReferencesAtPosition,
        findReferences,
    };

    // apis
    function getCompletionsAtPosition(fileName: string, position: number, options: ts.GetCompletionsAtPositionOptions | undefined): ReturnType<ts.LanguageService['getCompletionsAtPosition']> {
        const finalResult = scriptTsLs.__internal__.raw.getCompletionsAtPosition(fileName, position, options);
        if (finalResult) {
            finalResult.entries = finalResult.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
        }
        return finalResult;
    }
    function getReferencesAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getReferencesAtPosition']> {
        return findLocations(['script', 'template'], fileName, position, 'references') as ts.ReferenceEntry[];
    }
    function getDefinitionAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getDefinitionAtPosition']> {
        return findLocations(['script'], fileName, position, 'definition') as ts.DefinitionInfo[];
    }
    function getTypeDefinitionAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getDefinitionAtPosition']> {
        return findLocations(['script'], fileName, position, 'typeDefinition') as ts.DefinitionInfo[];
    }
    function getImplementationAtPosition(fileName: string, position: number): ReturnType<ts.LanguageService['getImplementationAtPosition']> {
        return findLocations(['script', 'template'], fileName, position, 'implementation') as ts.ImplementationLocation[];
    }
    function findRenameLocations(fileName: string, position: number, findInStrings: boolean, findInComments: boolean, providePrefixAndSuffixTextForRename?: boolean): ReturnType<ts.LanguageService['findRenameLocations']> {
        return findLocations(['script', 'template'], fileName, position, 'rename', findInStrings, findInComments, providePrefixAndSuffixTextForRename) as ts.RenameLocation[];
    }
    function findLocations(
        lsTypes: ('script' | 'template')[],
        fileName: string,
        position: number,
        mode: 'definition' | 'typeDefinition' | 'references' | 'implementation' | 'rename',
        findInStrings = false,
        findInComments = false,
        providePrefixAndSuffixTextForRename?: boolean
    ) {

        return lsTypes.map(lsType => worker(lsType)).flat();

        function worker(lsType: 'script' | 'template') {

            const tsLs = getTsLs(lsType);
            const loopChecker = new Set<string>();
            let symbols: (ts.DefinitionInfo | ts.ReferenceEntry | ts.ImplementationLocation | ts.RenameLocation)[] = [];
            withTeleports(fileName, position);
            return symbols.map(s => transformDocumentSpanLike(lsType, s)).filter(notEmpty);

            function withTeleports(fileName: string, position: number) {
                const _symbols = mode === 'definition' ? tsLs.__internal__.raw.getDefinitionAtPosition(fileName, position)
                    : mode === 'typeDefinition' ? tsLs.__internal__.raw.getTypeDefinitionAtPosition(fileName, position)
                        : mode === 'references' ? tsLs.__internal__.raw.getReferencesAtPosition(fileName, position)
                            : mode === 'implementation' ? tsLs.__internal__.raw.getImplementationAtPosition(fileName, position)
                                : mode === 'rename' ? tsLs.__internal__.raw.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename)
                                    : undefined;
                if (!_symbols) return;
                symbols = symbols.concat(_symbols);
                for (const ref of _symbols) {
                    loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
                    const teleport = sourceFiles.getTsTeleports(lsType).get(fsPathToUri(ref.fileName));
                    if (teleport) {
                        for (const teleRange of teleport.findTeleports2(ref.textSpan.start, ref.textSpan.start + ref.textSpan.length)) {
                            if ((mode === 'definition' || mode === 'typeDefinition' || mode === 'implementation') && !teleRange.sideData.capabilities.definitions)
                                continue;
                            if ((mode === 'references') && !teleRange.sideData.capabilities.references)
                                continue;
                            if ((mode === 'rename') && !teleRange.sideData.capabilities.rename)
                                continue;
                            if (loopChecker.has(ref.fileName + ':' + teleRange.start))
                                continue;
                            withTeleports(ref.fileName, teleRange.start);
                        }
                    }
                }
            }
        }
    }
    function getDefinitionAndBoundSpan(fileName: string, position: number): ReturnType<ts.LanguageService['getDefinitionAndBoundSpan']> {

        return worker('script');

        function worker(lsType: 'script' | 'template') {

            const tsLs = getTsLs(lsType);
            const loopChecker = new Set<string>();
            let textSpan: ts.TextSpan | undefined;
            let symbols: ts.DefinitionInfo[] = [];
            withTeleports(fileName, position);
            if (!textSpan) return;
            return {
                textSpan: textSpan,
                definitions: symbols?.map(s => transformDocumentSpanLike(lsType, s)).filter(notEmpty),
            };

            function withTeleports(fileName: string, position: number) {
                const _symbols = tsLs.__internal__.raw.getDefinitionAndBoundSpan(fileName, position);
                if (!_symbols) return;
                if (!textSpan) {
                    textSpan = _symbols.textSpan;
                }
                if (!_symbols.definitions) return;
                symbols = symbols.concat(_symbols.definitions);
                for (const ref of _symbols.definitions) {
                    loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
                    const teleport = sourceFiles.getTsTeleports(lsType).get(fsPathToUri(ref.fileName));
                    if (teleport) {
                        for (const teleRange of teleport.findTeleports2(ref.textSpan.start, ref.textSpan.start + ref.textSpan.length)) {
                            if (!teleRange.sideData.capabilities.definitions)
                                continue;
                            if (loopChecker.has(ref.fileName + ':' + teleRange.start))
                                continue;
                            withTeleports(ref.fileName, teleRange.start);
                        }
                    }
                }
            }
        }
    }
    function findReferences(fileName: string, position: number): ReturnType<ts.LanguageService['findReferences']> {

        const scriptResult = worker('script');
        const templateResult = worker('template');
        return [
            ...scriptResult,
            ...templateResult,
        ];

        function worker(lsType: 'script' | 'template') {

            const tsLs = getTsLs(lsType);
            const loopChecker = new Set<string>();
            let symbols: ts.ReferencedSymbol[] = [];
            withTeleports(fileName, position);
            return symbols.map(s => transformReferencedSymbol(lsType, s)).filter(notEmpty);

            function withTeleports(fileName: string, position: number) {
                const _symbols = tsLs.__internal__.raw.findReferences(fileName, position);
                if (!_symbols) return;
                symbols = symbols.concat(_symbols);
                for (const symbol of _symbols) {
                    for (const ref of symbol.references) {
                        loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
                        const teleport = sourceFiles.getTsTeleports(lsType).get(fsPathToUri(ref.fileName));
                        if (teleport) {
                            for (const teleRange of teleport.findTeleports2(ref.textSpan.start, ref.textSpan.start + ref.textSpan.length)) {
                                if (!teleRange.sideData.capabilities.references)
                                    continue;
                                if (loopChecker.has(ref.fileName + ':' + teleRange.start))
                                    continue;
                                withTeleports(ref.fileName, teleRange.start);
                            }
                        }
                    }
                }
            }
        }
    }

    // transforms
    function transformReferencedSymbol(lsType: 'script' | 'template', symbol: ts.ReferencedSymbol): ts.ReferencedSymbol | undefined {
        const definition = transformDocumentSpanLike(lsType, symbol.definition);
        const references = symbol.references.map(r => transformDocumentSpanLike(lsType, r)).filter(notEmpty);
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
    function transformDocumentSpanLike<T extends ts.DocumentSpan>(lsType: 'script' | 'template', documentSpan: T): T | undefined {
        const textSpan = transformSpan(lsType, documentSpan.fileName, documentSpan.textSpan);
        if (!textSpan) return;
        const contextSpan = transformSpan(lsType, documentSpan.fileName, documentSpan.contextSpan);
        const originalTextSpan = transformSpan(lsType, documentSpan.originalFileName, documentSpan.originalTextSpan);
        const originalContextSpan = transformSpan(lsType, documentSpan.originalFileName, documentSpan.originalContextSpan);
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
    function transformSpan(lsType: 'script' | 'template', fileName: string | undefined, textSpan: ts.TextSpan | undefined) {
        if (!fileName) return;
        if (!textSpan) return;
        for (const vueLoc of sourceFiles.fromTsLocation2(lsType, fsPathToUri(fileName), textSpan.start, textSpan.start + textSpan.length)) {
            return {
                fileName: uriToFsPath(vueLoc.uri),
                textSpan: {
                    start: vueLoc.range.start,
                    length: vueLoc.range.end - vueLoc.range.start,
                },
            }
        }
    }
}
