<script lang="ts">
import { defineComponent } from 'vue';
import MyList from './MyList.vue';

export default defineComponent({
  components: {
    MyList, // <-- error: No overload matches this call
  },
});
</script>
