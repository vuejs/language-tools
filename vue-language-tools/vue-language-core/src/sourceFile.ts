import { DocumentCapabilities, VirtualFile, VirtualFileKind, PositionCapabilities, TeleportMappingData } from '@volar/language-core';
import { buildMappings, Mapping, Segment, toString } from '@volar/source-map';
import * as CompilerDom from '@vue/compiler-dom';
import { SFCBlock, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, Ref, shallowRef as ref, pauseTracking, resetTracking } from '@vue/reactivity';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Sfc, SfcBlock, VueLanguagePlugin } from './types';

export class VueEmbeddedFile {

	public parentFileName?: string;
	public kind = VirtualFileKind.TextFile;
	public capabilities: DocumentCapabilities = {};
	public content: Segment<PositionCapabilities>[] = [];
	public extraMappings: Mapping<PositionCapabilities>[] = [];
	public teleportMappings: Mapping<TeleportMappingData>[] = [];

	constructor(public fileName: string) { }
}

export class VueFile implements VirtualFile {

	static parsedSfcCache: {
		fileName: string,
		snapshot: ts.IScriptSnapshot,
		sfc: SFCParseResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	static compiledSFCTemplateCache: {
		fileName: string,
		template: string,
		snapshot: ts.IScriptSnapshot,
		result: CompilerDom.CodegenResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	static getSFC(plugins: ReturnType<VueLanguagePlugin>[], fileName: string, snapshot: ts.IScriptSnapshot) {

		if (VueFile.parsedSfcCache?.snapshot === snapshot) {
			return VueFile.parsedSfcCache.sfc;
		}

		// incremental update
		if (VueFile.parsedSfcCache?.fileName === fileName && VueFile.parsedSfcCache.plugin.updateSFC) {
			const change = snapshot.getChangeRange(VueFile.parsedSfcCache.snapshot);
			if (change) {
				const newSfc = VueFile.parsedSfcCache.plugin.updateSFC(VueFile.parsedSfcCache.sfc, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					VueFile.parsedSfcCache.snapshot = snapshot;
					VueFile.parsedSfcCache.sfc = newSfc;
					return newSfc;
				}
			}
		}

		for (const plugin of plugins) {
			const sfc = plugin.parseSFC?.(fileName, snapshot.getText(0, snapshot.getLength()));
			if (sfc) {
				if (!sfc.errors.length) {
					VueFile.parsedSfcCache = {
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

	static getCompiledSFCTemplate(plugins: ReturnType<VueLanguagePlugin>[], sourceFile: VueFile, newSnapshot: ts.IScriptSnapshot) {

		if (VueFile.compiledSFCTemplateCache?.snapshot === newSnapshot) {
			return {
				errors: [],
				warnings: [],
				ast: VueFile.compiledSFCTemplateCache.result.ast,
			};
		}

		if (
			VueFile.compiledSFCTemplateCache?.fileName === sourceFile.fileName
			&& VueFile.compiledSFCTemplateCache.template === sourceFile.sfc.template?.content
		) {
			return {
				errors: [],
				warnings: [],
				ast: VueFile.compiledSFCTemplateCache.result.ast,
			};
		}

		if (sourceFile.sfc.template) {

			// incremental update
			if (VueFile.compiledSFCTemplateCache?.plugin.updateSFCTemplate) {

				const change = newSnapshot.getChangeRange(VueFile.compiledSFCTemplateCache.snapshot);
				const templateOffset = sourceFile.sfc.template.startTagEnd;

				if (change) {
					const newText = newSnapshot.getText(change.span.start, change.span.start + change.newLength);
					const newResult = VueFile.compiledSFCTemplateCache.plugin.updateSFCTemplate(VueFile.compiledSFCTemplateCache.result, {
						start: change.span.start - templateOffset,
						end: change.span.start + change.span.length - templateOffset,
						newText,
					});
					if (newResult) {
						VueFile.compiledSFCTemplateCache.template = sourceFile.sfc.template.content;
						VueFile.compiledSFCTemplateCache.snapshot = newSnapshot;
						VueFile.compiledSFCTemplateCache.result = newResult;
						return {
							errors: [],
							warnings: [],
							ast: newResult.ast,
						};
					}
				}
			}

			const errors: CompilerDom.CompilerError[] = [];
			const warnings: CompilerDom.CompilerError[] = [];
			let options: CompilerDom.CompilerOptions = {
				onError: (err: CompilerDom.CompilerError) => errors.push(err),
				onWarn: (err: CompilerDom.CompilerError) => warnings.push(err),
				expressionPlugins: ['typescript'],
			};

			for (const plugin of plugins) {
				if (plugin.resolveTemplateCompilerOptions) {
					options = plugin.resolveTemplateCompilerOptions(options);
				}
			}

			for (const plugin of plugins) {

				let result: CompilerDom.CodegenResult | undefined;

				try {
					result = plugin.compileSFCTemplate?.(sourceFile.sfc.template.lang, sourceFile.sfc.template.content, options);
				}
				catch (e) {
					const err = e as CompilerDom.CompilerError;
					errors.push(err);
				}

				if (result || errors.length) {

					if (result && !errors.length && !warnings.length) {
						VueFile.compiledSFCTemplateCache = {
							fileName: sourceFile.fileName,
							template: sourceFile.sfc.template.content,
							snapshot: newSnapshot,
							result: result,
							plugin,
						};
					}
					else {
						VueFile.compiledSFCTemplateCache = undefined;
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

	static current = ref<VueFile>({} as any);

	static _pluginEmbeddedFiles = computed(() => VueFile.current.value.plugins.map(plugin => {
		const embeddedFiles: Record<string, ComputedRef<VueEmbeddedFile>> = {};
		const files = computed(() => {
			if (plugin.getEmbeddedFileNames) {
				const embeddedFileNames = plugin.getEmbeddedFileNames(VueFile.current.value.fileName, VueFile.current.value.sfc);
				for (const oldFileName of Object.keys(embeddedFiles)) {
					if (!embeddedFileNames.includes(oldFileName)) {
						delete embeddedFiles[oldFileName];
					}
				}
				for (const embeddedFileName of embeddedFileNames) {
					if (!embeddedFiles[embeddedFileName]) {
						embeddedFiles[embeddedFileName] = computed(() => {
							const file = new VueEmbeddedFile(embeddedFileName);
							for (const plugin of VueFile.current.value.plugins) {
								if (plugin.resolveEmbeddedFile) {
									plugin.resolveEmbeddedFile(VueFile.current.value.fileName, VueFile.current.value.sfc, file);
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

			return files.value.map(_file => {
				const file = _file.value;
				const mappings = [...buildMappings(file.content), ...file.extraMappings];
				for (const mapping of mappings) {
					if (mapping.source !== undefined) {
						const block = VueFile.current.value.sfcBlocks.value[mapping.source];
						if (block) {
							mapping.sourceRange = [
								mapping.sourceRange[0] + block.startTagEnd,
								mapping.sourceRange[1] + block.startTagEnd,
							];
							mapping.source = undefined;
						}
					}
				}
				return {
					file,
					snapshot: VueFile.current.value.ts.ScriptSnapshot.fromString(toString(file.content)),
					mappings,
				};
			});
		});
	}));
	static _allEmbeddedFiles = computed(() => {

		const all: {
			file: VueEmbeddedFile;
			snapshot: ts.IScriptSnapshot;
			mappings: Mapping<PositionCapabilities>[];
		}[] = [];

		for (const embeddedFiles of VueFile._pluginEmbeddedFiles.value) {
			for (const embedded of embeddedFiles.value) {
				all.push(embedded);
			}
		}

		return all;
	});
	static _embeddedFiles = computed(() => {

		const childs: VirtualFile[] = [];

		let remain = [...VueFile._allEmbeddedFiles.value];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const { file, snapshot, mappings } of remain) {
			childs.push({
				...file,
				snapshot,
				mappings,
				embeddedFiles: [],
			});
			console.error('Unable to resolve embedded: ' + file.parentFileName + ' -> ' + file.fileName);
		}

		return childs;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const { file, snapshot, mappings } = remain[i];
				if (!file.parentFileName) {
					childs.push({
						...file,
						snapshot,
						mappings,
						embeddedFiles: [],
					});
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(file.parentFileName, childs);
					if (parent) {
						parent.embeddedFiles.push({
							...file,
							snapshot,
							mappings,
							embeddedFiles: [],
						});
						remain.splice(i, 1);
					}
				}
			}
		}
		function findParentStructure(fileName: string, strus: VirtualFile[]): VirtualFile | undefined {
			for (const stru of strus) {
				if (stru.fileName === fileName) {
					return stru;
				}
				let _stru = findParentStructure(fileName, stru.embeddedFiles);
				if (_stru) {
					return _stru;
				}
			}
		}
	});

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

	sfcBlocks = computed(() => {
		const blocks: Record<string, SfcBlock> = {};
		if (this.sfc.template) {
			blocks[this.sfc.template.name] = this.sfc.template;
		}
		if (this.sfc.script) {
			blocks[this.sfc.script.name] = this.sfc.script;
		}
		if (this.sfc.scriptSetup) {
			blocks[this.sfc.scriptSetup.name] = this.sfc.scriptSetup;
		}
		for (const block of this.sfc.styles) {
			blocks[block.name] = block;
		}
		for (const block of this.sfc.customBlocks) {
			blocks[block.name] = block;
		}
		return blocks;
	});

	kind = VirtualFileKind.TextFile;

	capabilities: DocumentCapabilities = {
		diagnostic: true,
		foldingRange: true,
		documentFormatting: true,
		documentSymbol: true,
		codeAction: true,
		inlayHint: true,
	};

	get mappings(): Mapping<PositionCapabilities>[] {
		return this._mappings.value;
	}

	get snapshot() {
		return this._snapshot.value;
	}

	get compiledSFCTemplate() {
		pauseTracking();
		const snapshot = this._snapshot.value;
		resetTracking();
		return VueFile.getCompiledSFCTemplate(this.plugins, this, snapshot);
	}

	get tsFileName() {
		return this._allEmbeddeds.value.find(e => e.file.fileName.replace(this.fileName, '').match(/^\.(js|ts)x?$/))?.file.fileName ?? '';
	}

	get embeddedFiles() {
		return this._embeddeds.value;
	}

	// refs
	_snapshot: Ref<ts.IScriptSnapshot>;
	_mappings = computed<Mapping<PositionCapabilities>[]>(() => [{
		sourceRange: [0, this._snapshot.value.getLength()],
		generatedRange: [0, this._snapshot.value.getLength()],
		data: {
			hover: true,
			references: true,
			definition: true,
			rename: true,
			completion: true,
			diagnostic: true,
			semanticTokens: true,
		},
	}]);
	_allEmbeddeds = ref<{
		file: VueEmbeddedFile;
		snapshot: ts.IScriptSnapshot;
		mappings: Mapping<PositionCapabilities>[];
	}[]>([]);
	_embeddeds = ref<VirtualFile[]>([]);

	constructor(
		public fileName: string,
		private scriptSnapshot: ts.IScriptSnapshot,
		private ts: typeof import('typescript/lib/tsserverlibrary'),
		private plugins: ReturnType<VueLanguagePlugin>[],
	) {
		this._snapshot = ref(this.scriptSnapshot);
		this.update(this._snapshot.value, true);
	}

	update(newScriptSnapshot: ts.IScriptSnapshot, init = false) {

		const self = this;

		if (newScriptSnapshot === this._snapshot.value && !init) {
			return;
		}

		const parsedSfc = VueFile.getSFC(this.plugins, this.fileName, newScriptSnapshot);

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

		VueFile.current.value = this;

		this._allEmbeddeds.value = VueFile._allEmbeddedFiles.value;
		this._embeddeds.value = VueFile._embeddedFiles.value;

		function updateTemplate(block: SFCTemplateBlock | null) {

			const newData: Sfc['template'] | null = block ? {
				name: 'template',
				start: self._snapshot.value.getText(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + self._snapshot.value.getText(block.loc.end.offset, self._snapshot.value.getLength()).indexOf('>') + 1,
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
				name: 'script',
				start: self._snapshot.value.getText(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + self._snapshot.value.getText(block.loc.end.offset, self._snapshot.value.getLength()).indexOf('>') + 1,
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
				name: 'scriptSetup',
				start: self._snapshot.value.getText(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + self._snapshot.value.getText(block.loc.end.offset, self._snapshot.value.getLength()).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'js',
				generic: typeof block.attrs.generic === 'string' ? block.attrs.generic : undefined,
				genericOffset: typeof block.attrs.generic === 'string' ? newScriptSnapshot.getText(0, newScriptSnapshot.getLength()).substring(0, block.loc.start.offset).lastIndexOf(block.attrs.generic) - block.loc.start.offset : -1,
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
					name: 'style_' + i,
					start: self._snapshot.value.getText(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + self._snapshot.value.getText(block.loc.end.offset, self._snapshot.value.getLength()).indexOf('>') + 1,
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
					name: 'customBlock_' + i,
					start: self._snapshot.value.getText(0, block.loc.start.offset).lastIndexOf('<'),
					end: block.loc.end.offset + self._snapshot.value.getText(block.loc.end.offset, self._snapshot.value.getLength()).indexOf('>') + 1,
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
