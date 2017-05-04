'use strict';

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var querystring = require('querystring');
var crypto = require('crypto');

var httpx = require('httpx');
var kitx = require('kitx');
var debug = require('debug')('lambda');
var pkg = require('../package.json');

function buildCanonicalHeaders(headers, prefix) {
  var list = [];
  var keys = (0, _keys2.default)(headers);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.startsWith(prefix)) {
      list.push(key);
    }
  }
  list.sort();

  var canonical = '';
  for (var _i = 0; _i < list.length; _i++) {
    var _key = list[_i];
    canonical += _key + ':' + headers[_key] + '\n';
  }

  return canonical;
}

function composeStringToSign(method, path, headers) {
  var contentMD5 = headers['content-md5'] || '';
  var contentType = headers['content-type'] || '';
  var date = headers['date'];
  var signHeaders = buildCanonicalHeaders(headers, 'x-fc');
  return method + '\n' + contentMD5 + '\n' + contentType + '\n' + date + '\n' + signHeaders + path;
}

function signString(source, secret) {
  var buff = crypto.createHmac('sha256', secret).update(source, 'utf8').digest();
  return Buffer.from(buff, 'binary').toString('base64');
}

var Client = function () {
  function Client(accountid, config) {
    (0, _classCallCheck3.default)(this, Client);

    if (!accountid) {
      throw new TypeError('"accountid" must be passed in');
    }
    this.accountid = accountid;

    if (!config) {
      throw new TypeError('"config" must be passed in');
    }

    var accessKeyID = config.accessKeyID;
    if (!accessKeyID) {
      throw new TypeError('"config.accessKeyID" must be passed in');
    }

    this.accessKeyID = accessKeyID;

    var accessKeySecret = config.accessKeySecret;
    if (!accessKeySecret) {
      throw new TypeError('"config.accessKeySecret" must be passed in');
    }

    this.accessKeySecret = accessKeySecret;

    var region = config.region;
    if (!region) {
      throw new TypeError('"config.region" must be passed in');
    }

    var protocol = config.secure ? 'https' : 'http';

    var internal = config.internal ? '-internal' : '';

    this.endpoint = protocol + '://' + accountid + '.fc.' + region + internal + '.aliyuncs.com';
    this.host = accountid + '.fc.' + region + internal + '.aliyuncs.com';
    this.version = '2016-08-15';
    this.timeout = 10000; // 10s
  }

  (0, _createClass3.default)(Client, [{
    key: 'buildHeaders',
    value: function buildHeaders() {
      var now = new Date();
      var headers = {
        'accept': 'application/json',
        'date': now.toUTCString(),
        'host': this.host,
        'user-agent': 'Node.js(' + process.version + ') OS(' + process.platform + '/' + process.arch + ') SDK(' + pkg.name + '@v' + pkg.version + ')',
        'x-fc-account-id': this.accountid
      };

      if (this.securityToken) {
        headers['x-fc-security-token'] = this.securityToken;
      }
      return headers;
    }
  }, {
    key: 'request',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(method, path, query, body) {
        var url, headers, postBody, content, buff, digest, md5, stringToSign, signature, response, responseBody, contentType, code, requestid, err;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                url = this.endpoint + '/' + this.version + path;

                if (query && (0, _keys2.default)(query).length > 0) {
                  url = url + '?' + querystring.stringify(query);
                }

                headers = this.buildHeaders();


                if (body) {
                  content = (0, _stringify2.default)(body);

                  debug('request body: %s', content);
                  buff = Buffer.from(content, 'utf8');
                  digest = kitx.md5(buff, 'hex');
                  md5 = Buffer.from(digest, 'utf8').toString('base64');

                  headers['content-type'] = 'application/json';
                  headers['content-length'] = buff.length;
                  headers['content-md5'] = md5;
                  postBody = buff;
                }

                stringToSign = composeStringToSign(method, '/' + this.version + path, headers);

                debug('stringToSign: %s', stringToSign);
                signature = signString(stringToSign, this.accessKeySecret);

                headers['authorization'] = 'FC ' + this.accessKeyID + ':' + signature;

                debug('request headers: %j', headers);

                _context.next = 11;
                return httpx.request(url, {
                  method: method,
                  timeout: this.timeout,
                  headers: headers,
                  data: postBody
                });

              case 11:
                response = _context.sent;


                debug('response status: %s', response.statusCode);
                debug('response headers: %j', response.headers);

                _context.next = 16;
                return httpx.read(response, 'utf8');

              case 16:
                responseBody = _context.sent;


                debug('response body: %s', responseBody);

                contentType = response.headers['content-type'] || '';

                if (!contentType.startsWith('application/json')) {
                  _context.next = 27;
                  break;
                }

                _context.prev = 20;

                responseBody = JSON.parse(responseBody);
                _context.next = 27;
                break;

              case 24:
                _context.prev = 24;
                _context.t0 = _context['catch'](20);
                throw _context.t0;

              case 27:
                if (!(response.statusCode < 200 || response.statusCode >= 300)) {
                  _context.next = 34;
                  break;
                }

                code = response.statusCode;
                requestid = response.headers['x-fc-request-id'];
                err = new Error(method + ' ' + path + ' failed with ' + code + '. requestid: ' + requestid + ', message: ' + responseBody.ErrorMessage + '.');

                err.name = 'FC' + responseBody.ErrorCode + 'Error';
                err.code = responseBody.ErrorCode;
                throw err;

              case 34:
                return _context.abrupt('return', responseBody);

              case 35:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[20, 24]]);
      }));

      function request(_x, _x2, _x3, _x4) {
        return _ref.apply(this, arguments);
      }

      return request;
    }()

    /**
     * 创建service
     *
     * Options:
     * - description service的简短描述
     * - logConfig
     *
     * @param {String} serviceName 服务名
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 ServiceResponse
     */

  }, {
    key: 'createService',
    value: function createService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('POST', '/services', null, (0, _assign2.default)({
        serviceName: serviceName
      }, options));
    }

    /**
     * 获取service列表
     *
     * @return {Promise} 返回服务列表
     */

  }, {
    key: 'listServices',
    value: function listServices() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      return this.request('GET', '/services', options);
    }

    /**
     * 获取service信息
     *
     * @return {Promise} 返回 Service 信息
     */

  }, {
    key: 'getService',
    value: function getService(serviceName) {
      return this.request('GET', '/services/' + serviceName, null);
    }
  }, {
    key: 'updateService',
    value: function updateService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('PUT', '/services/' + serviceName, null, options);
    }
  }, {
    key: 'deleteService',
    value: function deleteService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('DELETE', '/services/' + serviceName, null, options);
    }
  }, {
    key: 'createFunction',
    value: function createFunction(serviceName, options) {
      return this.request('POST', '/services/' + serviceName + '/functions', null, options);
    }
  }, {
    key: 'listFunctions',
    value: function listFunctions(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('GET', '/services/' + serviceName + '/functions', options);
    }
  }, {
    key: 'getFunction',
    value: function getFunction(serviceName, functionName) {
      return this.request('GET', '/services/' + serviceName + '/functions/' + functionName);
    }
  }, {
    key: 'updateFunction',
    value: function updateFunction(serviceName, functionName, options) {
      return this.request('PUT', '/services/' + serviceName + '/functions/' + functionName, null, options);
    }
  }, {
    key: 'deleteFunction',
    value: function deleteFunction(serviceName, functionName) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.request('DELETE', '/services/' + serviceName + '/functions/' + functionName, options);
    }
  }, {
    key: 'invokeFunction',
    value: function invokeFunction(serviceName, functionName, options) {
      return this.request('POST', '/services/' + serviceName + '/functions/' + functionName + '/invocations', null, options);
    }
  }, {
    key: 'createTrigger',
    value: function createTrigger(serviceName, functionName, options) {
      return this.request('POST', '/services/' + serviceName + '/functions/' + functionName + '/triggers', null, options);
    }
  }, {
    key: 'listTriggers',
    value: function listTriggers(serviceName, functionName) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.request('GET', '/services/' + serviceName + '/functions/' + functionName + '/triggers', options);
    }
  }, {
    key: 'getTrigger',
    value: function getTrigger(serviceName, functionName, triggerName) {
      return this.request('GET', '/services/' + serviceName + '/functions/' + functionName + '/triggers/' + triggerName);
    }
  }, {
    key: 'updateTrigger',
    value: function updateTrigger(serviceName, functionName, triggerName, options) {
      return this.request('PUT', '/services/' + serviceName + '/functions/' + functionName + '/triggers/' + triggerName, null, options);
    }

    /**
     * Delete
     */

  }, {
    key: 'deleteTrigger',
    value: function deleteTrigger(serviceName, functionName, triggerName, options) {
      return this.request('DELETE', '/services/' + serviceName + '/functions/' + functionName + '/triggers/' + triggerName, null, options);
    }
  }]);
  return Client;
}();

module.exports = Client;