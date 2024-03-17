<script>
  import { onMount, onDestroy } from 'svelte';

  import { INPUT } from '../../constants';

  export let input;
  export let submit;

  const { PLACEHOLDER } = INPUT;
  let inputElement;
  let placeholder = PLACEHOLDER;
  let isInputActive = false;

  const handleInput = (event) => {
    if (event.target.value) {
      input = event.target.value;
    }
  };

  const handleClick = () => {
    placeholder = '';
    isInputActive = true;
  };

  const handleBlur = () => {
    placeholder = PLACEHOLDER;
    isInputActive = false;
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      submit(event);
    } else if (event.key === 'Escape') {
      input = '';
      placeholder = PLACEHOLDER;
      isInputActive = false;
    } else {
      placeholder = '';
      isInputActive = true;
    }
  };

  const handleGlobalKeyDown = () => {
    if (!isInputActive) {
      inputElement.focus();
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleGlobalKeyDown);
  });
</script>

<template>
  <div class="input-area">
    <input
      bind:this={inputElement}
      name="input"
      style={`caret-color: ${isInputActive ? '#e8e6e2' : 'transparent'}`}
      autocapitalize="none"
      autocomplete="off"
      autocorrect="off"
      {placeholder}
      tabindex="0"
      type="text"
      value={input}
      on:keydown={handleKeyDown}
      on:blur={handleBlur}
      on:input={handleInput}
      on:click={handleClick}
    />
  </div>
  <button
    type="button"
    on:click={submit}>Submit
  </button>
</template>

<style>
  .input-area {
    padding-top: 3%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
</style>
