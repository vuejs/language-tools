import type { TsApiRegisterOptions } from './types';
import type * as ts from 'typescript';
import { notEmpty } from '@volar/shared';

export function register({ mapper, tsLanguageService }: TsApiRegisterOptions) {

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
        const info = tsLanguageService.raw.getCompletionsAtPosition(fileName, position, options);
        if (!info) return;
        return {
            ...info,
            entries: info.entries.filter(entry => entry.name.indexOf('__VLS_') === -1),
        };
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
    function findRenameLocations(fileName: string, position: number): ReturnType<ts.LanguageService['findRenameLocations']> {
        return findLocations(fileName, position, 'rename') as ts.RenameLocation[];
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
        return symbols.map(transformDocumentSpanLike).filter(notEmpty);

        function withTeleports(fileName: string, position: number) {
            const _symbols = mode === 'definition' ? tsLanguageService.raw.getDefinitionAtPosition(fileName, position)
                : mode === 'typeDefinition' ? tsLanguageService.raw.getTypeDefinitionAtPosition(fileName, position)
                    : mode === 'references' ? tsLanguageService.raw.getReferencesAtPosition(fileName, position)
                        : mode === 'implementation' ? tsLanguageService.raw.getImplementationAtPosition(fileName, position)
                            : mode === 'rename' ? tsLanguageService.raw.findRenameLocations(fileName, position, findInStrings, findInComments, providePrefixAndSuffixTextForRename)
                                : undefined;
            if (!_symbols) return;
            symbols = symbols.concat(_symbols);
            for (const ref of _symbols) {
                loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
                for (const teleport of mapper.ts.teleports2(ref.fileName, { start: ref.textSpan.start, end: ref.textSpan.start + ref.textSpan.length })) {
                    if ((mode === 'definition' || mode === 'typeDefinition' || mode === 'implementation') && !teleport.sideData.capabilities.definitions)
                        continue;
                    if ((mode === 'references') && !teleport.sideData.capabilities.references)
                        continue;
                    if ((mode === 'rename') && !teleport.sideData.capabilities.rename)
                        continue;
                    if (loopChecker.has(ref.fileName + ':' + teleport.range.start))
                        continue;
                    withTeleports(ref.fileName, teleport.range.start);
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
            definitions: symbols?.map(transformDocumentSpanLike).filter(notEmpty),
        };

        function withTeleports(fileName: string, position: number) {
            const _symbols = tsLanguageService.raw.getDefinitionAndBoundSpan(fileName, position);
            if (!_symbols) return;
            if (!textSpan) {
                textSpan = _symbols.textSpan;
            }
            if (!_symbols.definitions) return;
            symbols = symbols.concat(_symbols.definitions);
            for (const ref of _symbols.definitions) {
                loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
                for (const teleport of mapper.ts.teleports2(ref.fileName, { start: ref.textSpan.start, end: ref.textSpan.start + ref.textSpan.length })) {
                    if (!teleport.sideData.capabilities.definitions)
                        continue;
                    if (loopChecker.has(ref.fileName + ':' + teleport.range.start))
                        continue;
                    withTeleports(ref.fileName, teleport.range.start);
                }
            }
        }
    }
    function findReferences(fileName: string, position: number): ReturnType<ts.LanguageService['findReferences']> {

        const loopChecker = new Set<string>();
        let symbols: ts.ReferencedSymbol[] = [];
        withTeleports(fileName, position);
        return symbols.map(transformReferencedSymbol).filter(notEmpty);

        function withTeleports(fileName: string, position: number) {
            const _symbols = tsLanguageService.raw.findReferences(fileName, position);
            if (!_symbols) return;
            symbols = symbols.concat(_symbols);
            for (const symbol of _symbols) {
                for (const ref of symbol.references) {
                    loopChecker.add(ref.fileName + ':' + ref.textSpan.start);
                    for (const teleport of mapper.ts.teleports2(ref.fileName, { start: ref.textSpan.start, end: ref.textSpan.start + ref.textSpan.length })) {
                        if (!teleport.sideData.capabilities.references)
                            continue;
                        if (loopChecker.has(ref.fileName + ':' + teleport.range.start))
                            continue;
                        withTeleports(ref.fileName, teleport.range.start);
                    }
                }
            }
        }
    }

    // transforms
    function transformReferencedSymbol(symbol: ts.ReferencedSymbol): ts.ReferencedSymbol | undefined {
        const definition = transformDocumentSpanLike(symbol.definition);
        const references = symbol.references.map(transformDocumentSpanLike).filter(notEmpty);
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
        for (const sourceMaped of mapper.ts.from2(fileName, { start: textSpan.start, end: textSpan.start + textSpan.length })) {
            return {
                fileName: sourceMaped.fileName,
                textSpan: {
                    start: sourceMaped.range.start,
                    length: sourceMaped.range.end - sourceMaped.range.start,
                },
            }
        }
    }
}
