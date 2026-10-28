import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
import { type ComponentMeta, createChecker, type Declaration, getComponentMeta, getExportNames, type TypeId } from '..';
import { getComponentMetaOfType } from '../lib/componentMeta';

const workspace = path.resolve(__dirname, '../../../test-workspace/component-meta');
const runtimeCore = 'runtime-core.d.ts';

/** A readable form of a type: its structure, the text of leaves and external types, cut at cycles. */
function print(meta: ComponentMeta, id: TypeId, seen = new Set<TypeId>()): unknown {
	const type = meta.types[id]!;
	if (seen.has(id)) {
		return `<cycle ${type.text}>`;
	}
	seen = new Set(seen).add(id);
	switch (type.kind) {
		case 'primitive':
		case 'literal':
			return type.text;
		case 'external':
			return `<external ${type.text} @ ${type.declaration && path.basename(type.declaration.file)}>`;
		case 'union':
			return { union: type.types.map(t => print(meta, t, seen)) };
		case 'array':
			return { array: print(meta, type.element, seen) };
		case 'tuple':
			return { tuple: type.elements.map(t => print(meta, t, seen)) };
		case 'object':
			return Object.fromEntries(
				type.properties.map(p => [p.name + (p.optional ? '?' : ''), print(meta, p.type, seen)]),
			);
		case 'function':
			return {
				parameters: Object.fromEntries(
					type.parameters.map(p => [
						(p.rest ? '...' : '') + p.name + (p.optional ? '?' : ''),
						print(meta, p.type, seen),
					]),
				),
				returns: print(meta, type.returns, seen),
			};
	}
}

/** Members by name, with their types printed and line endings normalized, without their declarations. */
function members<T extends { name: string; type: TypeId; declarations: Declaration[] }>(
	meta: ComponentMeta,
	list: T[],
) {
	return normalize(
		Object.fromEntries(
			list.map(({ name, type, declarations: _, ...rest }) => [name, { ...rest, type: print(meta, type) }]),
		),
	);
}

/**
 * The declarations of members by name, each as its file relative to the workspace and its source text, or as its file
 * name outside of the workspace.
 */
function declarations(list: { name: string; declarations: Declaration[] }[]) {
	return Object.fromEntries(list.map(member => [
		member.name,
		member.declarations.map(({ file, start, end }) => {
			const relative = path.relative(workspace, file);
			if (relative.startsWith('..')) {
				return path.basename(file);
			}
			const text = fs.readFileSync(file, 'utf8').slice(start, end).replace(/\r\n/g, '\n');
			return `${relative.replace(/\\/g, '/')}: ${text}`;
		}),
	]));
}

/** The props declared by the component, by name. */
function props(meta: ComponentMeta) {
	return members(meta, declaredProps(meta).map(({ global: _, ...prop }) => prop));
}

function declaredProps(meta: ComponentMeta) {
	return meta.props.filter(p => !p.global);
}

function normalize<T>(value: T): T {
	return JSON.parse(JSON.stringify(value).replace(/\\r\\n/g, '\\n'));
}

describe('vue-component-meta', async () => {
	const checker = await createChecker(path.join(workspace, 'tsconfig.json'));
	afterAll(() => checker.close());
	const getMeta = (fileName: string, exportName?: string) =>
		checker.getComponentMeta(path.join(workspace, fileName), exportName);

	test('empty-component', async () => {
		const meta = await getMeta('empty-component/component.vue');

		expect(meta.props.map(prop => prop.name)).toEqual([
			'key',
			'ref',
			'ref_for',
			'ref_key',
			'onVue:beforeMount',
			'onVue:mounted',
			'onVue:beforeUpdate',
			'onVue:updated',
			'onVue:beforeUnmount',
			'onVue:unmounted',
			'class',
			'style',
		]);
		expect(meta.props.every(prop => prop.global && !prop.required)).toBe(true);
		expect(meta.props.every(prop => prop.declarations.map(d => path.basename(d.file)).join() === runtimeCore))
			.toBe(true);
		expect(meta.events).toEqual([]);
		expect(meta.slots).toEqual([]);
		expect(meta.exposed).toEqual([]);
	});

	test('reference-type-model', async () => {
		const meta = await getMeta('reference-type-model/component.vue');

		expect(props(meta)).toEqual({
			modelValue: { required: true, description: 'required number modelValue', tags: [], type: 'number' },
			foo: {
				required: false,
				default: 'false',
				description: 'optional boolean foo with default false',
				tags: [],
				type: { union: ['undefined', 'false', 'true'] },
			},
			bar: {
				required: false,
				description: 'optional string bar with lazy and trim modifiers',
				tags: [],
				type: { union: ['undefined', 'string'] },
			},
			barModifiers: {
				required: false,
				description: '',
				tags: [],
				type: { union: ['undefined', '<external Partial<Record<"lazy" | "trim", true>> @ lib.es5.d.ts>'] },
			},
		});
		expect(members(meta, meta.events)).toEqual({
			'update:modelValue': {
				description: '',
				tags: [],
				type: { parameters: { value: 'number' }, returns: 'void' },
			},
			'update:foo': {
				description: '',
				tags: [],
				type: { parameters: { value: 'boolean' }, returns: 'void' },
			},
			'update:bar': {
				description: '',
				tags: [],
				type: { parameters: { value: { union: ['undefined', 'string'] } }, returns: 'void' },
			},
		});
		// the name of a `defineModel` declares its prop; the default model and the modifiers have no name in the source
		expect(declarations(declaredProps(meta))).toEqual({
			modelValue: [],
			foo: [`reference-type-model/component.vue: 'foo'`],
			bar: [`reference-type-model/component.vue: 'bar'`],
			barModifiers: [],
		});
		expect(declarations(meta.events)).toEqual({
			'update:bar': [runtimeCore],
			'update:foo': [runtimeCore],
			'update:modelValue': [runtimeCore],
		});
	});

	test('reference-type-props', async () => {
		const meta = await getMeta('reference-type-props/component.vue');
		const nestedProps = { nestedProp: 'string' };

		expect(props(meta)).toEqual({
			foo: {
				required: true,
				description: 'string foo',
				tags: [
					{ name: 'default', text: '"rounded"' },
					{ name: 'since', text: 'v1.0.0' },
					{ name: 'see', text: 'https://vuejs.org/' },
					{
						name: 'example',
						text: '```vue\n<template>\n  <component foo="straight" />\n</template>\n```',
					},
				],
				type: 'string',
			},
			bar: {
				required: false,
				default: '1',
				description: 'optional number bar',
				tags: [],
				type: { union: ['undefined', 'number'] },
			},
			baz: {
				required: false,
				default: `['foo', 'bar']`,
				description: 'string array baz',
				tags: [],
				type: { union: ['undefined', { array: 'string' }] },
			},
			union: {
				required: true,
				description: 'required union type',
				tags: [],
				type: { union: ['string', 'number'] },
			},
			unionOptional: {
				required: false,
				description: 'optional union type',
				tags: [],
				type: { union: ['undefined', 'string', 'number'] },
			},
			nested: { required: true, description: 'required nested object', tags: [], type: nestedProps },
			nestedIntersection: {
				required: true,
				description: 'required nested object with intersection',
				tags: [],
				type: { nestedProp: 'string', additionalProp: 'string' },
			},
			nestedOptional: {
				required: false,
				description: 'optional nested object',
				tags: [],
				type: { union: ['undefined', nestedProps, nestedProps] },
			},
			array: { required: true, description: 'required array object', tags: [], type: { array: nestedProps } },
			arrayOptional: {
				required: false,
				description: 'optional array object',
				tags: [],
				type: { union: ['undefined', { array: nestedProps }] },
			},
			enumValue: {
				required: true,
				description: 'enum value',
				tags: [],
				type: { union: ['MyEnum.Small', 'MyEnum.Medium', 'MyEnum.Large'] },
			},
			stringEnumValue: {
				required: true,
				description: 'string enum value',
				tags: [],
				type: { union: ['MyStringEnum.Small', 'MyStringEnum.Medium', 'MyStringEnum.Large'] },
			},
			namespaceType: { required: true, description: 'namespace type', tags: [], type: {} },
			literalFromContext: {
				required: true,
				description: 'literal type alias that require context',
				tags: [],
				type: { union: ['"Addons"', '"Content"', '"Display"', '"Forms"', '"Interaction"', '"Uncategorized"'] },
			},
			inlined: { required: true, description: '', tags: [], type: { foo: 'string' } },
			recursive: {
				required: true,
				description: '',
				tags: [],
				type: { recursive: '<cycle MyNestedRecursiveProps>' },
			},
		});
		const myProps = (text: string) => [`reference-type-props/my-props.ts: ${text}`];
		expect(declarations(declaredProps(meta))).toEqual({
			foo: myProps('foo: string;'),
			bar: myProps('bar?: number;'),
			baz: myProps('baz?: string[];'),
			union: myProps('union: string | number;'),
			unionOptional: myProps('unionOptional?: string | number;'),
			nested: myProps('nested: MyNestedProps;'),
			nestedIntersection: myProps(
				'nestedIntersection: MyNestedProps & {\n\t\t/**\n\t\t * required additional property\n\t\t */\n\t\tadditionalProp: string;\n\t};',
			),
			nestedOptional: myProps('nestedOptional?: MyNestedProps | MyIgnoredNestedProps;'),
			array: myProps('array: MyNestedProps[];'),
			arrayOptional: myProps('arrayOptional?: MyNestedProps[];'),
			enumValue: myProps('enumValue: MyEnum;'),
			stringEnumValue: myProps('stringEnumValue: MyStringEnum;'),
			namespaceType: myProps('namespaceType: MyNamespace.MyType;'),
			literalFromContext: myProps('literalFromContext: MyCategories;'),
			inlined: myProps('inlined: { foo: string };'),
			recursive: myProps('recursive: MyNestedRecursiveProps;'),
		});
	});

	test('reference-type-props: texts and documentation of nested types', async () => {
		const meta = await getMeta('reference-type-props/component.vue');
		const prop = (name: string) => meta.types[meta.props.find(p => p.name === name)!.type]!;

		expect(prop('nested')).toEqual({
			text: 'MyNestedProps',
			kind: 'object',
			properties: [
				{ name: 'nestedProp', optional: false, description: 'nested prop documentation', type: expect.any(Number) },
			],
		});
		const intersection = prop('nestedIntersection');
		expect(intersection.text).toBe('MyNestedProps & { additionalProp: string; }');
		expect(intersection.kind === 'object' && intersection.properties.map(p => p.description)).toEqual([
			'nested prop documentation',
			'required additional property',
		]);
		expect(prop('enumValue').text).toBe('MyEnum');
		expect(prop('literalFromContext').text).toBe(
			'"Addons" | "Content" | "Display" | "Forms" | "Interaction" | "Uncategorized"',
		);
	});

	test('reference-type-props-destructured', async () => {
		const componentPath = path.join(workspace, 'reference-type-props/component-destructure.vue');
		const meta = await checker.getComponentMeta(componentPath);

		expect(props(meta)).toEqual({
			text: { required: true, default: `'foobar'`, description: '', tags: [], type: 'string' },
		});

		const text = meta.props.find(prop => prop.name === 'text')!;
		expect(text.declarations.length).toBe(1);
		const [{ file, start, end }] = text.declarations as [Declaration];
		expect(path.relative(workspace, file)).toBe(path.join('reference-type-props', 'component-destructure.vue'));
		expect(fs.readFileSync(componentPath, 'utf8').slice(start, end)).toBe('text: string;');
	});

	test('reference-type-props-non-ascii-default', async () => {
		const meta = await getMeta('reference-type-props/component-non-ascii.vue');

		expect(props(meta).label).toMatchObject({ required: false, default: `'こんにちは'` });
		expect(declarations(declaredProps(meta))).toEqual({
			label: ['reference-type-props/component-non-ascii.vue: label?: string;'],
		});
	});

	test('reference-type-props-block-default', async () => {
		const meta = await getMeta('reference-type-props/component-block-default.vue');

		expect(props(meta).expression).toMatchObject({ default: '[1]' });
		expect(props(meta).returned).toMatchObject({ default: '[2]' });
		expect(props(meta).statements).toMatchObject({
			default: '() => {\n\t\tconst value = [3];\n\t\treturn value;\n\t}',
		});
	});

	test('reference-type-props-js', async () => {
		const meta = await getMeta('reference-type-props/component-js.vue');
		const optionalString = { union: ['undefined', 'string'] };

		expect(props(meta)).toEqual({
			foo: { required: true, description: '', tags: [], type: 'string' },
			bar: { required: false, default: `'BAR'`, description: '', tags: [], type: optionalString },
			baz: { required: false, description: '', tags: [], type: optionalString },
			xfoo: { required: true, description: '', tags: [], type: 'string' },
			xbar: { required: false, description: '', tags: [], type: optionalString },
			xbaz: { required: false, description: '', tags: [], type: optionalString },
		});
		const componentJs = (text: string) => [`reference-type-props/component-js.vue: ${text}`];
		expect(declarations(declaredProps(meta))).toEqual({
			foo: componentJs('foo: {\n\t\ttype: String,\n\t\trequired: true\n\t}'),
			bar: componentJs(`bar: {\n\t\ttype: String,\n\t\tdefault: 'BAR',\n\t}`),
			baz: componentJs('baz: {\n\t\ttype: String\n\t}'),
			xfoo: componentJs('xfoo: StringRequired'),
			xbar: componentJs('xbar: StringEmpty'),
			xbaz: componentJs('xbaz: StringUndefined'),
		});
	});

	test('reference-type-props-js-setup', async () => {
		const meta = await getMeta('reference-type-props/component-js-setup.vue');
		const optionalString = { union: ['undefined', 'string'] };

		expect(props(meta)).toEqual({
			foo: { required: true, description: '', tags: [], type: 'string' },
			bar: { required: false, default: `'BAR'`, description: '', tags: [], type: optionalString },
			baz: { required: false, description: '', tags: [], type: optionalString },
			xfoo: { required: true, description: '', tags: [], type: 'string' },
			xbar: { required: false, description: '', tags: [], type: optionalString },
			xbaz: { required: false, description: '', tags: [], type: optionalString },
			hello: {
				required: false,
				default: `'Hello'`,
				description: 'The hello property.',
				tags: [{ name: 'since', text: 'v1.0.0' }],
				type: optionalString,
			},
			numberOrStringProp: {
				required: false,
				default: '42',
				description: '',
				tags: [],
				type: { union: ['undefined', 'string', 'number'] },
			},
			arrayProps: {
				required: false,
				default: '[42, 43, 44]',
				description: '',
				tags: [],
				type: { union: ['undefined', { array: 'unknown' }] },
			},
		});
		const componentJsSetup = (text: string) => [`reference-type-props/component-js-setup.vue: ${text}`];
		expect(declarations(declaredProps(meta))).toEqual({
			foo: componentJsSetup('foo: {\n    type: String,\n    required: true\n  }'),
			bar: componentJsSetup(`bar: {\n    type: String,\n    default: 'BAR'\n  }`),
			baz: componentJsSetup('baz: {\n    type: String\n  }'),
			xfoo: componentJsSetup('xfoo: StringRequired'),
			xbar: componentJsSetup('xbar: StringEmpty'),
			xbaz: componentJsSetup('xbaz: StringUndefined'),
			hello: componentJsSetup(`hello: {\n    type: String,\n    default: 'Hello'\n  }`),
			numberOrStringProp: componentJsSetup('numberOrStringProp: {\n    type: [Number, String],\n    default: 42\n  }'),
			arrayProps: componentJsSetup('arrayProps: {\n    type: Array,\n    default: () => [42, 43, 44]\n  }'),
		});
	});

	test('reference-type-events', async () => {
		const meta = await getMeta('reference-type-events/component.vue');

		expect(members(meta, meta.events)).toEqual({
			foo: {
				description: '',
				tags: [],
				type: { parameters: { 'data?': { union: ['undefined', { foo: 'string' }] } }, returns: 'void' },
			},
			bar: {
				description: '',
				tags: [],
				type: { parameters: { value: { arg1: 'number', 'arg2?': 'any' } }, returns: 'void' },
			},
			baz: { description: '', tags: [], type: { parameters: {}, returns: 'void' } },
		});
		expect(meta.events.map(event => meta.types[event.type]!.text)).toEqual([
			'(value: { arg1: number; arg2?: any; }) => void',
			'() => void',
			'(data?: { foo: string; } | undefined) => void',
		]);
		// the props of the events are not props of the component
		expect(meta.props.filter(prop => !prop.global)).toEqual([]);
		expect(declarations(meta.events)).toEqual({ foo: [runtimeCore], bar: [runtimeCore], baz: [runtimeCore] });
	});

	// Waits on TypeScript exposing the documentation of signatures in its API (upstream ask TS-5), which the events
	// read from their call signatures; exit: this passes once `getEvents` reads it.
	test.fails('reference-type-events w/ documentation', async () => {
		const meta = await getMeta('reference-type-events/component-docs.vue');

		expect(members(meta, meta.events)).toEqual({
			save: {
				description: 'Fired on save.',
				tags: [{ name: 'since', text: 'v1.0.0' }],
				type: { parameters: {}, returns: 'void' },
			},
		});
	});

	test('reference-type-events w/ tuple syntax', async () => {
		const meta = await getMeta('reference-type-exposed/component.vue');

		expect(members(meta, meta.events)).toEqual({
			click: {
				description: '',
				tags: [],
				type: { parameters: { event: '<external Event @ lib.dom.d.ts>' }, returns: 'void' },
			},
		});
	});

	test('reference-type-events w/ rest parameters', async () => {
		const meta = await getMeta('js-component/component-options.vue');
		const change = meta.types[meta.events[0]!.type]!;

		expect(change.text).toBe('(...args: any[]) => void');
		expect(print(meta, meta.events[0]!.type)).toEqual({
			parameters: { '...args': { array: 'any' } },
			returns: 'void',
		});
	});

	test('generic withDefaults and defineModel defaults', async () => {
		const meta = await getMeta('generic/component-defaults.vue');

		expect(props(meta).foo).toMatchObject({ required: false, default: '1' });
		expect(props(meta).bar).not.toHaveProperty('default');
		expect(props(meta).baz).toMatchObject({ required: false, default: '() => 2' });
		expect(props(meta).modelValue).toMatchObject({ required: false, default: '3' });
	});

	test('generic destructure and defineModel defaults', async () => {
		const meta = await getMeta('generic/component-destructure.vue');

		expect(props(meta).foo).toMatchObject({ required: false, default: '1' });
		expect(props(meta).bar).not.toHaveProperty('default');
		expect(props(meta).title).toMatchObject({ required: false, default: `'x'` });
	});

	test('defaults of quoted prop names', async () => {
		expect(props(await getMeta('generic/component-destructure.vue'))['foo-bar']).toMatchObject({ default: '[2]' });
		expect(props(await getMeta('reference-type-props/component-quoted-default.vue'))['foo-bar']).toMatchObject({
			default: '1',
		});
	});

	test('reference-type-events w/ generic', async () => {
		const meta = await getMeta('generic/component.vue');

		expect(members(meta, meta.events)).toEqual({
			bar: { description: '', tags: [], type: { parameters: { data: 'number' }, returns: 'void' } },
			'update:title': { description: '', tags: [], type: { parameters: { value: 'string' }, returns: 'void' } },
		});
		expect(props(meta)).toEqual({
			foo: { required: true, description: '', tags: [], type: 'number' },
			title: { required: true, description: '', tags: [], type: 'string' },
		});
		expect(declarations(meta.events)).toEqual({
			bar: [`generic/component.vue: (e: 'bar', data: number): void`],
			'update:title': ['template-helpers.d.ts'],
		});
		expect(declarations(declaredProps(meta))).toEqual({
			foo: ['generic/component.vue: foo: number'],
			title: [`generic/component.vue: 'title'`],
		});
	});

	test('reference-type-slots', async () => {
		const expected = {
			'no-bind': { description: '', tags: [], type: {} },
			default: { description: '', tags: [], type: { num: 'number' } },
			'named-slot': { description: '', tags: [], type: { str: 'string' } },
			vbind: { description: '', tags: [], type: { num: 'number', str: 'string' } },
		};
		for (const file of ['component.vue', 'component-no-script.vue']) {
			const meta = await getMeta(`reference-type-slots/${file}`);
			expect(members(meta, meta.slots)).toEqual(expected);
			// the names of the `<slot>` elements in the template
			expect(declarations(meta.slots)).toEqual({
				'no-bind': [`reference-type-slots/${file}: no-bind`],
				default: [`reference-type-slots/${file}: slot`],
				'named-slot': [`reference-type-slots/${file}: named-slot`],
				vbind: [`reference-type-slots/${file}: vbind`],
			});
		}
	});

	test('reference-type-slots w/ defineSlots', async () => {
		const meta = await getMeta('reference-type-slots/component-define-slots.vue');

		expect(members(meta, meta.slots)).toEqual({
			default: { description: 'Default slot', tags: [], type: { num: 'number' } },
			'named-slot': { description: '', tags: [], type: { str: 'string' } },
			vbind: {
				description: 'Slot with tags',
				tags: [{ name: 'deprecated', text: 'do not use' }],
				type: { num: 'number', str: 'string' },
			},
			// a slot without parameters has no props
			'no-bind': { description: '', tags: [], type: 'any' },
		});
		const mySlots = (text: string) => [`reference-type-slots/my-slots.ts: ${text}`];
		expect(declarations(meta.slots)).toEqual({
			default: mySlots('default: (props: { num: number }) => VNode[];'),
			'named-slot': mySlots(`'named-slot': (props: { str: string }) => VNode[];`),
			vbind: mySlots('vbind: (props: { num: number; str: string }) => VNode[];'),
			'no-bind': mySlots(`'no-bind': () => VNode[];`),
		});
	});

	test('reference-type-slots w/ generic', async () => {
		const meta = await getMeta('generic/component.vue');

		expect(members(meta, meta.slots)).toEqual({
			default: { description: '', tags: [], type: { foo: 'number' } },
		});
		expect(declarations(meta.slots)).toEqual({
			default: ['generic/component.vue: default?: (props: { foo: number }) => any'],
		});
	});

	test('generic type parameters', async () => {
		const meta = await getMeta('#4577/main.vue');

		expect(props(meta)).toEqual({
			nonGeneric: { required: true, description: '', tags: [], type: 'string' },
			rows: { required: true, description: '', tags: [], type: { array: 'Row' } },
		});
		expect(members(meta, meta.slots)).toEqual({
			default: { description: '', tags: [], type: { row: 'Row' } },
		});
	});

	test('reference-type-exposed', async () => {
		const meta = await getMeta('reference-type-exposed/component.vue');

		expect(members(meta, meta.exposed)).toEqual({
			counter: { description: 'a counter string', tags: [], type: 'string' },
			oldCounter: {
				description: 'an oldCounter string',
				tags: [{ name: 'deprecated', text: 'use counter instead' }],
				type: 'string',
			},
		});
		// props, events and slots are not exposed
		expect(Object.keys(props(meta))).toEqual(['label']);
		expect(meta.events.map(event => event.name)).toEqual(['click']);
		expect(meta.slots.map(slot => slot.name)).toEqual(['default']);
		expect(declarations(meta.exposed)).toEqual({
			counter: ['reference-type-exposed/my-exposed.ts: counter: Ref<string>;'],
			oldCounter: ['reference-type-exposed/my-exposed.ts: oldCounter: Ref<string>;'],
		});
		expect(declarations(declaredProps(meta))).toEqual({
			label: ['reference-type-exposed/component.vue: label: string'],
		});
		expect(declarations(meta.events)).toEqual({ click: [runtimeCore] });
		expect(declarations(meta.slots)).toEqual({
			default: ['reference-type-exposed/component.vue: default: () => VNode[]'],
		});
	});

	test('options-api expose array', async () => {
		const meta = await getMeta('reference-type-exposed/component-options-api.vue');

		expect(members(meta, meta.exposed)).toEqual({
			reset: {
				description: 'Resets the counter to zero',
				tags: [],
				type: { parameters: {}, returns: 'void' },
			},
			increment: {
				description: 'Increments the counter by one',
				tags: [],
				type: { parameters: {}, returns: 'void' },
			},
		});
		const component = (text: string) => [`reference-type-exposed/component-options-api.vue: ${text}`];
		expect(declarations(meta.exposed)).toEqual({
			reset: component('reset() {\n      (this as any).counter = 0;\n    }'),
			increment: component('increment() {\n      (this as any).counter += 1;\n    }'),
		});
	});

	test('component with both props and events', async () => {
		const meta = await getMeta('#5546/main.vue');

		expect(props(meta)).toEqual({
			title: { required: true, description: '', tags: [], type: 'string' },
			// a prop that starts with `on` but is not an event
			onCompleted: { required: true, description: '', tags: [], type: { parameters: {}, returns: 'void' } },
		});
		expect(members(meta, meta.events)).toEqual({
			close: { description: '', tags: [], type: { parameters: {}, returns: 'void' } },
		});
		expect(declarations(declaredProps(meta))).toEqual({
			title: ['#5546/main.vue: title: string;'],
			onCompleted: ['#5546/main.vue: onCompleted: () => void;'],
		});
		expect(declarations(meta.events)).toEqual({ close: [runtimeCore] });
	});

	test('non-component', async () => {
		const meta = await getMeta('non-component/component.ts');

		expect(meta).toEqual({
			name: undefined,
			description: undefined,
			props: [],
			events: [],
			slots: [],
			exposed: [],
			types: [],
		});
	});

	test('ts-component', async () => {
		const expected = {
			foo: { required: true, description: 'string foo', tags: [], type: 'string' },
			bar: { required: false, description: 'optional number bar', tags: [], type: { union: ['undefined', 'number'] } },
		};
		for (const file of ['component.ts', 'component-tsx.tsx']) {
			const meta = await getMeta(`ts-component/${file}`);
			expect(props(meta)).toEqual(expected);
			expect(declarations(declaredProps(meta))).toEqual({
				foo: ['ts-component/PropDefinitions.ts: foo: string;'],
				bar: ['ts-component/PropDefinitions.ts: bar?: number;'],
			});
		}
	});

	test('ts-named-exports', async () => {
		const fileName = 'ts-named-export/component.ts';

		expect(await checker.getExportNames(path.join(workspace, fileName))).toEqual(['Foo', 'Bar']);
		const foo = await getMeta(fileName, 'Foo');
		const bar = await getMeta(fileName, 'Bar');
		expect(props(foo)).toEqual({
			foo: { required: true, description: '', tags: [], type: 'string' },
		});
		expect(props(bar)).toEqual({
			bar: { required: false, description: '', tags: [], type: { union: ['undefined', 'number'] } },
		});
		expect(declarations(declaredProps(foo))).toEqual({ foo: ['ts-named-export/component.ts: foo: string'] });
		expect(declarations(declaredProps(bar))).toEqual({ bar: ['ts-named-export/component.ts: bar?: number'] });
	});

	test('options-api', async () => {
		const meta = await getMeta('options-api/component.ts');
		const unknownArray = { union: ['undefined', { array: 'unknown' }] };

		expect(members(meta, meta.events)).toEqual({
			submit: {
				description: '',
				tags: [],
				type: { parameters: { arg0: { email: 'string', password: 'string' } }, returns: 'void' },
			},
		});
		const submit = meta.types[meta.events[0]!.type]!;
		const payload = submit.kind === 'function' ? meta.types[submit.parameters[0]!.type] : undefined;
		expect(payload?.kind === 'object' && payload.properties.map(p => p.description)).toEqual([
			'email of user',
			'password of same user',
		]);
		expect(props(meta)).toEqual({
			numberDefault: {
				required: false,
				default: '42',
				description: 'Default number',
				tags: [],
				type: { union: ['undefined', 'number'] },
			},
			objectDefault: {
				required: false,
				default: `{\n\t\t\t\tfoo: 'bar',\n\t\t\t}`,
				description: 'Default function Object',
				tags: [],
				type: { union: ['undefined', '<external Record<string, any> @ lib.es5.d.ts>'] },
			},
			arrayDefault: {
				required: false,
				default: '[1, 2, 3]',
				description: 'Default function Array',
				tags: [],
				type: unknownArray,
			},
			complexDefault: {
				required: false,
				default: expect.stringMatching(/^\(props: any\) => \{/),
				description: 'Default function more complex',
				tags: [],
				type: unknownArray,
			},
		});
		const component = (text: string) => [`options-api/component.ts: ${text}`];
		expect(declarations(declaredProps(meta))).toEqual({
			numberDefault: component('numberDefault: {\n\t\t\ttype: Number,\n\t\t\tdefault: 42,\n\t\t}'),
			objectDefault: component(
				`objectDefault: {\n\t\t\ttype: Object,\n\t\t\tdefault: () => ({\n\t\t\t\tfoo: 'bar',\n\t\t\t}),\n\t\t}`,
			),
			arrayDefault: component('arrayDefault: {\n\t\t\ttype: Array,\n\t\t\tdefault: () => [1, 2, 3],\n\t\t}'),
			complexDefault: [expect.stringMatching(/^options-api\/component\.ts: complexDefault: \{\n\t\t\ttype: Array,/)],
		});
		expect(declarations(meta.events)).toEqual({ submit: [runtimeCore] });
	});

	test('js-component (script setup)', async () => {
		const meta = await getMeta('js-component/component.vue');

		expect(props(meta)).toEqual({
			bar: { required: false, default: '1', description: '', tags: [], type: { union: ['undefined', 'number'] } },
			foo: { required: true, description: '', tags: [], type: 'string' },
		});
		expect(members(meta, meta.slots)).toEqual({
			header: { description: '', tags: [], type: { count: 'number' } },
		});
		expect(meta.description).toBeUndefined();
		expect(declarations(declaredProps(meta))).toEqual({
			bar: ['js-component/component.vue: bar: {\n\t\ttype: Number,\n\t\tdefault: 1\n\t}'],
			foo: ['js-component/component.vue: foo: {\n\t\ttype: String,\n\t\trequired: true\n\t}'],
		});
		expect(declarations(meta.slots)).toEqual({ header: ['js-component/component.vue: header'] });
	});

	test('js-component (options api)', async () => {
		const meta = await getMeta('js-component/component-options.vue');

		expect(props(meta)).toEqual({
			foo: { required: true, description: '', tags: [], type: 'string' },
		});
		expect(meta.events.map(event => event.name)).toEqual(['change']);
		expect(declarations(declaredProps(meta))).toEqual({
			foo: ['js-component/component-options.vue: foo: {\n\t\t\ttype: String,\n\t\t\trequired: true\n\t\t}'],
		});
		expect(declarations(meta.events)).toEqual({ change: [runtimeCore] });
	});

	test('component-name-description (vue)', async () => {
		const meta = await getMeta('component-name-description/component.vue');

		expect(meta.name).toBe('MyComponent');
		expect(meta.description).toBe('My awesome component description');
		expect(props(meta).title).toMatchObject({ required: true, description: 'The title prop' });
		expect(declarations(declaredProps(meta))).toEqual({
			title: ['component-name-description/component.vue: title: {\n\t\t\ttype: String,\n\t\t\trequired: true,\n\t\t}'],
		});
	});

	test('component-name-description (ts)', async () => {
		const meta = await getMeta('component-name-description/component-ts.ts');

		expect(meta.name).toBe('TsComponent');
		expect(meta.description).toBe('TypeScript component with description');
		expect(props(meta).message).toMatchObject({ required: true, description: 'The message prop' });
	});

	test('component-name of defineComponent (vue)', async () => {
		const meta = await getMeta('component-name-description/component-define-component.vue');

		expect(meta.name).toBe('DefinedComponent');
	});

	test('component-name of JavaScript (vue)', async () => {
		const meta = await getMeta('component-name-description/component-js.vue');

		expect(meta.name).toBe('JsComponent');
	});

	test('component-name of script setup (vue)', async () => {
		const meta = await getMeta('component-name-description/component-script-setup.vue');

		expect(meta.name).toBeUndefined();
	});

	test('component-no-name (vue)', async () => {
		const meta = await getMeta('component-name-description/component-no-name.vue');

		expect(meta.name).toBeUndefined();
		expect(meta.description).toBeUndefined();
		expect(props(meta).value).toMatchObject({ required: true, description: 'The value prop' });
	});

	test('global props', async () => {
		const meta = await getMeta('reference-type-props/component.vue');
		const global = Object.fromEntries(meta.props.filter(p => p.global).map(p => [p.name, p]));

		expect(global.key?.required).toBe(false);
		expect(print(meta, global.class!.type)).toBe('unknown');
		expect(meta.types[global.style!.type]!.text).toBe('unknown');
		expect(declarations(meta.props.filter(p => p.global)).class).toEqual([runtimeCore]);
	});
});

describe('types', async () => {
	const checker = await createChecker(path.join(workspace, 'tsconfig.json'));
	afterAll(() => checker.close());

	test('a type is resolved once and shared by id', async () => {
		const meta = await checker.getComponentMeta(path.join(workspace, 'reference-type-props/component.vue'));
		const typeOf = (name: string) => meta.props.find(p => p.name === name)!.type;
		const nested = typeOf('nested');
		const array = meta.types[typeOf('array')]!;
		const arrayOptional = meta.types[typeOf('arrayOptional')]!;

		expect(array.kind === 'array' && array.element).toBe(nested);
		expect(arrayOptional.kind === 'union' && arrayOptional.types[1]).toBe(typeOf('array'));
		const nestedOptional = meta.types[typeOf('nestedOptional')]!;
		expect(nestedOptional.kind === 'union' && nestedOptional.types).toContain(nested);
		expect(meta.types.filter(t => t.text === 'MyNestedProps').length).toBe(1);
	});

	test('a recursive type refers to itself', async () => {
		const meta = await checker.getComponentMeta(path.join(workspace, 'reference-type-props/component.vue'));
		const id = meta.props.find(p => p.name === 'recursive')!.type;
		const type = meta.types[id]!;

		expect(type.kind === 'object' && type.properties[0]!.type).toBe(id);
	});

	test('results are plain data', async () => {
		const meta = await checker.getComponentMeta(path.join(workspace, 'reference-type-props/component.vue'));

		expect(meta.props.some(prop => prop.declarations.length)).toBe(true);
		expect(JSON.parse(JSON.stringify(meta))).toEqual(meta);
		// every id refers to an entry of the table
		const ids = JSON.stringify(meta).match(/"(?:type|element|returns)":\d+/g)!.map(m => Number(m.split(':')[1]));
		expect(ids.every(id => id >= 0 && id < meta.types.length)).toBe(true);
	});

	test('the declaration of an external type', async () => {
		const meta = await checker.getComponentMeta(path.join(workspace, 'reference-type-model/component.vue'));
		const partial = meta.types.find(t => t.kind === 'external' && t.text.startsWith('Partial'));

		expect(partial?.kind).toBe('external');
		const { file, start, end } = (partial as { declaration: { file: string; start: number; end: number } })
			.declaration;
		expect(path.basename(file)).toBe('lib.es5.d.ts');
		expect(fs.readFileSync(file, 'utf8').slice(start, end)).toMatch(/^type Partial<T> = \{/);
	});

	test('types declared in the project keep their structure', async () => {
		const meta = await checker.getComponentMeta(path.join(workspace, 'reference-type-props/component.vue'));

		for (const type of meta.types) {
			if (type.kind === 'external') {
				const relative = path.relative(workspace, type.declaration!.file);
				expect(relative.startsWith('..')).toBe(true);
			}
		}
	});
});

describe('project scope', async () => {
	const scopedChecker = await createChecker(path.join(workspace, 'tsconfig.scope.json'));
	afterAll(() => scopedChecker.close());

	test('component outside the project', async () => {
		const outsidePath = path.join(workspace, 'reference-type-props/component.vue');
		await expect(scopedChecker.getExportNames(outsidePath)).rejects.toThrow();
		await expect(scopedChecker.getComponentMeta(outsidePath)).rejects.toThrow();
	});

	test('missing export', async () => {
		const componentPath = path.join(workspace, 'empty-component/component.vue');
		await expect(scopedChecker.getComponentMeta(componentPath, 'missing')).rejects.toThrow();
	});

	test('reads the files from disk on every query', async () => {
		const consumerPath = path.join(workspace, 'empty-component/disk-consumer.vue');
		const depPath = path.join(workspace, 'empty-component/disk-dep.ts');
		const propNames = async () => (await scopedChecker.getComponentMeta(consumerPath)).props.map(prop => prop.name);
		try {
			fs.writeFileSync(depPath, `export interface DepProps { foo: string }\n`);
			fs.writeFileSync(
				consumerPath,
				`<script setup lang="ts">\nimport type { DepProps } from './disk-dep';\ndefineProps<DepProps>();\n</script>\n`,
			);
			expect(await propNames()).toContain('foo');

			fs.writeFileSync(depPath, `export interface DepProps { bar: string }\n`);
			const names = await propNames();
			expect(names).toContain('bar');
			expect(names).not.toContain('foo');

			fs.rmSync(consumerPath);
			await expect(scopedChecker.getComponentMeta(consumerPath)).rejects.toThrow();
		}
		finally {
			fs.rmSync(consumerPath, { force: true });
			fs.rmSync(depPath, { force: true });
		}
	});
});

describe('checker', () => {
	const tsconfig = path.join(workspace, 'tsconfig.json');
	const propsPath = path.join(workspace, 'reference-type-props/component.vue');
	const eventsPath = path.join(workspace, 'reference-type-events/component.vue');

	test('await using', async () => {
		await using checker = await createChecker(tsconfig);
		expect(await checker.getExportNames(propsPath)).toEqual(['default']);
	});

	test('getComponentMetas', async () => {
		await using checker = await createChecker(tsconfig);
		expect(await checker.getComponentMetas([propsPath, eventsPath])).toEqual([
			await checker.getComponentMeta(propsPath),
			await checker.getComponentMeta(eventsPath),
		]);
	});
});

describe('project', async () => {
	const tsconfig = path.join(workspace, 'tsconfig.json').replace(/\\/g, '/');
	const eventsPath = path.join(workspace, 'reference-type-events/component.vue');
	const ts = { ...await import('typescript/ast'), ...await import('typescript/async') };

	test('getComponentMeta / getExportNames / getComponentMetaOfType', async () => {
		await using checker = await createChecker(tsconfig);
		const api = new ts.API({ cwd: workspace, runExternalCode: true });
		const snapshot = await api.createSnapshot({ openProjects: [tsconfig] });
		try {
			const project = snapshot.getConfiguredProject(tsconfig)!;
			expect(await getExportNames(project, eventsPath)).toEqual(['default']);

			const meta = await getComponentMeta(ts, project, eventsPath);
			expect(meta).toEqual(await checker.getComponentMeta(eventsPath));
			expect(meta.events.length).toBeGreaterThan(0);

			// a component known only by its type has no declaration to read the name, description and defaults from
			const moduleSymbol = await project.checker.getSymbolOfSourceFile(eventsPath.replace(/\\/g, '/'));
			const defaultExport = await project.checker.getMemberInModuleExports(moduleSymbol!, 'default');
			const type = await project.checker.getTypeOfSymbol(defaultExport!);
			expect(await getComponentMetaOfType(ts, project, type, undefined)).toEqual({
				...meta,
				name: undefined,
				description: undefined,
			});
		}
		finally {
			await snapshot.dispose();
			await api.close();
		}
	});
});
