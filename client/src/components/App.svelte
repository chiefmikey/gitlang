<script>
  import { onMount } from 'svelte';

  import handler from '../../lib/index';

  import Footer from './Footer.svelte';
  import Header from './Header.svelte';
  import Input from './Input.svelte';
  import Results from './Results.svelte';
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
      console.error(error);
    }
  };

  const processData = (allData) => {
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
        const allData = await getData(current);
        if (allData) {
          processData(allData);
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
  <Header />
  <Input
    {submit}
    bind:input
  />
  <Results
    {count1}
    {count2}
    {current}
    {data}
    {isDone}
  />
  {#if done}
    <ScrollTop />
  {/if}
  <Footer />
</template>
