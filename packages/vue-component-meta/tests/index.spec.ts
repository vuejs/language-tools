import * as path from 'path';
import { describe, expect, it } from 'vitest';
import * as metaChecker from '..';

describe.only(`vue-component-meta`, () => {

	const tsconfigPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/tsconfig.json');
	const checker = metaChecker.createComponentMetaChecker(tsconfigPath);

	it('reference-type-props', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/reference-type-props/component.vue');
		const meta = checker.getComponentMeta(componentPath);

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
		const onEvent = meta.props.find(prop => prop.name === 'onEvent');

		expect(foo).toBeDefined();
		expect(foo?.required).toBeTruthy()
		expect(foo?.type).toEqual('string')
		expect(foo?.schema).toEqual('string')
		expect(foo?.description).toEqual('string foo')
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
		])

		expect(bar).toBeDefined();
		expect(bar?.required).toBeFalsy()
		expect(bar?.type).toEqual('number | undefined')
		expect(bar?.description).toEqual('optional number bar')
		expect(bar?.schema).toEqual({ 
			kind: 'enum',
			type: 'number | undefined',
			schema: ['undefined', 'number']
		})

		expect(baz).toBeDefined();
		expect(baz?.required).toBeTruthy()
		expect(baz?.type).toEqual('string[]')
		expect(baz?.description).toEqual('string array baz')
		expect(baz?.schema).toEqual({ 
			kind: 'array',
      type: 'string[]',
      schema: ['string']
		})

		expect(union).toBeDefined();
		expect(union?.required).toBeTruthy()
		expect(union?.type).toEqual('string | number')
		expect(union?.description).toEqual('required union type')
		expect(union?.schema).toEqual({ 
			kind: 'enum',
			type: 'string | number',
			schema: ['string', 'number']
		})

		expect(unionOptional).toBeDefined();
		expect(unionOptional?.required).toBeFalsy()
		expect(unionOptional?.type).toEqual('string | number | undefined')
		expect(unionOptional?.description).toEqual('optional union type')
		expect(unionOptional?.schema).toEqual({ 
			kind: 'enum',
			type: 'string | number | undefined',
			schema: ['undefined', 'string', 'number']
		})

		expect(nested).toBeDefined();
		expect(nested?.required).toBeTruthy()
		expect(nested?.type).toEqual('MyNestedProps')
		expect(nested?.description).toEqual('required nested object')
		expect(nested?.schema).toEqual({ 
			kind: 'object',
			type: 'MyNestedProps',
			schema: {
				nestedProp: {
          name: 'nestedProp',
          description: 'nested prop documentation',
					tags: [],
          required: true,
          type: 'string',
          schema: 'string'
        }
			}
		})

		expect(nestedIntersection).toBeDefined();
		expect(nestedIntersection?.required).toBeTruthy()
		expect(nestedIntersection?.type).toEqual('MyNestedProps & { additionalProp: string; }')
		expect(nestedIntersection?.description).toEqual('required nested object with intersection')
		expect(nestedIntersection?.schema).toEqual({ 
			kind: 'object',
			type: 'MyNestedProps & { additionalProp: string; }',
			schema: {
				nestedProp: {
          name: 'nestedProp',
          description: 'nested prop documentation',
					tags: [],
          required: true,
          type: 'string',
          schema: 'string'
        },
        additionalProp: {
          name: 'additionalProp',
          description: 'required additional property',
					tags: [],
          required: true,
          type: 'string',
          schema: 'string'
        }
			}
		})

		expect(nestedOptional).toBeDefined();
		expect(nestedOptional?.required).toBeFalsy()
		expect(nestedOptional?.type).toEqual('MyNestedProps | undefined')
		expect(nestedOptional?.description).toEqual('optional nested object')
		expect(nestedOptional?.schema).toEqual({ 
			kind: 'enum',
			type: 'MyNestedProps | undefined',
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
							required: true,
							type: 'string',
							schema: 'string'
						}
					}
				}
			]
		})

		expect(array).toBeDefined();
		expect(array?.required).toBeTruthy()
		expect(array?.type).toEqual('MyNestedProps[]')
		expect(array?.description).toEqual('required array object')
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
              required: true,
              type: 'string',
              schema: 'string'
            }
          }
        }
      ]
		})

		expect(arrayOptional).toBeDefined();
		expect(arrayOptional?.required).toBeFalsy()
		expect(arrayOptional?.type).toEqual('MyNestedProps[] | undefined')
		expect(arrayOptional?.description).toEqual('optional array object')
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
									required: true,
									type: 'string',
									schema: 'string'
								}
							}
						}
					]
				}
			]
		})

		expect(enumValue).toBeDefined();
		expect(enumValue?.required).toBeTruthy()
		expect(enumValue?.type).toEqual('MyEnum')
		expect(enumValue?.description).toEqual('enum value')
		expect(enumValue?.schema).toEqual({ 
			kind: 'enum',
      type: 'MyEnum',
      schema: [ 'MyEnum.Small', 'MyEnum.Medium', 'MyEnum.Large' ]
		})

		expect(literalFromContext).toBeDefined();
		expect(literalFromContext?.required).toBeTruthy()
		expect(literalFromContext?.type).toEqual('"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"')
		expect(literalFromContext?.description).toEqual('literal type alias that require context')
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
		})
		
		expect(onEvent).toBeDefined();
		// expect(onEvent?.required).toBeFalsy()
		expect(onEvent?.type).toEqual('((...args: any[]) => any) | undefined')
		expect(onEvent?.schema).toEqual({
			kind: 'enum',
			type: '((...args: any[]) => any) | undefined',
			schema: [
        'undefined',
				{
					kind: 'event',
					type: '(...args: any[]): any',
					schema: [
						{
							kind: 'array',
							type: 'any',
							schema: [],
						}
					]
				}
			]
		})
	});

	it('reference-type-events', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/reference-type-events/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const a = meta.events.find(event =>
			event.name === 'foo'
			&& event.parametersType === '[data: { foo: string; }]'
			&& event.parameters.length === 1
			&& event.parameters[0].type === '{ foo: string; }'
			// && event.parameters[0].name === 'data'
			// && event.parameters[0].isOptional === false
		);
		const b = meta.events.find(event =>
			event.name === 'bar'
			&& event.parametersType === '[arg1: number, arg2?: any]'
			&& event.parameters.length === 2
			&& event.parameters[0].type === 'number'
			// && event.parameters[0].name === 'arg1'
			// && event.parameters[0].isOptional === false
			&& event.parameters[1].type === 'any'
			// && event.parameters[1].name === 'arg2'
			// && event.parameters[1].isOptional === true
		);
		const c = meta.events.find(event =>
			event.name === 'baz'
			&& event.parametersType === '[]'
			&& event.parameters.length === 0
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
	});

	it('template-slots', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/template-slots/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.propsType === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'named-slot'
			&& slot.propsType === '{ str: string; }'
		);
		const c = meta.slots.find(slot =>
			slot.name === 'vbind'
			&& slot.propsType === '{ num: number; str: string; }'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
		expect(c).toBeDefined();
	});

	it('class-slots', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/class-slots/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const a = meta.slots.find(slot =>
			slot.name === 'default'
			&& slot.propsType === '{ num: number; }'
		);
		const b = meta.slots.find(slot =>
			slot.name === 'foo'
			&& slot.propsType === '{ str: string; }'
		);

		expect(a).toBeDefined();
		expect(b).toBeDefined();
	});
});
