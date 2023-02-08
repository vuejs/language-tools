export interface MyNestedProps {
	/**
	 * nested prop documentation
	 */
	nestedProp: string;
}

export interface MyIgnoredNestedProps {
	nestedProp: string;
}

export interface MyNestedRecursiveProps {
	recursive: MyNestedRecursiveProps
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
] as const;

type MyCategories = typeof categories[number];

export interface MyProps {
	/**
   * string foo
   *
   * @default "rounded"
   * @since v1.0.0
   * @see https://vuejs.org/
   * @example
   * ```vue
   * <template>
   *   <component foo="straight" />
   * </template>
   * ```
	 */
	foo: string,
	/**
	 * optional number bar
	 */
	bar?: number,
	/**
	 * string array baz
	 */
	baz?: string[],
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
	nestedOptional?: MyNestedProps | MyIgnoredNestedProps,
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
	inlined: { foo: string; },
	recursive: MyNestedRecursiveProps
}

export const StringRequired = {
	type: String,
	required: true,
} as const

export const StringEmpty = {
	type: String,
	value: '',
} as const

export const StringUndefined = {
	type: String,
} as const
