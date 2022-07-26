import * as path from 'path';
import { describe, expect, it } from 'vitest';
import * as metaChecker from '..';

describe(`vue-component-meta`, () => {

	const tsconfigPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/tsconfig.json');
	const checker = metaChecker.createComponentMetaChecker(tsconfigPath);

	it('reference-type-props', () => {

		const componentPath = path.resolve(__dirname, '../../vue-test-workspace/vue-component-meta/reference-type-props/component.vue');
		const meta = checker.getComponentMeta(componentPath);

		const foo = meta.props.find(prop =>
			prop.name === 'foo'
			&& prop.required === true
			&& prop.type === 'string'
			&& prop.description === 'string foo'
		);
		const bar = meta.props.find(prop =>
			prop.name === 'bar'
			&& prop.required === false
			&& prop.type === 'number | undefined'
			&& prop.description === 'optional number bar'
		);
		const baz = meta.props.find(prop =>
			prop.name === 'baz'
			&& prop.required === true
			&& prop.type === 'string[]'
			&& prop.description === 'string array baz'
		);
		const union = meta.props.find(prop =>
			prop.name === 'union'
			&& prop.required === true
			&& prop.type === 'string | number'
			&& prop.description === 'required union type'
		);
		const unionOptional = meta.props.find(prop =>
			prop.name === 'unionOptional'
			&& prop.required === false
			&& prop.type === 'string | number | undefined'
			&& prop.description === 'optional union type'
		);
		const nested = meta.props.find(prop =>
			prop.name === 'nested'
			&& prop.required === true
			&& prop.type === 'MyNestedProps'
			&& prop.description === 'required nested object'
		);
		const nestedIntersection = meta.props.find(prop =>
			prop.name === 'nestedIntersection'
			&& prop.required === true
			&& prop.type === 'MyNestedProps & { additionalProp: string; }'
			&& prop.description === 'required nested object with intersection'
		);
		const nestedOptional = meta.props.find(prop =>
			prop.name === 'nestedOptional'
			&& prop.required === false
			&& prop.type === 'MyNestedProps | undefined'
			&& prop.description === 'optional nested object'
		);
		const array = meta.props.find(prop =>
			prop.name === 'array'
			&& prop.required === true
			&& prop.type === 'MyNestedProps[]'
			&& prop.description === 'required array object'
		);
		const arrayOptional = meta.props.find(prop =>
			prop.name === 'arrayOptional'
			&& prop.required === false
			&& prop.type === 'MyNestedProps[] | undefined'
			&& prop.description === 'optional array object'
		);
		const enumValue = meta.props.find(prop =>
			prop.name === 'enumValue'
			&& prop.required === true
			&& prop.type === 'MyEnum'
			&& prop.description === 'enum value'
		);
		const literalFromContext = meta.props.find(prop =>
			prop.name === 'literalFromContext'
			&& prop.required === true
			&& prop.type === '"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"'
			&& prop.description === 'literal type alias that require context'
		);

		expect(foo).toBeDefined();
		expect(foo.schema).toEqual('string')

		expect(bar).toBeDefined();
		expect(bar.schema).toEqual({ 
			kind: 'enum',
			type: 'number | undefined',
			schema: ['undefined', 'number']
		})

		expect(baz).toBeDefined();
		expect(baz.schema).toEqual({ 
			kind: 'array',
      type: 'string[]',
      schema: ['string']
		})

		expect(union).toBeDefined();
		expect(union.schema).toEqual({ 
			kind: 'enum',
			type: 'string | number',
			schema: ['string', 'number']
		})

		expect(unionOptional).toBeDefined();
		expect(unionOptional.schema).toEqual({ 
			kind: 'enum',
			type: 'string | number | undefined',
			schema: ['undefined', 'string', 'number']
		})

		expect(nested).toBeDefined();
		expect(nested.schema).toEqual({ 
			kind: 'object',
			type: 'MyNestedProps',
			schema: {
				nestedProp: {
          name: 'nestedProp',
          description: 'nested prop documentation',
          required: true,
          type: 'string',
          schema: 'string'
        }
			}
		})

		expect(nestedIntersection).toBeDefined();
		expect(nestedIntersection.schema).toEqual({ 
			kind: 'object',
			type: 'MyNestedProps & { additionalProp: string; }',
			schema: {
				nestedProp: {
          name: 'nestedProp',
          description: 'nested prop documentation',
          required: true,
          type: 'string',
          schema: 'string'
        },
        additionalProp: {
          name: 'additionalProp',
          description: 'required additional property',
          required: true,
          type: 'string',
          schema: 'string'
        }
			}
		})

		expect(nestedOptional).toBeDefined();
		expect(nestedOptional.schema).toEqual({ 
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
							required: true,
							type: 'string',
							schema: 'string'
						}
					}
				}
			]
		})

		expect(array).toBeDefined();
		expect(array.schema).toEqual({ 
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
              required: true,
              type: 'string',
              schema: 'string'
            }
          }
        }
      ]
		})

		expect(arrayOptional).toBeDefined();
		expect(arrayOptional.schema).toEqual({ 
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
		expect(enumValue.schema).toEqual({ 
			kind: 'enum',
      type: 'MyEnum',
      schema: [ 'MyEnum.Small', 'MyEnum.Medium', 'MyEnum.Large' ]
		})

		expect(literalFromContext).toBeDefined();
		expect(literalFromContext.schema).toEqual({ 
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
