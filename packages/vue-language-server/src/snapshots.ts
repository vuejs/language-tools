import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';

interface IncrementalScriptSnapshotVersion {
	// if set, it mean this change is applyed to document
	changeRange: ts.TextChangeRange | undefined,
	version: number,
	contentChanges: {
		range: vscode.Range;
		text: string;
	}[],
	snapshot: WeakRef<ts.IScriptSnapshot> | undefined,
}

class IncrementalScriptSnapshot {

	private document: TextDocument;
	uri: string;
	versions: IncrementalScriptSnapshotVersion[];

	constructor(uri: string, languageId: string, version: number, text: string) {
		this.uri = uri;
		this.document = TextDocument.create(uri, languageId, version - 1, '');
		this.versions = [
			{
				changeRange: undefined,
				version,
				contentChanges: [{
					range: {
						start: { line: 0, character: 0 },
						end: { line: 0, character: 0 },
					},
					text,
				}],
				snapshot: undefined,
			}
		];
	}

	get version() {
		if (this.versions.length) {
			return this.versions[this.versions.length - 1].version;
		}
		return this.document.version;
	}

	update(params: vscode.DidChangeTextDocumentParams) {
		TextDocument.update(this.document, params.contentChanges, params.textDocument.version);
		this.versions.length = 0;
	}

	getSnapshot() {

		this.clearUnReferenceVersions();

		const lastChange = this.versions[this.versions.length - 1];
		if (!lastChange.snapshot) {
			this.applyVersionToRootDocument(lastChange.version, false);
			const text = this.document.getText();
			const cache = new WeakMap<ts.IScriptSnapshot, ts.TextChangeRange | undefined>();
			const snapshot: ts.IScriptSnapshot = {
				getText: (start, end) => text.substring(start, end),
				getLength: () => text.length,
				getChangeRange: (oldSnapshot) => {
					if (!cache.has(oldSnapshot)) {
						const start = this.versions.findIndex(change => change.snapshot?.deref() === oldSnapshot) + 1;
						const end = this.versions.indexOf(lastChange) + 1;
						if (start >= 0 && end >= 0) {
							const changeRanges = this.versions.slice(start, end).map(change => change.changeRange!);
							const result = combineContinuousChangeRanges.apply(null, changeRanges);
							cache.set(oldSnapshot, result);
						}
						else {
							cache.set(oldSnapshot, undefined);
						}
					}
					return cache.get(oldSnapshot);
				},
			};
			lastChange.snapshot = new WeakRef(snapshot);
		}

		return lastChange.snapshot.deref()!;
	}

	getDocument() {

		this.clearUnReferenceVersions();

		const lastChange = this.versions[this.versions.length - 1];
		if (!lastChange.changeRange) {
			this.applyVersionToRootDocument(lastChange.version, false);
		}

		return this.document;
	}

	clearUnReferenceVersions() {
		let versionToApply: number | undefined;
		for (let i = 0; i < this.versions.length - 1; i++) {
			const change = this.versions[i];
			if (!change.snapshot?.deref()) {
				versionToApply = change.version;
			}
			else {
				break;
			}
		}
		if (versionToApply !== undefined) {
			this.applyVersionToRootDocument(versionToApply, true);
		}
	}

	applyVersionToRootDocument(version: number, removeBeforeVersions: boolean) {
		let removeEnd = -1;
		for (let i = 0; i < this.versions.length; i++) {
			const change = this.versions[i];
			if (change.version > version) {
				break;
			}
			if (!change.changeRange) {
				const changeRanges: ts.TextChangeRange[] = change.contentChanges.map(edit => ({
					span: {
						start: this.document.offsetAt(edit.range.start),
						length: this.document.offsetAt(edit.range.end) - this.document.offsetAt(edit.range.start),
					},
					newLength: edit.text.length,
				}));
				change.changeRange = combineMultiLineChangeRanges.apply(null, changeRanges);
				TextDocument.update(this.document, change.contentChanges, change.version);
			}
			removeEnd = i + 1;
		}
		if (removeBeforeVersions && removeEnd >= 1) {
			this.versions.splice(0, removeEnd);
		}
	}
}

export function combineContinuousChangeRanges(...changeRanges: ts.TextChangeRange[]) {
	if (changeRanges.length === 1) {
		return changeRanges[0];
	}
	let changeRange: ts.TextChangeRange = changeRanges[0];
	for (let i = 1; i < changeRanges.length; i++) {
		const nextChangeRange = changeRanges[i];
		changeRange = _combineContinuousChangeRanges(changeRange, nextChangeRange);
	}
	return changeRange;
}

// https://tsplay.dev/w6Paym - @browsnet
function _combineContinuousChangeRanges(a: ts.TextChangeRange, b: ts.TextChangeRange): ts.TextChangeRange {
	const aStart = a.span.start;
	const aEnd = a.span.start + a.span.length;
	const aDiff = a.newLength - a.span.length;
	const changeBegin = aStart + Math.min(a.span.length, a.newLength);
	const rollback = (start: number) => start > changeBegin ? start - aDiff : start;
	const bStart = rollback(b.span.start);
	const bEnd = rollback(b.span.start + b.span.length);
	const bDiff = b.newLength - b.span.length;
	const start = Math.min(aStart, bStart);
	const end = Math.max(aEnd, bEnd);
	const length = end - start;
	const newLength = aDiff + bDiff + length;
	return { span: { start, length }, newLength };
}

export function combineMultiLineChangeRanges(...changeRanges: ts.TextChangeRange[]) {
	if (changeRanges.length === 1) {
		return changeRanges[0];
	}
	const firstChangeRange = changeRanges.sort((a, b) => a.span.start - b.span.start)[0];
	const lastChangeRange = changeRanges.sort((a, b) => b.span.start - a.span.start)[0];
	const fullStart = firstChangeRange.span.start;
	const fullEnd = lastChangeRange.span.start + lastChangeRange.span.length;
	const newLength = fullEnd - fullStart + (lastChangeRange.newLength - lastChangeRange.span.length);
	const lastChange: ts.TextChangeRange = {
		span: {
			start: firstChangeRange.span.start,
			length: lastChangeRange.span.start + lastChangeRange.span.length - firstChangeRange.span.start,
		},
		newLength,
	};
	return lastChange;
}

export function createSnapshots(connection: vscode.Connection) {

	const snapshots = shared.createPathMap<IncrementalScriptSnapshot>();
	const onDidOpens: ((params: vscode.DidOpenTextDocumentParams) => void)[] = [];
	const onDidChangeContents: ((params: vscode.DidChangeTextDocumentParams) => void)[] = [];
	const onDidCloses: ((params: vscode.DidCloseTextDocumentParams) => void)[] = [];

	connection.onDidOpenTextDocument(params => {
		snapshots.uriSet(params.textDocument.uri, new IncrementalScriptSnapshot(
			params.textDocument.uri,
			params.textDocument.languageId,
			params.textDocument.version,
			params.textDocument.text,
		));
		for (const cb of onDidOpens) {
			cb(params);
		}
	});
	connection.onDidChangeTextDocument(params => {
		const incrementalSnapshot = snapshots.uriGet(params.textDocument.uri);
		if (incrementalSnapshot) {
			if (params.contentChanges.every(vscode.TextDocumentContentChangeEvent.isIncremental)) {
				incrementalSnapshot.versions.push({
					changeRange: undefined,
					contentChanges: params.contentChanges,
					version: params.textDocument.version,
					snapshot: undefined,
				});
			}
			else {
				incrementalSnapshot.update(params);
			}
		}
		for (const cb of onDidChangeContents) {
			cb(params);
		}
	});
	connection.onDidCloseTextDocument(params => {
		snapshots.uriDelete(params.textDocument.uri);
		for (const cb of onDidCloses) {
			cb(params);
		}
	});

	return {
		data: snapshots,
		onDidOpen: (cb: typeof onDidOpens[number]) => onDidOpens.push(cb),
		onDidChangeContent: (cb: typeof onDidChangeContents[number]) => onDidChangeContents.push(cb),
		onDidClose: (cb: typeof onDidCloses[number]) => onDidCloses.push(cb),
	};
}
