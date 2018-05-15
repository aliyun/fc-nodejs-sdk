'use strict';

var url = require('url');

function buildCanonicalHeaders(headers, prefix) {
  var list = [];
  var keys = Object.keys(headers);

  var fcHeaders = {};
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];

    var lowerKey = key.toLowerCase().trim();
    if (lowerKey.startsWith(prefix)) {
      list.push(lowerKey);
      fcHeaders[lowerKey] = headers[key];
    }
  }
  list.sort();

  var canonical = '';
  for (var _i = 0; _i < list.length; _i++) {
    var _key = list[_i];
    canonical += `${_key}:${fcHeaders[_key]}\n`;
  }

  return canonical;
}

function composeStringToSign(method, path, headers, queries) {
  var contentMD5 = headers['content-md5'] || '';
  var contentType = headers['content-type'] || '';
  var date = headers['date'];
  var signHeaders = buildCanonicalHeaders(headers, 'x-fc-');

  var u = url.parse(path);
  var pathUnescaped = decodeURIComponent(u.pathname);
  var str = `${method}\n${contentMD5}\n${contentType}\n${date}\n${signHeaders}${pathUnescaped}`;

  if (queries) {
    var params = [];
    Object.keys(queries).forEach(function (key) {
      var values = queries[key];
      var type = typeof values;
      if (type === 'string') {
        params.push(`${key}=${values}`);
        return;
      }
      if (Array.isArray(values)) {
        queries[key].forEach(function (value) {
          params.push(`${key}=${value}`);
        });
      }
    });
    params.sort();
    str += '\n' + params.join('\n');
  }
  return str;
}

module.exports = {
  composeStringToSign: composeStringToSign
};