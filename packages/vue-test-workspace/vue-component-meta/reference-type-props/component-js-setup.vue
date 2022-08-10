<script lang="ts" setup>
import { StringEmpty, StringRequired, StringUndefined } from './my-props';

defineProps({
  foo: {
    type: String,
    required: true
  },
  bar: {
    type: String,
    default: 'BAR'
  },
  baz: {
    type: String
  },
  xfoo: StringRequired,
  xbar: StringEmpty,
  xbaz: StringUndefined,
  /**
   * The hello property.
   *
   * @since v1.0.0
   */
  hello: {
    type: String,
    default: 'Hello'
  },
  numberOrStringProp: {
    type: [Number, String],
    default: 42
  },
  arrayProps: {
    type: Array,
    default: () => [42, 43, 44]
  }
})
</script>
