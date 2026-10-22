export type TypeScript =
	& typeof import('typescript-7/ast', { with: { 'resolution-mode': 'import' }})
	& typeof import('typescript-7/async', { with: { 'resolution-mode': 'import' }});

export type ComponentMetaChecker = Awaited<ReturnType<typeof import('../index')['createChecker']>>;

/** A declaration's range in UTF-16 offsets of the file's source text (for a Vue file, its `.vue` text). */
export interface Declaration {
	file: string;
	start: number;
	end: number;
}

/** An index into `ComponentMeta.types`. */
export type TypeId = number;

export interface ComponentMeta {
	name?: string;
	description?: string;
	props: PropMeta[];
	events: EventMeta[];
	slots: SlotMeta[];
	exposed: ExposeMeta[];
	/** The types that members refer to by `TypeId`, each resolved once. */
	types: TypeNode[];
}

export interface Tag {
	name: string;
	text?: string;
}

export interface PropMeta {
	name: string;
	required: boolean;
	default?: string;
	description: string;
	tags: Tag[];
	/** Declared by Vue or the global component props (e.g. `key`, `class`) rather than the component. */
	global: boolean;
	declarations: Declaration[];
	type: TypeId;
}

export interface EventMeta {
	name: string;
	description: string;
	tags: Tag[];
	/** The event's call signature. */
	declarations: Declaration[];
	/** A `function` type of the event's arguments. */
	type: TypeId;
}

export interface SlotMeta {
	name: string;
	description: string;
	tags: Tag[];
	declarations: Declaration[];
	/** The type of the slot props. */
	type: TypeId;
}

export interface ExposeMeta {
	name: string;
	description: string;
	tags: Tag[];
	declarations: Declaration[];
	type: TypeId;
}

export interface PropertyNode {
	name: string;
	optional: boolean;
	description: string;
	type: TypeId;
}

export interface ParameterNode {
	name: string;
	optional: boolean;
	rest: boolean;
	type: TypeId;
}

/**
 * A type as written by the checker (`text`) and, unless it is declared outside the project's own source files, its
 * structure.
 */
export type TypeNode =
	& { text: string }
	& (
		| { kind: 'primitive' | 'literal' }
		| { kind: 'union'; types: TypeId[] }
		| { kind: 'array'; element: TypeId }
		| { kind: 'tuple'; elements: TypeId[] }
		| { kind: 'object'; properties: PropertyNode[] }
		| { kind: 'function'; parameters: ParameterNode[]; returns: TypeId }
		| { kind: 'external'; declaration?: Declaration }
	);
