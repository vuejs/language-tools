import { defineComponent } from 'vue';

interface SubmitPayload {
	/**
	 * email of user
	 */
	email: string;
	/**
	 * password of same user
	 */
	password: string;
}

export default defineComponent({
	emits: {
		// Validate submit event
		submit: ({ email, password }: SubmitPayload) => {
			if (email && password) {
				return true;
			} else {
				console.warn('Invalid submit event payload!');
				return false;
			}
		}
	},
	props: {
		/**
		 * Default number
		 */
		numberDefault: {
			type: Number,
			default: 42
		},
		/**
		 * Default function Object
		 */
		objectDefault: {
			type: Object,
			default: () => ({
				foo: 'bar'
			})
		},
		/**
		 * Default function Array
		 */
		arrayDefault: {
			type: Array,
			default: () => [1, 2, 3]
		},
		/**
		 * Default function more complex
		 */
		complexDefault: {
			type: Array,
			default: (props: any) => {
				if (props.arrayDefault.length > props.numberDefault) {
					return [];
				} else {
					return undefined;
				}
			}
		},
	},
});
