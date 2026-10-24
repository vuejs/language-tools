import type { IScriptSnapshot, Mapping, TextChangeRange, VirtualCode } from '@volar/language-core';
import { computed } from 'alien-signals';
import { toString } from 'muggle-string';
import type { Code, IR, IRBlock, VueLanguagePluginReturn } from '../types';
import { buildDiagnosticDirectiveMarkers, buildMappings, type DiagnosticDirectiveMarker } from '../utils/buildMappings';

export class VueEmbeddedCode {
	public parentCodeId?: string;
	public embeddedCodes: VueEmbeddedCode[] = [];

	constructor(
		public id: string,
		public lang: string,
		public content: Code[],
	) {}
}

export interface VueGeneratedCode extends VirtualCode {
	diagnosticDirectives: DiagnosticDirectiveMarker[];
}

export function useEmbeddedCodes(
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	ir: IR,
) {
	const getNameToBlockMap = computed(() => {
		const blocks: Record<string, IRBlock> = {};
		if (ir.template) {
			blocks[ir.template.name] = ir.template;
		}
		if (ir.script) {
			blocks[ir.script.name] = ir.script;
		}
		if (ir.scriptSetup) {
			blocks[ir.scriptSetup.name] = ir.scriptSetup;
		}
		for (const block of ir.styles) {
			blocks[block.name] = block;
		}
		for (const block of ir.customBlocks) {
			blocks[block.name] = block;
		}
		return blocks;
	});
	const pluginsResult = plugins.map(useEmbeddedCodesForPlugin);

	return computed(() => {
		const result: VueGeneratedCode[] = [];
		const idToCodeMap = new Map<string, VueGeneratedCode>();
		const virtualCodes = pluginsResult
			.map(getPluginResult => getPluginResult())
			.flat()
			.map(
				({ code, snapshot, mappings, diagnosticDirectives }) => {
					const virtualCode: VueGeneratedCode = {
						id: code.id,
						languageId: resolveCommonLanguageId(code.lang),
						snapshot,
						mappings,
						embeddedCodes: [],
						diagnosticDirectives,
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
			Map<string, () => { code: VueEmbeddedCode; snapshot: IScriptSnapshot }>
		>(
			prevMap => {
				if (!plugin.getEmbeddedCodes) {
					return new Map();
				}

				const newCodeList = plugin.getEmbeddedCodes(fileName, ir);
				const map = new Map<string, () => { code: VueEmbeddedCode; snapshot: IScriptSnapshot }>();

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
				snapshot: IScriptSnapshot;
				mappings: Mapping[];
				diagnosticDirectives: DiagnosticDirectiveMarker[];
			}[] = [];

			for (const generate of getMap().values()) {
				const { code, snapshot } = generate();
				const content = toSourceContent(code);
				result.push({
					code,
					snapshot,
					mappings: buildMappings(content),
					diagnosticDirectives: buildDiagnosticDirectiveMarkers(content),
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
					plugin.resolveEmbeddedCode(fileName, ir, code);
				}
				catch (e) {
					console.error(e);
				}
			}
			const newText = toString(code.content);
			const changeRanges = new Map<IScriptSnapshot, TextChangeRange | undefined>();
			const snapshot: IScriptSnapshot = {
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

	function toSourceContent(code: VueEmbeddedCode) {
		return code.content.map<Code>(segment => {
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
		});
	}
}

function fullDiffTextChangeRange(oldText: string, newText: string): TextChangeRange | undefined {
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
