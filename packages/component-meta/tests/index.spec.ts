import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { createChecker, createCheckerByJson, MetaCheckerOptions, ComponentMetaChecker, TypeMeta } from '..';

const worker = (checker: ComponentMetaChecker, withTsconfig: boolean) => describe(`vue-component-meta ${withTsconfig ? 'with tsconfig' : 'without tsconfig'}`, () => {

	test('empty-component', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/empty-component/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.props.map(prop => prop.name)).toEqual([
			'key',
			'ref',
			'ref_for',
			'ref_key',
			'class',
			'style',
		]);
		expect(meta.props.filter(prop => !prop.global)).toEqual([]);
	});

	test('reference-type-model', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-model/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		// expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		const onUpdateFoo = meta.events.find(event => event.name === 'update:foo');

		const bar = meta.props.find(prop => prop.name === 'bar');
		const onUpdateBar = meta.events.find(event => event.name === 'update:bar');

		const qux = meta.props.find(prop => prop.name === 'qux');
		const quxModifiers = meta.props.find(prop => prop.name === 'quxModifiers');
		const onUpdateQux = meta.events.find(event => event.name === 'update:qux');

		expect(foo).toBeDefined();
		expect(bar).toBeDefined();
		expect(qux).toBeDefined();
		expect(quxModifiers).toBeDefined();
		expect(onUpdateFoo).toBeDefined();
		expect(onUpdateBar).toBeDefined();
		expect(onUpdateQux).toBeDefined();
	});

	test('reference-type-props', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		const bar = meta.props.find(prop => prop.name === 'bar');
		const baz = meta.props.find(prop => prop.name === 'baz');

		const union = meta.props.find(prop => prop.name === 'union');
		const unionOptional = meta.props.find(prop => prop.name === 'unionOptional');
		const nested = meta.props.find(prop => prop.name === 'nested');
		const nestedIntersection = meta.props.find(prop => prop.name === 'nestedIntersection');
		const nestedOptional = meta.props.find(prop => prop.name === 'nestedOptional');
		const array = meta.props.find(prop => prop.name === 'array');
		const arrayOptional = meta.props.find(prop => prop.name === 'arrayOptional');
		const enumValue = meta.props.find(prop => prop.name === 'enumValue');
		const literalFromContext = meta.props.find(prop => prop.name === 'literalFromContext');
		const inlined = meta.props.find(prop => prop.name === 'inlined');
		const recursive = meta.props.find(prop => prop.name === 'recursive');

		expect(foo).toBeDefined();
		expect(foo?.required).toBeTruthy();
		expect(foo?.type).toEqual('string');
		expect(foo?.schema).toEqual('string');
		expect(foo?.description).toEqual('string foo');
		if (process.platform !== 'win32') { // TODO
			expect(foo?.tags).toEqual([
				{
					name: 'default',
					text: '"rounded"',
				},
				{
					name: 'since',
					text: 'v1.0.0',
				},
				{
					name: 'see',
					text: 'https://vuejs.org/',
				},
				{
					name: 'example',
					text: '```vue\n<template>\n  <component foo="straight" />\n</template>\n```',
				},
			]);
		}

		expect(bar).toBeDefined();
		expect(bar?.default).toEqual('1');
		expect(bar?.required).toBeFalsy();
		expect(bar?.type).toEqual('number | undefined');
		expect(bar?.description).toEqual('optional number bar');
		expect(bar?.schema).toEqual({
			kind: 'enum',
			type: 'number | undefined',
			schema: ['undefined', 'number']
		});

		expect(baz).toBeDefined();
		// When initializing an array, users have to do it in a function to avoid
		// referencing always the same instance for every component
		// if no params are given to the function and it is simply an Array,
		// the array is the default value and should be given instead of the function
		expect(baz?.default).toEqual(`["foo", "bar"]`);
		expect(baz?.required).toBeFalsy();
		expect(baz?.type).toEqual('string[] | undefined');
		expect(baz?.description).toEqual('string array baz');
		expect(baz?.schema).toEqual({
			kind: 'enum',
			type: 'string[] | undefined',
			schema: [
				'undefined',
				{
					kind: 'array',
					type: 'string[]',
					schema: ['string']
				}
			]
		});

		expect(union).toBeDefined();
		expect(union?.default).toBeUndefined();
		expect(union?.required).toBeTruthy();
		expect(union?.type).toEqual('string | number');
		expect(union?.description).toEqual('required union type');
		expect(union?.schema).toEqual({
			kind: 'enum',
			type: 'string | number',
			schema: ['string', 'number']
		});

		expect(unionOptional).toBeDefined();
		expect(unionOptional?.default).toBeUndefined();
		expect(unionOptional?.required).toBeFalsy();
		expect(unionOptional?.type).toEqual('string | number | undefined');
		expect(unionOptional?.description).toEqual('optional union type');
		expect(unionOptional?.schema).toEqual({
			kind: 'enum',
			type: 'string | number | undefined',
			schema: ['undefined', 'string', 'number']
		});

		expect(nested).toBeDefined();
		expect(nested?.default).toBeUndefined();
		expect(nested?.required).toBeTruthy();
		expect(nested?.type).toEqual('MyNestedProps');
		expect(nested?.description).toEqual('required nested object');
		expect(nested?.schema).toEqual({
			kind: 'object',
			type: 'MyNestedProps',
			schema: {
				nestedProp: {
					name: 'nestedProp',
					description: 'nested prop documentation',
					tags: [],
					global: false,
					required: true,
					type: 'string',
					declarations: [],
					schema: 'string'
				}
			}
		});

		expect(nestedIntersection).toBeDefined();
		expect(nestedIntersection?.default).toBeUndefined();
		expect(nestedIntersection?.required).toBeTruthy();
		expect(nestedIntersection?.type).toEqual('MyNestedProps & { additionalProp: string; }');
		expect(nestedIntersection?.description).toEqual('required nested object with intersection');
		expect(nestedIntersection?.schema).toEqual({
			kind: 'object',
			type: 'MyNestedProps & { additionalProp: string; }',
			schema: {
				nestedProp: {
					name: 'nestedProp',
					description: 'nested prop documentation',
					tags: [],
					global: false,
					required: true,
					type: 'string',
					declarations: [],
					schema: 'string'
				},
				additionalProp: {
					name: 'additionalProp',
					description: 'required additional property',
					tags: [],
					global: false,
					required: true,
					type: 'string',
					declarations: [],
					schema: 'string'
				}
			}
		});

		expect(nestedOptional).toBeDefined();
		expect(nestedOptional?.default).toBeUndefined();
		expect(nestedOptional?.required).toBeFalsy();
		expect(nestedOptional?.type).toEqual('MyNestedProps | MyIgnoredNestedProps | undefined');
		expect(nestedOptional?.description).toEqual('optional nested object');
		expect(nestedOptional?.schema).toEqual({
			kind: 'enum',
			type: 'MyNestedProps | MyIgnoredNestedProps | undefined',
			schema: [
				'undefined',
				{
					kind: 'object',
					type: 'MyNestedProps',
					schema: {
						nestedProp: {
							name: 'nestedProp',
							description: 'nested prop documentation',
							tags: [],
							global: false,
							required: true,
							type: 'string',
							declarations: [],
							schema: 'string'
						}
					}
				},
				'MyIgnoredNestedProps',
			]
		});

		expect(array).toBeDefined();
		expect(array?.default).toBeUndefined();
		expect(array?.required).toBeTruthy();
		expect(array?.type).toEqual('MyNestedProps[]');
		expect(array?.description).toEqual('required array object');
		expect(array?.schema).toEqual({
			kind: 'array',
			type: 'MyNestedProps[]',
			schema: [
				{
					kind: 'object',
					type: 'MyNestedProps',
					schema: {
						nestedProp: {
							name: 'nestedProp',
							description: 'nested prop documentation',
							tags: [],
							global: false,
							required: true,
							type: 'string',
							declarations: [],
							schema: 'string'
						}
					}
				}
			]
		});

		expect(arrayOptional).toBeDefined();
		expect(arrayOptional?.default).toBeUndefined();
		expect(arrayOptional?.required).toBeFalsy();
		expect(arrayOptional?.type).toEqual('MyNestedProps[] | undefined');
		expect(arrayOptional?.description).toEqual('optional array object');
		expect(arrayOptional?.schema).toEqual({
			kind: 'enum',
			type: 'MyNestedProps[] | undefined',
			schema: [
				'undefined',
				{
					kind: 'array',
					type: 'MyNestedProps[]',
					schema: [
						{
							kind: 'object',
							type: 'MyNestedProps',
							schema: {
								nestedProp: {
									name: 'nestedProp',
									description: 'nested prop documentation',
									tags: [],
									global: false,
									required: true,
									type: 'string',
									declarations: [],
									schema: 'string'
								}
							}
						}
					]
				}
			]
		});

		expect(enumValue).toBeDefined();
		expect(enumValue?.default).toBeUndefined();
		expect(enumValue?.required).toBeTruthy();
		expect(enumValue?.type).toEqual('MyEnum');
		expect(enumValue?.description).toEqual('enum value');
		expect(enumValue?.schema).toEqual({
			kind: 'enum',
			type: 'MyEnum',
			schema: ['MyEnum.Small', 'MyEnum.Medium', 'MyEnum.Large']
		});

		expect(inlined).toBeDefined();
		expect(inlined?.default).toBeUndefined();
		expect(inlined?.required).toBeTruthy();
		expect(inlined?.schema).toEqual({
			kind: 'object',
			type: '{ foo: string; }',
			schema: {
				foo: {
					name: 'foo',
					description: '',
					tags: [],
					global: false,
					required: true,
					type: 'string',
					declarations: [],
					schema: 'string'
				}
			}
		});

		expect(literalFromContext).toBeDefined();
		expect(literalFromContext?.default).toBeUndefined();
		expect(literalFromContext?.required).toBeTruthy();
		expect(literalFromContext?.type).toEqual('"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"');
		expect(literalFromContext?.description).toEqual('literal type alias that require context');
		expect(literalFromContext?.schema).toEqual({
			kind: 'enum',
			type: '"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"',
			schema: [
				'"Uncategorized"',
				'"Content"',
				'"Interaction"',
				'"Display"',
				'"Forms"',
				'"Addons"'
			]
		});

		expect(recursive).toBeDefined();
		expect(recursive?.default).toBeUndefined();
		expect(recursive?.required).toBeTruthy();
		expect(recursive?.type).toEqual('MyNestedRecursiveProps');
		expect(recursive?.schema).toEqual({
			kind: 'object',
			type: 'MyNestedRecursiveProps',
			schema: {
				recursive: {
					name: 'recursive',
					description: '',
					tags: [],
					global: false,
					required: true,
					type: 'MyNestedRecursiveProps',
					declarations: [],
					schema: 'MyNestedRecursiveProps'
				}
			}
		});
	});

	test('reference-type-props-js', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component-js.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		const bar = meta.props.find(prop => prop.name === 'bar');
		const baz = meta.props.find(prop => prop.name === 'baz');
		const xfoo = meta.props.find(prop => prop.name === 'xfoo');
		const xbar = meta.props.find(prop => prop.name === 'xbar');
		const xbaz = meta.props.find(prop => prop.name === 'xbaz');

		expect(foo).toBeDefined();
		expect(foo?.default).toBeUndefined();
		expect(foo?.required).toBeTruthy();
		expect(foo?.type).toEqual('string');

		expect(bar).toBeDefined();
		expect(bar?.default).toBe('"BAR"');
		expect(bar?.required).toBeFalsy();
		expect(bar?.type).toEqual('string | undefined');

		expect(baz).toBeDefined();
		expect(baz?.default).toBeUndefined();
		expect(baz?.required).toBeFalsy();
		expect(baz?.type).toEqual('string | undefined');

		expect(xfoo).toBeDefined();
		expect(xfoo?.default).toBeUndefined();
		expect(xfoo?.required).toBeTruthy();
		expect(xfoo?.type).toEqual('string');

		expect(xbar).toBeDefined();
		// expect(xbar?.default).toBe('""'); // @toto should be empty string
		expect(xbar?.required).toBeFalsy();
		expect(xbar?.type).toEqual('string | undefined');

		expect(xbaz).toBeDefined();
		expect(xbaz?.default).toBeUndefined();
		expect(baz?.required).toBeFalsy();
		expect(xbaz?.type).toEqual('string | undefined');
	});

	test('reference-type-props-js-setup', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-props/component-js-setup.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const foo = meta.props.find(prop => prop.name === 'foo');
		const bar = meta.props.find(prop => prop.name === 'bar');
		const baz = meta.props.find(prop => prop.name === 'baz');
		const xfoo = meta.props.find(prop => prop.name === 'xfoo');
		const xbar = meta.props.find(prop => prop.name === 'xbar');
		const xbaz = meta.props.find(prop => prop.name === 'xbaz');

		const hello = meta.props.find(prop => prop.name === 'hello');
		const numberOrStringProp = meta.props.find(prop => prop.name === 'numberOrStringProp');
		const arrayProps = meta.props.find(prop => prop.name === 'arrayProps');

		expect(foo).toBeDefined();
		expect(foo?.default).toBeUndefined();
		expect(foo?.type).toEqual('string');
		expect(foo?.required).toBeTruthy();

		expect(bar).toBeDefined();
		expect(bar?.default).toBe('"BAR"');
		expect(bar?.type).toEqual('string | undefined');
		expect(bar?.required).toBeFalsy();

		expect(baz).toBeDefined();
		expect(baz?.default).toBeUndefined();
		expect(baz?.type).toEqual('string | undefined');
		expect(baz?.required).toBeFalsy();

		expect(xfoo).toBeDefined();
		expect(xfoo?.default).toBeUndefined();
		expect(xfoo?.type).toEqual('string');
		expect(xfoo?.required).toBeTruthy();

		expect(xbar).toBeDefined();
		// expect(xbar?.default).toBe('""'); // @todo should be empty string
		expect(xbar?.type).toEqual('string | undefined');
		expect(xbar?.required).toBeFalsy();

		expect(xbaz).toBeDefined();
		expect(xbaz?.default).toBeUndefined();
		expect(xbaz?.type).toEqual('string | undefined');
		expect(baz?.required).toBeFalsy();

		expect(hello).toBeDefined();
		expect(hello?.default).toEqual('"Hello"');
		expect(hello?.type).toEqual('string | undefined');
		expect(hello?.required).toBeFalsy();

		expect(numberOrStringProp).toBeDefined();
		expect(numberOrStringProp?.default).toEqual('42');
		expect(numberOrStringProp?.type).toEqual('string | number | undefined');
		expect(numberOrStringProp?.required).toBeFalsy();

		expect(arrayProps).toBeDefined();
		// expect(arrayProps?.type).toEqual('unknown[] | undefined'); // @todo should be number[]
		expect(arrayProps?.required).toBeFalsy();
		// expect(arrayProps?.schema).toEqual({
		// 	kind: 'enum',
		// 	type: 'unknown[] | undefined',   // @todo should be number[]
		// 	schema: [
		// 		'undefined',
		// 		{
		// 			kind: 'array',
		// 			type: 'unknown[]',  // @todo should be number[]
		// 			schema: ['unknown'] // @todo should be number[]
		// 		}
		// 	]
		// });
	});

	test('reference-type-events', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-events/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const onFoo = meta.events.find(event => event.name === 'foo');
		const onBar = meta.events.find(event => event.name === 'bar');
		const onBaz = meta.events.find(event => event.name === 'baz');

		expect(onFoo).toBeDefined();
		expect(onFoo?.type).toEqual('[data?: { foo: string; } | undefined]');
		expect(onFoo?.signature).toEqual('(event: "foo", data?: { foo: string; } | undefined): void');
		expect(onFoo?.schema).toEqual([
			{
				kind: 'enum',
				type: '{ foo: string; } | undefined',
				schema: [
					'undefined',
					{
						kind: 'object',
						type: '{ foo: string; }',
						schema: {
							foo: {
								name: 'foo',
								description: '',
								tags: [],
								global: false,
								required: true,
								type: 'string',
								declarations: [],
								schema: 'string'
							}
						}
					}
				],
			}
		]);

		expect(onBar).toBeDefined();
		expect(onBar?.type).toEqual('[value: { arg1: number; arg2?: any; }]');
		expect(onBar?.signature).toEqual('(event: "bar", value: { arg1: number; arg2?: any; }): void');
		expect(onBar?.schema).toEqual([
			{
				kind: 'object',
				type: '{ arg1: number; arg2?: any; }',
				schema: {
					arg1: {
						name: 'arg1',
						description: '',
						tags: [],
						global: false,
						required: true,
						type: 'number',
						declarations: [],
						schema: 'number'
					},
					arg2: {
						name: 'arg2',
						description: '',
						tags: [],
						global: false,
						required: false,
						type: 'any',
						declarations: [],
						schema: 'any'
					},
				}
			}
		]);

		expect(onBaz).toBeDefined();
		expect(onBaz?.type).toEqual('[]');
		expect(onBaz?.signature).toEqual('(event: "baz"): void');
		expect(onBaz?.schema).toEqual([]);
	});

	test('reference-type-events for generic', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Function);

		const onBar = meta.events.find(event => event.name === 'bar');

		expect(onBar).toBeDefined();
		expect(onBar?.type).toEqual('number');
		expect(onBar?.signature).toEqual('(e: "bar", data: number): void');
	});

	test('template-slots', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/template-slots/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'named-slot'
			&& slot.type === '{ str: string; }'
		);
		const c = meta.slots.find(slot =>
			slot.name === 'vbind'
			&& slot.type === '{ num: number; str: string; }'
		);
		const d = meta.slots.find(slot =>
			slot.name === 'no-bind'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
		expect(d).toBeDefined();
	});

	test('defineSlots', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/template-slots/component-define-slots.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'named-slot'
			&& slot.type === '{ str: string; }'
		);
		const c = meta.slots.find(slot =>
			slot.name === 'vbind'
			&& slot.type === '{ num: number; str: string; }'
		);
		const d = meta.slots.find(slot =>
			slot.name === 'no-bind'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
		expect(d).toBeDefined();
	});

	test('template-slots for generic', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/generic/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Function);

		expect(meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ foo: number; }'
		)).toBeDefined();
	});

	test('template-slots without a script block', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/template-slots/component-no-script.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'named-slot'
			&& slot.type === '{ str: string; }'
		);
		const c = meta.slots.find(slot =>
			slot.name === 'vbind'
			&& slot.type === '{ num: number; str: string; }'
		);
		const d = meta.slots.find(slot =>
			slot.name === 'no-bind'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
		expect(d).toBeDefined();
	});

	test('class-slots', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/class-slots/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.type === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'foo'
			&& slot.type === '{ str: string; }'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('exposed', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/reference-type-exposed/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const counter = meta.exposed.find(exposed =>
			exposed.name === 'counter'
			&& exposed.type === 'string'
			&& exposed.description === 'a counter string'
		);

		expect(counter).toBeDefined();
	});

	test('ts-component', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-component/component.ts');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('emits-generic', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/events/component-generic.vue');
		const meta = checker.getComponentMeta(componentPath);
		const foo = meta.events.find(event => event.name === 'foo');

		expect(foo?.description).toBe('Emitted when foo...');
	});

	// Wait for https://github.com/vuejs/core/pull/10801
	test.skip('emits-class', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/events/component-class.vue');
		const meta = checker.getComponentMeta(componentPath);
		const foo = meta.events.find(event => event.name === 'foo');

		expect(foo?.description).toBe('Emitted when foo...');
	});

	test('ts-named-exports', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-named-export/component.ts');
		const exportNames = checker.getExportNames(componentPath);
		const Foo = checker.getComponentMeta(componentPath, 'Foo');
		const Bar = checker.getComponentMeta(componentPath, 'Bar');

		expect(Foo.type).toEqual(TypeMeta.Class);
		expect(Bar.type).toEqual(TypeMeta.Class);
		expect(exportNames).toEqual(['Foo', 'Bar']);

		const a = Foo.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
		);
		const b = Bar.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});

	test('options-api', () => {

		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/options-api/component.ts');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		// const submitEvent = meta.events.find(evt => evt.name === 'submit');

		// expect(submitEvent).toBeDefined();
		// expect(submitEvent?.schema).toEqual(expect.arrayContaining([{
		// 	kind: 'object',
		// 	schema: {
		// 		email: {
		// 			description: 'email of user',
		// 			name: 'email',
		// 			required: true,
		// 			schema: 'string',
		// 			tags: [],
		// 			type: 'string'
		// 		},
		// 		password: {
		// 			description: 'password of same user',
		// 			name: 'password',
		// 			required: true,
		// 			schema: 'string',
		// 			tags: [],
		// 			type: 'string'
		// 		}
		// 	},
		// 	type: 'SubmitPayload'
		// }]));

		const propNumberDefault = meta.props.find(prop => prop.name === 'numberDefault');

		// expect(propNumberDefault).toBeDefined();
		// expect(propNumberDefault?.type).toEqual('number | undefined');
		// expect(propNumberDefault?.schema).toEqual({
		// 	kind: 'enum',
		// 	schema: ['undefined', 'number'],
		// 	type: 'number | undefined'
		// });
		expect(propNumberDefault?.default).toEqual(`42`);

		const propObjectDefault = meta.props.find(prop => prop.name === 'objectDefault');

		expect(propObjectDefault).toBeDefined();
		expect(propObjectDefault?.default).toEqual(`{\n    foo: "bar"\n}`);

		const propArrayDefault = meta.props.find(prop => prop.name === 'arrayDefault');

		expect(propArrayDefault).toBeDefined();
		expect(propArrayDefault?.default).toEqual(`[1, 2, 3]`);
	});

	test('non-component', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/non-component/component.ts');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Unknown);
	});

	test('ts-component.tsx', () => {
		const componentPath = path.resolve(__dirname, '../../../test-workspace/component-meta/ts-component/component.tsx');
		const meta = checker.getComponentMeta(componentPath);

		expect(meta.type).toEqual(TypeMeta.Class);

		const a = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
		);
		const b = meta.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
			&& prop.type === 'number | undefined'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});
});

const checkerOptions: MetaCheckerOptions = {
	forceUseTs: true,
	noDeclarations: true,
	schema: { ignore: ['MyIgnoredNestedProps'] },
	printer: { newLine: 1 },
};
const tsconfigChecker = createChecker(
	path.resolve(__dirname, '../../../test-workspace/component-meta/tsconfig.json'),
	checkerOptions
);
const noTsConfigChecker = createCheckerByJson(
	path.resolve(__dirname, '../../../test-workspace/component-meta'),
	{
		"extends": "../tsconfig.base.json",
		"include": [
			"**/*",
		],
	},
	checkerOptions
);

worker(tsconfigChecker, true);
worker(noTsConfigChecker, false);
