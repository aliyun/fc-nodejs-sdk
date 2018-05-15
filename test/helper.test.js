'use strict';

const helper = require('../lib/helper.js')
const expect = require('expect.js');

describe('helper test', function () {
  it('test composeStringToSign', function() {
    var headers = {
      'content-md5':'1bca714f406993b309bb87fabeb30a6b',
      'content-type':'text/json',
      date:'today',
      'x-fc-foo':'123',
      'x-fc-bar':'xyz',
      'x-fcdummy':'dummy',
      test:'foo'
    };
    var queires = {
      foo:'bar',
      key1:['xyz', 'abc'],
      'key3 with-escaped~chars_here.ext':'value with-escaped~chars_here.ext',
      key2:['123'],
    };
    var str = helper.composeStringToSign('GET', '/path/action with-escaped~chars_here.ext', headers, queires);
    expect(str).to.be('GET\n1bca714f406993b309bb87fabeb30a6b\ntext/json\ntoday\nx-fc-bar:xyz\nx-fc-foo:123\n/path/action with-escaped~chars_here.ext\nfoo=bar\nkey1=abc\nkey1=xyz\nkey2=123\nkey3 with-escaped~chars_here.ext=value with-escaped~chars_here.ext');
  });
})


