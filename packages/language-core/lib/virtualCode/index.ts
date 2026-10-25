import { type IScriptSnapshot, type Mapping, SpanMapKind, type VirtualCode } from '@volar/language-core';
import type { SFCParseResult } from '@vue/compiler-sfc';
import { computed, signal } from 'alien-signals';
import { allFeatures } from '../codegen/features';
import { getScriptAnalysis } from '../scriptAnalysis';
import type { IR, TypeScript, VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { useEmbeddedCodes } from './embeddedCodes';

export type { VueGeneratedCode } from './embeddedCodes';
import { useIR } from './ir';
import { petiteVueParser } from './parsers/petiteVue';
import { sfcParser } from './parsers/sfc';
import { vitePressParser } from './parsers/vitepress';

type SfcParser = Pick<VueLanguagePluginReturn, 'parseSFC' | 'updateSFC'>;

const builtInParsers: Record<VueCompilerOptions['format'], SfcParser> = {
	sfc: sfcParser,
	vitepress: vitePressParser,
	'petite-vue': petiteVueParser,
};

const rootLanguageIds: Record<VueCompilerOptions['format'], string> = {
	sfc: 'vue',
	vitepress: 'markdown',
	'petite-vue': 'html',
};

export function getRootLanguageId(vueCompilerOptions: VueCompilerOptions) {
	return rootLanguageIds[vueCompilerOptions.format] ?? 'vue';
}

export class VueVirtualCode implements VirtualCode {
	readonly id = 'main';

	private _snapshot: {
		(): IScriptSnapshot;
		(newSnapshot: IScriptSnapshot): void;
	};
	private _parsedSfcResult: () => ReturnType<typeof this.parseSfc>;
	private _ir: IR;
	private _embeddedCodes: () => VirtualCode[];
	private _mappings: () => Mapping[];

	get languageId() {
		return getRootLanguageId(this.vueCompilerOptions);
	}
	get snapshot() {
		return this._snapshot();
	}
	get vueSfc() {
		return this._parsedSfcResult()?.result;
	}
	get ir() {
		return this._ir;
	}
	/** @deprecated use `ir` instead */
	get sfc() {
		return this._ir;
	}
	get embeddedCodes() {
		return this._embeddedCodes();
	}
	get mappings() {
		return this._mappings();
	}
	get scriptAnalysis() {
		return getScriptAnalysis(this.ts, this.vueCompilerOptions, this.fileName, this._ir);
	}

	constructor(
		public fileName: string,
		public initSnapshot: IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		plugins: VueLanguagePluginReturn[],
		private ts: TypeScript,
	) {
		this._snapshot = signal(initSnapshot);
		this._parsedSfcResult = computed(lastResult => this.parseSfc(plugins, lastResult));
		this._ir = useIR(
			ts,
			plugins,
			fileName,
			this._snapshot,
			() => this._parsedSfcResult()?.result,
		);
		this._embeddedCodes = useEmbeddedCodes(plugins, fileName, this._ir);
		this._mappings = computed(() => {
			const length = this._snapshot().getLength();
			return [[0, length, 0, length, SpanMapKind.Verbatim, allFeatures]];
		});
	}

	update(newSnapshot: IScriptSnapshot) {
		this._snapshot(newSnapshot);
	}

	private parseSfc(
		plugins: VueLanguagePluginReturn[],
		lastResult?: {
			snapshot: IScriptSnapshot;
			result: SFCParseResult;
			plugin: SfcParser;
		},
	) {
		const snapshot = this.snapshot;

		if (lastResult?.plugin.updateSFC && !lastResult.result.errors.length) {
			const change = snapshot.getChangeRange(lastResult.snapshot);
			if (change) {
				const newSfc = lastResult.plugin.updateSFC(lastResult.result, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					// force dirty
					newSfc.descriptor = JSON.parse(JSON.stringify(newSfc.descriptor));
					return {
						snapshot,
						plugin: lastResult.plugin,
						result: newSfc,
					};
				}
			}
		}

		const content = snapshot.getText(0, snapshot.getLength());
		for (const plugin of [...plugins, builtInParsers[this.vueCompilerOptions.format] ?? sfcParser]) {
			const sfc = plugin.parseSFC?.(this.fileName, content);
			if (sfc) {
				return {
					snapshot,
					plugin,
					result: sfc,
				};
			}
		}
	}
}
