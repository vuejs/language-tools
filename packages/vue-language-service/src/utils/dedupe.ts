import type * as vscode from 'vscode-languageserver-protocol';

export function createLocationSet() {
	const set = new Set<string>();

	return {
		add,
		has,
	};

	function add(item: vscode.Location) {
		if (has(item)) {
			return false;
		}
		set.add(getKey(item));
		return true;
	}
	function has(item: vscode.Location) {
		return set.has(getKey(item));
	}
	function getKey(item: vscode.Location) {
		return [
			item.uri,
			item.range.start.line,
			item.range.start.character,
			item.range.end.line,
			item.range.end.character,
		].join(':');
	}
}

export function withCodeAction<T extends vscode.CodeAction>(items: T[]): T[] {
	return dedupe(items, item => [
		item.title
	].join(':'));
}
export function withTextEdits<T extends vscode.TextEdit>(items: T[]): T[] {
	return dedupe(items, item => [
		item.range.start.line,
		item.range.start.character,
		item.range.end.line,
		item.range.end.character,
		item.newText,
	].join(':'));
}
export function withDocumentChanges(items: NonNullable<vscode.WorkspaceEdit['documentChanges']>) {
	return dedupe(items, item => JSON.stringify(item)); // TODO: improve this
}
export function withDiagnostics<T extends vscode.Diagnostic>(items: T[]): T[] {
	return dedupe(items, item => [
		item.range.start.line,
		item.range.start.character,
		item.range.end.line,
		item.range.end.character,
		item.source,
		item.code,
		item.severity,
		item.message,
	].join(':'));
}
export function withSymbolInformations<T extends vscode.SymbolInformation>(items: T[]): T[] {
	return dedupe(items, item => [
		item.name,
		item.kind,
		item.location.uri,
		item.location.range.start.line,
		item.location.range.start.character,
		item.location.range.end.line,
		item.location.range.end.character,
	].join(':'));
}
export function withLocations<T extends vscode.Location>(items: T[]): T[] {
	return dedupe(items, item => [
		item.uri,
		item.range.start.line,
		item.range.start.character,
		item.range.end.line,
		item.range.end.character,
	].join(':'));
}
export function withLocationLinks<T extends vscode.LocationLink>(items: T[]): T[] {
	return dedupe(items, item => [
		item.targetUri,
		item.targetSelectionRange.start.line,
		item.targetSelectionRange.start.character,
		item.targetSelectionRange.end.line,
		item.targetSelectionRange.end.character,
		// ignore difference targetRange
	].join(':'));
}
export function withCallHierarchyIncomingCalls<T extends vscode.CallHierarchyIncomingCall>(items: T[]): T[] {
	return dedupe(items, item => [
		item.from.uri,
		item.from.range.start.line,
		item.from.range.start.character,
		item.from.range.end.line,
		item.from.range.end.character,
	].join(':'));
}
export function withCallHierarchyOutgoingCalls<T extends vscode.CallHierarchyOutgoingCall>(items: T[]): T[] {
	return dedupe(items, item => [
		item.to.uri,
		item.to.range.start.line,
		item.to.range.start.character,
		item.to.range.end.line,
		item.to.range.end.character,
	].join(':'));
}
export function withRanges<T extends vscode.Range>(items: T[]): T[] {
	return dedupe(items, item => [
		item.start.line,
		item.start.character,
		item.end.line,
		item.end.character,
	].join(':'));
}
function dedupe<T>(items: T[], getKey: (item: T) => string): T[] {
	const map = new Map<string, T>();
	for (const item of items.reverse()) {
		map.set(getKey(item), item);
	}
	return [...map.values()];
}
