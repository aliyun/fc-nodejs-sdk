'use strict';

const fs = require('fs');
const path = require('path');

const expect = require('expect.js');

const FunctionComputeClient = require('../');

const ACCOUNT_ID = process.env.ACCOUNT_ID ;
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID ;
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET ;
const REGION = process.env.REGION;
const serviceName = process.env.SERVICE_NAME || 'fc-nodejs-sdk-unit-test';
const triggerBucketName = process.env.TRIGGER_BUCKET || 'fc-sdk-trigger-bucket';
const domainName = process.env.DOMAIN_NAME || `sdk. + ${ACCOUNT_ID} . ${REGION} + .functioncompute.com`;
const jaegerEndpoint = process.env.JAEGER_ENDPOINT ;

describe('client test', function () {
  it('static function getSignature', function () {
    var queries = {
      a: '123',
      b: 'xyz',
      'foo-bar': '123 ~ xyz-a'
    };
    var signature = FunctionComputeClient.getSignature(ACCOUNT_ID, ACCESS_KEY_SECRET, 'GET', '/hello/world', {
      date: 'today'
    }, queries);
    expect(signature).to.be.ok();
    expect(signature).to.contain(`FC ${ACCOUNT_ID}:`);
  });

  it('constructor', function () {
    expect(() => {
      new FunctionComputeClient();
    }).to.throwException(/"accountid" must be passed in/);

    expect(() => {
      new FunctionComputeClient('accountid');
    }).to.throwException(/"config" must be passed in/);

    expect(() => {
      new FunctionComputeClient('accountid', {});
    }).to.throwException(/"config.accessKeyID" must be passed in/);

    expect(() => {
      new FunctionComputeClient('accountid', {
        accessKeyID: 'accessKeyID'
      });
    }).to.throwException(/"config.accessKeySecret" must be passed in/);

    expect(() => {
      new FunctionComputeClient('accountid', {
        accessKeyID: 'accessKeyID',
        accessKeySecret: 'accessKeySecret'
      });
    }).to.throwException(/"config.region" must be passed in/);

    expect(() => {
      new FunctionComputeClient('accountid', {
        accessKeyID: 'STS.accessKeyID',
        accessKeySecret: 'accessKeySecret',
        region: REGION,
      });
    }).to.throwException(/"config.securityToken" must be passed in for STS/);

    var client;
    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: REGION
    });
    expect(client.endpoint).to.be(`http://accountid.${ACCOUNT_ID}.fc.aliyuncs.com`);

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'STS.accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: REGION,
      securityToken: 'securityToken',
    });
    expect(client.endpoint).to.be(`http://accountid.${ACCOUNT_ID}.fc.aliyuncs.com`);

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: REGION,
      secure: true
    });
    expect(client.endpoint).to.be(`http://accountid.${ACCOUNT_ID}.fc.aliyuncs.com`);

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: REGION,
      secure: true,
      internal: true
    });
    expect(client.endpoint).to.be(`http://accountid.${ACCOUNT_ID}-internal.fc.aliyuncs.com`);

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: REGION,
      endpoint: 'http://localhost:8080',
      secure: true,
      internal: true
    });
    expect(client.endpoint).to.be('http://localhost:8080');

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: REGION,
      timeout: 20000
    });
    expect(client.timeout).to.be(20000);
  });

  it('listServices with invalid accessKeyID', function () {
    return (async function () {
      var client = new FunctionComputeClient('accountid', {
        accessKeyID: 'invalidAccessKeyID',
        accessKeySecret: 'invalidAccessKeySecret',
        region: REGION
      });
      try {
        await client.listServices();
      } catch (ex) {
        expect(ex.name).to.be('FCInvalidAccessKeyIDError');
        expect(ex.message).to.match(/GET \/services failed with 403\. requestid: .{36}, message: invalid access key ID 'invalidAccessKeyID'./);
      }
    })();
  });

  it('listServices with invalid accessKeySecret', function () {
    return (async function () {
      var client = new FunctionComputeClient('accountid', {
        accessKeyID: ACCESS_KEY_ID,
        accessKeySecret: 'invalidAccessKeySecret',
        region: REGION
      });
      try {
        await client.listServices();
      } catch (ex) {
        expect(ex.name).to.be('FCSignatureNotMatchError');
        expect(ex.message).to.match(/GET \/services failed with 403\. requestid: .{36}, message: The request signature we calculated does not match the signature you provided\./);
      }
    })();
  });

  describe('request', function () {
    it('accepts timeout', async function () {
      var client = new FunctionComputeClient(ACCOUNT_ID, {
        accessKeyID: ACCESS_KEY_ID,
        accessKeySecret: ACCESS_KEY_SECRET,
        region: REGION,
        timeout: 1
      });

      try {
        await client.listServices();
      } catch (ex) {
        expect(ex.name).to.be('RequestTimeoutError');
      }
    });
  });

  describe('service should ok', function () {

    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });

    before(async function () {
      try {
        // clean up
        var listServiceOptions = {
          'prefix': serviceName
        };
        const response = await client.listServices(listServiceOptions);
        for (var i = 0; i < response.data.services.length; i++) {
          const service = response.data.services[i];
          // Only delete test service
          if (service.serviceName === serviceName) {
            const res = await client.listFunctions(service.serviceName);
            // clean up functions
            for (var j = 0; j < res.data.functions.length; j++) {
              const fun = res.data.functions[j];
              await client.deleteFunction(service.serviceName, fun.functionName);
            }
            await client.deleteService(service.serviceName);
            await client.deleteFunction('fc-nodejs-sdk-unit-test', 'testProvisionConfig');
            await client.deleteService('fc-nodejs-sdk-unit-test');
          }
        }
      } catch (ex) {
        //ignore
      }
    });

    after(async function () {
      // clean up
      try {
        const res = await client.listFunctions(serviceName);
        for (var j = 0; j < res.data.functions.length; j++) {
          const fun = res.data.functions[j];
          await client.deleteFunction(serviceName, fun.functionName);
        }
        await client.deleteService(serviceName);
      } catch (ex) {
        // ignore
      }
    });

    it('createService should ok', async function () {
      const service = await client.createService(serviceName);
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', serviceName);
    });

    it('listServices should ok', async function () {
      const response = await client.listServices();
      expect(response.data).to.be.ok();
      expect(response.data.services).to.be.ok();
      expect(response.data.services.length).to.above(0);
      const [service] = response.data.services;
      expect(service).to.have.property('serviceName');
    });

    it('getService should ok', async function () {
      var service = await client.getService(serviceName, {}, 'LATEST');
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', serviceName);
      expect(service.data).to.have.property('description', '');

      service = await client.getService(serviceName);
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', serviceName);
      expect(service.data).to.have.property('description', '');
    });

    it('updateService should ok', async function () {
      const service = await client.updateService(serviceName, {
        description: 'this is test update service'
      });
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', serviceName);
      expect(service.data).to.have.property('description', 'this is test update service');
    });

    it('deleteService should ok', async function () {
      await client.deleteService(serviceName);
      // no exception = ok
    });

    it('createService with tracingConfig should be ok', async function () {
      var options = {
        'tracingConfig': {
          'type': 'Jaeger',
          'params': {
            'endpoint': jaegerEndpoint
          }
        }
      };
      var service = await client.createService(serviceName, options);
      expect(service.data).to.be.ok();

      expect(service.data).to.have.property('serviceName', serviceName);
      expect(service.data.tracingConfig).to.have.property('type', 'Jaeger');
      expect(service.data.tracingConfig.params).to.have.property('endpoint', jaegerEndpoint);
    });

    it('invokeFunction with injected span context should pass traceID to context', async function () {
      var functionName = 'echo-tracing-context';
      var func = await client.createFunction(serviceName, {
        functionName: functionName,
        description: 'function desc',
        memorySize: 128,
        handler: 'main.test_tracing',
        runtime: 'nodejs6',
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', functionName);

      var headers = {
        'x-fc-tracing-opentracing-span-context': '124ed43254b54966:124ed43254b54966:0:1',
        'x-fc-tracing-opentracing-span-context-baggage-key': 'val'
      };
      var resp = await client.invokeFunction(serviceName, functionName, 'event', headers = headers);
      var out = JSON.parse(resp.data);
      expect(out.openTracingSpanContext).to.contain('124ed43254b54966');
      expect(out.openTracingSpanBaggages).to.have.property('key', 'val');
      client.deleteFunction(serviceName, functionName);
    });

    it('update tracingConfig to disable tracingConfig should be ok', async function () {
      var options = {
        'tracingConfig': {},
      };
      var service = await client.updateService(serviceName, options);
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', serviceName);
      expect(service.data.tracingConfig).to.have.property('type', null);
      expect(service.data.tracingConfig).to.have.property('params', null);
      client.deleteService(serviceName);
    });
  });

  describe('function should ok', function () {
    const functionName = 'hello-world';
    const initFunctionName = 'counter';
    const functionWithBufResp = 'test-buf-resp';
    const functionWithHandledErr = 'test-func-with-handled-err';
    const functionWithUnhandledErr = 'test-func-with-unhandled-err';
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });

    before(async function () {
      // clean up
      try {
        await client.deleteService(serviceName);
      } catch (ex) {
        // Ignore
      }
      const service = await client.createService(serviceName);
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', serviceName);
    });

    after(async function () {
      try {
        await client.deleteFunction(serviceName, functionWithBufResp);
        await client.deleteFunction(serviceName, functionWithHandledErr);
        await client.deleteFunction(serviceName, functionWithUnhandledErr);
        await client.deleteFunction(serviceName, functionName);
      } catch (ex) {
        // Ignore
      }
      await client.deleteService(serviceName);
      // no exception = ok
    });

    it('createFunction should ok', async function () {
      const func = await client.createFunction(serviceName, {
        functionName: functionName,
        description: 'function desc',
        memorySize: 128,
        handler: 'main.handler',
        runtime: 'nodejs4.4',
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', functionName);
    });

    it('createFunction with initializer should ok', async function () {
      const func = await client.createFunction(serviceName, {
        functionName: initFunctionName,
        description: 'function desc',
        memorySize: 128,
        handler: 'counter.handler',
        runtime: 'nodejs4.4',
        initializer: 'counter.initializer',
        initializationTimeout: 10,
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/counter.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', initFunctionName);
    });

    it('listFunctions should ok', async function () {
      var response = await client.listFunctions(serviceName);
      expect(response.data).to.be.ok();
      expect(response.data.functions).to.be.ok();
      expect(response.data.functions).to.have.length(2);
      var func = response.data.functions;
      expect(func[0]).to.have.property('functionName', initFunctionName);
      expect(func[1]).to.have.property('functionName', functionName);

      response = await client.listFunctions(serviceName, {}, {}, 'LATEST');
      expect(response.data).to.be.ok();
      expect(response.data.functions).to.be.ok();
      expect(response.data.functions).to.have.length(2);
      func = response.data.functions;
      expect(func[0]).to.have.property('functionName', initFunctionName);
      expect(func[1]).to.have.property('functionName', functionName);
    });

    it('getFunction should ok', async function () {
      const func = await client.getFunction(serviceName, functionName, {}, 'LATEST');
      expect(func.data).to.have.property('functionName', functionName);
      const initFunc = await client.getFunction(serviceName, initFunctionName);
      expect(initFunc.data).to.have.property('functionName', initFunctionName);
    });

    it('getFunctionCode should ok', async function () {
      var code = await client.getFunctionCode(serviceName, functionName);
      expect(code.data).to.have.property('url');
      expect(code.data).to.have.property('checksum');

      code = await client.getFunctionCode(serviceName, functionName, {}, 'LATEST');
      expect(code.data).to.have.property('url');
      expect(code.data).to.have.property('checksum');
    });

    it('updateFunction should ok', async function () {
      const func = await client.updateFunction(serviceName, functionName, {
        description: 'updated function desc'
      });
      expect(func.data).to.have.property('functionName', functionName);
      expect(func.data).to.have.property('description', 'updated function desc');

      const initFunc = await client.updateFunction(serviceName, initFunctionName, {
        description: 'updated function desc',
        initializationTimeout: '20'
      });
      expect(initFunc.data).to.have.property('functionName', initFunctionName);
      expect(initFunc.data).to.have.property('description', 'updated function desc');
      expect(initFunc.data).to.have.property('initializationTimeout', 20);
      expect(initFunc.data).to.have.property('initializer', 'counter.initializer');
    });

    it('invokeFunction should ok', async function () {
      const response = await client.invokeFunction(serviceName, functionName, 'world', {}, 'LATEST');
      expect(response.data).to.be('hello world');

      const initResponse_1 = await client.invokeFunction(serviceName, initFunctionName, null);
      expect(initResponse_1.data).to.be('2');
      const initResponse_2 = await client.invokeFunction(serviceName, initFunctionName, null);
      expect(initResponse_2.data).to.be('3');
    });

    it('invokeFunction should faster', async function () {
      const response = await client.invokeFunction(serviceName, functionName, Buffer.from('world'));
      expect(response.data).a('string');
      expect(response.data).to.be('hello world');
    });

    it('invokeFunction with rawBuf=false should return string', async function () {
      const response = await client.invokeFunction(serviceName, functionName, Buffer.from('world'), {}, 'LATEST', {
        rawBuf: false
      });
      expect(response.data).a('string');
      expect(response.data).to.be('hello world');
    });

    it('invokeFunction with buffer response should return buffer', async function () {
      const func = await client.createFunction(serviceName, {
        functionName: functionWithBufResp,
        description: 'function desc',
        memorySize: 128,
        handler: 'main.test_buf',
        runtime: 'nodejs6',
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', functionWithBufResp);

      const response = await client.invokeFunction(serviceName, functionWithBufResp, Buffer.from('world'), {}, 'LATEST', {
        rawBuf: true
      });
      expect(response.data).an(Buffer);
      expect(response.data.toString()).to.be('world');
    });

    it('invokeFunction with handled error should decode with utf8', async function () {
      const func = await client.createFunction(serviceName, {
        functionName: functionWithHandledErr,
        description: 'function desc',
        memorySize: 128,
        handler: 'main.test_buf_handled_err',
        runtime: 'nodejs6',
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', functionWithHandledErr);

      const response = await client.invokeFunction(serviceName, functionWithHandledErr, Buffer.from('world'), {}, 'LATEST', {
        rawBuf: true
      });
      expect(response.data).not.an(Buffer);
      expect(JSON.stringify(response.data)).to.be(JSON.stringify({
        'errorMessage': 'This is a handled error'
      }));
    });

    it('invokeFunction with unhandled error should decode with utf8', async function () {
      const func = await client.createFunction(serviceName, {
        functionName: functionWithUnhandledErr,
        description: 'function desc',
        memorySize: 128,
        handler: 'main.test_buf_unhandled_err',
        runtime: 'nodejs6',
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', functionWithUnhandledErr);

      const response = await client.invokeFunction(serviceName, functionWithUnhandledErr, Buffer.from('world'), {}, 'LATEST', {
        rawBuf: true
      });
      expect(response.data).not.an(Buffer);
      expect(JSON.stringify(response.data)).contain(JSON.stringify({
        'errorMessage': 'Process exited unexpectedly before completing request'
      }).slice(0, -2));
    });

    it('invokeFunction async should ok', async function () {
      const response = await client.invokeFunction(serviceName, functionName, Buffer.from('world'), {
        'x-fc-invocation-type': 'Async'
      });
      expect(response.data).to.be('');

      const initResponse = await client.invokeFunction(serviceName, functionName, null, {
        'x-fc-invocation-type': 'Async'
      });
      expect(initResponse.data).to.be('');
    });

    it('invokeFunction async with upper case header should ok', async function () {
      const response = await client.invokeFunction(serviceName, functionName, Buffer.from('world'), {
        'X-Fc-Invocation-Type': 'Async'
      });
      expect(response.data).to.be('');
    });

    it('invokeFunction with invalid event should fail', async function () {
      expect(() => {
        client.invokeFunction(serviceName, functionName, {
          event: 'hello world',
        });
      }).to.throwException(/"event" must be String or Buffer/);
    });

    it('createFunction with invalid runtime should fail', async function () {
      try {
        await client.createFunction(serviceName, {
          functionName: 'test_invalid_runtime_function',
          description: 'function desc',
          memorySize: 128,
          handler: 'main.handler',
          runtime: 10,
          timeout: 10,
          code: {
            zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
          }
        });
      } catch (ex) {
        expect(ex.stack).to.contain('FCInvalidArgumentError');
        expect(ex.stack).to.contain('Runtime is set to an invalid value');
      }

      try {
        await client.createFunction(serviceName, {
          functionName: 'test_invalid_runtime_function',
          description: 'function desc',
          memorySize: 128,
          handler: 'counter.handler',
          initializer: 'counter.initializer',
          initializationTimeout: 10,
          runtime: 10,
          timeout: 10,
          code: {
            zipFile: fs.readFileSync(path.join(__dirname, 'figures/counter.zip'), 'base64')
          }
        });
      } catch (ex) {
        expect(ex.stack).to.contain('FCInvalidArgumentError');
        expect(ex.stack).to.contain('Runtime is set to an invalid value');
      }
    });

    it('updateFunction with invalid runtime should fail', async function () {
      try {
        await client.updateFunction(serviceName, functionName, {
          description: 'updated function desc',
          runtime: 10
        });
      } catch (ex) {
        expect(ex.stack).to.contain('FCInvalidArgumentError');
        expect(ex.stack).to.contain('Runtime is set to an invalid value');
      }

      try {
        await client.updateFunction(serviceName, initFunctionName, {
          description: 'updated function desc',
          runtime: 10
        });
      } catch (ex) {
        expect(ex.stack).to.contain('FCInvalidArgumentError');
        expect(ex.stack).to.contain('Runtime is set to an invalid value');
      }
    });

    it('deleteFunction should ok', async function () {
      await client.deleteFunction(serviceName, functionName);
      await client.deleteFunction(serviceName, initFunctionName);
      // No exception, no failed
    });
  });

  async function createServiceAndFunction(client, serviceName, functionName, handlerName) {
    // clean up
    const service = await client.createService(serviceName);
    expect(service.data).to.be.ok();
    expect(service.data).to.have.property('serviceName', serviceName);
    const func = await client.createFunction(serviceName, {
      functionName: functionName,
      description: 'function desc',
      memorySize: 128,
      handler: handlerName,
      runtime: 'nodejs4.4',
      timeout: 10,
      code: {
        zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
      }
    });
    expect(func.data).to.be.ok();
    expect(func.data).to.have.property('functionName', functionName);
  }

  async function cleanupResources(client, serviceName, functionName, triggerName) {
    try {
      await client.deleteTrigger(serviceName, functionName, triggerName);
    } catch (ex) {
      // Ignore
      console.log(ex.stack);
    }
    try {
      await client.deleteFunction(serviceName, functionName);
    } catch (ex) {
      // Ignore
      console.log(ex.stack);
    }
    await client.deleteService(serviceName);
    // no exception = ok
  }

  async function createTrigger(client, serviceName, functionName, triggerName, triggerType, triggerConfig) {
    const trigger = await client.createTrigger(serviceName, functionName, {
      invocationRole: `acs:ram::${ACCOUNT_ID}:role/fc-test`,
      sourceArn: `acs:oss:${REGION}:${ACCOUNT_ID}:${triggerBucketName}`,
      triggerName: triggerName,
      triggerType: triggerType,
      triggerConfig: triggerConfig
    });
    expect(trigger.data).to.be.ok();
    expect(trigger.data).to.have.property('triggerName', triggerName);
    // sleep a while for trigger meta to sync
    await new Promise(res => setTimeout(res, 30 * 1000));
  }

  describe('http trigger should be ok', function () {
    const functionName = 'http-echo';
    const triggerName = 'http-trigger';
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION,
      headers: {
        'custom-header-in-constructor': 'abcd'
      }
    });

    before(async function () {
      await createServiceAndFunction(client, serviceName, functionName, 'main.http_handler');
    });

    after(async function () {
      await client.deleteTrigger(serviceName, 'http_trigger_with_function_error', 'http-trigger');
      await client.deleteFunction(serviceName, 'http_trigger_with_function_error');
      await cleanupResources(client, serviceName, functionName, triggerName);
    });

    it('createTrigger should be ok', async function () {
      const triggerConfig = {
        'authType': 'function', // `function` level here to make sure working well for signature.
        'methods': ['GET', 'POST', 'PUT']
      };
      await createTrigger(client, serviceName, functionName, triggerName, 'http', triggerConfig);
    });

    it('getTrigger should be ok', async function () {
      const trigger = await client.getTrigger(serviceName, functionName, triggerName);
      expect(trigger.data).to.have.property('triggerName', triggerName);
    });

    it('send `GET` request to access http function should be ok', async function () {
      const path = `/proxy/${serviceName}/${functionName}/action`;
      const queries = {
        x: 'awsome',
        y: 'serverless'
      };
      const headers = {
        'custom-header': 'abc',
      };

      // var url: /2016-08-15/proxy/fc-nodejs-sdk-unit-test/http-echo/action?x=awsome&y=serverless
      const resp = await client.get(path, queries, headers);
      expect(resp.headers).to.have.property('x', 'awsome');
      expect(resp.headers).to.have.property('y', 'serverless');
      var body = JSON.parse(resp.data);
      expect(body).to.have.property('headers');
      expect(body.headers).to.have.property('custom-header-in-constructor', 'abcd');
      expect(body.queries).to.have.property('x', 'awsome');
      expect(body.queries).to.have.property('y', 'serverless');
      expect(body).to.have.property('method', 'GET');
    });

    it('send `GET` request with empty queries and headers to access http function should be ok', async function () {
      const path = `/proxy/${serviceName}/${functionName}/`;
      // var url: /2016-08-15/proxy/fc-nodejs-sdk-unit-test/http-echo/
      const resp = await client.get(path);
      var body = JSON.parse(resp.data);
      expect(body).to.have.property('method', 'GET');
    });

    it('http trigger with function error passing through should be ok', async function () {
      const functionName = 'http_trigger_with_function_error';
      const handlerName = 'main.http_function_err_handler';
      const func = await client.createFunction(serviceName, {
        functionName: functionName,
        description: 'function desc',
        memorySize: 128,
        handler: handlerName,
        runtime: 'nodejs6',
        timeout: 10,
        code: {
          zipFile: fs.readFileSync(path.join(__dirname, 'figures/test.zip'), 'base64')
        }
      });
      expect(func.data).to.be.ok();
      expect(func.data).to.have.property('functionName', functionName);

      const triggerConfig = {
        'authType': 'anonymous',
        'methods': ['GET', 'POST', 'PUT']
      };

      await createTrigger(client, serviceName, functionName, triggerName, 'http', triggerConfig);

      const funcPath = `/proxy/${serviceName}/${functionName}/action`;
      try {
        await client.get(funcPath);
      } catch (ex) {
        expect(ex.name).to.be('FCundefinedError');
        expect(ex.message).to.match(/GET .* failed with 502\. requestid: .{36}, message: Process exited unexpectedly before completing request.*/);
      }
    });

  });

  describe('oss trigger should be ok', function () {
    const functionName = 'hello-world';
    const triggerName = 'image_resize';
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });

    before(async function () {
      await createServiceAndFunction(client, serviceName, functionName, 'main.handler');
    });

    after(async function () {
      await cleanupResources(client, serviceName, functionName, triggerName);
    });

    it('createTrigger should be ok', async function () {
      const triggerConfig = {
        events: ['oss:ObjectCreated:*'],
        filter: {
          key: {
            prefix: 'prefix',
            suffix: 'suffix'
          }
        }
      };
      await createTrigger(client, serviceName, functionName, triggerName, 'oss', triggerConfig);
    });

    it('listTriggers should be ok', async function () {
      const response = await client.listTriggers(serviceName, functionName);
      expect(response.data).to.be.ok();
      expect(response.data.triggers).to.be.ok();
      expect(response.data.triggers).to.have.length(1);
      const [trigger] = response.data.triggers;
      expect(trigger).to.have.property('triggerName', triggerName);
    });

    it('getTrigger should be ok', async function () {
      const trigger = await client.getTrigger(serviceName, functionName, triggerName);
      expect(trigger.data).to.have.property('triggerName', triggerName);
    });

    it('updateTrigger should be ok', async function () {
      const trigger = await client.updateTrigger(serviceName, functionName, triggerName, {
        invocationRole: `acs:ram::${ACCOUNT_ID}:role/fc-test-updated`,
      });
      expect(trigger.data).to.have.property('triggerName', triggerName);
      expect(trigger.data).to.have.property('invocationRole', `acs:ram::${ACCOUNT_ID}:role/fc-test-updated`);
    });

    it('deleteTrigger should be ok', async function () {
      await client.deleteTrigger(serviceName, functionName, triggerName);
      // No exception, no failed
    });
  });

  describe('customDomain should be ok', function () {

    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });

    before(async function () {
      // clean up
      const response = await client.listCustomDomains();
      for (var i = 0; i < response.data.customDomains.length; i++) {
        const customDomain = response.data.customDomains[i];
        if (customDomain.domainName === domainName) {
          await client.deleteCustomDomain(customDomain.domainName);
        }
      }
    });

    it('createCustomDomain should be ok', async function () {
      const customDomain = await client.createCustomDomain(domainName);
      expect(customDomain.data).to.be.ok();
      expect(customDomain.data).to.have.property('domainName', domainName);
    });

    it('listCustomDomains should be ok', async function () {
      const response = await client.listCustomDomains();
      expect(response.data).to.be.ok();
      expect(response.data.customDomains).to.be.ok();
      expect(response.data.customDomains.length).to.above(0);
      const [customDomain] = response.data.customDomains;
      expect(customDomain).to.have.property('domainName');
    });

    it('getCustomDomain should be ok', async function () {
      const customDomain = await client.getCustomDomain(domainName);
      expect(customDomain.data).to.be.ok();
      expect(customDomain.data).to.have.property('domainName', domainName);
      expect(customDomain.data).to.have.property('protocol', 'HTTP');
    });

    it('updateCustomDomain should be ok', async function () {
      const customDomain = await client.updateCustomDomain(domainName, {
        routeConfig: {
          routes: [{
            path: '/',
            serviceName: 's1',
            functionName: 'f1',
          }]
        },
      });
      expect(customDomain.data).to.be.ok();
      expect(customDomain.data).to.have.property('domainName', domainName);
      expect(customDomain.data.routeConfig).to.have.property('routes');
      expect(customDomain.data.routeConfig.routes[0]).to.have.property('path', '/');
      expect(customDomain.data.routeConfig.routes[0]).to.have.property('serviceName', 's1');
      expect(customDomain.data.routeConfig.routes[0]).to.have.property('functionName', 'f1');
    });


    it('deleteCustomDomain should be ok', async function () {
      await client.deleteCustomDomain(domainName);
    });
  });

  describe('alias test', async function () {
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });
    const functionName = 'hello-world';
    const aliasName = 'new-version';


    before(async function () {
      await createServiceAndFunction(client, serviceName, functionName, 'main.handler');
      await client.publishVersion(serviceName, 'test version 1');
      await client.updateFunction(serviceName, functionName, {
        description: 'updated function desc'
      });
      await client.publishVersion(serviceName, 'test version 2');
    });

    after(async function () {
      const aliasRes = await client.listAliases(serviceName);
      aliasRes.data.aliases.forEach(async function (alias) {
        await client.deleteAlias(serviceName, alias.aliasName);
      });

      const versionsRes = await client.listVersions(serviceName);
      versionsRes.data.versions.forEach(async function (version) {
        await client.deleteVersion(serviceName, version.versionId);
      });

      await cleanupResources(client, serviceName, functionName);
    });

    it('create alias', async function () {
      const res = await client.createAlias(serviceName, aliasName, '1', {
        'description': 'test alias',
        'additionalVersionWeight': {
          '1': 1
        }
      });

      expect(res.data.aliasName).to.be(aliasName);
      expect(res.data.versionId).to.be('1');
      expect(res.data.description).to.be('test alias');
      expect(res.data.additionalVersionWeight).to.eql({
        '1': 1
      });
    });

    it('update alias', async function () {
      var res = await client.updateAlias(serviceName, aliasName, null, {
        'additionalVersionWeight': {
          '2': 0.3
        },
        'description': ''
      });
      expect(res.data.aliasName).to.be(aliasName);
      expect(res.data.versionId).to.be('1');
      expect(res.data.description).to.be('');
      expect(res.data.additionalVersionWeight).to.eql({
        '2': 0.3
      });

      res = await client.updateAlias(serviceName, aliasName, '2', {
        'additionalVersionWeight': {
          '2': 0.5
        }
      });

      expect(res.data.aliasName).to.be(aliasName);
      expect(res.data.versionId).to.be('2');
      expect(res.data.description).to.be('');
      expect(res.data.additionalVersionWeight).to.eql({
        '2': 0.5
      });
    });

    it('get alias', async function () {
      const res = await client.getAlias(serviceName, aliasName);

      expect(res.data.aliasName).to.be(aliasName);
      expect(res.data.versionId).to.be('2');
      expect(res.data.description).to.be('');
      expect(res.data.additionalVersionWeight).to.eql({
        '2': 0.5
      });
    });

    it('list aliases', async function () {
      const res = await client.listAliases(serviceName);

      expect(res.data.aliases).to.length(1);
      expect(res.data.aliases[0].versionId).to.be('2');
      expect(res.data.aliases[0].description).to.be('');
      expect(res.data.aliases[0].additionalVersionWeight).to.eql({
        '2': 0.5
      });
    });

    it('delete alias', async function () {
      const res = await client.deleteAlias(serviceName, aliasName);

      expect(res.data).to.be('');
    });

  });

  describe('versions test', function () {
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });
    const functionName = 'hello-world';

    before(async function () {
      await createServiceAndFunction(client, serviceName, functionName, 'main.handler');
    });

    after(async function () {
      const res = await client.listVersions(serviceName);

      res.data.versions.forEach(async function (version) {
        await client.deleteVersion(serviceName, version.versionId);
      });
      await cleanupResources(client, serviceName, functionName);
    });

    it('publish version', async function () {
      await client.publishVersion(serviceName);
      await client.deleteVersion(serviceName, '1');

      const description = 'test version';
      const version = await client.publishVersion(serviceName, description);
      expect(version.data).to.be.ok();
      expect(version.data).to.have.property('versionId', '2');
      expect(version.data).to.have.property('description', description);
    });

    it('list versions', async function () {
      const res = await client.listVersions(serviceName);

      expect(res.data.versions).to.have.length(1);
      expect(res.data.versions[0].versionId).to.be('2');
    });

    it('delete version', async function () {
      const res = await client.deleteVersion(serviceName, '2');
      expect(res.data).to.be('');
    });
  });

  describe('tag test should be ok', function () {
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });
    const tagServiceName = `${serviceName}_tag_test`;
    before(async function () {
      const service = await client.createService(tagServiceName);
      expect(service.data).to.be.ok();
      expect(service.data).to.have.property('serviceName', tagServiceName);
    });

    after(async function () {
      await client.deleteService(tagServiceName);
    });

    it('tagResource should ok', async function () {
      await client.tagResource(`services/${tagServiceName}`, {
        k1: 'v1',
        k2: 'v2'
      });
      const resp = await client.getResourceTags({
        'resourceArn': `services/${tagServiceName}`
      });
      expect(resp.data).to.be.ok();
      expect(resp.data.tags).to.be.ok();
      expect(resp.data.tags.k1).to.be('v1');
      expect(resp.data.tags.k2).to.be('v2');
      var lresp = await client.listServices({
        tags: {
          k1: 'v1',
          k2: 'v2',
        }
      });

      expect(lresp.data).to.be.ok();
      expect(lresp.data.services).to.be.ok();
      expect(lresp.data.services.length).to.above(0);

      lresp = await client.listServices({
        tags: {
          k3: 'v3'
        }
      });

      expect(lresp.data).to.be.ok();
      expect(lresp.data.services).to.be.ok();
      expect(lresp.data.services.length).to.equal(0);
    });

    it('untagResource should ok', async function () {
      await client.untagResource(`services/${tagServiceName}`, ['k1'], false);
      var resp = await client.getResourceTags({
        'resourceArn': `services/${tagServiceName}`
      });
      expect(resp.data).to.be.ok();
      expect(resp.data.tags).to.be.ok();
      expect(resp.data.tags.k1).to.be(undefined);
      expect(resp.data.tags.k2).to.be('v2');
      await client.untagResource(`services/${tagServiceName}`, [], true);
      resp = await client.getResourceTags({
        'resourceArn': `services/${tagServiceName}`
      });
      expect(Object.keys(resp.data.tags).length).to.equal(0);
    });
  });

  describe('list reserved capacity should ok', function () {
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });

    it('listReservedCapacities should ok', async function () {
      const response = await client.listReservedCapacities();
      expect(response.data).to.be.ok();
      expect(response.data.reservedCapacities).to.be.ok();
      for (var i = 0; i < response.data.reservedCapacities.length; i++) {
        const elem = response.data.reservedCapacities[i];
        expect(elem.instanceId.length).to.be.equal(22);
        expect(elem.cu).to.be.above(0);
        expect(elem.Deadline > elem.CreatedTime).to.be.true;
        expect(elem).to.have.property('lastModifiedTime');
        expect(elem).to.have.property('isRefunded');
      }
    });
  });

  describe('manage provision config should be ok', function () {
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });
    const functionName = 'testProvisionConfig';
    const aliasName = 'prod';

    before(async function () {
      await createServiceAndFunction(client, serviceName, functionName, 'main.handler');
      await client.publishVersion(serviceName, 'test version 1');
      await client.createAlias(serviceName, aliasName, '1', {
        'description': 'test alias',
        'additionalVersionWeight': {
          '1': 1
        }
      });
    });

    after(async function () {
      await client.putProvisionConfig(serviceName, functionName, aliasName, {
        target: 0,
      });
      await client.deleteVersion(serviceName, '1');
      await client.deleteAlias(serviceName, aliasName);
      await cleanupResources(client, serviceName, functionName);
    });

    it('putProvisionConfigs should be ok', async function () {
      const response = await client.putProvisionConfig(serviceName, functionName, aliasName, {
        target: 1,
      });
      expect(response.data).to.be.ok();
      expect(response.data.target).to.be.equal(1);
      expect(response.data.resource).to.be.ok();
    });

    it('getProvisionConfig should be ok', async function () {
      const response = await client.getProvisionConfig(serviceName, functionName, aliasName);
      expect(response.data).to.be.ok();
      expect(response.data.target).to.be.equal(1);
      expect(response.data.resource).to.be.ok();
    });

    it('listProvisionConfigs should ok', async function () {
      const response = await client.listProvisionConfigs({
        'serviceName': serviceName,
        'qualifier': aliasName,
      });
      expect(response.data).to.be.ok();
      expect(response.data.provisionConfigs).to.be.ok();
      for (var i = 0; i < response.data.provisionConfigs.length; i++) {
        const elem = response.data.provisionConfigs[i];
        expect(elem.target).to.be.equal(1);
        expect(elem.resource).to.be.ok();
      }
    });
  });

  describe('manage function async config should be ok', function () {

    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: REGION
    });
    const functionName = 'asyncTest';
    const asyncConfig = {
      destinationConfig: {
        onSuccess: {
          destination: `acs:mns:${REGION}:${ACCOUNT_ID}:/queues/sth/messages`
        }
      },
      maxAsyncRetryAttempts: 1,
      maxAsyncEventAgeInSeconds: 100
    };
    before(async function () {
      await createServiceAndFunction(client, serviceName, functionName, 'main.handler');
    });

    after(async function () {
      await cleanupResources(client, serviceName, functionName);
    });

    it('putFunctionAsyncConfig should be ok', async function () {
      const response = await client.putFunctionAsyncConfig(serviceName, functionName, '', asyncConfig);
      console.log(response.data);
      expect(response.data).to.be.ok();
      expect(response.data.destinationConfig.onSuccess.destination).to.be.equal(asyncConfig.destinationConfig.onSuccess.destination);
      expect(response.data.lastModifiedTime).to.be.ok();
      expect(response.data.createdTime).to.be.ok();
    });

    it('getFunctionAsyncConfig should be ok', async function () {
      const response = await client.getFunctionAsyncConfig(serviceName, functionName, '');
      expect(response.data).to.be.ok();
      expect(response.data.maxAsyncEventAgeInSeconds).to.be.equal(asyncConfig.maxAsyncEventAgeInSeconds);
    });

    it('listFunctionAsyncConfig should ok', async function () {
      const response = await client.listFunctionAsyncConfigs(serviceName, functionName, {
        limit: 1,
      });
      expect(response.data).to.be.ok();
      expect(response.data.configs).to.be.ok();
      for (var i = 0; i < response.data.configs.length; i++) {
        const elem = response.data.configs[i];
        expect(elem.maxAsyncEventAgeInSeconds).to.be.equal(asyncConfig.maxAsyncEventAgeInSeconds);
        expect(elem.maxAsyncRetryAttempts).to.be.equal(asyncConfig.maxAsyncRetryAttempts);
      }
    });

    it('deleteFunctionAsyncConfig should be ok', async function () {
      const response = await client.deleteFunctionAsyncConfig(serviceName, functionName, '');
    });

  });
});