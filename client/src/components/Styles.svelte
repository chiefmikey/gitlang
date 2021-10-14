<style global>
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: Arial, Helvetica, sans-serif;
  }

  #app {
    width: 40px;
    height: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  input,
  button {
    width: 400px;
    border: none;
    box-sizing: border-box;
    text-align: center;
    padding: 14px;
    font-size: 14px;
    outline: none;
  }

  button {
    opacity: 50%;
  }

  button:hover {
    opacity: 100%;
    cursor: pointer;
  }

  input {
    font-size: 18px;
  }

  span {
    padding: 0 10px 0 10px;
  }

  tr {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  h1 {
    text-align: center;
    font-size: 30px;
    white-space: nowrap;
    padding: 40px 0 0 0;
  }

  h4 {
    font-size: 16px;
    white-space: nowrap;
  }

  h6 {
    font-weight: 200;
    white-space: nowrap;
    font-size: 14px;
    margin: 0;
    padding-bottom: 20px;
  }

  #results {
    padding: 40px 0 40px 0;
    text-align: center;
  }
</style>
