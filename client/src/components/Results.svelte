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
  export let isDone;
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
    {#if data}
      <table>
        <tbody>
          {#if data.length > 0}
            {#each data as dat, index (index)}
              <Progress
                {count1}
                {dat}
                {index}
                {isDone}
              />
            {/each}
          {:else}
            <h4 class="error">{ERROR.NOT_FOUND}</h4>
          {/if}
        </tbody>
      </table>
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

  .error {
    padding: 2rem;
  }
</style>
