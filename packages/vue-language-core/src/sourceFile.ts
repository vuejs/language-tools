import { FileCapabilities, VirtualFile, FileKind, FileRangeCapabilities, MirrorBehaviorCapabilities } from '@volar/language-core';
import { buildMappings, Mapping, Segment, toString } from '@volar/source-map';
import * as CompilerDom from '@vue/compiler-dom';
import { SFCBlock, SFCParseResult, SFCScriptBlock, SFCStyleBlock, SFCTemplateBlock } from '@vue/compiler-sfc';
import { computed, ComputedRef, reactive, pauseTracking, resetTracking } from '@vue/reactivity';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Sfc, SfcBlock, VueLanguagePlugin } from './types';
import * as muggle from 'muggle-string';

export class VueEmbeddedFile {

	public parentFileName?: string;
	public kind = FileKind.TextFile;
	public capabilities: FileCapabilities = {};
	public content: Segment<FileRangeCapabilities>[] = [];
	public extraMappings: Mapping<FileRangeCapabilities>[] = [];
	public mirrorBehaviorMappings: Mapping<[MirrorBehaviorCapabilities, MirrorBehaviorCapabilities]>[] = [];

	constructor(public fileName: string) { }
}

export class VueFile implements VirtualFile {

	parsedSfcCache: {
		snapshot: ts.IScriptSnapshot,
		sfc: SFCParseResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	compiledSFCTemplateCache: {
		template: string,
		snapshot: ts.IScriptSnapshot,
		result: CompilerDom.CodegenResult,
		plugin: ReturnType<VueLanguagePlugin>,
	} | undefined;

	capabilities = FileCapabilities.full;

	kind = FileKind.TextFile;

	mappings: Mapping<FileRangeCapabilities>[] = [];

	get compiledSFCTemplate() {
		return this._compiledSfcTemplate.value;
	}

	get mainScriptName() {
		return this._allEmbeddedFiles.value.find(e => e.file.fileName.replace(this.fileName, '').match(/^\.(js|ts)x?$/))?.file.fileName ?? '';
	}

	get embeddedFiles() {
		return this._embeddedFiles.value;
	}

	public parsedSfc: SFCParseResult | undefined;

	// refs
	public sfc = reactive<Sfc>({
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
		templateAst: computed(() => {
			return this._compiledSfcTemplate.value?.ast;
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
		...{
			// backward compatible
			getTemplateAst: () => {
				return this.compiledSFCTemplate?.ast;
			},
		},
	}) as Sfc /* avoid Sfc unwrap in .d.ts by reactive */;

	// computed

	_sfcBlocks = computed(() => {
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

	_compiledSfcTemplate = computed(() => {

		if (this.compiledSFCTemplateCache?.template === this.sfc.template?.content) {
			return {
				errors: [],
				warnings: [],
				ast: this.compiledSFCTemplateCache?.result.ast,
			};
		}

		if (this.sfc.template) {

			// incremental update
			if (this.compiledSFCTemplateCache?.plugin.updateSFCTemplate) {

				const change = this.snapshot.getChangeRange(this.compiledSFCTemplateCache.snapshot);
				if (change) {

					pauseTracking();
					const templateOffset = this.sfc.template.startTagEnd;
					resetTracking();

					const newText = this.snapshot.getText(change.span.start, change.span.start + change.newLength);
					const newResult = this.compiledSFCTemplateCache.plugin.updateSFCTemplate(this.compiledSFCTemplateCache.result, {
						start: change.span.start - templateOffset,
						end: change.span.start + change.span.length - templateOffset,
						newText,
					});
					if (newResult) {
						this.compiledSFCTemplateCache.template = this.sfc.template.content;
						this.compiledSFCTemplateCache.snapshot = this.snapshot;
						this.compiledSFCTemplateCache.result = newResult;
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

			for (const plugin of this.plugins) {
				if (plugin.resolveTemplateCompilerOptions) {
					options = plugin.resolveTemplateCompilerOptions(options);
				}
			}

			for (const plugin of this.plugins) {

				let result: CompilerDom.CodegenResult | undefined;

				try {
					result = plugin.compileSFCTemplate?.(this.sfc.template.lang, this.sfc.template.content, options);
				}
				catch (e) {
					const err = e as CompilerDom.CompilerError;
					errors.push(err);
				}

				if (result || errors.length) {

					if (result && !errors.length && !warnings.length) {
						this.compiledSFCTemplateCache = {
							template: this.sfc.template.content,
							snapshot: this.snapshot,
							result: result,
							plugin,
						};
					}
					else {
						this.compiledSFCTemplateCache = undefined;
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

	_pluginEmbeddedFiles = this.plugins.map((plugin) => {
		const embeddedFiles: Record<string, ComputedRef<VueEmbeddedFile>> = {};
		const files = computed(() => {
			try {
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
								const file = new VueEmbeddedFile(embeddedFileName);
								for (const plugin of this.plugins) {
									if (plugin.resolveEmbeddedFile) {
										try {
											plugin.resolveEmbeddedFile(this.fileName, this.sfc, file);
										}
										catch (e) {
											console.error(e);
										}
									}
								}
								return file;
							});
						}
					}
				}
			}
			catch (e) {
				console.error(e);
			}
			return Object.values(embeddedFiles);
		});
		return computed(() => {
			return files.value.map(_file => {
				const file = _file.value;
				const mappings = [...buildMappings(file.content), ...file.extraMappings];
				for (const mapping of mappings) {
					if (mapping.source !== undefined) {
						const block = this._sfcBlocks.value[mapping.source];
						if (block) {
							mapping.sourceRange = [
								mapping.sourceRange[0] + block.startTagEnd,
								mapping.sourceRange[1] + block.startTagEnd,
							];
							mapping.source = undefined;
						}
					}
				}
				const newText = toString(file.content);
				const changeRanges = new Map<ts.IScriptSnapshot, ts.TextChangeRange | undefined>();
				const snapshot: ts.IScriptSnapshot = {
					getText: (start, end) => newText.slice(start, end),
					getLength: () => newText.length,
					getChangeRange(oldSnapshot) {
						if (!changeRanges.has(oldSnapshot)) {
							changeRanges.set(oldSnapshot, undefined);
							const oldText = oldSnapshot.getText(0, oldSnapshot.getLength());
							for (let start = 0; start < oldText.length && start < newText.length; start++) {
								if (oldText[start] !== newText[start]) {
									let end = start;
									for (let i = oldText.length - 1; i > start; i--) {
										if (oldText[i] !== newText[i + (newText.length - oldText.length)]) {
											end = i;
											break;
										}
									}
									let length = end - start;
									let newLength = length + (newText.length - oldText.length);
									if (newLength < 0) {
										length -= newLength;
										newLength = 0;
									}
									changeRanges.set(oldSnapshot, {
										span: { start, length },
										newLength,
									});
									break;
								}
							}
						}
						return changeRanges.get(oldSnapshot);
					},
				};
				return {
					file,
					snapshot,
					mappings,
				};
			});
		});
	});

	_allEmbeddedFiles = computed(() => {

		const all: {
			file: VueEmbeddedFile;
			snapshot: ts.IScriptSnapshot;
			mappings: Mapping<FileRangeCapabilities>[];
		}[] = [];

		for (const embeddedFiles of this._pluginEmbeddedFiles) {
			for (const embedded of embeddedFiles.value) {
				all.push(embedded);
			}
		}

		return all;
	});

	_embeddedFiles = computed(() => {

		const embeddedFiles: VirtualFile[] = [];

		let remain = [...this._allEmbeddedFiles.value];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const { file, snapshot, mappings } of remain) {
			embeddedFiles.push({
				...file,
				snapshot,
				mappings,
				embeddedFiles: [],
			});
			console.error('Unable to resolve embedded: ' + file.parentFileName + ' -> ' + file.fileName);
		}

		return embeddedFiles;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const { file, snapshot, mappings } = remain[i];
				if (!file.parentFileName) {
					embeddedFiles.push({
						...file,
						snapshot,
						mappings,
						embeddedFiles: [],
					});
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(file.parentFileName, embeddedFiles);
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
		function findParentStructure(fileName: string, current: VirtualFile[]): VirtualFile | undefined {
			for (const child of current) {
				if (child.fileName === fileName) {
					return child;
				}
				let parent = findParentStructure(fileName, child.embeddedFiles);
				if (parent) {
					return parent;
				}
			}
		}
	});

	// functions

	constructor(
		public fileName: string,
		public snapshot: ts.IScriptSnapshot,
		private ts: typeof import('typescript/lib/tsserverlibrary'),
		private plugins: ReturnType<VueLanguagePlugin>[],
	) {
		this.update(snapshot);
	}

	update(newScriptSnapshot: ts.IScriptSnapshot) {

		this.snapshot = newScriptSnapshot;
		this.parsedSfc = this.parseSfc();

		if (this.parsedSfc) {
			this.updateTemplate(this.parsedSfc.descriptor.template);
			this.updateScript(this.parsedSfc.descriptor.script);
			this.updateScriptSetup(this.parsedSfc.descriptor.scriptSetup);
			this.updateStyles(this.parsedSfc.descriptor.styles);
			this.updateCustomBlocks(this.parsedSfc.descriptor.customBlocks);
		}
		else {
			this.updateTemplate(null);
			this.updateScript(null);
			this.updateScriptSetup(null);
			this.updateStyles([]);
			this.updateCustomBlocks([]);
		}

		const str: Segment<FileRangeCapabilities>[] = [[this.snapshot.getText(0, this.snapshot.getLength()), undefined, 0, FileRangeCapabilities.full]];
		for (const block of [
			this.sfc.script,
			this.sfc.scriptSetup,
			this.sfc.template,
			...this.sfc.styles,
			...this.sfc.customBlocks,
		]) {
			if (block) {
				muggle.replaceSourceRange(
					str, undefined, block.startTagEnd, block.endTagStart,
					[block.content, undefined, block.startTagEnd, {}],
				);
			}
		}
		this.mappings = str.map<Mapping<FileRangeCapabilities>>((m) => {
			const text = m[0];
			const start = m[2] as number;
			const end = start + text.length;
			return {
				sourceRange: [start, end],
				generatedRange: [start, end],
				data: m[3] as FileRangeCapabilities,
			};
		});
	}

	parseSfc() {

		// incremental update
		if (this.parsedSfcCache?.plugin.updateSFC) {
			const change = this.snapshot.getChangeRange(this.parsedSfcCache.snapshot);
			if (change) {
				const newSfc = this.parsedSfcCache.plugin.updateSFC(this.parsedSfcCache.sfc, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: this.snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					this.parsedSfcCache.snapshot = this.snapshot;
					this.parsedSfcCache.sfc = newSfc;
					return newSfc;
				}
			}
		}

		for (const plugin of this.plugins) {
			const sfc = plugin.parseSFC?.(this.fileName, this.snapshot.getText(0, this.snapshot.getLength()));
			if (sfc) {
				if (!sfc.errors.length) {
					this.parsedSfcCache = {
						snapshot: this.snapshot,
						sfc,
						plugin,
					};
				}
				return sfc;
			}
		}
	}

	updateTemplate(block: SFCTemplateBlock | null) {

		const newData: Sfc['template'] | null = block ? {
			name: 'template',
			start: this.snapshot.getText(0, block.loc.start.offset).lastIndexOf('<'),
			end: block.loc.end.offset + this.snapshot.getText(block.loc.end.offset, this.snapshot.getLength()).indexOf('>') + 1,
			startTagEnd: block.loc.start.offset,
			endTagStart: block.loc.end.offset,
			content: block.content,
			lang: block.lang ?? 'html',
		} : null;

		if (this.sfc.template && newData) {
			this.updateBlock(this.sfc.template, newData);
		}
		else {
			this.sfc.template = newData;
		}
	}

	updateScript(block: SFCScriptBlock | null) {

		const newData: Sfc['script'] | null = block ? {
			name: 'script',
			start: this.snapshot.getText(0, block.loc.start.offset).lastIndexOf('<'),
			end: block.loc.end.offset + this.snapshot.getText(block.loc.end.offset, this.snapshot.getLength()).indexOf('>') + 1,
			startTagEnd: block.loc.start.offset,
			endTagStart: block.loc.end.offset,
			content: block.content,
			lang: block.lang ?? 'js',
			src: block.src,
			srcOffset: block.src ? this.snapshot.getText(0, block.loc.start.offset).lastIndexOf(block.src) - block.loc.start.offset : -1,
		} : null;

		if (this.sfc.script && newData) {
			this.updateBlock(this.sfc.script, newData);
		}
		else {
			this.sfc.script = newData;
		}
	}

	updateScriptSetup(block: SFCScriptBlock | null) {

		const newData: Sfc['scriptSetup'] | null = block ? {
			name: 'scriptSetup',
			start: this.snapshot.getText(0, block.loc.start.offset).lastIndexOf('<'),
			end: block.loc.end.offset + this.snapshot.getText(block.loc.end.offset, this.snapshot.getLength()).indexOf('>') + 1,
			startTagEnd: block.loc.start.offset,
			endTagStart: block.loc.end.offset,
			content: block.content,
			lang: block.lang ?? 'js',
			generic: typeof block.attrs.generic === 'string' ? block.attrs.generic : undefined,
			genericOffset: typeof block.attrs.generic === 'string' ? this.snapshot.getText(0, block.loc.start.offset).lastIndexOf(block.attrs.generic) - block.loc.start.offset : -1,
		} : null;

		if (this.sfc.scriptSetup && newData) {
			this.updateBlock(this.sfc.scriptSetup, newData);
		}
		else {
			this.sfc.scriptSetup = newData;
		}
	}

	updateStyles(blocks: SFCStyleBlock[]) {
		for (let i = 0; i < blocks.length; i++) {

			const block = blocks[i];
			const newData: Sfc['styles'][number] = {
				name: 'style_' + i,
				start: this.snapshot.getText(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + this.snapshot.getText(block.loc.end.offset, this.snapshot.getLength()).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'css',
				module: typeof block.module === 'string' ? block.module : block.module ? '$style' : undefined,
				scoped: !!block.scoped,
			};

			if (this.sfc.styles.length > i) {
				this.updateBlock(this.sfc.styles[i], newData);
			}
			else {
				this.sfc.styles.push(newData);
			}
		}
		while (this.sfc.styles.length > blocks.length) {
			this.sfc.styles.pop();
		}
	}

	updateCustomBlocks(blocks: SFCBlock[]) {
		for (let i = 0; i < blocks.length; i++) {

			const block = blocks[i];
			const newData: Sfc['customBlocks'][number] = {
				name: 'customBlock_' + i,
				start: this.snapshot.getText(0, block.loc.start.offset).lastIndexOf('<'),
				end: block.loc.end.offset + this.snapshot.getText(block.loc.end.offset, this.snapshot.getLength()).indexOf('>') + 1,
				startTagEnd: block.loc.start.offset,
				endTagStart: block.loc.end.offset,
				content: block.content,
				lang: block.lang ?? 'txt',
				type: block.type,
			};

			if (this.sfc.customBlocks.length > i) {
				this.updateBlock(this.sfc.customBlocks[i], newData);
			}
			else {
				this.sfc.customBlocks.push(newData);
			}
		}
		while (this.sfc.customBlocks.length > blocks.length) {
			this.sfc.customBlocks.pop();
		}
	}

	updateBlock<T>(oldBlock: T, newBlock: T) {
		for (let key in newBlock) {
			oldBlock[key] = newBlock[key];
		}
	}
}
