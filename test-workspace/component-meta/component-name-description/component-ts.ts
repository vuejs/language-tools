import { defineComponent } from 'vue';

/**
 * TypeScript component with description
 */
export default defineComponent({
	name: 'TsComponent',
	props: {
		/**
		 * The message prop
		 */
		message: {
			type: String,
			required: true,
		},
	},
});
