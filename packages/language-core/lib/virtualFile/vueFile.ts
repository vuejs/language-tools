import type { CodeInformation, Mapping, VirtualCode } from '@volar/language-core';
import { computed, signal } from 'alien-signals';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins';
import type { VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { computedEmbeddedCodes } from './computedEmbeddedCodes';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';

export class VueVirtualCode implements VirtualCode {
	readonly id = 'main';
	readonly sfc: ReturnType<typeof computedSfc>;

	private _snapshot: {
		(): ts.IScriptSnapshot;
		(value: ts.IScriptSnapshot): void;
	};
	private _vueSfc: ReturnType<typeof computedVueSfc>;
	private _embeddedCodes: ReturnType<typeof computedEmbeddedCodes>;
	private _mappings: () => Mapping<CodeInformation>[];

	get snapshot() {
		return this._snapshot();
	}
	get vueSfc() {
		return this._vueSfc();
	}
	get embeddedCodes() {
		return this._embeddedCodes();
	}
	get mappings() {
		return this._mappings();
	}

	constructor(
		public fileName: string,
		public languageId: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: VueLanguagePluginReturn[],
		public ts: typeof import('typescript'),
	) {
		this._snapshot = signal(initSnapshot);
		this._vueSfc = computedVueSfc(this.plugins, this.fileName, this.languageId, this._snapshot);
		this.sfc = computedSfc(this.ts, this.plugins, this.fileName, this._snapshot, this._vueSfc);
		this._embeddedCodes = computedEmbeddedCodes(this.plugins, this.fileName, this.sfc);
		this._mappings = computed(() => {
			const snapshot = this._snapshot();
			return [{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [snapshot.getLength()],
				data: allCodeFeatures,
			}];
		});
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot(newSnapshot);
	}
}
