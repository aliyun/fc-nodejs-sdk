'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var querystring = require('querystring');
var crypto = require('crypto');

var httpx = require('httpx');
var kitx = require('kitx');
var debug = require('debug')('lambda');
var pkg = require('../package.json');

function buildCanonicalHeaders(headers, prefix) {
  var list = [];
  var keys = Object.keys(headers);
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
    canonical += `${_key}:${headers[_key]}\n`;
  }

  return canonical;
}

function composeStringToSign(method, path, headers) {
  var contentMD5 = headers['content-md5'] || '';
  var contentType = headers['content-type'] || '';
  var date = headers['date'];
  var signHeaders = buildCanonicalHeaders(headers, 'x-fc');
  return `${method}\n${contentMD5}\n${contentType}\n${date}\n${signHeaders}${path}`;
}

function signString(source, secret) {
  var buff = crypto.createHmac('sha256', secret).update(source, 'utf8').digest();
  return new Buffer(buff, 'binary').toString('base64');
}

var Client = function () {
  function Client(accountid, config) {
    _classCallCheck(this, Client);

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

    this.endpoint = `${protocol}://${accountid}.fc.${region}${internal}.aliyuncs.com`;
    this.host = `${accountid}.fc.${region}${internal}.aliyuncs.com`;
    this.version = '2016-08-15';
    this.timeout = 10000; // 10s
  }

  _createClass(Client, [{
    key: 'buildHeaders',
    value: function buildHeaders() {
      var now = new Date();
      var headers = {
        'accept': 'application/json',
        'date': now.toUTCString(),
        'host': this.host,
        'user-agent': `Node.js(${process.version}) OS(${process.platform}/${process.arch}) SDK(${pkg.name}@v${pkg.version})`,
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
      var _ref = _asyncToGenerator(_regenerator2.default.mark(function _callee(method, path, query, body) {
        var url, headers, postBody, buff, digest, md5, stringToSign, signature, response, responseBody, contentType, code, requestid, err;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                url = `${this.endpoint}/${this.version}${path}`;

                if (query && Object.keys(query).length > 0) {
                  url = `${url}?${querystring.stringify(query)}`;
                }

                headers = this.buildHeaders();


                if (body) {
                  debug('request body: %s', body);
                  buff = null;

                  if (Buffer.isBuffer(body)) {
                    buff = body;
                    headers['content-type'] = 'application/octet-stream';
                  } else if (typeof body === 'string') {
                    buff = new Buffer(body, 'utf8');
                    headers['content-type'] = 'application/octet-stream';
                  } else {
                    buff = new Buffer(JSON.stringify(body), 'utf8');
                    headers['content-type'] = 'application/json';
                  }
                  digest = kitx.md5(buff, 'hex');
                  md5 = new Buffer(digest, 'utf8').toString('base64');

                  headers['content-length'] = buff.length;
                  headers['content-md5'] = md5;
                  postBody = buff;
                }

                stringToSign = composeStringToSign(method, `/${this.version}${path}`, headers);

                debug('stringToSign: %s', stringToSign);
                signature = signString(stringToSign, this.accessKeySecret);

                headers['authorization'] = `FC ${this.accessKeyID}:${signature}`;

                debug('request headers: %j', headers);

                _context.next = 11;
                return httpx.request(url, {
                  method,
                  timeout: this.timeout,
                  headers,
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
                err = new Error(`${method} ${path} failed with ${code}. requestid: ${requestid}, message: ${responseBody.ErrorMessage}.`);

                err.name = `FC${responseBody.ErrorCode}Error`;
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
     * 创建Service
     *
     * Options:
     * - description Service的简短描述
     * - logConfig log config
     * - role Service role
     *
     * @param {String} serviceName 服务名
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 ServiceResponse
     */

  }, {
    key: 'createService',
    value: function createService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('POST', '/services', null, Object.assign({
        serviceName
      }, options));
    }

    /**
     * 获取Service列表
     *
     * Options:
     * - limit
     * - prefix
     * - startKey
     * - nextToken
     *
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Service 列表
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
     * @param {String} serviceName
     * @return {Promise} 返回 Service 信息
     */

  }, {
    key: 'getService',
    value: function getService(serviceName) {
      return this.request('GET', `/services/${serviceName}`, null);
    }

    /**
     * 更新Service信息
     *
     * Options:
     * - description Service的简短描述
     * - logConfig log config
     * - role service role
     *
     * @param {String} serviceName 服务名
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Service 信息
     */

  }, {
    key: 'updateService',
    value: function updateService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('PUT', `/services/${serviceName}`, null, options);
    }

    /**
     * 删除Service
     *
     * @param {String} serviceName
     * @return {Promise}
     */

  }, {
    key: 'deleteService',
    value: function deleteService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('DELETE', `/services/${serviceName}`, null, options);
    }

    /**
     * 创建Function
     *
     * Options:
     * - description function的简短描述
     * - code function代码
     * - functionName
     * - handler
     * - memorySize
     * - runtime
     * - timeout
     *
     * @param {String} serviceName 服务名
     * @param {Object} options Function配置
     * @return {Promise} 返回 Function 信息
     */

  }, {
    key: 'createFunction',
    value: function createFunction(serviceName, options) {
      return this.request('POST', `/services/${serviceName}/functions`, null, options);
    }

    /**
     * 获取Function列表
     *
     * Options:
     * - limit
     * - prefix
     * - startKey
     * - nextToken
     *
     * @param {String} serviceName
     * @param {Object} options 选项，optional
     * @return {Promise} 返回Function列表
     */

  }, {
    key: 'listFunctions',
    value: function listFunctions(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.request('GET', `/services/${serviceName}/functions`, options);
    }

    /**
     * 获取Function信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @return {Promise} 返回 Function 信息
     */

  }, {
    key: 'getFunction',
    value: function getFunction(serviceName, functionName) {
      return this.request('GET', `/services/${serviceName}/functions/${functionName}`);
    }

    /**
     * 获取Function Code信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @return {Promise} 返回 Function Code 信息
     */

  }, {
    key: 'getFunctionCode',
    value: function getFunctionCode(serviceName, functionName) {
      return this.request('GET', `/services/${serviceName}/functions/${functionName}/code`);
    }

    /**
     * 更新Function信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} options Function配置，见createFunction
     * @return {Promise} 返回 Function 信息
     */

  }, {
    key: 'updateFunction',
    value: function updateFunction(serviceName, functionName, options) {
      return this.request('PUT', `/services/${serviceName}/functions/${functionName}`, null, options);
    }

    /**
     * 删除Function
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @return {Promise}
     */

  }, {
    key: 'deleteFunction',
    value: function deleteFunction(serviceName, functionName) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.request('DELETE', `/services/${serviceName}/functions/${functionName}`, options);
    }

    /**
     * 调用Function
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} event event信息
     * @return {Promise} 返回Function的执行结果
     */

  }, {
    key: 'invokeFunction',
    value: function invokeFunction(serviceName, functionName, event) {
      if (event && typeof event !== 'string' && !Buffer.isBuffer(event)) {
        throw new TypeError('"event" must be String or Buffer');
      }
      return this.request('POST', `/services/${serviceName}/functions/${functionName}/invocations`, null, event);
    }

    /**
     * 创建Trigger
     *
     * Options:
     * - invocationRole
     * - sourceArn
     * - triggerType
     * - triggerName
     * - triggerConfig
     *
     * @param {String} serviceName 服务名
     * @param {String} functionName 服务名
     * @param {Object} options Trigger配置
     * @return {Promise} 返回 Trigger 信息
     */

  }, {
    key: 'createTrigger',
    value: function createTrigger(serviceName, functionName, options) {
      return this.request('POST', `/services/${serviceName}/functions/${functionName}/triggers`, null, options);
    }

    /**
     * 获取Trigger列表
     *
     * Options:
     * - limit
     * - prefix
     * - startKey
     * - nextToken
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} options 选项，optional
     * @return {Promise} 返回Trigger列表
     */

  }, {
    key: 'listTriggers',
    value: function listTriggers(serviceName, functionName) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.request('GET', `/services/${serviceName}/functions/${functionName}/triggers`, options);
    }

    /**
     * 获取Trigger信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {String} triggerName
     * @return {Promise} 返回 Trigger 信息
     */

  }, {
    key: 'getTrigger',
    value: function getTrigger(serviceName, functionName, triggerName) {
      return this.request('GET', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`);
    }

    /**
     * 更新Trigger信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {String} triggerName
     * @param {Object} options Trigger配置，见createTrigger
     * @return {Promise} 返回 Trigger 信息
     */

  }, {
    key: 'updateTrigger',
    value: function updateTrigger(serviceName, functionName, triggerName, options) {
      return this.request('PUT', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`, null, options);
    }

    /**
     * 删除Trigger
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {String} triggerName
     * @return {Promise}
     */

  }, {
    key: 'deleteTrigger',
    value: function deleteTrigger(serviceName, functionName, triggerName, options) {
      return this.request('DELETE', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`, null, options);
    }
  }]);

  return Client;
}();

module.exports = Client;