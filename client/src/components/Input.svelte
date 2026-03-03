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
    margin-top: 8%;
    position: relative;
    display: inline-flex;
  }

  .input-area input {
    width: 390px;
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .input-area::before,
  .input-area::after {
    content: '';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    opacity: 0.4;
  }

  .input-area::before {
    left: -16px;
    border-left: 8px solid #e8e6e2;
  }

  .input-area::after {
    right: -16px;
    border-right: 8px solid #e8e6e2;
  }

  .controls {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-top: 8px;
  }

  .random-btn {
    background: none;
    border: none;
    color: #e8e6e2;
    font-size: 10px;
    padding: 8px 12px 2px;
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
