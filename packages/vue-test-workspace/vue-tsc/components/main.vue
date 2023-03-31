<script lang="ts">
import { exactType } from '../shared';
import { defineComponent } from 'vue';
import EmptyScriptSetup from './empty-script-setup.vue';

exactType(EmptyScriptSetup, defineComponent({}));
</script>
