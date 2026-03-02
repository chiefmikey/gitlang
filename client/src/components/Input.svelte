<script>
  import { onMount, onDestroy } from 'svelte';

  import { INPUT } from '../../lib/data/constants';

  export let input;
  export let includeForks;
  export let submit;

  const { PLACEHOLDER } = INPUT;
  let inputElement;
  let placeholder = PLACEHOLDER;
  let isInputActive = false;

  const handleInput = (event) => {
    if (event.target.value) {
      input = event.target.value;
    } else {
      placeholder = '';
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
      input = '';
      placeholder = PLACEHOLDER;
      isInputActive = false;
    } else if (event.key === 'Escape') {
      input = '';
      placeholder = PLACEHOLDER;
      isInputActive = false;
    }
  };

  const handleGlobalKeyDown = (event) => {
    if (!isInputActive && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey && event.key !== 'Escape' && event.key !== 'Enter') {
      inputElement.focus();
      isInputActive = true;
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
  <div class="controls">
    <label class="toggle">
      <input
        type="checkbox"
        bind:checked={includeForks}
      />
      <span>include forks</span>
    </label>
    <button
      type="button"
      on:click={submit}>Submit
    </button>
  </div>
</template>

<style>
  .input-area {
    padding-top: 3%;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 10px;
    color: #e8e6e2;
    opacity: 0.6;
  }

  .toggle:hover {
    opacity: 1;
  }

  .toggle input[type="checkbox"] {
    width: auto;
    min-width: auto;
    cursor: pointer;
    accent-color: #fe9fc9;
  }

  .toggle span {
    padding: 0;
    white-space: nowrap;
  }
</style>
