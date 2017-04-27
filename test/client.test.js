'use strict';

const fs = require('fs');
const path = require('path');

const expect = require('expect.js');

const FunctionComputeClient = require('../');

const ACCOUNT_ID = process.env.ACCOUNT_ID || 'accountid';
const ACCESS_KEY_ID = process.env.ACCESS_KEY_ID || 'accessKeyID';
const ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET || 'accessKeySecret';

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

    var client;
    client = new FunctionComputeClient('accountid', {
      accessKeyID: 'accessKeyID',
      accessKeySecret: 'accessKeySecret',
      region: 'cn-shanghai'
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

  describe('service should ok', function () {

    const serviceName = 'unit-test';
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
      expect(response.services.length).to.above(1);
      const [service] = response.services;
      expect(service).to.have.property('serviceName', serviceName);
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
    const serviceName = 'unit-test';
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
      await client.deleteFunction(serviceName, functionName);
      await client.deleteService(serviceName);
      // no exception = ok
    });

    it('createFunction should ok', async function() {
      const response = await client.createFunction(serviceName, {
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
      expect(response).to.be.ok();
      expect(response).to.have.property('functionName', functionName);
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

    it('updateFunction should ok', async function() {
      const func = await client.updateFunction(serviceName, functionName, {
        description: 'updated function desc'
      });
      expect(func).to.have.property('functionName', functionName);
      expect(func).to.have.property('description', 'updated function desc');
    });

    it('invokeFunction should ok', async function() {
      const response = await client.invokeFunction(serviceName, functionName, {
        event: Buffer.from('')
      });
      expect(response).to.have.property('functionName', functionName);
      expect(response).to.have.property('description', 'updated function desc');
    });
  });
});
