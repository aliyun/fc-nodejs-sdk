'use strict';

var Client = require('./es5/client.js');
Client.useAsync = function () {
  return require('./lib/client.js');
};

module.exports = Client;
