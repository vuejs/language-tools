import type { Range } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { LocationLink } from 'vscode-languageserver/node';
import type { CallHierarchyIncomingCall } from 'vscode-languageserver/node';
import type { CallHierarchyOutgoingCall } from 'vscode-languageserver/node';
import type { Diagnostic } from 'vscode-languageserver/node';
import type { TextEdit } from 'vscode-languageserver/node';

export function createLocationSet() {
    const set = new Set<string>();

    return {
        add,
        has,
    };

    function add(item: Location) {
        if (has(item)) {
            return false;
        }
        set.add(getKey(item));
        return true;
    }
    function has(item: Location) {
        return set.has(getKey(item));
    }
    function getKey(item: Location) {
        return [
            item.uri,
            item.range.start.line,
            item.range.start.character,
            item.range.end.line,
            item.range.end.character,
        ].join(':');
    }
}

export function withTextEdits<T extends TextEdit>(items: T[]): T[] {
    return dedupe(items, item => [
        item.range.start.line,
        item.range.start.character,
        item.range.end.line,
        item.range.end.character,
        item.newText,
    ].join(':'));
}
export function withDiagnostics<T extends Diagnostic>(items: T[]): T[] {
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
export function withLocations<T extends Location>(items: T[]): T[] {
    return dedupe(items, item =>[
        item.uri,
        item.range.start.line,
        item.range.start.character,
        item.range.end.line,
        item.range.end.character,
    ].join(':'));
}
export function withLocationLinks<T extends LocationLink>(items: T[]): T[] {
    return dedupe(items, item =>[
        item.targetUri,
        item.targetSelectionRange.start.line,
        item.targetSelectionRange.start.character,
        item.targetSelectionRange.end.line,
        item.targetSelectionRange.end.character,
        item.targetRange.start.line,
        item.targetRange.start.character,
        item.targetRange.end.line,
        item.targetRange.end.character,
    ].join(':'));
}
export function withCallHierarchyIncomingCalls<T extends CallHierarchyIncomingCall>(items: T[]): T[] {
    return dedupe(items, item => [
        item.from.uri,
        item.from.range.start.line,
        item.from.range.start.character,
        item.from.range.end.line,
        item.from.range.end.character,
    ].join(':'));
}
export function withCallHierarchyOutgoingCalls<T extends CallHierarchyOutgoingCall>(items: T[]): T[] {
    return dedupe(items, item => [
        item.to.uri,
        item.to.range.start.line,
        item.to.range.start.character,
        item.to.range.end.line,
        item.to.range.end.character,
    ].join(':'));
}
export function withRanges<T extends Range>(items: T[]): T[] {
    return dedupe(items, item => [
        item.start.line,
        item.start.character,
        item.end.line,
        item.end.character,
    ].join(':'));
}
function dedupe<T>(items: T[], getKey: (item: T) => string): T[] {
    const map = new Map<string, T>();
    for (const item of items) {
        map.set(getKey(item), item);
    }
    return [...map.values()];
}
