import * as shared from '@volar/shared';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { SearchTexts, TypeScriptRuntime, VueFile } from '@volar/vue-typescript';
import { VueDocument, VueDocuments } from '../vueDocuments';
import { pauseTracking, resetTracking } from '@vue/reactivity';
import { camelize, capitalize, hyphenate, isHTMLTag } from '@vue/shared';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as ts2 from '@volar/typescript-language-service';
import type { LanguageServiceHost } from '../types';
import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';
import useHtmlPlugin from '../commonPlugins/html';

export const semanticTokenTypes = [
    'componentTag',
    'operator', // namespaced component accessor: '.'
];

// https://v3.vuejs.org/api/directives.html#v-on
const eventModifiers: Record<string, string> = {
    stop: 'call event.stopPropagation().',
    prevent: 'call event.preventDefault().',
    capture: 'add event listener in capture mode.',
    self: 'only trigger handler if event was dispatched from this element.',
    // {keyAlias}: 'only trigger handler on certain keys.',
    once: 'trigger handler at most once.',
    left: 'only trigger handler for left button mouse events.',
    right: 'only trigger handler for right button mouse events.',
    middle: 'only trigger handler for middle button mouse events.',
    passive: 'attaches a DOM event with { passive: true }.',
};

const vueGlobalDirectiveProvider = html.newHTMLDataProvider('vueGlobalDirective', {
    version: 1.1,
    tags: [],
    globalAttributes: [
        { name: 'v-if' },
        { name: 'v-else-if' },
        { name: 'v-else', valueSet: 'v' },
        { name: 'v-for' },
    ],
});

interface HtmlCompletionData {
    mode: 'html',
    tsItem: ts.CompletionEntry | undefined,
}

interface AutoImportCompletionData {
    mode: 'autoImport',
    vueDocumentUri: string,
    importUri: string,
}

export default function <T extends ReturnType<typeof useHtmlPlugin>>(options: {
    ts: typeof import('typescript/lib/tsserverlibrary'),
    getSemanticTokenLegend(): vscode.SemanticTokensLegend,
    getScanner(document: TextDocument): html.Scanner | undefined,
    tsLs: ts2.LanguageService,
    templateLanguagePlugin: T,
    isSupportedDocument: (document: TextDocument) => boolean,
    getNameCases?: (uri: string) => Promise<{
        tag: 'both' | 'kebabCase' | 'pascalCase',
        attr: 'kebabCase' | 'camelCase',
    }>,
    getScriptContentVersion: () => number,
    vueLsHost: LanguageServiceHost,
    vueDocuments: VueDocuments,
    tsSettings: ts2.Settings,
    tsRuntime: TypeScriptRuntime,
}): EmbeddedLanguageServicePlugin & T {

    const componentCompletionDataCache = new WeakMap<
        ReturnType<VueFile['getTemplateData']>,
        Map<string, { item: ts.CompletionEntry | undefined, bind: ts.CompletionEntry[], on: ts.CompletionEntry[] }>
    >();
    const autoImportPositions = new WeakSet<vscode.Position>();
    const tokenTypes = new Map(options.getSemanticTokenLegend().tokenTypes.map((t, i) => [t, i]));

    return {

        ...options.templateLanguagePlugin,

        triggerCharacters: [
            ...options.templateLanguagePlugin.triggerCharacters ?? [],
            '@', // vue event shorthand
        ],

        async doValidation(document, options_2) {

            if (!options.isSupportedDocument(document))
                return;

            const originalResult = await options.templateLanguagePlugin.doValidation?.(document, options_2);
            const vueDocument = options.vueDocuments.fromEmbeddedDocument(document);

            if (vueDocument) {

                const templateErrors: vscode.Diagnostic[] = [];
                const sfcVueTemplateCompiled = vueDocument.file.getSfcVueTemplateCompiled();
                const sfcTemplateLanguageCompiled = vueDocument.file.getSfcTemplateLanguageCompiled();
                const sfcTemplate = vueDocument.file.getSfcTemplateDocument();

                if (sfcVueTemplateCompiled && sfcTemplateLanguageCompiled && sfcTemplate) {

                    for (const error of sfcVueTemplateCompiled.errors) {
                        onCompilerError(error, vscode.DiagnosticSeverity.Error);
                    }

                    for (const warning of sfcVueTemplateCompiled.warnings) {
                        onCompilerError(warning, vscode.DiagnosticSeverity.Warning);
                    }

                    function onCompilerError(error: NonNullable<typeof sfcVueTemplateCompiled>['errors'][number], severity: vscode.DiagnosticSeverity) {

                        const templateHtmlRange = {
                            start: error.loc?.start.offset ?? 0,
                            end: error.loc?.end.offset ?? 0,
                        };
                        let sourceRange = sfcTemplateLanguageCompiled!.htmlToTemplate(templateHtmlRange.start, templateHtmlRange.end);
                        let errorMessage = error.message;

                        if (!sourceRange) {
                            const htmlText = sfcTemplateLanguageCompiled!.htmlText.substring(templateHtmlRange.start, templateHtmlRange.end);
                            errorMessage += '\n```html\n' + htmlText.trim() + '\n```';
                            sourceRange = { start: 0, end: 0 };
                        }

                        templateErrors.push({
                            range: {
                                start: document.positionAt(sourceRange.start),
                                end: document.positionAt(sourceRange.end),
                            },
                            severity,
                            code: error.code,
                            source: 'vue',
                            message: errorMessage,
                        });
                    }
                }

                return [
                    ...originalResult ?? [],
                    ...templateErrors,
                ];
            }
        },

        async findDocumentSemanticTokens(document, range) {

            if (!options.isSupportedDocument(document))
                return;

            const result = await options.templateLanguagePlugin.findDocumentSemanticTokens?.(document, range) ?? [];
            const vueDocument = options.vueDocuments.fromEmbeddedDocument(document);
            const scanner = options.getScanner(document);

            if (vueDocument && scanner) {

                const templateScriptData = vueDocument.file.getTemplateData();
                const components = new Set([
                    ...templateScriptData.components,
                    ...templateScriptData.components.map(hyphenate).filter(name => !isHTMLTag(name)),
                ]);
                const offsetRange = range ? {
                    start: document.offsetAt(range.start),
                    end: document.offsetAt(range.end),
                } : {
                    start: 0,
                    end: document.getText().length,
                };

                let token = scanner.scan();

                while (token !== html.TokenType.EOS) {

                    const tokenOffset = scanner.getTokenOffset();

                    // TODO: fix source map perf and break in while condition
                    if (tokenOffset > offsetRange.end)
                        break;

                    if (tokenOffset >= offsetRange.start && (token === html.TokenType.StartTag || token === html.TokenType.EndTag)) {

                        const tokenText = scanner.getTokenText();

                        if (components.has(tokenText) || tokenText.indexOf('.') >= 0) {

                            const tokenLength = scanner.getTokenLength();
                            const tokenPosition = document.positionAt(tokenOffset);

                            if (components.has(tokenText)) {
                                result.push([tokenPosition.line, tokenPosition.character, tokenLength, tokenTypes.get('componentTag') ?? -1, 0]);
                            }
                            else if (tokenText.indexOf('.') >= 0) {
                                for (let i = 0; i < tokenText.length; i++) {
                                    if (tokenText[i] === '.') {
                                        result.push([tokenPosition.line, tokenPosition.character + i, 1, tokenTypes.get('operator') ?? -1, 0]);
                                    }
                                }
                            }
                        }
                    }
                    token = scanner.scan();
                }
            }

            return result;
        },

        async doComplete(document, position, context) {

            if (!options.isSupportedDocument(document))
                return;

            const vueDocument = options.vueDocuments.fromEmbeddedDocument(document);
            let tsItems: Awaited<ReturnType<typeof provideHtmlData>> | undefined;

            if (vueDocument) {
                tsItems = await provideHtmlData(vueDocument);
            }

            const htmlComplete = await options.templateLanguagePlugin.doComplete?.(document, position, context);

            if (!htmlComplete)
                return;

            if (vueDocument && tsItems) {
                afterHtmlCompletion(htmlComplete, vueDocument, tsItems);
            }

            return htmlComplete;
        },

        async doCompleteResolve(item) {

            const data: HtmlCompletionData | AutoImportCompletionData | undefined = item.data as any;

            if (data?.mode === 'html') {
                return await resolveHtmlItem(item, data);
            }
            else if (data?.mode === 'autoImport') {
                return await resolveAutoImportItem(item, data);
            }

            return item;
        },

        resolveEmbeddedRange(range) {
            if (autoImportPositions.has(range.start) && autoImportPositions.has(range.end))
                return range;
        },
    };

    // not supported for now
    async function resolveHtmlItem(item: vscode.CompletionItem, data: HtmlCompletionData) {

        // let tsItem = data.tsItem;

        // if (!tsItem)
        //     return item;

        // if (!host.templateTsLs)
        //     return item;

        // tsItem = await host.templateTsLs.doCompletionResolve(tsItem);
        // item.tags = [...item.tags ?? [], ...tsItem.tags ?? []];

        // const details: string[] = [];
        // const documentations: string[] = [];

        // if (item.detail) details.push(item.detail);
        // if (tsItem.detail) details.push(tsItem.detail);
        // if (details.length) {
        //     item.detail = details.join('\n\n');
        // }

        // if (item.documentation) documentations.push(typeof item.documentation === 'string' ? item.documentation : item.documentation.value);
        // if (tsItem.documentation) documentations.push(typeof tsItem.documentation === 'string' ? tsItem.documentation : tsItem.documentation.value);
        // if (documentations.length) {
        //     item.documentation = {
        //         kind: vscode.MarkupKind.Markdown,
        //         value: documentations.join('\n\n'),
        //     };
        // }

        return item;
    }

    async function resolveAutoImportItem(item: vscode.CompletionItem, data: AutoImportCompletionData) {

        const _vueDocument = options.vueDocuments.get(data.vueDocumentUri);
        if (!_vueDocument)
            return item;

        const vueDocument = _vueDocument;
        const importFile = shared.uriToFsPath(data.importUri);
        const rPath = path.relative(options.vueLsHost.getCurrentDirectory(), importFile);
        const descriptor = vueDocument.file.getDescriptor();
        const scriptAst = vueDocument.file.getScriptAst();
        const scriptSetupAst = vueDocument.file.getScriptSetupAst();

        let importPath = path.relative(path.dirname(data.vueDocumentUri), data.importUri);
        if (!importPath.startsWith('.')) {
            importPath = './' + importPath;
        }

        if (!descriptor.scriptSetup && !descriptor.script) {
            item.detail = `Auto import from '${importPath}'\n\n${rPath}`;
            item.documentation = {
                kind: vscode.MarkupKind.Markdown,
                value: '[Error] `<script>` / `<script setup>` block not found.',
            };
            return item;
        }

        item.labelDetails = { description: rPath };

        const scriptImport = scriptAst ? getLastImportNode(scriptAst) : undefined;
        const scriptSetupImport = scriptSetupAst ? getLastImportNode(scriptSetupAst) : undefined;
        const componentName = capitalize(camelize(item.label));
        const textDoc = vueDocument.getDocument();
        let insertText = '';
        const planAResult = await planAInsertText();
        if (planAResult) {
            insertText = planAResult.insertText;
            item.detail = planAResult.description + '\n\n' + rPath;
        }
        else {
            insertText = planBInsertText();
            item.detail = `Auto import from '${importPath}'\n\n${rPath}`;
        }
        if (descriptor.scriptSetup) {
            const editPosition = textDoc.positionAt(descriptor.scriptSetup.startTagEnd + (scriptSetupImport ? scriptSetupImport.end : 0));
            autoImportPositions.add(editPosition);
            item.additionalTextEdits = [
                vscode.TextEdit.insert(
                    editPosition,
                    '\n' + insertText,
                ),
            ];
        }
        else if (descriptor.script && scriptAst) {
            const editPosition = textDoc.positionAt(descriptor.script.startTagEnd + (scriptImport ? scriptImport.end : 0));
            autoImportPositions.add(editPosition);
            item.additionalTextEdits = [
                vscode.TextEdit.insert(
                    editPosition,
                    '\n' + insertText,
                ),
            ];
            const scriptRanges = parseScriptRanges(options.ts, scriptAst, !!descriptor.scriptSetup, true, true);
            const exportDefault = scriptRanges.exportDefault;
            if (exportDefault) {
                // https://github.com/microsoft/TypeScript/issues/36174
                const printer = options.ts.createPrinter();
                if (exportDefault.componentsOption && exportDefault.componentsOptionNode) {
                    const newNode: typeof exportDefault.componentsOptionNode = {
                        ...exportDefault.componentsOptionNode,
                        properties: [
                            ...exportDefault.componentsOptionNode.properties,
                            options.ts.factory.createShorthandPropertyAssignment(componentName),
                        ] as any as ts.NodeArray<ts.ObjectLiteralElementLike>,
                    };
                    const printText = printer.printNode(options.ts.EmitHint.Expression, newNode, scriptAst);
                    const editRange = vscode.Range.create(
                        textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.componentsOption.start),
                        textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.componentsOption.end),
                    );
                    autoImportPositions.add(editRange.start);
                    autoImportPositions.add(editRange.end);
                    item.additionalTextEdits.push(vscode.TextEdit.replace(
                        editRange,
                        unescape(printText.replace(/\\u/g, '%u')),
                    ));
                }
                else if (exportDefault.args && exportDefault.argsNode) {
                    const newNode: typeof exportDefault.argsNode = {
                        ...exportDefault.argsNode,
                        properties: [
                            ...exportDefault.argsNode.properties,
                            options.ts.factory.createShorthandPropertyAssignment(`components: { ${componentName} }`),
                        ] as any as ts.NodeArray<ts.ObjectLiteralElementLike>,
                    };
                    const printText = printer.printNode(options.ts.EmitHint.Expression, newNode, scriptAst);
                    const editRange = vscode.Range.create(
                        textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.args.start),
                        textDoc.positionAt(descriptor.script.startTagEnd + exportDefault.args.end),
                    );
                    autoImportPositions.add(editRange.start);
                    autoImportPositions.add(editRange.end);
                    item.additionalTextEdits.push(vscode.TextEdit.replace(
                        editRange,
                        unescape(printText.replace(/\\u/g, '%u')),
                    ));
                }
            }
        }
        return item;

        async function planAInsertText() {
            const embeddedScriptFile = vueDocument.file.getScriptTsFile();
            const embeddedScriptDocument = vueDocument.embeddedDocumentsMap.get(embeddedScriptFile);
            const tsImportName = camelize(path.basename(importFile).replace(/\./g, '-'));
            const [formatOptions, preferences] = await Promise.all([
                options.tsSettings.getFormatOptions?.(embeddedScriptDocument) ?? {},
                options.tsSettings.getPreferences?.(embeddedScriptDocument) ?? {},
            ]);
            const tsDetail = options.tsLs.__internal__.raw.getCompletionEntryDetails(shared.uriToFsPath(embeddedScriptDocument.uri), 0, tsImportName, formatOptions, importFile, preferences, undefined);
            if (tsDetail?.codeActions) {
                for (const action of tsDetail.codeActions) {
                    for (const change of action.changes) {
                        for (const textChange of change.textChanges) {
                            if (textChange.newText.indexOf(`import ${tsImportName} `) >= 0) {
                                return {
                                    insertText: textChange.newText.replace(`import ${tsImportName} `, `import ${componentName} `).trim(),
                                    description: action.description,
                                };
                            }
                        }
                    }
                }
            }
        }
        function planBInsertText() {
            const anyImport = scriptSetupImport ?? scriptImport;
            let withSemicolon = true;
            let quote = '"';
            if (anyImport) {
                withSemicolon = anyImport.text.endsWith(';');
                quote = anyImport.text.includes("'") ? "'" : '"';
            }
            return `import ${componentName} from ${quote}${importPath}${quote}${withSemicolon ? ';' : ''}`;
        }
    }

    async function provideHtmlData(vueDocument: VueDocument) {

        const nameCases = await options.getNameCases?.(vueDocument.uri) ?? {
            tag: 'both',
            attr: 'kebabCase',
        };
        const componentCompletion = getComponentCompletionData(vueDocument);
        const tags: html.ITagData[] = [];
        const tsItems = new Map<string, ts.CompletionEntry>();
        const globalAttributes: html.IAttributeData[] = [];

        for (const [_componentName, { item, bind, on }] of componentCompletion) {

            const componentNames =
                nameCases.tag === 'kebabCase' ? new Set([hyphenate(_componentName)])
                    : nameCases.tag === 'pascalCase' ? new Set([_componentName])
                        : new Set([hyphenate(_componentName), _componentName])

            for (const componentName of componentNames) {

                const attributes: html.IAttributeData[] = componentName === '*' ? globalAttributes : [];

                for (const prop of bind) {

                    const name = nameCases.attr === 'camelCase' ? prop.name : hyphenate(prop.name);

                    if (hyphenate(name).startsWith('on-')) {

                        const propNameBase = name.startsWith('on-')
                            ? name.slice('on-'.length)
                            : (name['on'.length].toLowerCase() + name.slice('onX'.length));
                        const propKey = createInternalItemId('componentEvent', [componentName, propNameBase]);

                        attributes.push(
                            {
                                name: 'v-on:' + propNameBase,
                                description: propKey,
                            },
                            {
                                name: '@' + propNameBase,
                                description: propKey,
                            },
                        );
                        tsItems.set(propKey, prop);
                    }
                    else {

                        const propName = name;
                        const propKey = createInternalItemId('componentProp', [componentName, propName]);

                        attributes.push(
                            {
                                name: propName,
                                description: propKey,
                            },
                            {
                                name: ':' + propName,
                                description: propKey,
                            },
                            {
                                name: 'v-bind:' + propName,
                                description: propKey,
                            },
                        );
                        tsItems.set(propKey, prop);
                    }
                }
                for (const event of on) {

                    const name = nameCases.attr === 'camelCase' ? event.name : hyphenate(event.name);
                    const propKey = createInternalItemId('componentEvent', [componentName, name]);

                    attributes.push({
                        name: 'v-on:' + name,
                        description: propKey,
                    });
                    attributes.push({
                        name: '@' + name,
                        description: propKey,
                    });
                    tsItems.set(propKey, event);
                }

                const componentKey = createInternalItemId('component', [componentName])

                if (componentName !== '*') {
                    tags.push({
                        name: componentName,
                        description: componentKey,
                        attributes,
                    });
                }

                if (item) {
                    tsItems.set(componentKey, item);
                }
            }
        }

        const descriptor = vueDocument.file.getDescriptor();
        const enabledComponentAutoImport = await useConfigurationHost()?.getConfiguration<boolean>('volar.completion.autoImportComponent') ?? true;

        if (enabledComponentAutoImport && (descriptor.script || descriptor.scriptSetup)) {
            for (const vueDocument of options.vueDocuments.getAll()) {
                let baseName = path.basename(vueDocument.uri, '.vue');
                if (baseName.toLowerCase() === 'index') {
                    baseName = path.basename(path.dirname(vueDocument.uri));
                }
                const componentName_1 = hyphenate(baseName);
                const componentName_2 = capitalize(camelize(baseName));
                let i: number | '' = '';
                if (componentCompletion.has(componentName_1) || componentCompletion.has(componentName_2)) {
                    i = 1;
                    while (componentCompletion.has(componentName_1 + i) || componentCompletion.has(componentName_2 + i)) {
                        i++;
                    }
                }
                tags.push({
                    name: (nameCases.tag === 'kebabCase' ? componentName_1 : componentName_2) + i,
                    description: createInternalItemId('importFile', [vueDocument.uri]),
                    attributes: [],
                });
            }
        }

        const dataProvider = html.newHTMLDataProvider('vue-html', {
            version: 1.1,
            tags,
            globalAttributes,
        });

        options.templateLanguagePlugin.htmlLs.setDataProviders(true, [
            ...options.templateLanguagePlugin.getHtmlDataProviders(),
            vueGlobalDirectiveProvider,
            dataProvider,
        ]);

        return tsItems;
    }

    function afterHtmlCompletion(completionList: vscode.CompletionList, vueDocument: VueDocument, tsItems: Map<string, ts.CompletionEntry>) {

        const replacement = getReplacement(completionList, vueDocument.getDocument());

        if (replacement) {

            const isEvent = replacement.text.startsWith('@') || replacement.text.startsWith('v-on:');
            const hasModifier = replacement.text.includes('.');

            if (isEvent && hasModifier) {

                const modifiers = replacement.text.split('.').slice(1);
                const textWithoutModifier = path.trimExt(replacement.text, [], 999);

                for (const modifier in eventModifiers) {

                    if (modifiers.includes(modifier))
                        continue;

                    const modifierDes = eventModifiers[modifier];
                    const newItem: html.CompletionItem = {
                        label: modifier,
                        filterText: textWithoutModifier + '.' + modifier,
                        documentation: modifierDes,
                        textEdit: {
                            range: replacement.textEdit.range,
                            newText: textWithoutModifier + '.' + modifier,
                        },
                        kind: vscode.CompletionItemKind.EnumMember,
                    };

                    completionList.items.push(newItem);
                }
            }
        }

        for (const item of completionList.items) {

            const itemIdKey = typeof item.documentation === 'string' ? item.documentation : item.documentation?.value;
            const itemId = itemIdKey ? readInternalItemId(itemIdKey) : undefined;

            if (itemId) {
                item.documentation = undefined;
            }

            if (itemId?.type === 'importFile') {

                const [fileUri] = itemId.args;
                const filePath = shared.uriToFsPath(fileUri);
                const rPath = path.relative(options.vueLsHost.getCurrentDirectory(), filePath);
                const data: AutoImportCompletionData = {
                    mode: 'autoImport',
                    vueDocumentUri: vueDocument.uri,
                    importUri: fileUri,
                };
                item.labelDetails = { description: rPath };
                item.filterText = item.label + ' ' + rPath;
                item.detail = rPath;
                item.kind = vscode.CompletionItemKind.File;
                item.sortText = '\u0003' + (item.sortText ?? item.label);
                item.data = data as any;
            }
            else if (itemIdKey && itemId) {

                const tsItem = itemIdKey ? tsItems.get(itemIdKey) : undefined;

                if (itemId.type === 'componentProp' || itemId.type === 'componentEvent') {

                    const [componentName] = itemId.args;

                    if (componentName !== '*') {
                        item.sortText = '\u0000' + (item.sortText ?? item.label);
                    }

                    if (tsItem) {
                        if (itemId.type === 'componentProp') {
                            item.kind = vscode.CompletionItemKind.Property;
                        }
                        else {
                            item.kind = vscode.CompletionItemKind.Event;
                        }
                    }
                }
                else if (
                    item.label === 'v-if'
                    || item.label === 'v-else-if'
                    || item.label === 'v-else'
                    || item.label === 'v-for'
                ) {
                    item.kind = vscode.CompletionItemKind.Method;
                    item.sortText = '\u0003' + (item.sortText ?? item.label);
                }
                else if (item.label.startsWith('v-')) {
                    item.kind = vscode.CompletionItemKind.Function;
                    item.sortText = '\u0002' + (item.sortText ?? item.label);
                }
                else {
                    item.sortText = '\u0001' + (item.sortText ?? item.label);
                }

                const data: HtmlCompletionData = {
                    mode: 'html',
                    tsItem: tsItem,
                };

                item.data = data as any;
            }
        }

        {
            const temp = new Map<string, vscode.CompletionItem>();

            for (const item of completionList.items) {

                const data: HtmlCompletionData | AutoImportCompletionData | undefined = item.data as any;

                if (data?.mode === 'autoImport' && data.importUri === vueDocument.uri) { // don't import itself
                    continue;
                }

                if (!temp.get(item.label)?.documentation) { // filter HTMLAttributes
                    temp.set(item.label, item);
                }
            }

            completionList.items = [...temp.values()];
        }

        options.templateLanguagePlugin.htmlLs.setDataProviders(true, options.templateLanguagePlugin.getHtmlDataProviders());
    }

    function getLastImportNode(ast: ts.SourceFile) {
        let importNode: ts.ImportDeclaration | undefined;
        ast.forEachChild(node => {
            if (options.ts.isImportDeclaration(node)) {
                importNode = node;
            }
        });
        return importNode ? {
            text: importNode.getFullText(ast).trim(),
            end: importNode.getEnd(),
        } : undefined;
    }

    function getComponentCompletionData(sourceFile: VueDocument) {

        const templateData = sourceFile.file.getTemplateData();

        let cache = componentCompletionDataCache.get(templateData);
        if (!cache) {

            const { sfcTemplateScript } = sourceFile.file.refs;

            cache = new Map<string, { item: ts.CompletionEntry | undefined, bind: ts.CompletionEntry[], on: ts.CompletionEntry[] }>();

            pauseTracking();
            const file = sfcTemplateScript.file.value;
            const templateTagNames = sfcTemplateScript.templateCodeGens.value ? Object.keys(sfcTemplateScript.templateCodeGens.value.tagNames) : [];
            resetTracking();

            if (file) {

                const tags_1 = templateData.componentItems.map(item => {
                    return { item, name: item.name };
                });
                const tags_2 = templateTagNames
                    .filter(tag => tag.indexOf('.') >= 0)
                    .map(tag => ({ name: tag, item: undefined }));

                for (const tag of [...tags_1, ...tags_2]) {

                    if (cache.has(tag.name))
                        continue;

                    let bind: ts.CompletionEntry[] = [];
                    let on: ts.CompletionEntry[] = [];
                    {
                        const searchText = SearchTexts.PropsCompletion(tag.name);
                        let offset = file.content.indexOf(searchText);
                        if (offset >= 0) {
                            offset += searchText.length;
                            bind = options.tsRuntime.getTsLs().getCompletionsAtPosition(file.fileName, offset, undefined)?.entries.filter(entry => entry.kind !== 'warning') ?? [];
                        }
                    }
                    {
                        const searchText = SearchTexts.EmitCompletion(tag.name);
                        let offset = file.content.indexOf(searchText);
                        if (offset >= 0) {
                            offset += searchText.length;
                            on = options.tsRuntime.getTsLs().getCompletionsAtPosition(file.fileName, offset, undefined)?.entries.filter(entry => entry.kind !== 'warning') ?? [];
                        }
                    }
                    cache.set(tag.name, { item: tag.item, bind, on });
                }
                const globalBind = options.tsRuntime.getTsLs().getCompletionsAtPosition(file.fileName, file.content.indexOf(SearchTexts.GlobalAttrs), undefined)?.entries.filter(entry => entry.kind !== 'warning') ?? [];
                cache.set('*', { item: undefined, bind: globalBind, on: [] });
            }

            componentCompletionDataCache.set(templateData, cache);
        }

        return cache;
    }
}

function eqSet<T>(as: Set<T>, bs: Set<T>) {
    if (as.size !== bs.size) return false;
    for (const a of as) if (!bs.has(a)) return false;
    return true;
}

function createInternalItemId(type: 'importFile' | 'vueDirective' | 'componentEvent' | 'componentProp' | 'component', args: string[]) {
    return '__VLS_::' + type + '::' + args.join(',');
}

function readInternalItemId(key: string) {
    if (key.startsWith('__VLS_::')) {
        const strs = key.split('::');
        return {
            type: strs[1] as 'importFile' | 'vueDirective' | 'componentEvent' | 'componentProp' | 'component',
            args: strs[2].split(','),
        };
    }
}

function getReplacement(list: html.CompletionList, doc: TextDocument) {
    for (const item of list.items) {
        if (item.textEdit && 'range' in item.textEdit) {
            return {
                item: item,
                textEdit: item.textEdit,
                text: doc.getText(item.textEdit.range)
            };
        }
    }
}
