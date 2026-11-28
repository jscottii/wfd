<script>
  // A few quick "tell me about yourself" questions for new accounts and guests. Every answer sets a setting;
  // everything can be skipped and changed later in More → Settings.
  import { app, saveSettings, saveMe, myName, setHouseholdSize, track, toast } from '../lib/db.svelte.js';
  import MealPrefs from './MealPrefs.svelte';
  let { onclose } = $props();
  const s = app.settings;
  let step = $state(0), busy = $state(false);
  let name = $state(myName());
  let detail = $state(s.audience === 'group' ? 'group' : 'household');
  let repeat = $state(Number(s.repeat) || 2);
  let goals = $state([...(s.goals || [])]);
  let kcal = $state(s.calorieGoal || ''), protein = $state(s.proteinGoal || '');
  let people = $state(Number(s.householdSize) || 2);
  let cook = $state(s.cookStyle || 'some'), budget = $state(s.weeklyBudget || '');
  let meals = $state([...(s.planShape?.meals || ['lunch', 'dinner']), ...(s.planShape?.snack ? ['snack'] : [])]);
  const STEPS = 6;
  const tog = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const GOALS = [['money', '💰', 'Save money'], ['time', '⏱️', 'Save time'], ['diet', '🥗', 'I’m on a diet'], ['protein', '💪', 'More protein'], ['restrict', '🚫', 'I have dietary restrictions'], ['picky', '🧒', 'Picky eaters at home']];
  const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];

  async function finish(skipped = false) {
    busy = true;
    try {
      if (!skipped) {
        const mains = meals.filter((m) => m !== 'snack');
        const patch = {
          audience: detail, repeat, goals, picky: goals.includes('picky'), cookStyle: cook, prepStyle: cook === 'batch' ? 'full' : s.prepStyle || 'single', weeklyBudget: +budget > 0 ? Math.round(+budget) : '',
          tripChoice: goals.includes('money') && !goals.includes('time') ? 'cheapest' : goals.includes('time') && !goals.includes('money') ? 'fastest' : 'best',
          householdSize: Math.max(1, Math.min(50, Number(people) || 2)),
          planShape: { ...(s.planShape || {}), meals: mains.length ? mains : ['dinner'], snack: meals.includes('snack') },
          calorieGoal: goals.includes('diet') && +kcal ? +kcal : s.calorieGoal || '',
          proteinGoal: goals.includes('protein') && +protein ? +protein : s.proteinGoal || '',
          calorieAsked: goals.includes('diet') || goals.includes('protein') || s.calorieAsked || false,
        };
        await saveSettings(patch);
        await setHouseholdSize(patch.householdSize).catch(() => {});
      }
      await saveMe({ surveyed: true, ...(name.trim() ? { first_name: name.trim().slice(0, 30) } : {}) });
      track(skipped ? 'welcome_skipped' : 'welcome_done', { step, goals: goals.join(',') });
      if (!skipped) toast(name.trim() ? `✓ Thanks, ${name.trim()}! WFD is set up your way.` : '✓ WFD is set up your way.');
    } catch (e) { toast(e.message); }
    busy = false; onclose();
  }
  const next = () => (step < STEPS - 1 ? step++ : finish());
</script>

<div class="modal-back" role="presentation">
  <div class="modal card nocollapse wel" role="dialog" aria-modal="true" aria-label="Tell us about you">
    <div class="spread"><div class="dots" aria-label="Question {step + 1} of {STEPS}">{#each Array(STEPS) as _, i}<span class:on={i <= step}></span>{/each}</div><button class="quiet small" onclick={() => finish(true)} disabled={busy}>Skip all</button></div>

    {#if step === 0}
      <h2>Welcome to WFD Meals 👋</h2>
      <p class="muted" style="margin-top:0">A few quick questions so we can set things up your way. It takes under a minute.</p>
      <p style="margin:0 0 8px"><b>How much do you want to see?</b></p>
      <div class="opts">
        <button class="opt" class:on={detail === 'household'} onclick={() => (detail = 'household')}><b>🙂 Just tell me what to cook</b><span>Short screens, the essentials.</span></button>
        <button class="opt" class:on={detail === 'group'} onclick={() => (detail = 'group')}><b>📋 I love to see all the details</b><span>Full prep steps, numbers and batch sizes.</span></button>
      </div>
    {:else if step === 1}
      <h2>How do you feel about leftovers?</h2>
      <div class="opts">
        <button class="opt" class:on={repeat === 1} onclick={() => (repeat = 1)}><b>🙅 I hate leftovers</b><span>A different meal every time.</span></button>
        <button class="opt" class:on={repeat === 2} onclick={() => (repeat = 2)}><b>👍 Leftovers once is fine</b><span>Cook once, eat it twice.</span></button>
        <button class="opt" class:on={repeat === 3} onclick={() => (repeat = 3)}><b>🔁 I love eating the same thing most nights</b><span>Bigger batches, up to three times a week.</span></button>
      </div>
    {:else if step === 2}
      <h2>What matters most?</h2>
      <p class="small muted" style="margin-top:0">Pick any.</p>
      <div class="opts two">
        {#each GOALS as [k, ic, label]}<button class="opt" class:on={goals.includes(k)} onclick={() => (goals = tog(goals, k))}><b>{ic} {label}</b></button>{/each}
      </div>
      {#if goals.includes('diet')}<label class="f" style="margin-top:10px">Calories per meal, about <span class="muted small">(optional)</span><input type="number" inputmode="numeric" min="200" max="2000" bind:value={kcal} placeholder="e.g. 500" /></label>{/if}
      {#if goals.includes('protein')}<label class="f">Protein per meal, at least (g) <span class="muted small">(optional)</span><input type="number" inputmode="numeric" min="5" max="150" bind:value={protein} placeholder="e.g. 30" /></label>{/if}
      {#if goals.includes('restrict')}<p class="small" style="margin:10px 0 4px"><b>Which diets or allergies?</b> We'll hide recipes that don't fit.</p><MealPrefs compact />{/if}
      {#if goals.includes('picky')}<p class="small muted" style="margin:10px 0 0">Got it: Pick for me will lean toward familiar, mild dishes and skip spicy or unusual ones.</p>{/if}
    {:else if step === 3}
      <h2>How do you like to cook?</h2>
      <div class="opts">
        <button class="opt" class:on={cook === 'quick'} onclick={() => (cook = 'quick')}><b>⚡ Quick meals, about 30 minutes</b><span>Short recipes on busy nights.</span></button>
        <button class="opt" class:on={cook === 'some'} onclick={() => (cook = 'some')}><b>🍳 Cook a few nights a week</b><span>Normal recipes, leftovers in between.</span></button>
        <button class="opt" class:on={cook === 'batch'} onclick={() => (cook = 'batch')}><b>📦 One big prep day</b><span>Cook it all at once, eat all week.</span></button>
      </div>
      <label class="f" style="margin-top:12px">Grocery budget per week <span class="muted small">(optional)</span>
        <div class="row" style="gap:6px;flex-wrap:nowrap;align-items:center"><b>$</b><input type="number" inputmode="numeric" min="0" step="5" bind:value={budget} placeholder="e.g. 150" style="width:8em" /></div>
      </label>
      <p class="small muted" style="margin:0">We'll show how your plan compares as you pick meals.</p>
    {:else if step === 4}
      <h2>Who are you cooking for?</h2>
      <label class="f">How many people, usually?
        <div class="row" style="gap:6px;flex-wrap:nowrap"><button class="ghost" onclick={() => (people = Math.max(1, people - 1))} aria-label="Fewer">−</button><input type="number" min="1" max="50" bind:value={people} style="width:5em;text-align:center" /><button class="ghost" onclick={() => (people = Math.min(50, people + 1))} aria-label="More">+</button></div>
      </label>
      <p class="small" style="margin:12px 0 4px"><b>Which meals do you want to plan?</b></p>
      <div class="row" style="gap:6px">{#each MEALS as [k, label]}<button class="chip" class:on={meals.includes(k)} onclick={() => (meals = tog(meals, k))}>{meals.includes(k) ? '✓ ' : ''}{label}</button>{/each}</div>
    {:else}
      <h2>Last one: what's your first name?</h2>
      <p class="small muted" style="margin-top:0">So we can say hi. Only you see it.</p>
      <input bind:value={name} maxlength="30" autocomplete="given-name" placeholder="First name" onkeydown={(e) => e.key === 'Enter' && next()} />
    {/if}

    <div class="row" style="margin-top:16px">
      {#if step > 0}<button class="ghost" onclick={() => step--} disabled={busy}>Back</button>{/if}
      <button class="grow" onclick={next} disabled={busy}>{#if busy}<span class="spinner"></span>{/if} {step === STEPS - 1 ? 'Done' : 'Next'}</button>
    </div>
    <p class="small muted" style="margin:10px 0 0;text-align:center">You can change any of this later in More → Settings.</p>
  </div>
</div>

<style>
  .wel { max-width: 480px; }
  .wel h2 { margin: 12px 0 8px; }
  .dots { display: flex; gap: 6px; } .dots span { width: 22px; height: 5px; border-radius: 3px; background: var(--line); } .dots span.on { background: var(--accent); }
  .opts { display: grid; gap: 8px; } .opts.two { grid-template-columns: 1fr 1fr; } .opts.two .opt b { font-size: 14px; }
  .opt { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; background: var(--card); color: var(--ink); border: 1.5px solid var(--line); border-radius: 12px; padding: 12px; font-weight: 400; }
  .opt span { font-size: 13px; color: var(--muted); }
  .opt.on { border-color: var(--accent); background: var(--accent-soft); }
</style>
