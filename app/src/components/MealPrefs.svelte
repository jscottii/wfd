<script>
  import { app, saveSettings, toast } from '../lib/db.svelte.js';
  import { DIETS, HEALTH_DIETS, ALLERGENS } from '../lib/diet.js';
  // diets, allergies and foods to avoid — saved as you tap
  let { compact = false } = $props();
  let diets = $state([...(app.settings.diets || [])]), allergies = $state([...(app.settings.allergies || [])]), avoid = $state(app.settings.avoid || '');
  const flip = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  async function save(patch, msg) { try { await saveSettings(patch); if (msg) toast(msg); } catch (e) { toast(e.message); } }
</script>

<div>
  <p class="small" style="margin:0 0 4px"><b>Meal preferences</b></p>
  <div class="row" style="gap:4px">{#each DIETS as d}<button class="chip" class:on={diets.includes(d)} onclick={() => { diets = flip(diets, d); save({ diets }); }}>{diets.includes(d) ? '✓ ' : ''}{d}</button>{/each}</div>
  <p class="small" style="margin:10px 0 4px"><b>Dietary needs</b></p>
  <div class="row" style="gap:4px">{#each HEALTH_DIETS as d}<button class="chip" class:on={diets.includes(d)} onclick={() => { diets = flip(diets, d); save({ diets }); }}>{diets.includes(d) ? '✓ ' : ''}{d}</button>{/each}</div>
  <p class="note small" style="margin:8px 0 0">ℹ️ WFD isn't medical or nutrition advice. It flags recipes by their ingredients only. If you have diabetes, kidney disease, are pregnant, or have any health concern, please talk with a registered dietitian or your doctor.</p>
  <p class="small" style="margin:10px 0 4px"><b>Allergies</b></p>
  <div class="row" style="gap:4px">{#each ALLERGENS as a}<button class="chip allergy" class:on={allergies.includes(a)} onclick={() => { allergies = flip(allergies, a); save({ allergies }); }}>{allergies.includes(a) ? '⚠️ ' : ''}{a}</button>{/each}</div>
  <label class="f" style="margin-top:10px">Anything else to avoid? <span class="small muted">(comma separated)</span>
    <input bind:value={avoid} placeholder="e.g. cilantro, mushrooms, pork" onchange={() => save({ avoid }, '✓ Saved')} /></label>
  {#if !compact}<p class="small muted" style="margin:6px 0 0">Pick for me skips recipes that clash, and saved recipes get a warning. We check ingredient names, so hidden ingredients can slip through — with an allergy, always read the label.</p>{/if}
</div>

<style>.chip.allergy.on { background: #fdecea; border-color: #d9534f; color: #8a1f1b; }</style>
