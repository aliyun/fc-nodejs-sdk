'use strict';

var expect = require('expect.js');

var FunctionComputeClient = require('../');

var ACCOUNT_ID = process.env.ACCOUNT_ID || 'accountid';
var ACCESS_KEY_ID = process.env.ACCESS_KEY_ID || 'accessKeyID';
var ACCESS_KEY_SECRET = process.env.ACCESS_KEY_SECRET || 'accessKeySecret';

describe('es5 client test', function () {

  it('listServices should ok', function(done) {
    var client = new FunctionComputeClient(ACCOUNT_ID, {
      accessKeyID: ACCESS_KEY_ID,
      accessKeySecret: ACCESS_KEY_SECRET,
      region: 'cn-shanghai'
    });
    client.listServices().then(function (response) {
      expect(response).to.be.ok();
      expect(response.services).to.be.ok();
      done();
    }).catch(function (err) {
      done(err);
    });
  });
});
