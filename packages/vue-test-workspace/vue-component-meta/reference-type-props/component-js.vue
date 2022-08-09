<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  props: {
    foo: {
		type: String,
		required: true
	},
    bar: {
		type: String,
		default: 'BAR',
	},
    baz: {
		type: String
	}
  }
})
</script>
