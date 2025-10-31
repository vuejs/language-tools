import type * as ts from 'typescript';
import { getVariableType } from './utils';

const builtInDirectives = new Set([
	'vBind',
	'vIf',
	'vOn',
	'vOnce',
	'vShow',
	'vSlot',
]);

export function getComponentDirectives(
	ts: typeof import('typescript'),
	program: ts.Program,
	fileName: string,
): string[] {
	const directives = getVariableType(ts, program, fileName, '__VLS_directives');
	if (!directives) {
		return [];
	}

	return directives.type.getProperties()
		.map(({ name }) => name)
		.filter(name => name.startsWith('v') && name.length >= 2 && name[1] === name[1]!.toUpperCase())
		.filter(name => !builtInDirectives.has(name));
}
