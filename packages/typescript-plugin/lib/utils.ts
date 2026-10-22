import type * as ts from 'typescript';

export function* forEachTouchingNode(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	position: number,
) {
	yield* binaryVisit(ts, sourceFile, sourceFile, position);
}

function* binaryVisit(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	node: ts.Node,
	position: number,
): Generator<ts.Node> {
	const nodes: ts.Node[] = [];
	ts.forEachChild(node, child => {
		nodes.push(child);
	});

	let left = 0;
	let right = nodes.length - 1;

	while (left <= right) {
		const mid = Math.floor((left + right) / 2);
		const node = nodes[mid]!;

		if (position > node.end) {
			left = mid + 1;
		}
		else if (position < node.getStart(sourceFile)) {
			right = mid - 1;
		}
		else {
			yield node;
			yield* binaryVisit(ts, sourceFile, node, position);
			return;
		}
	}
}
