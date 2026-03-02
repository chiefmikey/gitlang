<script>
  import { onMount } from 'svelte';

  import handler from '../../lib/index';

  import Footer from './Footer.svelte';
  import Input from './Input.svelte';
  import Results from './Results.svelte';
  import ScrollTop from './ScrollTop.svelte';

  let input = '';
  let current = '';
  let data;
  let langBreakdown;
  let count1;
  let count2;
  let done = false;
  let errorMessage = '';
  let includeForks = false;
  let compareGroups;

  const RANDOM_USERS = [
    'torvalds', 'gaearon', 'sindresorhus', 'tj', 'mrdoob',
    'antirez', 'jakubroztocil', 'jessfraz', 'ThePrimeagen', 'tpope',
    'mitchellh', 'fatih', 'BurntSushi', 'dtolnay', 'matklad',
    'wez', 'sharkdp', 'ogham', 'JakeWharton', 'yyx990803',
    'Rich-Harris', 'getify', 'mpj', 'kentcdodds', 'chrisbiscardi',
    'wesbos', 'benawad', 'rwieruch', 'bradtraversy', 'florinpop17',
  ];

  const randomize = async () => {
    const randomUser = RANDOM_USERS[Math.floor(Math.random() * RANDOM_USERS.length)];
    input = randomUser;
    await submit('window');
  };

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
      const response = await handler(input, { includeForks });
      return response.data;
    } catch (error) {
      if (error.message) {
        errorMessage = error.message;
      }
      console.error(error);
    }
  };

  const processGroupData = (group) => {
    const collectData = [];
    const keys = Object.keys(group.space);
    for (const key of keys) {
      collectData.push({ name: key, percent: group.space[key] });
    }
    collectData.sort((a, b) => b.percent - a.percent);
    return {
      label: group.label,
      data: collectData,
      count1: keys.length,
      count2: group.allNames.length,
      langBreakdown: group.langBreakdown,
    };
  };

  const processData = (allData) => {
    if (allData.compareGroups) {
      // Compare mode — multiple groups
      compareGroups = allData.compareGroups.map(processGroupData);
      data = undefined;
      count1 = undefined;
      count2 = undefined;
      langBreakdown = undefined;
      done = true;
      return;
    }

    // Standard compile mode
    compareGroups = undefined;
    const collectData = [];
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
    if (allData.langBreakdown) {
      langBreakdown = allData.langBreakdown;
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
        langBreakdown = undefined;
        compareGroups = undefined;
        count1 = undefined;
        count2 = undefined;
        errorMessage = '';
        // Convert spaces to + (compile), ? to ~ (compare delimiter in URL)
        current = input.trim().replaceAll(/\s+/g, '+').replaceAll('?', '~');
        input = '';
        const allData = await getData(current);
        if (allData) {
          processData(allData);
        } else {
          data = [];
        }
      }
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };
</script>

<template>
  <h5>
    View language usage per repo<br />or total by username/organization
  </h5>
  <Input
    {randomize}
    {submit}
    bind:includeForks
    bind:input
  />
  {#if compareGroups}
    {#each compareGroups as group, i}
      <div class="compare-label">
        <span>{group.label}</span>
      </div>
      <Results
        count1={group.count1}
        count2={group.count2}
        current={group.label}
        data={group.data}
        {errorMessage}
        isDone={() => { if (i === compareGroups.length - 1) { done = true; } }}
        langBreakdown={group.langBreakdown}
      />
      {#if i < compareGroups.length - 1}
        <div class="compare-divider">
          <span>vs</span>
        </div>
      {/if}
    {/each}
  {:else}
    <Results
      {count1}
      {count2}
      {current}
      {data}
      {errorMessage}
      {isDone}
      {langBreakdown}
    />
  {/if}
  {#if done}
    <ScrollTop />
  {/if}
  <Footer />
</template>

<style>
  .compare-label {
    text-align: center;
    padding: 1rem 0 0.2rem 0;
    font-size: 14px;
    font-weight: 600;
    color: #fe9fc9;
    animation: fade-in 0.3s ease forwards;
  }

  .compare-divider {
    text-align: center;
    padding: 0.8rem 0;
    font-size: 12px;
    font-weight: 200;
    color: #e8e6e2;
    opacity: 0.5;
    animation: fade-in 0.3s ease forwards;
  }
</style>
