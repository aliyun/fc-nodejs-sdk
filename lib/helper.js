'use strict';

const url = require('url');

function buildCanonicalHeaders(headers, prefix) {
  var list = [];
  var keys = Object.keys(headers);

  var fcHeaders = {};
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];

    var lowerKey = key.toLowerCase().trim();
    if (lowerKey.startsWith(prefix)) {
      list.push(lowerKey);
      fcHeaders[lowerKey] = headers[key];
    }
  }
  list.sort();

  var canonical = '';
  for (let i = 0; i < list.length; i++) {
    const key = list[i];
    canonical += `${key}:${fcHeaders[key]}\n`;
  }

  return canonical;
}


function composeStringToSign(method, path, headers, queries) {
  const contentMD5 = headers['content-md5'] || '';
  const contentType = headers['content-type'] || '';
  const date = headers['date'];
  const signHeaders = buildCanonicalHeaders(headers, 'x-fc-');

  const u = url.parse(path);
  const pathUnescaped = decodeURIComponent(u.pathname);
  var str = `${method}\n${contentMD5}\n${contentType}\n${date}\n${signHeaders}${pathUnescaped}`;

  if (queries) {
    var params = [];
    Object.keys(queries).forEach(function(key) {
      var values = queries[key];
      var type = typeof values;
      if (type === 'string') {
        params.push(`${key}=${values}`);
        return;
      }
      if (Array.isArray(values)) {
        queries[key].forEach(function(value){
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
