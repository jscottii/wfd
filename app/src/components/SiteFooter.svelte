<script>
  // The small links at the bottom of every screen.
  let { page, go } = $props();
  function contact(e) {
    e.preventDefault();
    const scroll = () => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    if (page === 'more') return scroll();
    sessionStorage.setItem('mp-more-tab', 'settings'); go('more'); setTimeout(scroll, 400);
  }
</script>

<p class="small muted site-foot">
  <a href="./privacy.html">Privacy policy</a> · <a href="./support.html">Help</a> · {#if page !== 'login'}<a href="#contact" onclick={contact}>Contact us</a> · <a href="#more" onclick={(e) => { e.preventDefault(); window.dispatchEvent(new Event('wfd-whats-new')); }}>What's new</a> · {/if}WFD v{__APP_VERSION__} <span title="Build date">({__BUILD_DATE__})</span>
</p>

<style>
  .site-foot { text-align: center; margin: 20px 0 8px; line-height: 1.8; }
</style>
