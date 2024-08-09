import type { VirtualCode } from '@volar/language-core';
import { computed } from 'computeds';
import { toString } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code, Sfc, SfcBlock, VueLanguagePluginReturn } from '../types';
import { buildMappings } from '../utils/buildMappings';
import { VueEmbeddedCode } from './embeddedFile';

export function computedEmbeddedCodes(
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	sfc: Sfc
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
	const pluginsResult = plugins.map(plugin => computedPluginEmbeddedCodes(plugins, plugin, fileName, sfc, nameToBlock));
	const flatResult = computed(() => pluginsResult.map(r => r()).flat());
	const structuredResult = computed(() => {

		const embeddedCodes: VirtualCode[] = [];

		let remain = [...flatResult()];

		while (remain.length) {
			const beforeLength = remain.length;
			consumeRemain();
			if (beforeLength === remain.length) {
				break;
			}
		}

		for (const { code } of remain) {
			console.error('Unable to resolve embedded: ' + code.parentCodeId + ' -> ' + code.id);
		}

		return embeddedCodes;

		function consumeRemain() {
			for (let i = remain.length - 1; i >= 0; i--) {
				const { code, snapshot, mappings } = remain[i];
				if (!code.parentCodeId) {
					embeddedCodes.push({
						id: code.id,
						languageId: resolveCommonLanguageId(code.lang),
						linkedCodeMappings: code.linkedCodeMappings,
						snapshot,
						mappings,
						embeddedCodes: [],
					});
					remain.splice(i, 1);
				}
				else {
					const parent = findParentStructure(code.parentCodeId, embeddedCodes);
					if (parent) {
						parent.embeddedCodes ??= [];
						parent.embeddedCodes.push({
							id: code.id,
							languageId: resolveCommonLanguageId(code.lang),
							linkedCodeMappings: code.linkedCodeMappings,
							snapshot,
							mappings,
							embeddedCodes: [],
						});
						remain.splice(i, 1);
					}
				}
			}
		}
		function findParentStructure(id: string, current: VirtualCode[]): VirtualCode | undefined {
			for (const child of current) {
				if (child.id === id) {
					return child;
				}
				let parent = findParentStructure(id, child.embeddedCodes ?? []);
				if (parent) {
					return parent;
				}
			}
		}
	});

	return structuredResult;
}

function computedPluginEmbeddedCodes(
	plugins: VueLanguagePluginReturn[],
	plugin: VueLanguagePluginReturn,
	fileName: string,
	sfc: Sfc,
	nameToBlock: () => Record<string, SfcBlock>
) {
	const computeds = new Map<string, () => { code: VueEmbeddedCode; snapshot: ts.IScriptSnapshot; }>();
	const getComputedKey = (code: {
		id: string;
		lang: string;
	}) => code.id + '__' + code.lang;
	const codes = computed(() => {
		try {
			if (!plugin.getEmbeddedCodes) {
				return [...computeds.values()];
			}
			const embeddedCodeInfos = plugin.getEmbeddedCodes(fileName, sfc);
			for (const oldId of computeds.keys()) {
				if (!embeddedCodeInfos.some(code => getComputedKey(code) === oldId)) {
					computeds.delete(oldId);
				}
			}
			for (const codeInfo of embeddedCodeInfos) {
				if (!computeds.has(getComputedKey(codeInfo))) {
					computeds.set(getComputedKey(codeInfo), computed(() => {
						const content: Code[] = [];
						const code = new VueEmbeddedCode(codeInfo.id, codeInfo.lang, content);
						for (const plugin of plugins) {
							if (!plugin.resolveEmbeddedCode) {
								continue;
							}
							try {
								plugin.resolveEmbeddedCode(fileName, sfc, code);
							}
							catch (e) {
								console.error(e);
							}
						}
						const newText = toString(code.content);
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
							code,
							snapshot,
						};
					}));
				}
			}
		}
		catch (e) {
			console.error(e);
		}
		return [...computeds.values()];
	});

	return computed(() => {
		return codes().map(_file => {
			const { code, snapshot } = _file();
			const mappings = buildMappings(code.content.map<Code>(segment => {
				if (typeof segment === 'string') {
					return segment;
				}
				const source = segment[1];
				if (source === undefined) {
					return segment;
				}
				const block = nameToBlock()[source];
				if (!block) {
					// console.warn('Unable to find block: ' + source);
					return segment;
				}
				return [
					segment[0],
					undefined,
					segment[2] + block.startTagEnd,
					segment[3],
				];
			}));
			const newMappings: typeof mappings = [];
			let lastValidMapping: typeof mappings[number] | undefined;

			for (let i = 0; i < mappings.length; i++) {
				const mapping = mappings[i];
				if (mapping.data.__combineOffsetMapping !== undefined) {
					const offsetMapping = mappings[i - mapping.data.__combineOffsetMapping];
					if (typeof offsetMapping === 'string' || !offsetMapping) {
						throw new Error('Invalid offset mapping, mappings: ' + mappings.length + ', i: ' + i + ', offset: ' + mapping.data.__combineOffsetMapping);
					}
					offsetMapping.sourceOffsets.push(...mapping.sourceOffsets);
					offsetMapping.generatedOffsets.push(...mapping.generatedOffsets);
					offsetMapping.lengths.push(...mapping.lengths);
					continue;
				}
				else if (mapping.data.__combineLastMapping) {
					lastValidMapping!.sourceOffsets.push(...mapping.sourceOffsets);
					lastValidMapping!.generatedOffsets.push(...mapping.generatedOffsets);
					lastValidMapping!.lengths.push(...mapping.lengths);
					continue;
				}
				else {
					lastValidMapping = mapping;
				}
				newMappings.push(mapping);
			}

			return {
				code,
				snapshot,
				mappings: newMappings,
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

export function resolveCommonLanguageId(lang: string) {
	switch (lang) {
		case 'js': return 'javascript';
		case 'cjs': return 'javascript';
		case 'mjs': return 'javascript';
		case 'ts': return 'typescript';
		case 'cts': return 'typescript';
		case 'mts': return 'typescript';
		case 'jsx': return 'javascriptreact';
		case 'tsx': return 'typescriptreact';
		case 'pug': return 'jade';
		case 'md': return 'markdown';
	}
	return lang;
}
