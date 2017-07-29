'use strict';

const fs = require('fs');
const path = require('path');

const expect = require('expect.js');

const FunctionComputeClient = require('../');

const ACCOUNT_ID = process.env.ACCOUNT_ID || 'accountid';
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID || 'accessKeyID';
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET || 'accessKeySecret';
const serviceName = process.env.SERVICE_NAME || 'fc-nodejs-sdk-unit-test';
const triggerBucketName = process.env.TRIGGER_BUCKET || 'fc-sdk-trigger-bucket';

describe('client test', function () {

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
        region: 'cn-shanghai',
      });
    }).to.throwException(/"config.securityToken" must be passed in for STS/);

    var client;
    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai'
    });
    expect(client.endpoint).to.be('http://accountid.fc.cn-shanghai.aliyuncs.com');

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'STS.accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai',
      securityToken: 'securityToken',
    });
    expect(client.endpoint).to.be('http://accountid.fc.cn-shanghai.aliyuncs.com');

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai',
      secure: true
    });
    expect(client.endpoint).to.be('https://accountid.fc.cn-shanghai.aliyuncs.com');

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai',
      secure: true,
      internal: true
    });
    expect(client.endpoint).to.be('https://accountid.fc.cn-shanghai-internal.aliyuncs.com');

    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai',
      timeout: 20000
    });
    expect(client.timeout).to.be(20000);
  });

  it('listServices with invalid accessKeyID', function () {
    return (async function() {
      var client = new FunctionComputeClient('accountid', {
        accessKeyID: 'invalidAccessKeyID',
        accessKeySecret: 'invalidAccessKeySecret',
        region: 'cn-shanghai'
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
    return (async function() {
      var client = new FunctionComputeClient('accountid', {
        accessKeyID: ACCESS_KEY_ID,
        accessKeySecret: 'invalidAccessKeySecret',
        region: 'cn-shanghai'
      });
      try {
        await client.listServices();
      } catch (ex) {
        expect(ex.name).to.be('FCSignatureNotMatchError');
        expect(ex.message).to.match(/GET \/services failed with 403\. requestid: .{36}, message: signature does not match\./);
      }
    })();
  });

  describe('request', function () {
    it('accepts timeout', async function () {
      var client = new FunctionComputeClient(ACCOUNT_ID, {
        accessKeyID: ACCESS_KEY_ID,
        accessKeySecret: ACCESS_KEY_SECRET,
        region: 'cn-shanghai',
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
      region: 'cn-shanghai'
    });

    before(async function () {
      // clean up
      const response = await client.listServices();
      for (var i = 0; i < response.services.length; i++) {
        const service = response.services[i];
        // Only delete test service
        if (service.serviceName === serviceName) {
          const res = await client.listFunctions(service.serviceName);
          // clean up functions
          for (var j = 0; j < res.functions.length; j++) {
            const fun = res.functions[j];
            await client.deleteFunction(service.serviceName, fun.functionName);
          }
          await client.deleteService(service.serviceName);
        }
      }
    });

    it('createService should ok', async function() {
      const service = await client.createService(serviceName);
      expect(service).to.be.ok();
      expect(service).to.have.property('serviceName', serviceName);
    });

    it('listServices should ok', async function() {
      const response = await client.listServices();
      expect(response).to.be.ok();
      expect(response.services).to.be.ok();
      expect(response.services.length).to.above(0);
      const [service] = response.services;
      expect(service).to.have.property('serviceName');
    });

    it('getService should ok', async function() {
      const service = await client.getService(serviceName);
      expect(service).to.be.ok();
      expect(service).to.have.property('serviceName', serviceName);
      expect(service).to.have.property('description', '');
    });

    it('updateService should ok', async function() {
      const service = await client.updateService(serviceName, {
        description: 'this is test update service'
      });
      expect(service).to.be.ok();
      expect(service).to.have.property('serviceName', serviceName);
      expect(service).to.have.property('description', 'this is test update service');
    });

    it('deleteService should ok', async function() {
      await client.deleteService(serviceName);
      // no exception = ok
    });
  });

  describe('function should ok', function () {
    const functionName = 'hello-world';
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: 'cn-shanghai'
    });

    before(async function () {
      // clean up
      const service = await client.createService(serviceName);
      expect(service).to.be.ok();
      expect(service).to.have.property('serviceName', serviceName);
    });

    after(async function () {
      try {
        await client.deleteFunction(serviceName, functionName);
      } catch (ex) {
        // Ignore
      }
      await client.deleteService(serviceName);
      // no exception = ok
    });

    it('createFunction should ok', async function() {
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
      expect(func).to.be.ok();
      expect(func).to.have.property('functionName', functionName);
    });

    it('listFunctions should ok', async function() {
      const response = await client.listFunctions(serviceName);
      expect(response).to.be.ok();
      expect(response.functions).to.be.ok();
      expect(response.functions).to.have.length(1);
      const [func] = response.functions;
      expect(func).to.have.property('functionName', functionName);
    });

    it('getFunction should ok', async function() {
      const func = await client.getFunction(serviceName, functionName);
      expect(func).to.have.property('functionName', functionName);
    });

    it('getFunctionCode should ok', async function() {
      const code = await client.getFunctionCode(serviceName, functionName);
      expect(code).to.have.property('url');
      expect(code).to.have.property('checksum');
    });

    it('updateFunction should ok', async function() {
      const func = await client.updateFunction(serviceName, functionName, {
        description: 'updated function desc'
      });
      expect(func).to.have.property('functionName', functionName);
      expect(func).to.have.property('description', 'updated function desc');
    });

    it('invokeFunction should ok', async function() {
      const response = await client.invokeFunction(serviceName, functionName, 'world');
      expect(response).to.be('hello world');
    });

    it('invokeFunction should faster', async function() {
      const response = await client.invokeFunction(serviceName, functionName, Buffer.from('world'));
      expect(response).to.be('hello world');
    });

    it('invokeFunction async should ok', async function() {
      const response = await client.invokeFunction(serviceName, functionName, Buffer.from('world'), {
        'x-fc-invocation-type': 'Async'
      });
      expect(response).to.be('');
    });

    it('invokeFunction with invalid event should fail', async function() {
      expect(() => {
        client.invokeFunction(serviceName, functionName, {
          event: 'hello world',
        });
      }).to.throwException(/"event" must be String or Buffer/);
    });

    it('deleteFunction should ok', async function() {
      await client.deleteFunction(serviceName, functionName);
      // No exception, no failed
    });
  });

  describe('trigger should ok', function () {
    const functionName = 'hello-world';
    const triggerName = 'image_resize';
    const client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: 'cn-shanghai'
    });

    before(async function () {
      // clean up
      const service = await client.createService(serviceName);
      expect(service).to.be.ok();
      expect(service).to.have.property('serviceName', serviceName);
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
      expect(func).to.be.ok();
      expect(func).to.have.property('functionName', functionName);
    });

    after(async function () {
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
    });

    it('createTrigger should ok', async function() {
      const trigger = await client.createTrigger(serviceName, functionName, {
        invocationRole: `acs:ram::${ACCOUNT_ID}:role/fc-test`,
        sourceArn: `acs:oss:cn-shanghai:${ACCOUNT_ID}:${triggerBucketName}`,
        triggerName: triggerName,
        triggerType: 'oss',
        triggerConfig: {
          events: ['oss:ObjectCreated:*'],
          filter: {
            key: {
              prefix: 'prefix',
              suffix: 'suffix'
            }
          }
        }
      });
      expect(trigger).to.be.ok();
      expect(trigger).to.have.property('triggerName', triggerName);
      // sleep a while for trigger meta to sync
      await new Promise(res => setTimeout(res, 30 * 1000));
    });

    it('listTriggers should ok', async function() {
      const response = await client.listTriggers(serviceName, functionName);
      expect(response).to.be.ok();
      expect(response.triggers).to.be.ok();
      expect(response.triggers).to.have.length(1);
      const [trigger] = response.triggers;
      expect(trigger).to.have.property('triggerName', triggerName);
    });

    it('getTrigger should ok', async function() {
      const trigger = await client.getTrigger(serviceName, functionName, triggerName);
      expect(trigger).to.have.property('triggerName', triggerName);
    });

    it('updateTrigger should ok', async function() {
      const trigger = await client.updateTrigger(serviceName, functionName, triggerName, {
        invocationRole: `acs:ram::${ACCOUNT_ID}:role/fc-test-updated`,
      });
      expect(trigger).to.have.property('triggerName', triggerName);
      expect(trigger).to.have.property('invocationRole', `acs:ram::${ACCOUNT_ID}:role/fc-test-updated`);
    });

    it('deleteTrigger should ok', async function() {
      await client.deleteTrigger(serviceName, functionName, triggerName);
      // No exception, no failed
    });
  });
});
