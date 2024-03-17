<script>
  import { onMount } from 'svelte';

  import handler from '../../lib/index';

  import Card from './Card.svelte';
  import Input from './Input.svelte';
  import Progress from './Progress.svelte';
  import ScrollTop from './ScrollTop.svelte';

  let input = '';
  let current = '';
  let data;
  let count1;
  let count2;
  let done = false;

  onMount(async () => {
    const windowOwner = `${window.location.pathname
      .split('/')
      .slice(1, 3)
      .join('/')}`;
    if (windowOwner && windowOwner.length > 0) {
      input = windowOwner;
      await submit('window');
    }
  });

  const isDone = () => {
    done = true;
  };

  const getData = async (input) => {
    try {
      const response = await handler(input);
      return response.data;
    } catch (error) {
      return error;
    }
  };

  const submit = async (event) => {
    try {
      if (
        (event === 'window' || !event.key || event.key === 'Enter') &&
          input.length > 0
      ) {
        if (event !== 'window') {
          event.target.blur();
        }
        done = false;
        data = undefined;
        count1 = undefined;
        count2 = undefined;
        current = input.replaceAll(' ', '');
        input = '';
        const collectData = [];
        const allData = await getData(current);
        if (allData.allNames) {
          count2 = allData.allNames.length;
        }
        if (allData.space) {
          const keys = Object.keys(allData.space);
          count1 = keys.length;
          for (const key of keys) {
            collectData.push({ name: key, percent: allData.space[key] });
          }
          collectData.sort((a, b) => b.percent - a.percent);
          data = collectData;
        }
      }
      return true;
    } catch (error) {
      return error;
    }
  };
</script>

<template>
  <img
    class="logo"
    alt="GITLANG LOGO"
    src="./assets/img/gitlang.svg"
  />
  <h5>
    View language usage per repo<br />or total by username
  </h5>
  <Input
    {submit}
    bind:input
  />
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
        <tbody id="tbody">
          {#if data.length > 0}
            {#each data as dat, index}
              <Progress
                {count1}
                {dat}
                {index}
                {isDone}
              />
            {/each}
          {:else}
            <h4 class="error">User Not Found</h4>
          {/if}
        </tbody>
      </table>
    {/if}
  </div>
  {#if done}
    <ScrollTop />
  {/if}
  <h6 class="footer">
    <a
      href="https://github.com/chiefmikey"
      rel="noopener noreferrer"
      target="_blank"
      >made by Chief Mikey</a
    >
  </h6>
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

  .logo {
    pointer-events: none;
    user-select: none;
    width: 75%;
    padding: 12% 5% 5%;
  }

  .footer {
    padding-bottom: 2rem;
    color: #fe9fc9;
  }

  .error {
    padding: 2rem;
  }
</style>
