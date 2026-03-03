<script>
  import { onMount } from 'svelte';
  import { cubicInOut } from 'svelte/easing';
  import { tweened } from 'svelte/motion';
  import { derived } from 'svelte/store';
  import { slide } from 'svelte/transition';

  export let dat;
  export let index;
  export let count1;
  export let isDone;
  export let breakdown;
  export let expandedLang;
  export let onToggleLang;

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
      onToggleLang(dat.name);
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
  <div
    class="bar-row"
    id="row{index}"
    style:animation="fade-in-height .5s ease-out {index / 8}s forwards"
  >
    <div class="cell">
      <div
        class="bar-fill"
        id="bar{index}"
        style:width="{$progress * 100}%"
      ></div>
      <span class="info info{index}">
        <span class="name">
          {#if breakdown && breakdown.length > 1}
            <button class="lang-btn" on:click={toggleBreakdown}>{dat.name}</button>
          {:else}
            <span>{dat.name}</span>
          {/if}
        </span>
        <span class="percent">
          <span>{$progress2Fixed}%</span>
        </span>
      </span>
    </div>
  </div>
  {#if expandedLang === dat.name && breakdown}
    <div class="breakdown-container" transition:slide={{ duration: 400, easing: cubicInOut }}>
      <div class="breakdown-list">
        {#each breakdown as item, i}
          <div
            class="breakdown-item"
            style:animation="fade-in .3s ease-out {i * 0.04}s both"
          >
            <span class="breakdown-name">{item.repo}</span>
            <span class="breakdown-percent">{(item.percent * 100).toFixed(1)}%</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</template>

<style>
.bar-row {
  width: 100%;
  height: 0;
  overflow: hidden;
  position: relative;
  margin-bottom: -1px;
}

.cell {
  position: relative;
  height: 50px;
  padding: 0;
}

.bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: calc(100% + 1px);
  background: var(--c, #fe9fc9);
}

.info {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.name {
  width: 100%;
  text-align: left;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
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
  text-decoration: none;
  width: auto;
  height: auto;
  text-align: left;
}

.name .lang-btn:hover {
  color: #fe9fc9;
}

.percent {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  height: 18px;
  padding: 0 10px 0 10px;
}

.percent span {
  font-size: 12px;
  padding: 0;
}

.breakdown-container {
  height: auto !important;
  overflow: hidden;
  animation: none !important;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  padding: 2px 15px 2px 25px;
  font-size: 11px;
  opacity: 0;
}

.breakdown-name {
  font-size: 11px;
  padding: 0;
  opacity: 0.7;
}

.breakdown-percent {
  font-size: 10px;
  padding: 0;
  opacity: 0.5;
}
</style>
