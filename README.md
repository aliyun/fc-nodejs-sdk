fc-nodejs-sdk
=======

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage][cov-image]][cov-url]

[npm-image]: https://img.shields.io/npm/v/@alicloud/fc.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@alicloud/fc
[travis-image]: https://img.shields.io/travis/aliyun/fc-nodejs-sdk/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/aliyun/fc-nodejs-sdk.svg?branch=master
[cov-image]: https://coveralls.io/repos/aliyun/fc-nodejs-sdk/badge.svg?branch=master&service=github
[cov-url]: https://coveralls.io/github/aliyun/fc-nodejs-sdk?branch=master

Documents: http://doxmate.cool/aliyun/fc-nodejs-sdk/api.html

## Install

```bash
npm install @alicloud/fc --save
```

## License

[MIT](LICENSE)

## Examples

### Promise

```js
'use strict';

var FCClient = require('@alicloud/fc');

var client = new FCClient('<account id>', {
  accessKeyID: '<access key id>',
  accessKeySecret: '<access key secret>',
  region: 'cn-shanghai',
  timeout: 10000 // Request timeout in milliseconds, default is 10s
});

var serviceName = '<service name>';
var funcName = '<function name>';

client.createService(serviceName).then(function(resp) {
  console.log('create service: %j', resp);
  return client.createFunction(serviceName, {
    functionName: funcName,
    handler: 'index.handler',
    memorySize: 128,
    runtime: 'nodejs4.4',
    code: {
      zipFile: fs.readFileSync('/tmp/index.zip', 'base64'),
    },
  });
}).then(function(resp) {
  console.log('create function: %j', resp);
  return client.invokeFunction(serviceName, funcName, 'event');
}).then(function(resp) {
  console.log('invoke function: %j', resp);
}).catch(function(err) {
  console.error(err);
});
```

### async/await (node >= 7.6)

```js
'use strict';

const FCClient = require('@alicloud/fc');

var client = new FCClient('<account id>', {
  accessKeyID: '<access key id>',
  accessKeySecret: '<access key secret>',
  region: 'cn-shanghai',
});

var serviceName = '<service name>';
var funcName = '<function name>';

async function test () {
  try {
    var resp = await client.createService(serviceName);
    console.log('create service: %j', resp);

    resp = await client.createFunction(serviceName, {
      functionName: funcName,
      handler: 'index.handler',
      memorySize: 128,
      runtime: 'nodejs4.4',
      code: {
        zipFile: fs.readFileSync('/tmp/index.zip', 'base64'),
      },
    });
    console.log('create function: %j', resp);

    resp = await client.invokeFunction(serviceName, funcName, 'event');
    console.log('invoke function: %j', resp);
  } catch (err) {
    console.error(err);
  }
}

test().then();
```

### Custom headers

```js
await client.invokeFunction(serviceName, funcName, 'event', {
  'x-fc-invocation-type': 'Async'
});
```

## API Spec

See: https://help.aliyun.com/document_detail/52877.html

## Test

```sh
ACCOUNT_ID=<ACCOUNT_ID> ACCESS_KEY_ID=<ACCESS_KEY_ID> ACCESS_KEY_SECRET=<ACCESS_KEY_SECRET> make test
```
