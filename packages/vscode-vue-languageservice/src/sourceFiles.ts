import {
	Diagnostic,
	DiagnosticSeverity,
	Position,
	CompletionItem,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createHtmlPugMapper, pugToHtml } from '@volar/pug';
import { uriToFsPath, sleep, extNameToLanguageId } from '@volar/shared';
import { SourceMap, MapedMode, TsSourceMap, CssSourceMap, HtmlSourceMap, Mapping, PugSourceMap } from './utils/sourceMaps';
import { transformVueHtml } from './utils/vueHtmlConverter';
import * as ts from 'typescript';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import * as vueSfc from '@vue/compiler-sfc';
import * as vueDom from '@vue/compiler-dom';
import * as css from 'vscode-css-languageservice';
import * as html from 'vscode-html-languageservice';
import * as upath from 'upath';
import { ref, computed, reactive, pauseTracking, resetTracking, Ref } from '@vue/reactivity';
import { hyphenate } from '@vue/shared';
import * as globalServices from './globalServices';
import * as prettyhtml from '@starptech/prettyhtml';

export type SourceFile = ReturnType<typeof createSourceFile>;
interface IDescriptorBlock {
	lang: string;
	content: string;
	loc: {
		start: number;
		end: number;
	};
}
interface IDescriptor {
	template: IDescriptorBlock | null;
	script: IDescriptorBlock | null;
	scriptSetup: (IDescriptorBlock & {
		setup: string;
	}) | null;
	styles: (IDescriptorBlock & {
		module: boolean;
	})[];
}

export function createSourceFile(initialDocument: TextDocument, tsLanguageService: ts2.LanguageService) {
	let documentVersion = 0;

	// sources
	const tsProjectVersion = ref<string>();
	const vue = reactive({
		uri: initialDocument.uri,
		fileName: uriToFsPath(initialDocument.uri),
		document: initialDocument,
	});
	const descriptor = reactive<IDescriptor>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
	});
	const templateScriptData = reactive({
		projectVersion: undefined as string | undefined,
		props: [] as string[],
		components: [] as string[],
		setupReturns: [] as string[],
		htmlElements: [] as string[],
	});
	const pugData = computed(() => {
		if (descriptor.template?.lang === 'pug') {
			try {
				const html = pugToHtml(descriptor.template.content);
				const mapper = createHtmlPugMapper(descriptor.template.content, html);
				return {
					html,
					mapper,
				};
			}
			catch (err) {
				const line: number = err.line - 1;
				const column: number = err.column - 1;
				const diagnostic: Diagnostic = {
					range: {
						start: Position.create(line, column),
						end: Position.create(line, column),
					},
					severity: DiagnosticSeverity.Error,
					code: err.code,
					source: 'pug',
					message: err.msg,
				};
				return {
					error: diagnostic
				};
			}
		}
		return {};
	});
	const scriptSetupDeclarePropsLoc = computed(() => {
		if (descriptor.scriptSetup) {
			const sourceFile = ts.createSourceFile('', descriptor.scriptSetup.content, ts.ScriptTarget.Latest);
			let propsNode: ts.Node | undefined;
			sourceFile.forEachChild(node => {
				if (!ts.isVariableStatement(node))
					return
				if (!node.modifiers?.find(m => m.kind === ts.SyntaxKind.DeclareKeyword))
					return;
				if (!node.declarationList.declarations.find(d => ts.isIdentifier(d.name) && d.name.escapedText === 'props'))
					return;
				propsNode = node;
			});
			if (propsNode) {
				return {
					start: propsNode.pos,
					end: propsNode.end,
				};
			}
		}
	});

	// template script(document + source maps)
	const templateScript = computed(() => {
		const interpolations = getInterpolations();
		if (!interpolations) return;

		const cssModuleMappings: {
			document: TextDocument,
			mappingOffset: number,
			originalOffset: number,
			originalLength: number,
			mappingLength: number,
			mode: MapedMode,
		}[] = [];
		const componentMappings: Mapping<undefined>[] = [];
		const propMappings: Mapping<{ isOptionsProp?: boolean, isSetupExport?: boolean }>[] = [];

		let code = [
			`import { FunctionalComponent as __VLS_Vue_FunctionalComponent } from '@vue/runtime-dom'`,
			`import { HTMLAttributes as __VLS_Vue_HTMLAttributes } from '@vue/runtime-dom'`,
			`import { VNodeProps as __VLS_Vue_VNodeProps } from '@vue/runtime-dom'`,
			`import { AllowedComponentProps as __VLS_Vue_AllowedComponentProps } from '@vue/runtime-dom'`,
			`import __VLS_VM from './${upath.basename(vue.fileName)}';`,
			(descriptor.scriptSetup
				? `import * as __VLS_setups from './${upath.basename(vue.fileName)}.options';`
				: `// no setups`),
			`const __VLS_Options = __VLS_VM.__VLS_options`,
			`declare var __VLS_vm: InstanceType<typeof __VLS_VM>;`,
			`declare var __VLS_vmUnwrap: typeof __VLS_Options & { components: { } };`,
			`declare var __VLS_Components: typeof __VLS_vmUnwrap.components & __VLS_GlobalComponents & __VLS_BuiltInComponents;`,
			`declare var __VLS_for_key: string;`,
			`declare function __VLS_getVforSourceType<T>(source: T): T extends number ? number[] : T;`,
			`type __VLS_PickProp<A, B> = A & Omit<B, keyof A>;`,
			`type __VLS_PropsType<C> = C extends new (...args: any) => { $props: infer Props } ? Props : C extends __VLS_Vue_FunctionalComponent<infer R> ? R : C;`,
			`type __VLS_MapPropsTypeBase<T> = { [K in keyof T]: __VLS_PropsType<T[K]> };`,
			`type __VLS_MapPropsType<T> = { [K in keyof T]: __VLS_PickProp<__VLS_PropsType<T[K]>, __VLS_Vue_HTMLAttributes> & Record<string, unknown> };`,
			`type __VLS_MapEmitType<T> = { [K in keyof T]: __VLS_RemoveAnyFnSet<T[K] extends new (...args: any) => { $emit: infer Emit } ? __VLS_ConstructorOverloads<Emit> : {}> };`,
			`type __VLS_FirstFunction<F1, F2> = F1 extends undefined ? F2 : (F1 extends (...args: any) => any ? F1 : (F2 extends (...args: any) => any ? F2 : F1));`,
			`type __VLS_RemoveAnyFnSet<T> = ({ 'Catch Me If You Can~!': any } extends T ? {} : T) & Record<string, undefined>;`,
			`type __VLS_GlobalAttrs = __VLS_Vue_HTMLAttributes & __VLS_Vue_VNodeProps & __VLS_Vue_AllowedComponentProps;`,
			`type __VLS_PickFunc<A, B> = A extends (...args: any) => any ? A : B;`,
			`type __VLS_OmitGlobalAttrs<T> = { [K in keyof T]: Omit<T[K], keyof __VLS_GlobalAttrs> };`,
		].join('\n') + `\n`;

		code += `type __VLS_ConstructorOverloads<T> =\n`;
		for (let i = 8; i >= 1; i--) {
			code += `// ${i}\n`;
			code += `T extends {\n`;
			for (let j = 1; j <= i; j++) {
				code += `(event: infer E${j}, ...payload: infer P${j}): void;\n`
			}
			code += `} ? (\n`
			for (let j = 1; j <= i; j++) {
				if (j > 1) code += '& ';
				code += `(E${j} extends string ? { [K${j} in E${j}]: (...payload: P${j}) => void } : {})\n`;
			}
			code += `) :\n`;
		}
		code += `// 0\n`
		code += `unknown;\n`

		/* CSS Module */
		code += '/* CSS Module */\n';
		const cssModuleClasses = getCssModuleClasses();
		code += 'declare var $style: {\n';
		for (const [className, locs] of cssModuleClasses) {
			for (const loc of locs) {
				const document = loc[0];
				const offset = loc[1];
				cssModuleMappings.push({
					document,
					originalOffset: offset,
					mappingOffset: code.length + 1, // + '
					originalLength: className.length,
					mappingLength: className.length,
					mode: MapedMode.Offset,
				});
				cssModuleMappings.push({
					document,
					originalOffset: offset,
					mappingOffset: code.length,
					originalLength: className.length,
					mappingLength: className.length + 2,
					mode: MapedMode.Gate,
				});
			}
			code += `'${className}': string,\n`;
		}
		code += '};\n';

		/* Components */
		code += '/* Components */\n';
		code += 'declare var __VLS_components: __VLS_OmitGlobalAttrs<JSX.IntrinsicElements> & {\n';
		for (const name_1 of templateScriptData.components) {
			const names = new Set([name_1, hyphenate(name_1)]);
			for (const name_2 of names) {
				const start_1 = code.length;
				const end_1 = code.length + `'${name_2}'`.length;
				const start_2 = code.length + `'${name_2}': typeof __VLS_Components[`.length;
				const end_2 = code.length + `'${name_2}': typeof __VLS_Components['${name_1}'`.length;
				componentMappings.push({
					data: undefined,
					mode: MapedMode.Gate,
					vueRange: {
						start: start_1,
						end: end_1,
					},
					virtualRange: {
						start: start_2,
						end: end_2,
					},
				});
				componentMappings.push({
					data: undefined,
					mode: MapedMode.Gate,
					vueRange: {
						start: start_1 + 1,
						end: end_1 - 1,
					},
					virtualRange: {
						start: start_2 + 1,
						end: end_2 - 1,
					},
				});
				code += `'${name_2}': typeof __VLS_Components['${name_1}'],\n`;
			}
		}
		code += '};\n';
		code += 'declare var __VLS_componentPropsBase: __VLS_MapPropsTypeBase<typeof __VLS_components>;\n';
		code += 'declare var __VLS_componentProps: __VLS_MapPropsType<typeof __VLS_components>;\n';
		code += 'declare var __VLS_componentEmits: __VLS_MapEmitType<typeof __VLS_components>;\n'

		/* Completion */
		code += '/* Completion: Emits */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.tags, name)) continue;
			code += `__VLS_componentEmits['${name}'][''];\n`
		}
		code += '/* Completion: Props */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.tags, name)) continue;
			code += `__VLS_componentPropsBase['${name}'][''];\n`
		}
		code += '/* Completion: Global Attrs */\n';
		code += `({} as __VLS_GlobalAttrs)[''];\n`;

		/* Props */
		code += `/* Props */\n`;
		for (const propName of templateScriptData.props) {
			propMappings.push({
				data: {
				},
				mode: MapedMode.Offset,
				vueRange: {
					start: code.length + `var `.length,
					end: code.length + `var ${propName}`.length,
				},
				virtualRange: {
					start: code.length + `var ${propName} = __VLS_vm.`.length,
					end: code.length + `var ${propName} = __VLS_vm.${propName}`.length,
				},
			});
			propMappings.push({
				data: {
					isOptionsProp: true,
				},
				mode: MapedMode.Offset,
				vueRange: {
					start: code.length + `var `.length,
					end: code.length + `var ${propName}`.length,
				},
				virtualRange: {
					start: code.length + `var ${propName} = __VLS_vm.${propName}; __VLS_Options['props']['`.length,
					end: code.length + `var ${propName} = __VLS_vm.${propName}; __VLS_Options['props']['${propName}`.length,
				},
			});
			if (descriptor.scriptSetup) {
				propMappings.push({
					data: {
						isSetupExport: true,
					},
					mode: MapedMode.Offset,
					vueRange: {
						start: code.length + `var `.length,
						end: code.length + `var ${propName}`.length,
					},
					virtualRange: {
						start: code.length + `var ${propName} = __VLS_vm.${propName}; __VLS_Options['props']['${propName}']; __VLS_setups['`.length,
						end: code.length + `var ${propName} = __VLS_vm.${propName}; __VLS_Options['props']['${propName}']; __VLS_setups['${propName}`.length,
					},
				});
			}
			if (descriptor.scriptSetup) {
				code += `var ${propName} = __VLS_vm.${propName}; __VLS_Options['props']['${propName}']; __VLS_setups['${propName}'];\n`;
			}
			else {
				code += `var ${propName} = __VLS_vm.${propName}; __VLS_Options['props']['${propName}'];\n`;
			}
		}

		/* Interpolations */
		code += `/* Interpolations */\n`;
		const interpolationsStart = code.length;
		code += interpolations.text;

		const document = TextDocument.create(vue.uri + '.template.ts', 'typescript', documentVersion++, code);
		const propSourceMap = getPropSourceMap();
		const componentSourceMap = getComponentSourceMap();

		return {
			document,
			propSourceMap,
			componentSourceMap,
			getSourceMaps,
		};

		function hasElement(tags: Set<string>, tagName: string) {
			return tags.has(tagName) || tags.has(hyphenate(tagName));
		}
		function getPropSourceMap() {
			const sourceMap = new SourceMap<{ isOptionsProp?: boolean, isSetupExport?: boolean }>(
				document,
				document,
			);
			for (const maped of propMappings) {
				sourceMap.add(maped);
			}
			return sourceMap;
		}
		function getComponentSourceMap() {
			const sourceMap = new SourceMap(
				document,
				document,
			);
			for (const maped of componentMappings) {
				sourceMap.add(maped);
			}
			return sourceMap;
		}
		function getSourceMaps() {
			if (!descriptor.template) return [];
			if (!interpolations) return [];

			const sourceMaps = new Map<string, TsSourceMap>();
			{ // diagnostic for '@vue/runtime-dom' package not exist
				const sourceMap = getSourceMap(vue.document, document);
				const text = `'@vue/runtime-dom'`;
				const textIndex = document.getText().indexOf(text);
				const virtualRange = {
					start: textIndex,
					end: textIndex + text.length,
				};
				sourceMap.add({
					data: {
						vueTag: 'template',
						capabilities: {
							basic: false,
							references: false,
							rename: false,
							diagnostic: true,
							formatting: false,
							completion: false,
							semanticTokens: false,
						},
					},
					mode: MapedMode.Gate,
					vueRange: {
						start: descriptor.template.loc.start,
						end: descriptor.template.loc.start,
					},
					virtualRange: virtualRange,
				});
			}
			for (const maped of cssModuleMappings) {
				const sourceMap = getSourceMap(maped.document, document);
				sourceMap.add({
					data: {
						vueTag: 'style',
						capabilities: {
							basic: true,
							references: true,
							rename: true,
							diagnostic: true,
							formatting: false,
							completion: true,
							semanticTokens: false,
						},
					},
					mode: maped.mode,
					vueRange: {
						start: maped.originalOffset,
						end: maped.originalOffset + maped.originalLength,
					},
					virtualRange: {
						start: maped.mappingOffset,
						end: maped.mappingOffset + maped.mappingLength,
					},
				});
			}
			for (const maped of interpolations.mappings) {
				const sourceMap = getSourceMap(vue.document, document);
				sourceMap.add({
					data: maped.data,
					mode: maped.mode,
					vueRange: {
						start: maped.vueRange.start + descriptor.template.loc.start,
						end: maped.vueRange.end + descriptor.template.loc.start,
					},
					virtualRange: {
						start: maped.virtualRange.start + interpolationsStart,
						end: maped.virtualRange.end + interpolationsStart,
					},
				});
			}
			return [...sourceMaps.values()];

			function getSourceMap(sourceDoc: TextDocument, targetDoc: TextDocument) {
				const key = sourceDoc.uri + '=>' + targetDoc.uri;
				if (!sourceMaps.has(key)) {
					sourceMaps.set(key, new TsSourceMap(sourceDoc, targetDoc, true, { foldingRanges: false }));
				}
				return sourceMaps.get(key)!;
			}
		}
		function getCssModuleClasses() {
			const names = new Map<string, [TextDocument, number][]>();
			for (const sourceMap of cssSourceMaps.value) {
				if (!sourceMap.module) continue;
				worker(sourceMap, sourceMap.virtualDocument, sourceMap.stylesheet);
				for (const linkStyle of sourceMap.links) {
					worker(undefined, linkStyle[0], linkStyle[1]);
				}
			}
			return names;

			function worker(sourceMap: CssSourceMap | undefined, doc: TextDocument, ss: css.Stylesheet) {
				const cssLanguageService = doc.languageId === 'scss' ? globalServices.scss : globalServices.css;
				const symbols = cssLanguageService.findDocumentSymbols(doc, ss);
				for (const s of symbols) {
					if (s.kind === css.SymbolKind.Class) {
						// https://stackoverflow.com/questions/448981/which-characters-are-valid-in-css-class-names-selectors
						const classNames = s.name.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);

						for (const className of classNames) {
							if (className.index === undefined) continue;

							const text = className.toString();
							if (!names.has(text)) {
								names.set(text, []);
							}
							if (sourceMap) {
								const vueLoc = sourceMap.findFirstVueLocation(s.location.range);
								if (vueLoc) {
									names.get(text)!.push([vue.document, vue.document.offsetAt(vueLoc.range.start) + 1]);
								}
							}
							else {
								names.get(text)!.push([doc, doc.offsetAt(s.location.range.start) + 1]);
							}
						}
					}
				}
			}
		}
		function getInterpolations() {
			if (!descriptor.template) return;
			try {
				const html = pugData.value?.html ?? descriptor.template.content;
				const ast = vueDom.compile(html, { onError: () => { } }).ast;
				return transformVueHtml(
					ast,
					pugData.value?.mapper,
				);
			}
			catch (err) {
				return {
					text: '',
					mappings: [],
					tags: new Set<string>(),
				};
			}
		}
	});

	// documents
	const scriptDocument = computed(() => {
		if (descriptor.script) {
			const lang = descriptor.script.lang;
			const uri = `${vue.uri}.script.${lang}`;
			const languageId = extNameToLanguageId(lang);
			const content = descriptor.script.content;
			return TextDocument.create(uri, languageId, documentVersion++, content);
		}
		if (descriptor.scriptSetup) {
			const lang = 'ts';
			const uri = `${vue.uri}.script.${lang}`;
			const languageId = extNameToLanguageId(lang);
			const content = [
				`import * as __VLS_setups from './${upath.basename(vue.fileName)}.setup.0';`,
				`import { defineComponent } from '@vue/runtime-dom';`,
				`type __VLS_DefaultType<T> = T extends { default: infer K } ? K : new () => ({});`,
				`type __VLS_NonDefaultType<T> = Omit<T, 'default'>;`,
				`declare const __VLS_default: __VLS_DefaultType<typeof __VLS_setups>;`,
				`declare const __VLS_nonDefault: __VLS_NonDefaultType<typeof __VLS_setups>;`,
				`export default defineComponent({`,
				`	setup() { return {`,
				`		...new __VLS_default(),`,
				`		...__VLS_nonDefault,`,
				`	} }`,
				`});`,
			].join('\n')
			return TextDocument.create(uri, languageId, documentVersion++, content);
		}
	});
	const scriptSetupDocument0 = computed(() => {
		if (descriptor.scriptSetup) {
			const lang = descriptor.scriptSetup.lang;
			const uri = `${vue.uri}.setup.0.${lang}`;
			const languageId = extNameToLanguageId(lang);
			ts.SyntaxKind
			const content = [
				descriptor.scriptSetup.content,
				...(!hasExportDefault(descriptor.scriptSetup.content) ? [
					``,
					`declare const __VLS_defineComponent: (typeof import('vue'))['defineComponent'];`,
					`const __VLS_options = __VLS_defineComponent({ setup: () => { } });`,
					`declare const __VLS_parameters: Parameters<NonNullable<typeof __VLS_options.setup>>;`,
					`declare function __VLS_setup(__VLS_props: typeof props, __VLS_ctx: typeof __VLS_parameters[1]): ReturnType<NonNullable<typeof __VLS_options.setup>>;`,
					`declare const __VLS_export: typeof __VLS_options & {`,
					`	setup: typeof __VLS_setup,`,
					`	new(): InstanceType<typeof __VLS_options> & typeof props,`,
					`}`,
					`export default __VLS_export;`,
				] : []),
			].join('\n');
			return TextDocument.create(uri, languageId, documentVersion++, content);
		}

		function hasExportDefault(code: string) {
			const sourceFile = ts.createSourceFile('', code, ts.ScriptTarget.Latest);
			let result = false;
			sourceFile.forEachChild(node => {
				if (ts.isExportAssignment(node)) {
					result = true;
				}
			});
			return result;
		}
	});
	const scriptSetupDocument = computed(() => {
		if (descriptor.scriptSetup) {
			const lang = descriptor.scriptSetup.lang;
			const uri = `${vue.uri}.setup.${lang}`;
			const languageId = extNameToLanguageId(lang);
			const setup = descriptor.scriptSetup.setup;
			const content = [
				scriptSetupDeclarePropsLoc.value
					? (descriptor.scriptSetup.content.substring(0, scriptSetupDeclarePropsLoc.value.start)
						+ ' '.repeat(scriptSetupDeclarePropsLoc.value.end - scriptSetupDeclarePropsLoc.value.start)
						+ descriptor.scriptSetup.content.substring(scriptSetupDeclarePropsLoc.value.end))
					: descriptor.scriptSetup.content,
				``,
				`declare const __VLS_options: typeof import('./${upath.basename(vue.fileName)}.setup.0').default;`,
				`declare const __VLS_parameters: Parameters<NonNullable<typeof __VLS_options.setup>>;`,
				`declare var [${setup}]: typeof __VLS_parameters;`,
			].join('\n');
			return TextDocument.create(uri, languageId, documentVersion++, content);
		}
	});
	const scriptOptionsDocument = computed(() => {
		if (descriptor.scriptSetup) {
			const uri = `${vue.uri}.options.ts`;
			const languageId = 'typescript';
			const content = [
				descriptor.scriptSetup.content,
				`declare function defineComponent<T>(options: T): T;`,
			].join('\n');
			return TextDocument.create(uri, languageId, documentVersion++, content);
		}
		if (descriptor.script) {
			const uri = `${vue.uri}.options.ts`;
			const languageId = 'typescript';
			const content = [
				descriptor.script.content,
				`declare function defineComponent<T>(options: T): T;`,
			].join('\n');
			return TextDocument.create(uri, languageId, documentVersion++, content);
		}
	});
	const scriptMainDocument = computed(() => {
		const uri = `${vue.uri}.ts`;
		const content = [
			`import __VLS_VM from './${upath.basename(vue.fileName)}.script';`,
			`import __VLS_Options from './${upath.basename(vue.fileName)}.options';`,
			`import __VLS_Slots from './${upath.basename(vue.fileName)}.template';`,
			`declare var __VLS_vm: InstanceType<typeof __VLS_VM>;`,
			`declare var __VLS_ComponentsWrap: typeof __VLS_Options & { components: { } };`,
			`declare var __VLS_Components: typeof __VLS_ComponentsWrap.components & __VLS_GlobalComponents & __VLS_BuiltInComponents;`,
			`__VLS_vm.;`,
			`__VLS_Components.;`,
			`__VLS_Options.setup().;`,
			`({} as JSX.IntrinsicElements).;`,
			``,
			`declare global {`,
			`interface __VLS_GlobalComponents { }`,
			`interface __VLS_BuiltInComponents extends Pick<typeof import('vue'),`,
			`	'Transition'`,
			`	| 'TransitionGroup'`,
			`	| 'KeepAlive'`,
			`	| 'Suspense'`,
			`	| 'Teleport'`,
			`	> { }`,
			`}`,
			``,
			`declare const __VLS_exportData: typeof __VLS_VM & {`,
			`__VLS_options: typeof __VLS_Options,`,
			`__VLS_slots: typeof __VLS_Slots,`,
			`};`,
			`export * from './${upath.basename(vue.fileName)}.script';`,
			`export default __VLS_exportData;`,
		].join('\n');
		return TextDocument.create(uri, 'typescript', documentVersion++, content);
	});
	const templateScriptDocument = ref<TextDocument>();
	const styleDocuments = computed(() => {
		const compilerHost = ts.createCompilerHost(tsLanguageService.host.getCompilationSettings());
		const documentContext = {
			resolveReference: (ref: string, base: string) => {
				return resolvePath(ref, base);
			},
		};
		const documents: [
			TextDocument,
			css.Stylesheet,
			[TextDocument, css.Stylesheet][],
		][] = [];
		for (let i = 0; i < descriptor.styles.length; i++) {
			const style = descriptor.styles[i];
			const lang = style.lang;
			const content = style.content;
			const documentUri = vue.uri + '.' + i + '.' + lang;
			const document = TextDocument.create(documentUri, lang, documentVersion++, content);
			const cssLanguageService = lang === 'scss' ? globalServices.scss : globalServices.css;
			const stylesheet = cssLanguageService.parseStylesheet(document);
			const linkStyles: [TextDocument, css.Stylesheet][] = [];
			findLinks(document, stylesheet);
			documents.push([document, stylesheet, linkStyles]);

			function findLinks(textDocument: TextDocument, stylesheet: css.Stylesheet) {
				const links = cssLanguageService.findDocumentLinks(textDocument, stylesheet, documentContext);
				for (const link of links) {
					if (!link.target) continue;
					if (!link.target.endsWith('.css') && !link.target.endsWith('.scss')) continue;
					if (!ts.sys.fileExists(uriToFsPath(link.target))) continue;
					if (linkStyles.find(l => l[0].uri === link.target)) continue; // Loop

					const text = ts.sys.readFile(uriToFsPath(link.target));
					if (text === undefined) continue;

					const lang = upath.extname(link.target).substr(1);
					const doc = TextDocument.create(link.target, lang, documentVersion++, text);
					const ss = lang === 'scss' ? globalServices.scss.parseStylesheet(doc) : globalServices.css.parseStylesheet(doc);
					linkStyles.push([doc, ss]);
					findLinks(doc, ss);
				}
			}
		}
		return documents;
		function resolvePath(ref: string, base: string) {
			const resolveResult = ts.resolveModuleName(ref, base, tsLanguageService.host.getCompilationSettings(), compilerHost);
			const failedLookupLocations: string[] = (resolveResult as any).failedLookupLocations;
			for (const failed of failedLookupLocations) {
				let path = failed;
				if (path.endsWith('.d.ts')) {
					path = upath.trimExt(path);
					path = upath.trimExt(path);
				}
				else {
					path = upath.trimExt(path);
				}
				if (ts.sys.fileExists(uriToFsPath(path))) {
					return path;
				}
			}
			return ref;
		}
	});
	const templateDocument = computed<TextDocument | undefined>(() => {
		if (descriptor.template) {
			const lang = extNameToLanguageId(descriptor.template.lang);
			const uri = vue.uri + '.' + lang;
			const content = descriptor.template.content;
			const document = TextDocument.create(uri, lang, documentVersion++, content);
			return document;
		}
	});
	const vueHtmlDocument = computed(() => {
		return globalServices.html.parseHTMLDocument(vue.document);
	});
	const templateHtmlDocument = computed<html.HTMLDocument | undefined>(() => {
		if (templateDocument.value) {
			return globalServices.html.parseHTMLDocument(templateDocument.value);
		}
	});

	// source maps
	const scriptSourceMapes = computed(() => {
		const sourceMaps: TsSourceMap[] = [];
		const document = scriptDocument.value;
		if (document && descriptor.script) {
			const sourceMap = new TsSourceMap(vue.document, document, false, { foldingRanges: true });
			const start = descriptor.script.loc.start;
			const end = descriptor.script.loc.end;
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: true,
						references: true,
						rename: true,
						diagnostic: true,
						formatting: true,
						completion: true,
						semanticTokens: true,
					},
				},
				mode: MapedMode.Offset,
				vueRange: {
					start: start,
					end: end,
				},
				virtualRange: {
					start: 0,
					end: end - start,
				},
			});
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	const scriptSetupSourceMaps = computed(() => {
		const sourceMaps: TsSourceMap[] = [];
		// .vue.setup.0.ts
		const document0 = scriptSetupDocument0.value;
		if (document0 && descriptor.scriptSetup && scriptSetupDeclarePropsLoc.value) {
			const vueStart = descriptor.scriptSetup.loc.start;
			const sourceMap = new TsSourceMap(vue.document, document0, false, { foldingRanges: true });
			const virtualRange = scriptSetupDeclarePropsLoc.value;
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: true,
						references: true,
						rename: true,
						diagnostic: true,
						formatting: true,
						completion: true,
						semanticTokens: true,
					},
				},
				mode: MapedMode.Offset,
				vueRange: {
					start: vueStart + virtualRange.start,
					end: vueStart + virtualRange.end,
				},
				virtualRange: {
					start: virtualRange.start,
					end: virtualRange.end,
				},
			});
			sourceMaps.push(sourceMap);
		}
		// img.vue.setup.ts
		const document = scriptSetupDocument.value;
		if (document && descriptor.scriptSetup) {
			const sourceMap = new TsSourceMap(vue.document, document, false, { foldingRanges: true });
			{
				const vueStart = descriptor.scriptSetup.loc.start;
				const vueEnd = descriptor.scriptSetup.loc.end;
				const virtualRanges: { start: number, end: number }[] = [];
				if (scriptSetupDeclarePropsLoc.value) {
					virtualRanges.push({ start: 0, end: scriptSetupDeclarePropsLoc.value.start });
					virtualRanges.push({ start: scriptSetupDeclarePropsLoc.value.end, end: vueEnd - vueStart });
				}
				else {
					virtualRanges.push({ start: 0, end: vueEnd - vueStart })
				}
				for (const virtualRange of virtualRanges) {
					sourceMap.add({
						data: {
							vueTag: 'script',
							capabilities: {
								basic: true,
								references: true,
								rename: true,
								diagnostic: true,
								formatting: true,
								completion: true,
								semanticTokens: true,
							},
						},
						mode: MapedMode.Offset,
						vueRange: {
							start: vueStart + virtualRange.start,
							end: vueStart + virtualRange.end,
						},
						virtualRange: {
							start: virtualRange.start,
							end: virtualRange.end,
						},
					});
				}
			}
			{
				const setup = descriptor.scriptSetup.setup;
				const start = vue.document.getText().substring(0, descriptor.scriptSetup.loc.start).lastIndexOf(setup); // TODO: don't use indexOf()
				const end = start + setup.length;
				const start_2 = document.getText().lastIndexOf(`${setup}]: typeof __VLS_parameters;`);
				const end_2 = start_2 + setup.length;
				sourceMap.add({
					data: {
						vueTag: 'script',
						capabilities: {
							basic: true,
							references: true,
							rename: true,
							diagnostic: true,
							formatting: true,
							completion: true,
							semanticTokens: true,
						},
					},
					mode: MapedMode.Offset,
					vueRange: {
						start: start,
						end: end,
					},
					virtualRange: {
						start: start_2,
						end: end_2,
					},
				});
			}
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	const scriptOptionsSourceMaps = computed(() => {
		const sourceMaps: TsSourceMap[] = [];
		const document = scriptOptionsDocument.value;
		const start = descriptor.scriptSetup?.loc.start ?? descriptor.script?.loc.start;
		const end = descriptor.scriptSetup?.loc.end ?? descriptor.script?.loc.end;
		if (document && start !== undefined && end !== undefined) {
			const sourceMap = new TsSourceMap(vue.document, document, false, { foldingRanges: false });
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: false,
						references: true,
						rename: true,
						diagnostic: false,
						formatting: false,
						completion: false,
						semanticTokens: false,
					},
				},
				mode: MapedMode.Offset,
				vueRange: {
					start: start,
					end: end,
				},
				virtualRange: {
					start: 0,
					end: end - start,
				},
			});
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	const scriptMainSourceMapes = computed(() => {
		const sourceMaps: TsSourceMap[] = [];
		const document = scriptMainDocument.value;
		if (document && descriptor.script) {
			const sourceMap = new TsSourceMap(vue.document, document, false, { foldingRanges: false });
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {
						basic: false,
						references: false,
						rename: false,
						diagnostic: false,
						formatting: false,
						completion: false,
						semanticTokens: false,
					},
				},
				mode: MapedMode.Gate,
				vueRange: {
					start: descriptor.script.loc.start,
					end: descriptor.script.loc.end,
				},
				virtualRange: {
					start: 0,
					end: document.getText().length,
				},
			});
			const optionsPropertyOffset = document.getText().indexOf('__VLS_options: typeof __VLS_Options,');
			if (optionsPropertyOffset >= 0) {
				sourceMap.add({
					data: {
						vueTag: 'script',
						capabilities: {
							basic: false,
							references: false,
							rename: false,
							diagnostic: false,
							formatting: false,
							completion: false,
							semanticTokens: false,
						},
					},
					mode: MapedMode.Gate,
					vueRange: {
						start: descriptor.script.loc.start,
						end: descriptor.script.loc.end,
					},
					virtualRange: {
						start: optionsPropertyOffset,
						end: optionsPropertyOffset + '__VLS_options'.length,
					},
				});
			}
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	const templateScriptSourceMaps = computed(() => templateScript.value?.getSourceMaps() ?? []);

	// source map sets
	const tsSourceMaps = computed(() => {
		return [
			...scriptSourceMapes.value,
			...scriptSetupSourceMaps.value,
			...scriptOptionsSourceMaps.value,
			...scriptMainSourceMapes.value,
			...templateScriptSourceMaps.value,
		];
	});
	const cssSourceMaps = computed(() => {
		const sourceMaps: CssSourceMap[] = [];
		for (let i = 0; i < descriptor.styles.length && i < styleDocuments.value.length; i++) {
			const style = descriptor.styles[i];
			const document = styleDocuments.value[i][0];
			const stylesheet = styleDocuments.value[i][1];
			const linkStyles = styleDocuments.value[i][2];
			const loc = style.loc;
			const module = style.module;

			const sourceMap = new CssSourceMap(
				vue.document,
				document,
				stylesheet,
				module,
				linkStyles,
			);
			sourceMap.add({
				data: undefined,
				mode: MapedMode.Offset,
				vueRange: {
					start: loc.start,
					end: loc.end,
				},
				virtualRange: {
					start: 0,
					end: loc.end - loc.start,
				},
			});
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	const htmlSourceMaps = computed(() => {
		const sourceMaps: HtmlSourceMap[] = [];
		if (templateDocument.value?.languageId === 'html' && templateHtmlDocument.value && descriptor.template) {
			const document = templateDocument.value;
			const htmlDocument = templateHtmlDocument.value;
			const sourceMap = new HtmlSourceMap(
				vue.document,
				document,
				htmlDocument,
			);
			sourceMap.add({
				data: undefined,
				mode: MapedMode.Offset,
				vueRange: {
					start: descriptor.template.loc.start,
					end: descriptor.template.loc.end,
				},
				virtualRange: {
					start: 0,
					end: descriptor.template.loc.end - descriptor.template.loc.start,
				},
			});
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});
	const pugSourceMaps = computed(() => {
		const sourceMaps: PugSourceMap[] = [];
		if (templateDocument.value?.languageId === 'jade' && descriptor.template) {
			const document = templateDocument.value;
			const sourceMap = new PugSourceMap(
				vue.document,
				document,
				pugData.value.html,
				pugData.value.mapper,
			);
			sourceMap.add({
				data: undefined,
				mode: MapedMode.Offset,
				vueRange: {
					start: descriptor.template.loc.start,
					end: descriptor.template.loc.end,
				},
				virtualRange: {
					start: 0,
					end: descriptor.template.loc.end - descriptor.template.loc.start,
				},
			});
			sourceMaps.push(sourceMap);
		}
		return sourceMaps;
	});

	const tsDocuments = computed(() => {
		const docs = new Map<string, TextDocument>();
		if (scriptDocument.value) docs.set(scriptDocument.value.uri, scriptDocument.value);
		if (scriptSetupDocument0.value) docs.set(scriptSetupDocument0.value.uri, scriptSetupDocument0.value);
		if (scriptSetupDocument.value) docs.set(scriptSetupDocument.value.uri, scriptSetupDocument.value);
		if (scriptOptionsDocument.value) docs.set(scriptOptionsDocument.value.uri, scriptOptionsDocument.value);
		if (scriptMainDocument.value) docs.set(scriptMainDocument.value.uri, scriptMainDocument.value);
		if (templateScriptDocument.value) docs.set(templateScriptDocument.value.uri, templateScriptDocument.value);
		return docs;
	});

	update(initialDocument);

	return {
		uri: vue.uri,
		fileName: vue.fileName,
		getTextDocument: untrack(() => vue.document),
		update,
		updateTemplateScript,
		getComponentCompletionData: useComponentCompletionData(),
		getDiagnostics: useDiagnostics(),
		getTsSourceMaps: untrack(() => tsSourceMaps.value),
		getCssSourceMaps: untrack(() => cssSourceMaps.value),
		getHtmlSourceMaps: untrack(() => htmlSourceMaps.value),
		getPugSourceMaps: untrack(() => pugSourceMaps.value),
		getTemplateScriptData: untrack(() => templateScriptData),
		getTemplateScript: untrack(() => templateScript.value),
		getDescriptor: untrack(() => descriptor),
		getVueHtmlDocument: untrack(() => vueHtmlDocument.value),
		getTsDocuments: untrack(() => tsDocuments.value),
	};

	function update(newVueDocument: TextDocument) {
		const newDescriptor = vueSfc.parse(newVueDocument.getText(), { filename: vue.fileName }).descriptor;
		const versionsBeforeUpdate = [
			scriptDocument.value?.version,
			scriptSetupDocument.value?.version,
			templateScriptDocument.value?.version,
		];

		updateTemplate(newDescriptor);
		updateScript(newDescriptor);
		updateScriptSetup(newDescriptor);
		updateStyles(newDescriptor);
		updateTemplateScriptDocument();

		if (newVueDocument.getText() !== vue.document.getText()) {
			vue.document = newVueDocument;
		}

		const versionsAfterUpdate = [
			scriptDocument.value?.version,
			scriptSetupDocument.value?.version,
			templateScriptDocument.value?.version,
		];

		return {
			scriptUpdated: versionsBeforeUpdate[0] !== versionsAfterUpdate[0] || versionsBeforeUpdate[1] !== versionsAfterUpdate[1],
			templateScriptUpdated: versionsBeforeUpdate[2] !== versionsAfterUpdate[2],
		};

		function updateTemplate(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.template ? {
				lang: newDescriptor.template.lang ?? 'html',
				content: newDescriptor.template.content,
				loc: {
					start: newDescriptor.template.loc.start.offset,
					end: newDescriptor.template.loc.end.offset,
				},
			} : null;
			if (descriptor.template && newData) {
				descriptor.template.lang = newData.lang;
				descriptor.template.content = newData.content;
				descriptor.template.loc.start = newData.loc.start;
				descriptor.template.loc.end = newData.loc.end;
			}
			else {
				descriptor.template = newData;
			}
		}
		function updateScript(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.script ? {
				lang: newDescriptor.script.lang ?? 'js',
				content: passScriptRefs(newDescriptor.script),
				loc: {
					start: newDescriptor.script.loc.start.offset,
					end: newDescriptor.script.loc.end.offset,
				},
			} : null;
			if (descriptor.script && newData) {
				descriptor.script.lang = newData.lang;
				descriptor.script.content = newData.content;
				descriptor.script.loc.start = newData.loc.start;
				descriptor.script.loc.end = newData.loc.end;
			}
			else {
				descriptor.script = newData;
			}
		}
		function updateScriptSetup(newDescriptor: vueSfc.SFCDescriptor) {
			const newData = newDescriptor.scriptSetup ? {
				lang: newDescriptor.scriptSetup.lang ?? 'js',
				content: passScriptRefs(newDescriptor.scriptSetup),
				loc: {
					start: newDescriptor.scriptSetup.loc.start.offset,
					end: newDescriptor.scriptSetup.loc.end.offset,
				},
				setup: typeof newDescriptor.scriptSetup.setup === 'string' ? newDescriptor.scriptSetup.setup : '',
			} : null;
			if (descriptor.scriptSetup && newData) {
				descriptor.scriptSetup.lang = newData.lang;
				descriptor.scriptSetup.content = newData.content;
				descriptor.scriptSetup.loc.start = newData.loc.start;
				descriptor.scriptSetup.loc.end = newData.loc.end;
				descriptor.scriptSetup.setup = newData.setup;
			}
			else {
				descriptor.scriptSetup = newData;
			}
		}
		function updateStyles(newDescriptor: vueSfc.SFCDescriptor) {
			for (let i = 0; i < newDescriptor.styles.length; i++) {
				const style = newDescriptor.styles[i];
				const newData = {
					lang: style.lang ?? 'css',
					content: style.content,
					loc: {
						start: style.loc.start.offset,
						end: style.loc.end.offset,
					},
					module: style.module !== false,
				};
				if (descriptor.styles.length > i) {
					descriptor.styles[i].lang = newData.lang;
					descriptor.styles[i].content = newData.content;
					descriptor.styles[i].loc.start = newData.loc.start;
					descriptor.styles[i].loc.end = newData.loc.end;
					descriptor.styles[i].module = newData.module;
				}
				else {
					descriptor.styles.push(newData);
				}
			}
			while (descriptor.styles.length > newDescriptor.styles.length) {
				descriptor.styles.pop();
			}
		}
	}
	function updateTemplateScript() {
		if (templateScriptData.projectVersion === tsLanguageService.host.getProjectVersion?.()) {
			return false;
		}
		templateScriptData.projectVersion = tsLanguageService.host.getProjectVersion?.();

		const doc = scriptMainDocument.value;
		const props = tsLanguageService.doComplete(doc, doc.positionAt(getCodeEndIndex('__VLS_vm.')));
		const components = tsLanguageService.doComplete(doc, doc.positionAt(getCodeEndIndex('__VLS_Components.')));
		const setupReturns = tsLanguageService.doComplete(doc, doc.positionAt(getCodeEndIndex('__VLS_Options.setup().')));
		const htmlElements = tsLanguageService.doComplete(doc, doc.positionAt(getCodeEndIndex('({} as JSX.IntrinsicElements).')));

		const propNames = props.map(entry => entry.data.name);
		const componentNames = components.map(entry => entry.data.name);
		const setupReturnNames = setupReturns.map(entry => entry.data.name);
		const htmlElementNames = htmlElements.map(entry => entry.data.name);

		if (eqSet(new Set(propNames), new Set(templateScriptData.props))
			&& eqSet(new Set(componentNames), new Set(templateScriptData.components))
			&& eqSet(new Set(setupReturnNames), new Set(templateScriptData.setupReturns))
			&& eqSet(new Set(htmlElementNames), new Set(templateScriptData.htmlElements))
		) {
			return false;
		}

		templateScriptData.props = propNames;
		templateScriptData.components = componentNames;
		templateScriptData.setupReturns = setupReturnNames;
		templateScriptData.htmlElements = htmlElementNames;
		updateTemplateScriptDocument();
		return true;

		function getCodeEndIndex(text: string) {
			return doc.getText().indexOf(text) + text.length
		}
		function eqSet<T>(as: Set<T>, bs: Set<T>) {
			if (as.size !== bs.size) return false;
			for (const a of as) if (!bs.has(a)) return false;
			return true;
		}
	}
	function updateTemplateScriptDocument() {
		if (!templateScript.value) {
			templateScriptDocument.value = undefined;
		}
		else if (templateScript.value.document.getText() !== templateScriptDocument.value?.getText()) {
			templateScriptDocument.value = templateScript.value.document;
		}
	}
	function useDiagnostics() {

		let version = 0;

		const stylesDiags = useStylesValidation();
		const templateDiags = useTemplateValidation();
		const templateScriptDiags_1 = useTemplateScriptValidation(1);
		const templateScriptDiags_2 = useTemplateScriptValidation(2);
		const templateScriptDiags_3 = useTemplateScriptValidation(3);
		const scriptDiags_1 = useScriptValidation(1);
		const scriptDiags_2 = useScriptValidation(2);
		const scriptDiags_3 = useScriptValidation(3);

		const lastStylesDiags = ref<Diagnostic[]>([]);
		const lastTemplateDiags = ref<Diagnostic[]>([]);
		const lastTemplateScriptDiags_1 = ref<Diagnostic[]>([]);
		const lastTemplateScriptDiags_2 = ref<Diagnostic[]>([]);
		const lastTemplateScriptDiags_3 = ref<Diagnostic[]>([]);
		const lastScriptDiags_1 = ref<Diagnostic[]>([]);
		const lastScriptDiags_2 = ref<Diagnostic[]>([]);
		const lastScriptDiags_3 = ref<Diagnostic[]>([]);
		const result = computed(() => {
			let result = [
				...lastStylesDiags.value,
				...lastTemplateDiags.value,
				...lastScriptDiags_1.value,
				...lastScriptDiags_2.value,
				...lastScriptDiags_3.value,
				...lastTemplateScriptDiags_1.value,
				...lastTemplateScriptDiags_2.value,
				...lastTemplateScriptDiags_3.value,
			];
			return result;
		});

		return worker;

		async function worker(isCancel?: () => boolean, onDirty?: (diags: Diagnostic[]) => void) {
			tsProjectVersion.value = tsLanguageService.host.getProjectVersion?.();
			let dirty = false;

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(stylesDiags, lastStylesDiags);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(templateDiags, lastTemplateDiags);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(templateScriptDiags_2, lastTemplateScriptDiags_2);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(scriptDiags_2, lastScriptDiags_2);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(templateScriptDiags_3, lastTemplateScriptDiags_3);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(scriptDiags_3, lastScriptDiags_3);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(templateScriptDiags_1, lastTemplateScriptDiags_1);

			if (dirty) await sleep();
			if (isCancel?.()) return;
			dirty = tryProgress(scriptDiags_1, lastScriptDiags_1);

			return result.value;

			function tryProgress(data: Ref<Diagnostic[]>, lastData: Ref<Diagnostic[]>) {
				const oldVersion = version;
				lastData.value = data.value;
				if (version !== oldVersion) {
					onDirty?.(result.value);
					return true;
				}
				return false;
			}
		}
		function useTemplateValidation() {
			const htmlErrors = computed(() => {
				if (templateDocument.value?.languageId === 'html') {
					return getVueCompileErrors(templateDocument.value);
				}
				return [];
			});
			const pugErrors = computed(() => {
				const result: Diagnostic[] = [];
				if (pugData.value.error) {
					result.push(pugData.value.error);
				}
				if (pugData.value.html && templateDocument.value) {
					const htmlDoc = TextDocument.create('', 'html', 0, pugData.value.html);
					const vueCompileErrors = getVueCompileErrors(htmlDoc);
					const pugDocRange = {
						start: templateDocument.value.positionAt(0),
						end: templateDocument.value.positionAt(templateDocument.value.getText().length),
					};
					// TODO
					for (const vueCompileError of vueCompileErrors) {
						let errorText = htmlDoc.getText(vueCompileError.range);
						errorText = prettyhtml(errorText).contents;
						vueCompileError.range = pugDocRange;
						vueCompileError.message += '\n```html\n' + errorText + '```';
						result.push(vueCompileError);
					}
				}
				return result;
			});
			return computed(() => {
				version++;
				if (!templateDocument.value) return [];
				return [
					...getSourceDiags(htmlErrors.value, templateDocument.value.uri, htmlSourceMaps.value),
					...getSourceDiags(pugErrors.value, templateDocument.value.uri, pugSourceMaps.value),
				];
			});

			function getVueCompileErrors(doc: TextDocument) {
				const result: Diagnostic[] = [];
				try {
					const templateResult = vueSfc.compileTemplate({
						source: doc.getText(),
						filename: vue.fileName,
						compilerOptions: {
							onError: err => {
								if (!err.loc) return;

								const diagnostic: Diagnostic = {
									range: {
										start: doc.positionAt(err.loc.start.offset),
										end: doc.positionAt(err.loc.end.offset),
									},
									severity: DiagnosticSeverity.Error,
									code: err.code,
									source: 'vue',
									message: err.message,
								};
								result.push(diagnostic);
							},
						}
					});

					for (const err of templateResult.errors) {
						if (typeof err !== 'object' || !err.loc)
							continue;

						const diagnostic: Diagnostic = {
							range: {
								start: doc.positionAt(err.loc.start.offset),
								end: doc.positionAt(err.loc.end.offset),
							},
							severity: DiagnosticSeverity.Error,
							source: 'vue',
							code: err.code,
							message: err.message,
						};
						result.push(diagnostic);
					}
				}
				catch (err) {
					const diagnostic: Diagnostic = {
						range: {
							start: doc.positionAt(0),
							end: doc.positionAt(doc.getText().length),
						},
						severity: DiagnosticSeverity.Error,
						code: err.code,
						source: 'vue',
						message: err.message,
					};
					result.push(diagnostic);
				}
				return result;
			}
		}
		function useStylesValidation() {
			const errors = computed(() => {
				let result = new Map<string, css.Diagnostic[]>();
				for (const [document, stylesheet] of styleDocuments.value) {
					const cssLanguageService = document.languageId === "scss" ? globalServices.scss : globalServices.css;
					const errs = cssLanguageService.doValidation(document, stylesheet);
					if (errs) result.set(document.uri, errs);
				}
				return result;
			});
			return computed(() => {
				version++;
				let result: css.Diagnostic[] = [];
				for (const [uri, errs] of errors.value) {
					result = result.concat(getSourceDiags(errs, uri, cssSourceMaps.value));
				}
				return result as Diagnostic[];
			});
		}
		function useScriptValidation(mode: number) {
			const document = computed(() => scriptSetupDocument.value ? scriptSetupDocument.value : scriptDocument.value);
			const errors = computed(() => {
				if (mode === 1) { // watching
					tsProjectVersion.value;
				}
				const doc = document.value;
				if (!doc) return [];
				if (mode === 1) {
					return tsLanguageService.doValidation(doc, { semantic: true });
				}
				else if (mode === 2) {
					return tsLanguageService.doValidation(doc, { syntactic: true });
				}
				else {
					return tsLanguageService.doValidation(doc, { suggestion: true });
				}
			});
			return computed(() => {
				version++;
				const doc = document.value;
				if (!doc) return [];
				return getSourceDiags(errors.value, doc.uri, tsSourceMaps.value);
			});
		}
		function useTemplateScriptValidation(mode: number) {
			const errors_1 = computed(() => {
				if (mode === 1) { // watching
					tsProjectVersion.value;
				}
				const doc = templateScriptDocument.value;
				if (!doc) return [];
				if (mode === 1) {
					return tsLanguageService.doValidation(doc, { semantic: true });
				}
				else if (mode === 2) {
					return tsLanguageService.doValidation(doc, { syntactic: true });
				}
				else {
					return tsLanguageService.doValidation(doc, { suggestion: true });
				}
			});
			const errors_2 = computed(() => {
				const result: Diagnostic[] = [];
				if (!templateScript.value || !scriptDocument.value) return result;
				for (const diag of errors_1.value) {
					const spanText = templateScript.value.document.getText(diag.range);
					if (!templateScriptData.setupReturns.includes(spanText)) continue;
					const propRights = templateScript.value.propSourceMap.findVirtualLocations(diag.range);
					for (const propRight of propRights) {
						if (propRight.maped.data.isOptionsProp || propRight.maped.data.isSetupExport) continue;
						const definitions = tsLanguageService.findDefinition(templateScript.value.document, propRight.range.start);
						for (const definition of definitions) {
							if (definition.uri !== scriptDocument.value.uri) continue;
							result.push({
								...diag,
								range: definition.range,
							});
						}
					}
				}
				return result;
			})
			return computed(() => {
				version++;
				const result_1 = templateScriptDocument.value ? getSourceDiags(
					errors_1.value,
					templateScriptDocument.value.uri,
					tsSourceMaps.value,
				) : [];
				const result_2 = scriptDocument.value ? getSourceDiags(
					errors_2.value,
					scriptDocument.value.uri,
					tsSourceMaps.value,
				) : [];
				return [...result_1, ...result_2];
			});
		}
		function getSourceDiags<T = Diagnostic | css.Diagnostic>(errors: T[], virtualScriptUri: string, sourceMaps: SourceMap[]) {
			const result: T[] = [];
			for (const error of errors) {
				for (const sourceMap of sourceMaps) {
					if (sourceMap.virtualDocument.uri === virtualScriptUri) {
						if (css.Diagnostic.is(error)) {
							const vueLoc = sourceMap.findFirstVueLocation(error.range);
							if (vueLoc) {
								result.push({
									...error,
									range: vueLoc.range,
								});
							}
						}
						else if (Diagnostic.is(error)) {
							const vueLoc = sourceMap.findFirstVueLocation(error.range);
							if (vueLoc) {
								result.push({
									...error,
									range: vueLoc.range,
								});
							}
						}
					}
				}
			}
			return result;
		}
	}
	function useComponentCompletionData() {
		const result = computed(() => {
			{ // watching
				tsProjectVersion.value;
			}
			const data = new Map<string, { bind: CompletionItem[], on: CompletionItem[] }>();
			if (templateScriptDocument.value && templateDocument.value) {
				const doc = templateScriptDocument.value;
				const text = doc.getText();
				for (const tagName of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
					let bind: CompletionItem[];
					let on: CompletionItem[];
					{
						const searchText = `__VLS_componentPropsBase['${tagName}']['`;
						let offset = text.indexOf(searchText);
						if (offset === -1) continue;
						offset += searchText.length;
						bind = tsLanguageService.doComplete(doc, doc.positionAt(offset));
					}
					{
						const searchText = `__VLS_componentEmits['${tagName}']['`;
						let offset = text.indexOf(searchText);
						if (offset === -1) continue;
						offset += searchText.length;
						on = tsLanguageService.doComplete(doc, doc.positionAt(offset));
					}
					data.set(tagName, { bind, on });
					data.set(hyphenate(tagName), { bind, on });
				}
				let globalBind: CompletionItem[] = [];
				{
					const searchText = `({} as __VLS_GlobalAttrs)['`;
					let offset = text.indexOf(searchText);
					if (offset >= 0) {
						offset += searchText.length;
						globalBind = tsLanguageService.doComplete(doc, doc.positionAt(offset));
					}
				}
				data.set('*', { bind: globalBind, on: [] });
			}
			return data;
		});
		return () => {
			tsProjectVersion.value = tsLanguageService.host.getProjectVersion?.();
			return result.value;
		};
	}
	function passScriptRefs(script: vueSfc.SFCScriptBlock) {
		let content = script.content;
		if (script.attrs.refs) {
			const scriptTarget = tsLanguageService.host.getCompilationSettings().target ?? ts.ScriptTarget.Latest;
			const variant = (script.lang === 'tsx' || script.lang === 'jsx') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
			const tsScanner = ts.createScanner(scriptTarget, true, variant, script.content);
			let tokenType = tsScanner.scan();
			while (tokenType !== ts.SyntaxKind.EndOfFileToken) {
				const tokenText = tsScanner.getTokenText();
				const tokenPos = tsScanner.getTokenPos();
				if (tokenType === ts.SyntaxKind.Identifier && tokenText === 'ref') {
					const nextTokenType = tsScanner.scan();
					if (nextTokenType === ts.SyntaxKind.Identifier) {
						content = content.substring(0, tokenPos) + 'let' + content.substring(tokenPos + 'let'.length);
					}
					tokenType = nextTokenType;
				}
				else if (tokenType === ts.SyntaxKind.Identifier && tokenText === 'computed') {
					const nextTokenType = tsScanner.scan();
					if (nextTokenType === ts.SyntaxKind.Identifier) {
						content = content.substring(0, tokenPos) + '   const' + content.substring(tokenPos + '   const'.length);
					}
					tokenType = nextTokenType;
				}
				else {
					tokenType = tsScanner.scan();
				}
			}
		}
		return content;
	}
	function untrack<T>(source: () => T) {
		return () => {
			pauseTracking();
			const result = source();
			resetTracking();
			return result;
		};
	}
}
