import type * as ts from 'typescript';

/** Query the same symbolic remaining-space types used by vue-tsc. */
export function getMatchWarnings(ts: typeof import('typescript'), program: ts.Program, fileName: string) {
	const file = program.getSourceFile(fileName);
	const warnings: { start: number; end: number; message: string }[] = [];
	if (!file) {
		return warnings;
	}
	const checker = program.getTypeChecker();
	function visit(node: ts.Node) {
		if (ts.isTypeAliasDeclaration(node)) {
			const match = /^__VLS_match_arm_(\d+)_(\d+)$/.exec(ts.idText(node.name));
			if (match && checker.getTypeAtLocation(node).flags & ts.TypeFlags.Never) {
				warnings.push({
					start: +match[1]!,
					end: +match[2]!,
					message: 'Unreachable v-when: this pattern cannot match any remaining value.',
				});
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(file);
	return warnings;
}
