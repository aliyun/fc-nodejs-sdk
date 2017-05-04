fc-nodejs-sdk
=======

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

## API Spec

See: https://help.aliyun.com/document_detail/52877.html

## Test

```sh
ACCOUNT_ID=<ACCOUNT_ID> ACCESS_KEY_ID=<ACCESS_KEY_ID> ACCESS_KEY_SECRET=<ACCESS_KEY_SECRET> make test
```
