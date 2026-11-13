<script setup lang="ts">
/**
 * This is a model
 */
defineModel<string>({ default: 'default value' })

withDefaults(defineProps<{
  /**
   * This is a requird prop
   */
  requiredProp: string

  /**
   * With some markdown
   *
   * # Who puts a title in a jsdoc comment?
   *
   * > This is a blockquote
   *
   * - This is a list item
   * - This is another list item
   *
   * ```ts
   * const foo: string = 'bar'
   * ```
   */
  withMarkdown?: string

  /**
   * @deprecated This prop is deprecated and should not be used
   */
  deprecatedProp?: string
}>(), {
  withMarkdown: 'and default value',
})

defineEmits<{
  /**
   * This is a custom event
   */
  customEvent: []

  /**
   * This is an event with a payload
   */
  eventWithPayload: [payload: string, payload2: number]
}>()

defineSlots<{
  /**
   * Default slot with props
   */
  default(props: { foo: string }): any
}>()

defineExpose({
  /**
   * This is a method that can be called from the parent component
   */
  exposedMethod() { },
})
</script>
