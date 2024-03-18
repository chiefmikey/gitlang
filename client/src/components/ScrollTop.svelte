<script>
  import { onMount } from 'svelte';

  onMount(() => {
    setTimeout(() => {
      const button = document.querySelector('.scroll-top');
      button.style = 'animation: fade-in .5s ease-out 0s forwards;';
    }, 0);
  });

  const scroll = () => {
    const wrapper = document.querySelector('.wrapper');
    wrapper.scroll({ top: 0, behavior: 'smooth' });
  };

  const handleKeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      scroll();
    }
  };
</script>

<template>
  <button
    class="scroll-top"
    type="button"
    on:click={scroll}
    on:keydown={handleKeydown}
  >
    <h6>
      [ top ]
    </h6>
    </button>
</template>

<style>
  .scroll-top {
    cursor: pointer;
    right: 50%;
    z-index: 2;
    width: 100px;
    height: 30px;
    background-color: transparent;
    color: #e8e6e2;
  }
</style>
