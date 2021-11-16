/* eslint-disable unicorn/no-process-exit */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable unicorn/prefer-node-protocol */
import http from 'http';

const options = {
  host: 'localhost',
  port: '3004',
  timeout: 2000,
};
const request = http.request(options, (response) => {
  console.log(`STATUS: ${response.statusCode}`);
  if (response.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});
request.on('error', function (error) {
  console.log(`ERROR: ${error}`);
  process.exit(1);
});
request.end();
