'use strict';

function supportAsyncFunctions() {
  try {
    new Function('(async function () {})()');
    return true;
  } catch (ex) {
    return false;
  }
}

module.exports = supportAsyncFunctions() ?
  require('./lib/client.js') : require('./es5/client.js');
