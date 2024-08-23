<script setup lang="ts">
defineProps<{
  /** comment from props: foo */
  foo: number;

  /**
   * Represents a book.
   * this is new line?
   * @constructor
   * @param {string} title - The title of the book.
   * @param {string} author - The author of the book.
   */
  book: { title: string; author: string };
}>();
</script>
