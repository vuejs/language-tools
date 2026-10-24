import type { Node } from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { NodeHandle, Project, Signature, Symbol, Type } from 'typescript/async' with {
	'resolution-mode': 'import',
};
import type { Declaration, ParameterNode, TypeId, TypeNode, TypeScript } from './types';

/**
 * A table of the types reachable from the types passed to `ref`, filled level by level so that the requests of a
 * level are sent together.
 *
 * Unions, literals, arrays and tuples always keep their structure. Objects and functions declared outside the
 * project's own source files (the default library and external libraries) are `external` nodes.
 */
export function createTypeTable(ts: TypeScript, project: Project) {
	const { checker, program } = project;
	const types: TypeNode[] = [];
	const ids = new Map<number, TypeId>();
	const externalPaths = new Map<string, Promise<boolean>>();
	const files = new Map<string, Promise<unknown>>();
	let pending: [Type, TypeId][] = [];

	return { ref, refSignature, flush, finish, resolveNode, resolveNodes };

	/** Resolves `handle`, fetching each file once even when its nodes are resolved together. */
	async function resolveNode(handle: NodeHandle): Promise<Node | undefined> {
		const file = files.get(handle.path);
		if (!file) {
			const node = handle.resolve();
			files.set(handle.path, node);
			return await node;
		}
		await file;
		return await handle.resolve();
	}

	async function resolveNodes(handles: readonly NodeHandle[]): Promise<Node[]> {
		const nodes = await Promise.all(handles.map(resolveNode));
		return nodes.filter(node => !!node);
	}

	function ref(type: Type): TypeId {
		let id = ids.get(type.id);
		if (id === undefined) {
			id = types.push(undefined!) - 1;
			ids.set(type.id, id);
			pending.push([type, id]);
		}
		return id;
	}

	/** A `function` type of the parameters of `signature` from `skip`, e.g. an event's arguments. */
	async function refSignature(signature: Signature, skip = 0): Promise<TypeId> {
		const id = types.push(undefined!) - 1;
		types[id] = await resolveSignature(signature, skip);
		return id;
	}

	async function flush() {
		while (pending.length) {
			const level = pending;
			pending = [];
			await Promise.all(level.map(async ([type, id]) => {
				types[id] = await resolve(type);
			}));
		}
	}

	/**
	 * The table numbered in the order the types are reached from `roots`, which does not depend on the order the
	 * requests complete in, and a function that maps the ids passed out by `ref` to it.
	 */
	function finish(roots: TypeId[]) {
		const ids = new Map<TypeId, TypeId>();
		const order: TypeId[] = [];
		const visit = (id: TypeId) => {
			if (!ids.has(id)) {
				ids.set(id, order.push(id) - 1);
				forEachChild(types[id]!, visit);
			}
		};
		roots.forEach(visit);
		const map = (id: TypeId) => ids.get(id)!;
		return { types: order.map(id => mapChildren(types[id]!, map)), map };
	}

	async function resolve(type: Type): Promise<TypeNode> {
		const text = await typeToString(type);
		if (type.flags & ts.TypeFlags.Boolean) {
			return { text, kind: 'primitive' };
		}
		// before literals, as an enum is a union flagged as an enum literal
		if (type.isUnionType()) {
			return { text, kind: 'union', types: (await type.getTypes()).map(ref) };
		}
		if (type.isLiteralType() || type.flags & (ts.TypeFlags.BooleanLiteral | ts.TypeFlags.EnumLiteral)) {
			return { text, kind: 'literal' };
		}
		if (type.isIntrinsicType()) {
			return { text, kind: 'primitive' };
		}
		if (type.isIntersectionType() && (await type.getTypes()).some(t => t.isIntrinsicType() || t.isLiteralType())) {
			// branded primitives such as `string & {}`
			return { text, kind: 'primitive' };
		}
		// `Array` is declared in the default library, so arrays and tuples are checked before the boundary
		if (type.isTupleType()) {
			return { text, kind: 'tuple', elements: (await checker.getTypeArguments(type)).map(ref) };
		}
		if (type.isTypeReference() && await checker.isArrayType(type)) {
			const [element] = await checker.getTypeArguments(type);
			return { text, kind: 'array', element: ref(element ?? await checker.getAnyType()) };
		}
		const declaration = await getExternalDeclaration(type);
		if (declaration) {
			const node = await resolveNode(declaration);
			return { text, kind: 'external', declaration: node && toDeclaration(ts, node) };
		}
		const [signatures, properties] = await Promise.all([type.getCallSignatures(), type.getProperties()]);
		if (signatures.length && !properties.length) {
			return { ...await resolveSignature(signatures[0]!), text };
		}
		if (type.isObjectType() || type.isIntersectionType()) {
			const [propertyTypes, descriptions] = await Promise.all([
				properties.length ? checker.getTypeOfSymbol(properties) : [],
				Promise.all(properties.map(prop => checker.getDocumentationCommentOfSymbol(prop))),
			]);
			return {
				text,
				kind: 'object',
				properties: properties.map((prop, i) => ({
					name: prop.name,
					optional: !!(prop.flags & ts.SymbolFlags.Optional),
					description: descriptions[i]!,
					type: ref(propertyTypes[i]!),
				})),
			};
		}
		return { text, kind: 'primitive' };
	}

	async function resolveSignature(signature: Signature, skip = 0): Promise<TypeNode> {
		const [symbols, returnType] = await Promise.all([signature.getParameters(), signature.getReturnType()]);
		const used = symbols.slice(skip);
		const [usedTypes, declarations] = await Promise.all([
			used.length ? checker.getTypeOfSymbol(used) : [],
			Promise.all(used.map(async param => param.valueDeclaration && await resolveNode(param.valueDeclaration))),
		]);
		const parameters: { name: string; optional: boolean; rest: boolean; type: Type }[] = used.map((param, i) => {
			const declaration = declarations[i];
			return {
				name: param.name,
				optional: !!declaration && ts.isParameterDeclaration(declaration)
					&& !!(declaration.questionToken || declaration.initializer),
				rest: signature.hasRestParameter && i === used.length - 1,
				type: usedTypes[i]!,
			};
		});
		const rest = parameters.at(-1);
		if (rest?.rest && rest.type.isTupleType()) {
			const target = await rest.type.getTarget();
			if (target.elementFlags.every(flags => !(flags & ts.ElementFlags.Variable))) {
				// `(...args: [value: number])` reads as `(value: number)`
				parameters.pop();
				const [elements, labels] = await Promise.all([
					checker.getTypeArguments(rest.type),
					Promise.all(
						target.labeledElementDeclarations?.map(async handle => handle && await resolveNode(handle)) ?? [],
					),
				]);
				elements.forEach((type, i) => {
					const label = labels[i];
					parameters.push({
						name: label && (ts.isNamedTupleMember(label) || ts.isParameterDeclaration(label))
							? label.name.getText()
							: `arg${i}`,
						optional: !!(target.elementFlags[i]! & ts.ElementFlags.Optional),
						rest: false,
						type,
					});
				});
			}
		}
		const nodes: ParameterNode[] = parameters.map(param => ({
			name: param.name,
			optional: param.optional,
			rest: param.rest,
			type: ref(param.type),
		}));
		const returns = ref(returnType);
		const [parameterTexts, returnText] = await Promise.all([
			Promise.all(parameters.map(param => typeToString(param.type))),
			typeToString(returnType),
		]);
		const parameterText = nodes.map((param, i) =>
			`${param.rest ? '...' : ''}${param.name}${param.optional ? '?' : ''}: ${parameterTexts[i]}`
		);
		return {
			text: `(${parameterText.join(', ')}) => ${returnText}`,
			kind: 'function',
			parameters: nodes,
			returns,
		};
	}

	async function typeToString(type: Type) {
		const text = await checker.typeToString(
			type,
			undefined,
			ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.NoTruncation,
		);
		return text.replace(/import\(.*?\)\./g, '');
	}

	/** The declaration of `type` when it is outside the project's own source files. */
	async function getExternalDeclaration(type: Type): Promise<NodeHandle | undefined> {
		const symbol: Symbol | undefined = await type.getAliasSymbol() ?? await type.getSymbol();
		const handle = symbol?.declarations[0];
		if (handle && await isExternal(handle.path)) {
			return handle;
		}
	}

	function isExternal(path: string) {
		let result = externalPaths.get(path);
		if (!result) {
			result = program.getSourceFileMetadataByPath(path as never).then(metadata =>
				!!metadata && (metadata.isDefaultLibrary || metadata.isFromExternalLibrary)
			);
			externalPaths.set(path, result);
		}
		return result;
	}
}

/** The ranges of `nodes` in the source text of their files, without the nodes that are not in the source text. */
export function toDeclarations(ts: TypeScript, nodes: Node[]): Declaration[] {
	return nodes.map(node => toDeclaration(ts, node)).filter(declaration => !!declaration);
}

function toDeclaration(ts: TypeScript, node: Node): Declaration | undefined {
	const sourceFile = node.getSourceFile();
	const start = node.getStart(sourceFile);
	if (sourceFile.spanMap) {
		const { range, fidelity } = sourceFile.spanMap.virtualToOriginalSpan({ pos: start, end: node.end });
		return ts.SpanMap.isNone(fidelity) ? undefined : { file: sourceFile.fileName, start: range.pos, end: range.end };
	}
	return { file: sourceFile.fileName, start, end: node.end };
}

function forEachChild(node: TypeNode, cb: (id: TypeId) => void) {
	switch (node.kind) {
		case 'union':
			node.types.forEach(cb);
			break;
		case 'array':
			cb(node.element);
			break;
		case 'tuple':
			node.elements.forEach(cb);
			break;
		case 'object':
			node.properties.forEach(p => cb(p.type));
			break;
		case 'function':
			node.parameters.forEach(p => cb(p.type));
			cb(node.returns);
			break;
	}
}

function mapChildren(node: TypeNode, map: (id: TypeId) => TypeId): TypeNode {
	switch (node.kind) {
		case 'union':
			return { ...node, types: node.types.map(map) };
		case 'array':
			return { ...node, element: map(node.element) };
		case 'tuple':
			return { ...node, elements: node.elements.map(map) };
		case 'object':
			return { ...node, properties: node.properties.map(p => ({ ...p, type: map(p.type) })) };
		case 'function':
			return {
				...node,
				parameters: node.parameters.map(p => ({ ...p, type: map(p.type) })),
				returns: map(node.returns),
			};
		default:
			return node;
	}
}
