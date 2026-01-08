import type { Mapping, VirtualCode } from '@volar/language-core';
import { computed } from 'alien-signals';
import { toString } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code, Sfc, SfcBlock, VueCodeInformation, VueLanguagePluginReturn } from '../types';
import { buildMappings } from '../utils/buildMappings';

export class VueEmbeddedCode {
	public parentCodeId?: string;
	public linkedCodeMappings: Mapping[] = [];
	public embeddedCodes: VueEmbeddedCode[] = [];

	constructor(
		public id: string,
		public lang: string,
		public content: Code[],
	) {}
}

export function useEmbeddedCodes(
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	sfc: Sfc,
) {
	const getNameToBlockMap = computed(() => {
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
	const pluginsResult = plugins.map(useEmbeddedCodesForPlugin);

	return computed(() => {
		const result: VirtualCode[] = [];
		const idToCodeMap = new Map<string, VirtualCode>();
		const virtualCodes = pluginsResult
			.map(getPluginResult => getPluginResult())
			.flat()
			.map(
				({ code, snapshot, mappings }) => {
					const virtualCode: VirtualCode = {
						id: code.id,
						languageId: resolveCommonLanguageId(code.lang),
						linkedCodeMappings: code.linkedCodeMappings,
						snapshot,
						mappings,
						embeddedCodes: [],
					};
					idToCodeMap.set(code.id, virtualCode);
					return [code.parentCodeId, virtualCode] as const;
				},
			);

		for (const [parentCodeId, virtualCode] of virtualCodes) {
			if (!parentCodeId) {
				result.push(virtualCode);
				continue;
			}
			const parent = idToCodeMap.get(parentCodeId);
			if (parent) {
				parent.embeddedCodes ??= [];
				parent.embeddedCodes.push(virtualCode);
			}
			else {
				result.push(virtualCode);
			}
		}

		return result;
	});

	function useEmbeddedCodesForPlugin(plugin: VueLanguagePluginReturn) {
		const getMap = computed<
			Map<string, () => { code: VueEmbeddedCode; snapshot: ts.IScriptSnapshot }>
		>(
			prevMap => {
				if (!plugin.getEmbeddedCodes) {
					return new Map();
				}

				const newCodeList = plugin.getEmbeddedCodes(fileName, sfc);
				const map = new Map<string, () => { code: VueEmbeddedCode; snapshot: ts.IScriptSnapshot }>();

				for (const { id, lang } of newCodeList) {
					const key = id + '__' + lang;
					if (prevMap?.has(key)) {
						map.set(key, prevMap.get(key)!);
					}
					else {
						map.set(key, useEmbeddedCode(id, lang));
					}
				}

				return map;
			},
		);

		return computed(() => {
			const result: {
				code: VueEmbeddedCode;
				snapshot: ts.IScriptSnapshot;
				mappings: Mapping<VueCodeInformation>[];
			}[] = [];

			for (const generate of getMap().values()) {
				const { code, snapshot } = generate();
				result.push({
					code,
					snapshot,
					mappings: getMappingsForCode(code),
				});
			}

			return result;
		});
	}

	function useEmbeddedCode(id: string, lang: string) {
		return computed(() => {
			const content: Code[] = [];
			const code = new VueEmbeddedCode(id, lang, content);
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
		});
	}

	function getMappingsForCode(code: VueEmbeddedCode) {
		const mappings = buildMappings(code.content.map<Code>(segment => {
			if (typeof segment === 'string') {
				return segment;
			}
			const source = segment[1];
			if (source === undefined) {
				return segment;
			}
			const block = getNameToBlockMap()[source];
			if (!block) {
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
		const tokenMappings = new Map<symbol, Mapping>();

		for (let i = 0; i < mappings.length; i++) {
			const mapping = mappings[i]!;
			if (mapping.data.__combineToken !== undefined) {
				const token = mapping.data.__combineToken;
				if (tokenMappings.has(token)) {
					const offsetMapping = tokenMappings.get(token)!;
					offsetMapping.sourceOffsets.push(...mapping.sourceOffsets);
					offsetMapping.generatedOffsets.push(...mapping.generatedOffsets);
					offsetMapping.lengths.push(...mapping.lengths);
				}
				else {
					tokenMappings.set(token, mapping);
					newMappings.push(mapping);
				}
				continue;
			}
			if (mapping.data.__linkedToken !== undefined) {
				const token = mapping.data.__linkedToken;
				if (tokenMappings.has(token)) {
					const prevMapping = tokenMappings.get(token)!;
					code.linkedCodeMappings.push({
						sourceOffsets: [prevMapping.generatedOffsets[0]!],
						generatedOffsets: [mapping.generatedOffsets[0]!],
						lengths: [Number(token.description)],
						data: undefined,
					});
				}
				else {
					tokenMappings.set(token, mapping);
				}
				continue;
			}
			newMappings.push(mapping);
		}

		return newMappings;
	}
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

function resolveCommonLanguageId(lang: string) {
	switch (lang) {
		case 'js':
			return 'javascript';
		case 'cjs':
			return 'javascript';
		case 'mjs':
			return 'javascript';
		case 'ts':
			return 'typescript';
		case 'cts':
			return 'typescript';
		case 'mts':
			return 'typescript';
		case 'jsx':
			return 'javascriptreact';
		case 'tsx':
			return 'typescriptreact';
		case 'pug':
			return 'jade';
		case 'md':
			return 'markdown';
	}
	return lang;
}
