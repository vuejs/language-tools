import {
	allFeatures,
	createVueSource,
	type IScriptSnapshot,
	type Mapping,
	SpanMapKind,
	type TypeScript,
	type VirtualCode,
	type VueCompilerOptions,
	type VueLanguagePluginReturn,
	type VueSource,
} from '@vue/language-core';
import { computed } from 'alien-signals';
import { useEmbeddedCodes } from './embeddedCodes';

export * from './embeddedDocument';

const rootLanguageIds: Record<VueCompilerOptions['format'], string> = {
	sfc: 'vue',
	vitepress: 'markdown',
	'petite-vue': 'html',
};

export function getRootLanguageId(vueCompilerOptions: VueCompilerOptions) {
	return rootLanguageIds[vueCompilerOptions.format] ?? 'vue';
}

/** The virtual code of a Vue file for the language service: its `VueSource` and the embedded documents of it. */
export class VueVirtualCode implements VirtualCode {
	readonly id = 'main';
	readonly source: VueSource;

	private _embeddedCodes: () => VirtualCode[];
	private _mappings: () => Mapping[];

	get languageId() {
		return getRootLanguageId(this.vueCompilerOptions);
	}
	get snapshot() {
		return this.source.snapshot;
	}
	get vueSfc() {
		return this.source.vueSfc;
	}
	get ir() {
		return this.source.ir;
	}
	/** @deprecated use `ir` instead */
	get sfc() {
		return this.source.ir;
	}
	get embeddedCodes() {
		return this._embeddedCodes();
	}
	get mappings() {
		return this._mappings();
	}
	get scriptAnalysis() {
		return this.source.analysis;
	}

	constructor(
		public fileName: string,
		public initSnapshot: IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		plugins: VueLanguagePluginReturn[],
		ts: TypeScript,
	) {
		this.source = createVueSource(ts, vueCompilerOptions, plugins, fileName, initSnapshot);
		this._embeddedCodes = useEmbeddedCodes(ts, this.source.ir);
		this._mappings = computed(() => {
			const length = this.source.snapshot.getLength();
			return [[0, length, 0, length, SpanMapKind.Verbatim, allFeatures]];
		});
	}

	update(newSnapshot: IScriptSnapshot) {
		this.source.update(newSnapshot);
	}
}
