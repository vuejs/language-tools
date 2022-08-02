<script setup>
defineProps({
  /**
   * Required foo property
   */
  foo: {
    type: String,
		required: true,
  },
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
