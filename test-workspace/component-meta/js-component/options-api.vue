<script>
export default {
	props: {
		foo: String,
		bar: { type: Number, required: true },
	},
	emits: ['close'],
};
</script>
