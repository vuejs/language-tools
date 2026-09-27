import { defineComponent } from 'vue';

export default defineComponent({
	props: {
		label: String,
	},
	emits: ['open', 'close'],
});
