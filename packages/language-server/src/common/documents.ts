import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { createUriMap } from './utils/uriMap';
import type * as _ from 'vscode-uri';

interface IncrementalScriptSnapshotChange {
	applied: boolean,
	changeRange: ts.TextChangeRange | undefined,
	version: number,
	contentChange: {
		range: vscode.Range;
		text: string;
	} | undefined,
	snapshot: WeakRef<ts.IScriptSnapshot> | undefined,
}

class IncrementalScriptSnapshot {

	private document: TextDocument;
	uri: string;
	changes: IncrementalScriptSnapshotChange[];

	constructor(uri: string, languageId: string, version: number, text: string) {
		this.uri = uri;
		this.document = TextDocument.create(uri, languageId, version, text);
		this.changes = [
			{
				applied: true,
				changeRange: undefined,
				version,
				contentChange: undefined,
				snapshot: undefined,
			}
		];
	}

	get version() {
		return this.changes[this.changes.length - 1].version;
	}

	update(params: vscode.DidChangeTextDocumentParams) {
		TextDocument.update(this.document, params.contentChanges, params.textDocument.version);
		this.changes = [
			{
				applied: true,
				changeRange: undefined,
				version: params.textDocument.version,
				contentChange: undefined,
				snapshot: undefined,
			}
		];
	}

	getSnapshot() {

		this.clearUnReferenceVersions();

		const lastChange = this.changes[this.changes.length - 1];
		if (!lastChange.snapshot) {
			this.applyVersionChanges(lastChange.version, false);
			const text = this.document.getText();
			const cache = new WeakMap<ts.IScriptSnapshot, ts.TextChangeRange | undefined>();
			const snapshot: ts.IScriptSnapshot = {
				getText: (start, end) => text.substring(start, end),
				getLength: () => text.length,
				getChangeRange: (oldSnapshot) => {
					if (!cache.has(oldSnapshot)) {
						const oldIndex = this.changes.findIndex(change => change.snapshot?.deref() === oldSnapshot);
						if (oldIndex >= 0) {
							const start = oldIndex + 1;
							const end = this.changes.indexOf(lastChange) + 1;
							const changeRanges = this.changes.slice(start, end).map(change => change.changeRange!);
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

		const lastChange = this.changes[this.changes.length - 1];
		if (!lastChange.applied) {
			this.applyVersionChanges(lastChange.version, false);
		}

		return this.document;
	}

	clearUnReferenceVersions() {
		let versionToApply: number | undefined;
		for (let i = 0; i <= this.changes.length - 2; i++) {
			const change = this.changes[i];
			const nextChange = this.changes[i + 1];
			if (!change.snapshot?.deref()) {
				if (change.version !== nextChange.version) {
					versionToApply = change.version;
				}
			}
			else {
				break;
			}
		}
		if (versionToApply !== undefined) {
			this.applyVersionChanges(versionToApply, true);
		}
	}

	applyVersionChanges(version: number, removeBeforeVersions: boolean) {
		let removeEnd = -1;
		for (let i = 0; i < this.changes.length; i++) {
			const change = this.changes[i];
			if (change.version > version) {
				break;
			}
			if (!change.applied) {
				if (change.contentChange) {
					change.changeRange = {
						span: {
							start: this.document.offsetAt(change.contentChange.range.start),
							length: this.document.offsetAt(change.contentChange.range.end) - this.document.offsetAt(change.contentChange.range.start),
						},
						newLength: change.contentChange.text.length,
					};
					TextDocument.update(this.document, [change.contentChange], change.version);
				}
				change.applied = true;
			}
			removeEnd = i + 1;
		}
		if (removeBeforeVersions && removeEnd >= 1) {
			this.changes.splice(0, removeEnd);
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

export function createDocuments(connection: vscode.Connection) {

	const snapshots = createUriMap<IncrementalScriptSnapshot>();
	const onDidChangeContents = new Set<(params: vscode.DidChangeTextDocumentParams) => void>();
	const onDidCloses = new Set<(params: vscode.DidCloseTextDocumentParams) => void>();

	connection.onDidOpenTextDocument(params => {
		snapshots.uriSet(params.textDocument.uri, new IncrementalScriptSnapshot(
			params.textDocument.uri,
			params.textDocument.languageId,
			params.textDocument.version,
			params.textDocument.text,
		));
		for (const cb of onDidChangeContents) {
			cb({ textDocument: params.textDocument, contentChanges: [{ text: params.textDocument.text }] });
		}
	});
	connection.onDidChangeTextDocument(params => {
		const incrementalSnapshot = snapshots.uriGet(params.textDocument.uri);
		if (incrementalSnapshot) {
			if (params.contentChanges.every(vscode.TextDocumentContentChangeEvent.isIncremental)) {
				for (const contentChange of params.contentChanges) {
					incrementalSnapshot.changes.push({
						applied: false,
						changeRange: undefined,
						contentChange,
						version: params.textDocument.version,
						snapshot: undefined,
					});
				}
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
		onDidChangeContent: (cb: (params: vscode.DidChangeTextDocumentParams) => void) => {
			onDidChangeContents.add(cb);
			return () => onDidChangeContents.delete(cb);
		},
		onDidClose: (cb: (params: vscode.DidCloseTextDocumentParams) => void) => {
			onDidCloses.add(cb);
			return () => onDidCloses.delete(cb);
		},
	};
}
