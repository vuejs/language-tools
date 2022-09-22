import { DocumentCapabilities, EmbeddedFile, EmbeddedFileSourceMap, PositionCapabilities, SourceFile, Teleport, TeleportMappingData } from '@volar/language-core';
import { SFCBlock, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, Ref, shallowRef as ref } from '@vue/reactivity';
import { Sfc, VueLanguagePlugin } from './types';

import { CodeGen } from '@volar/code-gen';
import { Mapping } from '@volar/source-map';
import * as CompilerDom from '@vue/compiler-dom';
import type * as ts from 'typescript/lib/tsserverlibrary';

export interface EmbeddedStructure {
	self: Embedded | undefined,
	embeddeds: EmbeddedStructure[],
}

export interface Embedded {
	file: VueEmbeddedFile,
	sourceMap: EmbeddedFileSourceMap,
	teleport: Teleport | undefined,
}

export interface VueEmbeddedFile {
	parentFileName?: string,
	fileName: string,
	isTsHostFile: boolean,
	capabilities: DocumentCapabilities,
	codeGen: CodeGen<EmbeddedFileMappingData>,
	teleportMappings: Mapping<TeleportMappingData>[],
};

export interface EmbeddedFileMappingData {
	vueTag: 'template' | 'script' | 'scriptSetup' | 'scriptSrc' | 'style' | 'customBlock' | undefined,
	vueTagIndex?: number,
	capabilities: PositionCapabilities,
}

export class VueSourceFile implements SourceFile {

	static parsedSfcCache: {
		fileName: string,
		snapshot: ts.IScriptSnapshot,
		sfc: SFCParseResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	static compiledSFCTemplateCache: {
		fileName: string,
		template: string,
		templateOffset: number,
		snapshot: ts.IScriptSnapshot,
		result: CompilerDom.CodegenResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	static getSFC(plugins: ReturnType<VueLanguagePlugin>[], fileName: string, snapshot: ts.IScriptSnapshot) {

		if (VueSourceFile.parsedSfcCache?.snapshot === snapshot) {
			return VueSourceFile.parsedSfcCache.sfc;
		}

		// incremental update
		if (VueSourceFile.parsedSfcCache?.fileName === fileName && VueSourceFile.parsedSfcCache.plugin.updateSFC) {
			const change = snapshot.getChangeRange(VueSourceFile.parsedSfcCache.snapshot);
			if (change) {
				const newSfc = VueSourceFile.parsedSfcCache.plugin.updateSFC(VueSourceFile.parsedSfcCache.sfc, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					VueSourceFile.parsedSfcCache.snapshot = snapshot;
					VueSourceFile.parsedSfcCache.sfc = newSfc;
					return newSfc;
				}
			}
		}

		for (const plugin of plugins) {
			const sfc = plugin.parseSFC?.(fileName, snapshot.getText(0, snapshot.getLength()));
			if (sfc) {
				if (!sfc.errors.length) {
					VueSourceFile.parsedSfcCache = {
						fileName,
						snapshot,
						sfc,
						plugin,
					};
				}
				return sfc;
			}
		}
	}

	static getCompiledSFCTemplate(plugins: ReturnType<VueLanguagePlugin>[], sourceFile: VueSourceFile, newSnapshot: ts.IScriptSnapshot) {

		if (VueSourceFile.compiledSFCTemplateCache?.snapshot === newSnapshot) {
			return {
				errors: [],
				warnings: [],
				ast: VueSourceFile.compiledSFCTemplateCache.result.ast,
			};
		}

		if (
			VueSourceFile.compiledSFCTemplateCache?.fileName === sourceFile.fileName
			&& VueSourceFile.compiledSFCTemplateCache.template === sourceFile.sfc.template?.content
			&& VueSourceFile.compiledSFCTemplateCache.templateOffset === sourceFile.sfc.template.startTagEnd
		) {
			return {
				errors: [],
				warnings: [],
				ast: VueSourceFile.compiledSFCTemplateCache.result.ast,
			};
		}

		if (sourceFile.sfc.template) {

			// incremental update
			if (VueSourceFile.compiledSFCTemplateCache?.plugin.updateSFCTemplate) {

				const change = newSnapshot.getChangeRange(VueSourceFile.compiledSFCTemplateCache.snapshot);
				const templateOffset = sourceFile.sfc.template.startTagEnd;

				if (change) {
					const newText = newSnapshot.getText(change.span.start, change.span.start + change.newLength);
					const newResult = VueSourceFile.compiledSFCTemplateCache.plugin.updateSFCTemplate(VueSourceFile.compiledSFCTemplateCache.result, {
						start: change.span.start - templateOffset,
						end: change.span.start + change.span.length - templateOffset,
						newText,
					});
					if (newResult) {
						VueSourceFile.compiledSFCTemplateCache.snapshot = newSnapshot;
						VueSourceFile.compiledSFCTemplateCache.result = newResult;
						return {
							errors: [],
							warnings: [],
							ast: newResult.ast,
						};
					}
				}
			}

			for (const plugin of plugins) {

				const errors: CompilerDom.CompilerError[] = [];
				const warnings: CompilerDom.CompilerError[] = [];
				let result: CompilerDom.CodegenResult | undefined;

				try {
					result = plugin.compileSFCTemplate?.(sourceFile.sfc.template.lang, sourceFile.sfc.template.content, {
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
						VueSourceFile.compiledSFCTemplateCache = {
							fileName: sourceFile.fileName,
							template: sourceFile.sfc.template.content,
							templateOffset: sourceFile.sfc.template.startTagEnd,
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
	}

	public sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
		getTemplateAst: () => {
			return this.compiledSFCTemplate?.ast;
		},
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
		return VueSourceFile.getCompiledSFCTemplate(this.plugins, this, this._snapshot.value);
	}

	get tsFileName() {
		return this._allEmbeddeds.value.find(e => e[1].fileName.replace(this.fileName, '').match(/^\.(js|ts)x?$/))?.[1].fileName ?? '';
	}

	get embeddeds() {
		return this._embeddeds.value;
	}

	// refs
	_snapshot: Ref<ts.IScriptSnapshot>;
	_text = computed(() => this._snapshot.value.getText(0, this._snapshot.value.getLength()));

	// computeds
	_pluginEmbeddedFiles = this.plugins.map(plugin => {
		const embeddedFiles: Record<string, ComputedRef<VueEmbeddedFile>> = {};
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
							const file: VueEmbeddedFile = {
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
				const node: EmbeddedFile = {
					fileName: file.fileName,
					text: file.codeGen.getText(),
					capabilities: file.capabilities,
					isTsHostFile: file.isTsHostFile,
					mappings: file.codeGen.mappings.map(mapping => {
						return {
							...mapping,
							data: mapping.data.capabilities,
							sourceRange: embeddedRangeToVueRange(mapping.data, mapping.sourceRange),
							additional: mapping.additional ? mapping.additional.map(add => {
								const addVueRange = embeddedRangeToVueRange(mapping.data, add.sourceRange);
								return {
									...add,
									sourceRange: addVueRange,
								};
							}) : undefined,
						};
					}),
					teleportMappings: file.teleportMappings,
					embeddeds: [],
				};
				return [file, node] as [VueEmbeddedFile, EmbeddedFile];
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

		const all: [VueEmbeddedFile, EmbeddedFile][] = [];

		for (const embeddedFiles of this._pluginEmbeddedFiles) {
			for (const embedded of embeddedFiles.value) {
				all.push(embedded);
			}
		}

		return all;
	});
	_embeddeds = computed(() => {

		const childs: EmbeddedFile[] = [];

		// const embeddeds: EmbeddedStructure[] = [];
		let remain = [...this._allEmbeddeds.value];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const [embedded, node] of remain) {
			childs.push(node);
			if (embedded) {
				console.error('Unable to resolve embedded: ' + embedded.parentFileName + ' -> ' + embedded.fileName);
			}
		}

		return childs;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const [embedded, node] = remain[i];
				if (!embedded.parentFileName) {
					childs.push(node);
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(embedded.parentFileName, childs);
					if (parent) {
						parent.embeddeds.push(node);
						remain.splice(i, 1);
					}
				}
			}
		}
		function findParentStructure(fileName: string, strus: SourceFile[]): SourceFile | undefined {
			for (const stru of strus) {
				if (stru.fileName === fileName) {
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

		const parsedSfc = VueSourceFile.getSFC(this.plugins, this.fileName, newScriptSnapshot);

		this._snapshot.value = newScriptSnapshot;

		// TODO: wait for https://github.com/vuejs/core/pull/5912
		if (parsedSfc) {
			updateTemplate(parsedSfc.descriptor.template);
			updateScript(parsedSfc.descriptor.script);
			updateScriptSetup(parsedSfc.descriptor.scriptSetup);
			updateStyles(parsedSfc.descriptor.styles);
			updateCustomBlocks(parsedSfc.descriptor.customBlocks);
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
