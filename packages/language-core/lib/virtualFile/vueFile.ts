import type { VirtualCode } from '@volar/language-core';
import { computed, Signal, signal } from 'computeds';
import type * as ts from 'typescript';
import type { VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { computedEmbeddedCodes } from './computedEmbeddedCodes';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';
import { allCodeFeatures } from '../plugins';

export class VueVirtualCode implements VirtualCode {

	// sources

	id = 'main';

	getSnapshot: Signal<ts.IScriptSnapshot>;

	// computeds

	getVueSfc = computedVueSfc(this.plugins, this.fileName, this.languageId, () => this.getSnapshot());
	sfc = computedSfc(this.ts, this.plugins, this.fileName, () => this.getSnapshot(), this.getVueSfc);
	getMappings = computed(() => {
		const snapshot = this.getSnapshot();
		return [{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [snapshot.getLength()],
			data: allCodeFeatures,
		}];
	});
	getEmbeddedCodes = computedEmbeddedCodes(this.plugins, this.fileName, this.sfc);

	// others

	get embeddedCodes() {
		return this.getEmbeddedCodes();
	}
	get snapshot() {
		return this.getSnapshot();
	}
	get mappings() {
		return this.getMappings();
	}

	constructor(
		public fileName: string,
		public languageId: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: VueLanguagePluginReturn[],
		public ts: typeof import('typescript'),
	) {
		this.getSnapshot = signal(initSnapshot);
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this.getSnapshot.set(newSnapshot);
	}
}
