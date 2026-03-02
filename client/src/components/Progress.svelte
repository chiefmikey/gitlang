<script>
  import { onMount } from 'svelte';
  import { cubicInOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { derived } from 'svelte/store';

  export let dat;
  export let index;
  export let count1;
  export let isDone;
  export let breakdown;

  let expanded = false;

  const finalPercent = Number((dat.percent * 100).toFixed(2));
  const speed = (index / 8) * 1000 + 222;

  const progress = tweened(0, {
    duration: 1400,
    easing: cubicInOut,
  });

  const progress2 = tweened(0, {
    duration: 1400,
    easing: cubicInOut,
  });

  const progress2Fixed = derived(progress2, $progress2 => $progress2.toFixed(2), 0);

  const setProgress = (perc) => {
    if (perc < 0.003) {
      return 0.003;
    }
    return perc;
  };

  const toggleBreakdown = () => {
    if (breakdown && breakdown.length > 1) {
      expanded = !expanded;
    }
  };

  onMount(() => {
    setTimeout(() => ($progress = setProgress(dat.percent)), speed);
    setTimeout(() => {
      $progress2 = finalPercent;
      if (index === count1 - 1) {
        isDone();
      }
    }, speed);
    setTimeout(() => {
      const prog = document.querySelector(`#bar${index}`);
      const info = document.querySelector(`.info${index}`);
      prog.style.setProperty(
        '--c',
        `rgb(${255 - (255 / count1) * index}, ${
          160 - (160 / count1) * index
        }, ${203})`,
      );

      info.style.color = `rgb(${275 - (225 / count1) * index}, ${
        275 - (225 / count1) * index
      }, ${275 - (225 / count1) * index})`;
    }, 0);
  });
</script>

<template>
  <tr
    id="row{index}"
    class="info{index}"
    style:animation="fade-in-height .5s ease-out {index / 8}s forwards"
  >
    <td class="name">
      {#if breakdown && breakdown.length > 1}
        <button class="lang-btn" on:click={toggleBreakdown}>{dat.name}</button>
      {:else}
        <span>{dat.name}</span>
      {/if}
    </td>
    <td class="percent">
      <span>{$progress2Fixed}%</span>
    </td>
    <td class="bar">
      <progress
        id="bar{index}"
        value={$progress}
      ></progress>
    </td>
  </tr>
  {#if expanded && breakdown}
    {#each breakdown as item}
      <tr class="breakdown-row">
        <td class="breakdown-repo" colspan="3">
          <span class="breakdown-name">{item.repo}</span>
          <span class="breakdown-percent">{(item.percent * 100).toFixed(1)}%</span>
        </td>
      </tr>
    {/each}
  {/if}
</template>

<style>
progress {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  height: 104%;
  background-color: transparent;
}

progress::-moz-progress-bar {
  background-color: transparent;
}

progress::-webkit-progress-bar {
  background-color: transparent;
}

progress::-webkit-progress-value {
  background: var(--c, #fe9fc9);
}

.name {
  width: 100%;
  text-align: left;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  vertical-align: bottom;
}

.name span,
.name .lang-btn {
  font-size: 16px;
  padding: 0 5px 0 10px;
  font-weight: 600;
}

.name .lang-btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
  width: auto;
  height: auto;
  text-align: left;
}

.name .lang-btn:hover {
  color: #fe9fc9;
}

.bar {
  padding: 0;
  height: 50px;
  float: none;
}

.percent {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  height: 18px;
  padding: 0 10px 0 10px;
  vertical-align: bottom;
}

.percent span {
  font-size: 12px;
  padding: 0;
}

.breakdown-row {
  height: auto !important;
  opacity: 1;
  animation: none !important;
}

.breakdown-repo {
  display: flex;
  justify-content: space-between;
  padding: 2px 15px 2px 25px;
  font-size: 11px;
  opacity: 0.7;
}

.breakdown-name {
  font-size: 11px;
  padding: 0;
}

.breakdown-percent {
  font-size: 10px;
  padding: 0;
  opacity: 0.8;
}
</style>
