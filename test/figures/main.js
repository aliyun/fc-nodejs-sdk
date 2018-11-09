'use strict';

var getRawBody = require('raw-body');

exports.handler = function (event, context, callback) {
  console.log('event: %s', event.toString());
  callback(null, 'hello ' + event.toString());
};

exports.test_buf = function (event, context, callback) {
  console.log('event: %s', event.toString());
  callback(null, event);
};

exports.test_buf_handled_err = function (event, context, callback) {
  console.log('event: %s', event.toString());
  callback('This is a handled error', event);
};

// test unhandled err with bad spelling
exports.test_buf_unhandled_err = function (event, context, callback) {
  console.log('event: %s', event.toSting());
  callback(new Buffer('This is an unhandled error'), event);
};

exports.http_handler = function (request, response, context) {
  getRawBody(request, function (err, body) {
    console.log('request: url:%s, path:%s, method:%s, clientIP:%s, body:%s',
      request.url, request.path, request.method, request.clientIP, body.toString());
    console.log('header:%s\nqueries:%s', JSON.stringify(request.headers), JSON.stringify(request.queries));
    var retBody = {
      headers: request.headers,
      queries: request.queries,
      url: request.url,
      clientIP: request.clientIP,
      method: request.method,
    };
    for (var key in request.queries) {
      if (request.queries.hasOwnProperty(key)) {
        var value = request.queries[key];
        response.setHeader(key, value);
      }
    }
    response.setStatusCode(202);
    response.send(JSON.stringify(retBody));
  });
};
