import { VirtualFile } from '@volar/language-core';
import { buildMappings, buildStacks, toString } from '@volar/source-map';
import * as muggle from 'muggle-string';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { Sfc, SfcBlock, VueLanguagePlugin } from '../types';
import { VueEmbeddedFile } from './embeddedFile';
import { computed } from 'computeds';

export function computedFiles(
	plugins: ReturnType<VueLanguagePlugin>[],
	fileName: string,
	sfc: Sfc,
	codegenStack: boolean
) {

	const nameToBlock = computed(() => {
		const blocks: Record<string, SfcBlock> = {};
		if (sfc.template) {
			blocks[sfc.template.name] = sfc.template;
		}
		if (sfc.script) {
			blocks[sfc.script.name] = sfc.script;
		}
		if (sfc.scriptSetup) {
			blocks[sfc.scriptSetup.name] = sfc.scriptSetup;
		}
		for (const block of sfc.styles) {
			blocks[block.name] = block;
		}
		for (const block of sfc.customBlocks) {
			blocks[block.name] = block;
		}
		return blocks;
	});
	const pluginsResult = plugins.map(plugin => compiledPluginFiles(plugins, plugin, fileName, sfc, nameToBlock, codegenStack));
	const flatResult = computed(() => pluginsResult.map(r => r()).flat());
	const structuredResult = computed(() => {

		const embeddedFiles: VirtualFile[] = [];

		let remain = [...flatResult()];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const { file, snapshot, mappings, codegenStacks } of remain) {
			embeddedFiles.push({
				...file,
				snapshot,
				mappings,
				codegenStacks,
				embeddedFiles: [],
			});
			console.error('Unable to resolve embedded: ' + file.parentFileName + ' -> ' + file.fileName);
		}

		return embeddedFiles;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const { file, snapshot, mappings, codegenStacks } = remain[i];
				if (!file.parentFileName) {
					embeddedFiles.push({
						...file,
						snapshot,
						mappings,
						codegenStacks,
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
							codegenStacks,
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

	return structuredResult;
}

function compiledPluginFiles(
	plugins: ReturnType<VueLanguagePlugin>[],
	plugin: ReturnType<VueLanguagePlugin>,
	fileName: string,
	sfc: Sfc,
	nameToBlock: () => Record<string, SfcBlock>,
	codegenStack: boolean
) {
	const embeddedFiles: Record<string, () => { file: VueEmbeddedFile; snapshot: ts.IScriptSnapshot; }> = {};
	const files = computed(() => {
		try {
			if (!plugin.getEmbeddedFileNames) {
				return Object.values(embeddedFiles);
			}
			const embeddedFileNames = plugin.getEmbeddedFileNames(fileName, sfc);
			for (const oldFileName of Object.keys(embeddedFiles)) {
				if (!embeddedFileNames.includes(oldFileName)) {
					delete embeddedFiles[oldFileName];
				}
			}
			for (const embeddedFileName of embeddedFileNames) {
				if (!embeddedFiles[embeddedFileName]) {
					embeddedFiles[embeddedFileName] = computed(() => {
						const [content, stacks] = codegenStack ? muggle.track([]) : [[], []];
						const file = new VueEmbeddedFile(embeddedFileName, content, stacks);
						for (const plugin of plugins) {
							if (!plugin.resolveEmbeddedFile) {
								continue;
							}
							try {
								plugin.resolveEmbeddedFile(fileName, sfc, file);
							}
							catch (e) {
								console.error(e);
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
									const changeRange = fullDiffTextChangeRange(oldText, newText);
									if (changeRange) {
										changeRanges.set(oldSnapshot, changeRange);
									}
								}
								return changeRanges.get(oldSnapshot);
							},
						};
						return {
							file,
							snapshot,
						};
					});
				}
			}
		}
		catch (e) {
			console.error(e);
		}
		return Object.values(embeddedFiles);
	});

	return computed(() => {
		return files().map(_file => {
			const { file, snapshot } = _file();
			const mappings = buildMappings(file.content);
			for (const mapping of mappings) {
				if (mapping.source !== undefined) {
					const block = nameToBlock()[mapping.source];
					if (block) {
						mapping.sourceRange = [
							mapping.sourceRange[0] + block.startTagEnd,
							mapping.sourceRange[1] + block.startTagEnd,
						];
					}
					else {
						// ignore
					}
					mapping.source = undefined;
				}
			}
			return {
				file,
				snapshot,
				mappings,
				codegenStacks: buildStacks(file.content, file.contentStacks),
			};
		});
	});
}

function fullDiffTextChangeRange(oldText: string, newText: string): ts.TextChangeRange | undefined {
	for (let start = 0; start < oldText.length && start < newText.length; start++) {
		if (oldText[start] !== newText[start]) {
			let end = oldText.length;
			for (let i = 0; i < oldText.length - start && i < newText.length - start; i++) {
				if (oldText[oldText.length - i - 1] !== newText[newText.length - i - 1]) {
					break;
				}
				end--;
			}
			let length = end - start;
			let newLength = length + (newText.length - oldText.length);
			if (newLength < 0) {
				length -= newLength;
				newLength = 0;
			}
			return {
				span: { start, length },
				newLength,
			};
		}
	}
}
