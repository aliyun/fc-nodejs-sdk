'use strict';

exports.handler = function(event, context, callback) {
  console.log('event: %s', event.toString());
  callback(null, 'hello '+event.toString());
};
