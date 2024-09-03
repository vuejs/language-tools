<script setup lang="ts" generic="T">
defineProps<{
  /** jsdoc test: foo */
  foo: number;
  /** jsdoc test: book
   * @param {string} title - The title of the book.
   * @param {string} author - The author of the book.
   */
  book?: { title: string; author: string };
}>();
defineEmits<{ (e: 'bar', data: number): void }>();
defineExpose({ baz: {} as number });
defineSlots<{ default?(data: { foo: number }): any }>();
defineModel<string>('title');
</script>
