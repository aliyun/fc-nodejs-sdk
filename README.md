fc-nodejs-sdk
=======

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![coverage][cov-image]][cov-url]

[npm-image]: https://img.shields.io/npm/v/@alicloud/fc2.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@alicloud/fc2
[travis-image]: https://img.shields.io/travis/aliyun/fc-nodejs-sdk/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/aliyun/fc-nodejs-sdk.svg?branch=master
[cov-image]: https://coveralls.io/repos/aliyun/fc-nodejs-sdk/badge.svg?branch=master&service=github
[cov-url]: https://coveralls.io/github/aliyun/fc-nodejs-sdk?branch=master

Documents: http://doxmate.cool/aliyun/fc-nodejs-sdk/api.html

Notice
-------------------
We suggest using fc2，The main difference between fc and fc2 is:

The response returned by the user is the following object.

```js
{
     'headers': headers,
     'data': data,
}

```
for invoke function, data is the results returned by your code. By default, data is decoded by utf8, if you would like to get raw buffer, just set {rawBuf: true} in opts when you invoke function.

Examples are shown in the code below, 
for other apis, data is object.

Install the official fc2 release version:

```bash
npm install @alicloud/fc2 --save
```

## Install oldVersion

fc version is in 1.x branch， you can install fc use 'npm' like this

```bash
npm install @alicloud/fc --save
```


## License

[MIT](LICENSE)

## Examples

### Promise

```js
'use strict';

var FCClient = require('@alicloud/fc2');

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

const FCClient = require('@alicloud/fc2');

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
      handler: 'counter.handler',
      memorySize: 128,
      runtime: 'nodejs4.4',
      initializer: 'counter.initializer',
      code: {
        zipFile: fs.readFileSync('/tmp/counter.zip', 'base64'),
      },
    });
    console.log('create function: %j', resp);

    // by default , resp is decoded by utf8
    resp = await client.invokeFunction(serviceName, funcName, null);
    console.log('invoke function: %j', resp);

    // respWithBuf is returned as buffer if isRawBuf is set to be true in opts
    respWithBuf = await client.invokeFunction(serviceName, funcName, null, {}, 'LATEST', {rawBuf:true});

    uResp = await client.updateFunction(serviceName, funcName, {
      description: 'updated function desc',
      initializationTimeout: 60,
    });
    console.log('update function: %j', resp);
  } catch (err) {
    console.error(err);
  }
}
test().then();
```

### Custom headers

We offer two ways to customize request headers. 

One way is passing headers through the Client constructor. You should treat headers passed through the constructor as default custom headers, because all requests will use this headers.

```js
var client = new FCClient('<account id>', {
  accessKeyID: '<access key id>',
  accessKeySecret: '<access key secret>',
  region: 'cn-shanghai',
  headers: {
    'x-fc-invocation-type': 'Async'
  }
});

await client.invokeFunction(serviceName, funcName, 'event');
```

Another way is passing headers through the function's parameter. You should use this way when you want to just pass headers in specific functions.

```js
await client.invokeFunction(serviceName, funcName, 'event', {
  'x-fc-invocation-type': 'Async'
});
```

When both ways are used, headers will be merged. But for the headers with the same key, the headers provided by the function parameter overrides the headers provided by the constructor.

## API Spec

See: https://help.aliyun.com/document_detail/52877.html

## Test

```sh
ACCOUNT_ID=<ACCOUNT_ID> ACCESS_KEY_ID=<ACCESS_KEY_ID> ACCESS_KEY_SECRET=<ACCESS_KEY_SECRET> make test
```
