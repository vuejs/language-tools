import { SFCBlock, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, shallowRef as ref, Ref, pauseTracking, resetTracking } from '@vue/reactivity';
import { ResolvedVueCompilerOptions } from './types';
import { EmbeddedFileSourceMap, Teleport, EmbeddedFile, EmbeddedFileMappingData, Embedded, EmbeddedStructure, EmbeddedLangaugeSourceFile } from '@volar/embedded-language-core';

import { CodeGen } from '@volar/code-gen';
import { Mapping, MappingBase } from '@volar/source-map';
import * as CompilerDom from '@vue/compiler-dom';
import type * as ts from 'typescript/lib/tsserverlibrary';

export type VueLanguagePlugin = (ctx: {
	modules: {
		typescript: typeof import('typescript/lib/tsserverlibrary');
	},
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: ResolvedVueCompilerOptions,
}) => {
	order?: number;
	parseSFC?(fileName: string, content: string): SFCParseResult | undefined;
	updateSFC?(oldResult: SFCParseResult, textChange: { start: number, end: number, newText: string; }): SFCParseResult | undefined;
	compileSFCTemplate?(lang: string, template: string, options?: CompilerDom.CompilerOptions): CompilerDom.CodegenResult | undefined;
	updateSFCTemplate?(oldResult: CompilerDom.CodegenResult, textChange: { start: number, end: number, newText: string; }): CompilerDom.CodegenResult | undefined;
	getEmbeddedFileNames?(fileName: string, sfc: Sfc): string[];
	resolveEmbeddedFile?(fileName: string, sfc: Sfc, embeddedFile: EmbeddedFile): void;
};

export interface SfcBlock {
	tag: 'script' | 'scriptSetup' | 'template' | 'style' | 'customBlock',
	start: number;
	end: number;
	startTagEnd: number;
	endTagStart: number;
	lang: string;
	content: string;
}

export interface Sfc {
	template: SfcBlock | null;
	script: (SfcBlock & {
		src: string | undefined;
	}) | null;
	scriptSetup: SfcBlock | null;
	styles: (SfcBlock & {
		module: string | undefined;
		scoped: boolean;
	})[];
	customBlocks: (SfcBlock & {
		type: string;
	})[];

	// ast
	templateAst: CompilerDom.RootNode | undefined;
	scriptAst: ts.SourceFile | undefined;
	scriptSetupAst: ts.SourceFile | undefined;
}

export class VueSourceFile implements EmbeddedLangaugeSourceFile {

	public sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
		templateAst: computed(() => {
			return this._compiledSFCTemplate.value?.ast;
		}) as unknown as Sfc['templateAst'],
		scriptAst: computed(() => {
			if (this.sfc.script) {
				return this.ts.createSourceFile(this.fileName + '.' + this.sfc.script.lang, this.sfc.script.content, this.ts.ScriptTarget.Latest);
			}
		}) as unknown as Sfc['scriptAst'],
		scriptSetupAst: computed(() => {
			if (this.sfc.scriptSetup) {
				return this.ts.createSourceFile(this.fileName + '.' + this.sfc.scriptSetup.lang, this.sfc.scriptSetup.content, this.ts.ScriptTarget.Latest);
			}
		}) as unknown as Sfc['scriptSetupAst'],
	}) as Sfc /* avoid Sfc unwrap in .d.ts by reactive */;

	get text() {
		return this._text.value;
	}

	get compiledSFCTemplate() {
		return this._compiledSFCTemplate.value;
	}

	get tsFileName() {
		return this._allEmbeddeds.value.find(e => e.file.fileName.replace(this.fileName, '').match(/^\.(js|ts)x?$/))?.file.fileName ?? '';
	}

	get embeddeds() {
		return this._embeddeds.value;
	}

	// refs
	_snapshot: Ref<ts.IScriptSnapshot>;
	_text = computed(() => this._snapshot.value.getText(0, this._snapshot.value.getLength()));

	// cache
	_parsedSfcCache: {
		snapshot: ts.IScriptSnapshot,
		sfc: SFCParseResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;
	_compiledSFCTemplateCache: {
		snapshot: ts.IScriptSnapshot,
		result: CompilerDom.CodegenResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	// computeds
	_parsedSfc = computed(() => {

		// incremental update
		if (this._parsedSfcCache?.plugin.updateSFC) {
			const change = this._snapshot.value.getChangeRange(this._parsedSfcCache.snapshot);
			if (change) {
				const newSfc = this._parsedSfcCache.plugin.updateSFC(this._parsedSfcCache.sfc, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: this._snapshot.value.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					this._parsedSfcCache.snapshot = this._snapshot.value;
					this._parsedSfcCache.sfc = newSfc;
					return newSfc;
				}
			}
		}

		for (const plugin of this.plugins) {
			const sfc = plugin.parseSFC?.(this.fileName, this._text.value);
			if (sfc) {
				if (!sfc.errors.length) {
					this._parsedSfcCache = {
						snapshot: this._snapshot.value,
						sfc,
						plugin,
					};
				}
				return sfc;
			}
		}
	});
	_compiledSFCTemplate = computed(() => {

		if (this.sfc.template) {

			pauseTracking();
			// don't tracking
			const newSnapshot = this._snapshot.value;
			const templateOffset = this.sfc.template.startTagEnd;
			resetTracking();

			// tracking
			this.sfc.template.content;

			// incremental update
			if (this._compiledSFCTemplateCache?.plugin.updateSFCTemplate) {

				const change = newSnapshot.getChangeRange(this._compiledSFCTemplateCache.snapshot);

				if (change) {
					const newText = newSnapshot.getText(change.span.start, change.span.start + change.newLength);
					const newResult = this._compiledSFCTemplateCache.plugin.updateSFCTemplate(this._compiledSFCTemplateCache.result, {
						start: change.span.start - templateOffset,
						end: change.span.start + change.span.length - templateOffset,
						newText,
					});
					if (newResult) {
						this._compiledSFCTemplateCache.snapshot = newSnapshot;
						this._compiledSFCTemplateCache.result = newResult;
						return {
							errors: [],
							warnings: [],
							ast: newResult.ast,
						};
					}
				}
			}

			for (const plugin of this.plugins) {

				const errors: CompilerDom.CompilerError[] = [];
				const warnings: CompilerDom.CompilerError[] = [];
				let result: CompilerDom.CodegenResult | undefined;

				try {
					result = plugin.compileSFCTemplate?.(this.sfc.template.lang, this.sfc.template.content, {
						onError: (err: CompilerDom.CompilerError) => errors.push(err),
						onWarn: (err: CompilerDom.CompilerError) => warnings.push(err),
						expressionPlugins: ['typescript'],
					});
				}
				catch (e) {
					const err = e as CompilerDom.CompilerError;
					errors.push(err);
				}

				if (result || errors.length) {

					if (result && !errors.length && !warnings.length) {
						this._compiledSFCTemplateCache = {
							snapshot: newSnapshot,
							result: result,
							plugin,
						};
					}

					return {
						errors,
						warnings,
						ast: result?.ast,
					};
				}
			}
		}
	});
	_pluginEmbeddedFiles = this.plugins.map(plugin => {
		const embeddedFiles: Record<string, ComputedRef<EmbeddedFile>> = {};
		const files = computed(() => {
			if (plugin.getEmbeddedFileNames) {
				const embeddedFileNames = plugin.getEmbeddedFileNames(this.fileName, this.sfc);
				for (const oldFileName of Object.keys(embeddedFiles)) {
					if (!embeddedFileNames.includes(oldFileName)) {
						delete embeddedFiles[oldFileName];
					}
				}
				for (const embeddedFileName of embeddedFileNames) {
					if (!embeddedFiles[embeddedFileName]) {
						embeddedFiles[embeddedFileName] = computed(() => {
							const file: EmbeddedFile = {
								fileName: embeddedFileName,
								capabilities: {
									diagnostics: false,
									foldingRanges: false,
									formatting: false,
									documentSymbol: false,
									codeActions: false,
									inlayHints: false,
								},
								isTsHostFile: false,
								codeGen: new CodeGen(),
								teleportMappings: [],
							};
							for (const plugin of this.plugins) {
								if (plugin.resolveEmbeddedFile) {
									plugin.resolveEmbeddedFile(this.fileName, this.sfc, file);
								}
							}
							return file;
						});
					}
				}
			}
			return Object.values(embeddedFiles);
		});
		return computed(() => {

			const self = this;
			const baseOffsetMap = new Map<string, number>();

			return files.value.map(_file => {
				const file = _file.value;
				const sourceMap = new EmbeddedFileSourceMap();
				for (const mapping of file.codeGen.mappings) {
					const vueRange = embeddedRangeToVueRange(mapping.data, mapping.sourceRange);
					let additional: MappingBase[] | undefined;
					if (mapping.additional) {
						additional = [];
						for (const add of mapping.additional) {
							const addVueRange = embeddedRangeToVueRange(mapping.data, add.sourceRange);
							additional.push({
								...add,
								sourceRange: addVueRange,
							});
						}
					}
					sourceMap.mappings.push({
						...mapping,
						sourceRange: vueRange,
						additional,
					});
				}
				const embedded: Embedded = {
					file,
					sourceMap,
					teleport: new Teleport(file.teleportMappings),
				};
				return embedded;
			});

			function embeddedRangeToVueRange(data: EmbeddedFileMappingData, range: Mapping<unknown>['sourceRange']) {

				if (data.vueTag) {

					const key = data.vueTag + '-' + data.vueTagIndex;
					let baseOffset = baseOffsetMap.get(key);

					if (baseOffset === undefined) {

						if (data.vueTag === 'script' && self.sfc.script) {
							baseOffset = self.sfc.script.startTagEnd;
						}
						else if (data.vueTag === 'scriptSetup' && self.sfc.scriptSetup) {
							baseOffset = self.sfc.scriptSetup.startTagEnd;
						}
						else if (data.vueTag === 'template' && self.sfc.template) {
							baseOffset = self.sfc.template.startTagEnd;
						}
						else if (data.vueTag === 'style') {
							baseOffset = self.sfc.styles[data.vueTagIndex!].startTagEnd;
						}
						else if (data.vueTag === 'customBlock') {
							baseOffset = self.sfc.customBlocks[data.vueTagIndex!].startTagEnd;
						}

						if (baseOffset !== undefined) {
							baseOffsetMap.set(key, baseOffset);
						}
					}

					if (baseOffset !== undefined) {
						return {
							start: baseOffset + range.start,
							end: baseOffset + range.end,
						};
					}
				}

				if (data.vueTag === 'scriptSrc' && self.sfc.script?.src) {
					const vueStart = self._text.value.substring(0, self.sfc.script.startTagEnd).lastIndexOf(self.sfc.script.src);
					const vueEnd = vueStart + self.sfc.script.src.length;
					return {
						start: vueStart - 1,
						end: vueEnd + 1,
					};
				}

				return range;
			}
		});
	});
	_allEmbeddeds = computed(() => {

		const all: Embedded[] = [];

		for (const embeddedFiles of this._pluginEmbeddedFiles) {
			for (const embedded of embeddedFiles.value) {
				all.push(embedded);
			}
		}

		return all;
	});
	_embeddeds = computed(() => {

		const embeddeds: EmbeddedStructure[] = [];
		let remain = [...this._allEmbeddeds.value];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const e of remain) {
			embeddeds.push({
				self: e,
				embeddeds: [],
			});
			if (e.file.parentFileName) {
				console.error('Unable to resolve embedded: ' + e.file.parentFileName + ' -> ' + e.file.fileName);
			}
		}

		return embeddeds;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const embedded = remain[i];
				if (!embedded.file.parentFileName) {
					embeddeds.push({
						self: embedded,
						embeddeds: [],
					});
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(embedded.file.parentFileName, embeddeds);
					if (parent) {
						parent.embeddeds.push({
							self: embedded,
							embeddeds: [],
						});
						remain.splice(i, 1);
					}
				}
			}
		}
		function findParentStructure(fileName: string, strus: EmbeddedStructure[]): EmbeddedStructure | undefined {
			for (const stru of strus) {
				if (stru.self?.file.fileName === fileName) {
					return stru;
				}
				let _stru = findParentStructure(fileName, stru.embeddeds);
				if (_stru) {
					return _stru;
				}
			}
		}
	});

	constructor(
		public fileName: string,
		private pscriptSnapshot: ts.IScriptSnapshot,
		private ts: typeof import('typescript/lib/tsserverlibrary'),
		private plugins: ReturnType<VueLanguagePlugin>[],
	) {
		this._snapshot = ref(this.pscriptSnapshot);
		this.update(this._snapshot.value, true);
	}

	update(newScriptSnapshot: ts.IScriptSnapshot, init = false) {

		const self = this;

		if (newScriptSnapshot === this._snapshot.value && !init) {
			return;
		}

		this._snapshot.value = newScriptSnapshot;

		// TODO: wait for https://github.com/vuejs/core/pull/5912
		if (this._parsedSfc.value) {
			updateTemplate(this._parsedSfc.value.descriptor.template);
			updateScript(this._parsedSfc.value.descriptor.script);
			updateScriptSetup(this._parsedSfc.value.descriptor.scriptSetup);
			updateStyles(this._parsedSfc.value.descriptor.styles);
			updateCustomBlocks(this._parsedSfc.value.descriptor.customBlocks);
		}
		else {
			updateTemplate(null);
			updateScript(null);
			updateScriptSetup(null);
			updateStyles([]);
			updateCustomBlocks([]);
		}

		function updateTemplate(block: SFCTemplateBlock | null) {

			const newData: Sfc['template'] | null = block ? {
				tag: 'template',
				start: self._text.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + self._text.value.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'html',
			} : null;

			if (self.sfc.template && newData) {
				updateBlock(self.sfc.template, newData);
			}
			else {
				self.sfc.template = newData;
			}
		}
		function updateScript(block: SFCScriptBlock | null) {

			const newData: Sfc['script'] | null = block ? {
				tag: 'script',
				start: self._text.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + self._text.value.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'js',
				src: block.src,
			} : null;

			if (self.sfc.script && newData) {
				updateBlock(self.sfc.script, newData);
			}
			else {
				self.sfc.script = newData;
			}
		}
		function updateScriptSetup(block: SFCScriptBlock | null) {

			const newData: Sfc['scriptSetup'] | null = block ? {
				tag: 'scriptSetup',
				start: self._text.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + self._text.value.substring(block.loc.end.offset).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'js',
			} : null;

			if (self.sfc.scriptSetup && newData) {
				updateBlock(self.sfc.scriptSetup, newData);
			}
			else {
				self.sfc.scriptSetup = newData;
			}
		}
		function updateStyles(blocks: SFCStyleBlock[]) {
			for (let i = 0; i < blocks.length; i++) {

				const block = blocks[i];
				const newData: Sfc['styles'][number] = {
					tag: 'style',
					start: self._text.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + self._text.value.substring(block.loc.end.offset).indexOf('>') + 1,
					startTagEnd: block.loc.start.offset,
					endTagStart: block.loc.end.offset,
					content: block.content,
					lang: block.lang ?? 'css',
					module: typeof block.module === 'string' ? block.module : block.module ? '$style' : undefined,
					scoped: !!block.scoped,
				};

				if (self.sfc.styles.length > i) {
					updateBlock(self.sfc.styles[i], newData);
				}
				else {
					self.sfc.styles.push(newData);
				}
			}
			while (self.sfc.styles.length > blocks.length) {
				self.sfc.styles.pop();
			}
		}
		function updateCustomBlocks(blocks: SFCBlock[]) {
			for (let i = 0; i < blocks.length; i++) {

				const block = blocks[i];
				const newData: Sfc['customBlocks'][number] = {
					tag: 'customBlock',
					start: self._text.value.substring(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + self._text.value.substring(block.loc.end.offset).indexOf('>') + 1,
					startTagEnd: block.loc.start.offset,
					endTagStart: block.loc.end.offset,
					content: block.content,
					lang: block.lang ?? 'txt',
					type: block.type,
				};

				if (self.sfc.customBlocks.length > i) {
					updateBlock(self.sfc.customBlocks[i], newData);
				}
				else {
					self.sfc.customBlocks.push(newData);
				}
			}
			while (self.sfc.customBlocks.length > blocks.length) {
				self.sfc.customBlocks.pop();
			}
		}
		function updateBlock<T>(oldBlock: T, newBlock: T) {
			for (let key in newBlock) {
				oldBlock[key] = newBlock[key];
			}
		}
	}
}
