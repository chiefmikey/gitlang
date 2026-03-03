<script context="module">
  import { ERROR } from '../../lib/data/constants';

  import Card from './Card.svelte';
  import Progress from './Progress.svelte';
</script>

<script>
  export let current;
  export let data;
  export let count1;
  export let count2;
  export let errorMessage;
  export let isDone;
  export let langBreakdown;

  let expandedLang = null;

  const onToggleLang = (name) => {
    expandedLang = expandedLang === name ? null : name;
  };
</script>

<template>
  <div class="results">
    {#if current}
      <Card
        {count1}
        {count2}
        {current}
        {data}
      />
    {/if}
    {#if errorMessage}
      <h4 class="error">{errorMessage}</h4>
    {:else if data}
      {#if data.length > 0}
        <div class="bars">
          {#each data as dat, index (index)}
            <Progress
              {count1}
              {dat}
              {index}
              {isDone}
              breakdown={langBreakdown ? langBreakdown[dat.name] : undefined}
              {expandedLang}
              {onToggleLang}
            />
          {/each}
        </div>
      {:else}
        <h4 class="error">{ERROR.NOT_FOUND}</h4>
      {/if}
    {/if}
  </div>
</template>

<style>
  .results {
    width: 100%;
    padding: 0 0 10px 0;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .bars {
    width: 100%;
  }

  .error {
    padding: 2rem;
  }
</style>
