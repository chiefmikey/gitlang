<script>
  import { onMount, onDestroy } from 'svelte';

  import { INPUT } from '../../lib/data/constants';

  export let input;
  export let randomize;
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
    <span class="arrow">&#9654;</span>
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
    <span class="arrow flip">&#9654;</span>
  </div>
  <div class="controls">
    <button
      type="button"
      on:click={submit}>Submit
    </button>
  </div>
  <button
    class="random-btn"
    type="button"
    on:click={randomize}>random
  </button>
</template>

<style>
  .input-area {
    padding-top: 3%;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 6px;
  }

  .input-area input {
    width: 275px;
  }

  .arrow {
    color: #e8e6e2;
    font-size: 10px;
    opacity: 0.3;
    flex-shrink: 0;
    padding: 0;
  }

  .arrow.flip {
    transform: scaleX(-1);
  }

  .controls {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  .random-btn {
    background: none;
    border: none;
    color: #e8e6e2;
    font-size: 10px;
    padding: 2px 12px;
    height: auto;
    width: auto;
    opacity: 0.4;
    cursor: pointer;
  }

  .random-btn:hover {
    opacity: 1;
    color: #fe9fc9;
  }
</style>
