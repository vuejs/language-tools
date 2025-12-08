import { defineRule } from '@tsslint/config';

export default defineRule(({ typescript: ts, file, report }) => {
	ts.forEachChild(file, function visit(node) {
		if (
			ts.isImportDeclaration(node)
			&& node.importClause
			&& node.importClause.namedBindings
			&& node.importClause.phaseModifier !== ts.SyntaxKind.TypeKeyword
			&& !node.importClause.name
			&& !ts.isNamespaceImport(node.importClause.namedBindings)
			&& node.importClause.namedBindings.elements.every(e => e.isTypeOnly)
		) {
			const typeElements = node.importClause.namedBindings.elements;
			report(
				'This import statement should use type-only import.',
				node.getStart(file),
				node.getEnd(),
			).withFix(
				'Replace inline type imports with a type-only import.',
				() => [
					{
						fileName: file.fileName,
						textChanges: [
							...typeElements.map(element => {
								const token = element.getFirstToken(file)!;
								return {
									newText: '',
									span: {
										start: token.getStart(file),
										length: element.name.getStart(file) - token.getStart(file),
									},
								};
							}),
							{
								newText: 'type ',
								span: {
									start: node.importClause!.getStart(file),
									length: 0,
								},
							},
						],
					},
				],
			);
		}
		ts.forEachChild(node, visit);
	});
});
