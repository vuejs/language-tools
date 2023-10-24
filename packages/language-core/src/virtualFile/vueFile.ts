import { FileCapabilities, FileKind, VirtualFile, forEachEmbeddedFile } from '@volar/language-core';
import { Stack } from '@volar/source-map';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { VueCompilerOptions, VueLanguagePlugin } from '../types';
import { computedFiles } from './computedFiles';
import { computedMappings } from './computedMappings';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';
import { Signal, signal } from 'computeds';

const jsxReg = /^\.(js|ts)x?$/;

export class VueFile implements VirtualFile {

	// sources

	_snapshot: Signal<ts.IScriptSnapshot>;

	// computeds

	getVueSfc = computedVueSfc(this.plugins, this.fileName, () => this._snapshot());
	sfc = computedSfc(this.ts, this.plugins, this.fileName, () => this._snapshot(), this.getVueSfc);
	getMappings = computedMappings(() => this._snapshot(), this.sfc);
	getEmbeddedFiles = computedFiles(this.plugins, this.fileName, this.sfc, this.codegenStack);

	// others

	capabilities = FileCapabilities.full;
	kind = FileKind.TextFile;
	codegenStacks: Stack[] = [];
	get embeddedFiles() {
		return this.getEmbeddedFiles();
	}
	get mainScriptName() {
		let res: string = '';
		forEachEmbeddedFile(this, file => {
			if (file.kind === FileKind.TypeScriptHostFile && file.fileName.replace(this.fileName, '').match(jsxReg)) {
				res = file.fileName;
			}
		});
		return res;
	}
	get snapshot() {
		return this._snapshot();
	}
	get mappings() {
		return this.getMappings();
	}

	constructor(
		public fileName: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: ReturnType<VueLanguagePlugin>[],
		public ts: typeof import('typescript/lib/tsserverlibrary'),
		public codegenStack: boolean,
	) {
		this._snapshot = signal(initSnapshot);
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot.set(newSnapshot);
	}
}
