<script setup lang="ts">
import { bootstrapSession } from "@/state/session";

onLaunch(() => {
  void bootstrapSession();
});
</script>

<style lang="scss">
@use "@wot-ui/ui/styles/theme/index.scss" as *;

/*
 * Keep the native UniApp button baseline identical across H5 and Mini Program.
 * H5 renders <button> as <uni-button>, whose default block layout and pseudo
 * border otherwise shift labels vertically and leave stray divider lines.
 */
button,
uni-button {
  box-sizing: border-box;
  display: flex !important;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding-top: 0;
  padding-bottom: 0;
  border: 0;
  background: transparent;
  color: inherit;
  line-height: normal;
}

button::after,
uni-button::after {
  border: 0 !important;
}

/* #ifdef H5 */
.pc-platform-viewport {
  height: 100vh;
}

uni-navigator > .navigator-wrap {
  display: flex;
  flex: 1 1 auto;
  align-items: inherit;
  justify-content: inherit;
  min-width: 0;
  gap: inherit;
  color: inherit;
  text-decoration: none;
}

@supports (height: 100dvh) {
  .pc-platform-viewport {
    height: 100dvh;
  }
}
/* #endif */
</style>
