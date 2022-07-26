export interface MyNestedProps {
	/**
	 * nested prop documentation
	 */
	nestedProp: string;
}

enum MyEnum {
  Small,
  Medium,
  Large,
}

const categories = [
  'Uncategorized',
  'Content',
  'Interaction',
  'Display',
  'Forms',
  'Addons',
] as const

type MyCategories = typeof categories[number]

export interface MyProps {
	/**
	 * string foo
	 */
	foo: string,
	/**
	 * optional number bar
	 */
	bar?: number,
	/**
	 * string array baz
	 */
	baz: string[],
	/**
	 * required union type
	 */
	union: string | number,
	/**
	 * optional union type
	 */
	unionOptional?: string | number,
	/**
	 * required nested object
	 */
	nested: MyNestedProps,
	/**
	 * required nested object with intersection
	 */
	nestedIntersection: MyNestedProps & {
		/**
		 * required additional property
		 */
		additionalProp: string;
	},
	/**
	 * optional nested object
	 */
	nestedOptional?: MyNestedProps,
	/**
	 * required array object
	 */
	array: MyNestedProps[],
	/**
	 * optional array object
	 */
	arrayOptional?: MyNestedProps[],
	/**
	 * enum value
	 */
	enumValue: MyEnum,
	/**
	 * literal type alias that require context
	 */
	 literalFromContext: MyCategories,
}
