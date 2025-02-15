import type { VirtualCode } from '@volar/language-core';
import { computed, signal } from 'alien-signals';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins';
import type { VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import type { WriteableSignal } from '../utils/signals';
import { computedEmbeddedCodes } from './computedEmbeddedCodes';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';

export class VueVirtualCode implements VirtualCode {

	// sources

	id = 'main';

	_snapshot = signal(undefined!) as WriteableSignal<ts.IScriptSnapshot>;

	// computeds

	_vueSfc = computedVueSfc(this.plugins, this.fileName, this.languageId, this._snapshot);
	_sfc = computedSfc(this.ts, this.plugins, this.fileName, this._snapshot, this._vueSfc);
	_mappings = computed(() => {
		const snapshot = this._snapshot();
		return [{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [snapshot.getLength()],
			data: allCodeFeatures,
		}];
	});
	_embeddedCodes = computedEmbeddedCodes(this.plugins, this.fileName, this._sfc);

	// others

	get embeddedCodes() {
		return this._embeddedCodes();
	}
	get snapshot() {
		return this._snapshot();
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
		this._snapshot(initSnapshot);
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot(newSnapshot);
	}
}
