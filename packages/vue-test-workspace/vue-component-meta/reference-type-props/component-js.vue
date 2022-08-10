<script lang="ts">
import { defineComponent } from 'vue'
import { StringEmpty, StringRequired, StringUndefined } from './my-props';

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
	},
	xfoo: StringRequired,
	xbar: StringEmpty,
	xbaz: StringUndefined,
  }
})
</script>
