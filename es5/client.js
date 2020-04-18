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
var helper = require('./helper');

function signString(source, secret) {
  var buff = crypto.createHmac('sha256', secret).update(source, 'utf8').digest();
  return new Buffer(buff, 'binary').toString('base64');
}

function getServiceName(serviceName, qualifier) {
  if (qualifier) {
    return `${serviceName}.${qualifier}`;
  }

  return serviceName;
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

    if (this.accessKeyID.startsWith('STS')) {
      this.securityToken = config.securityToken;
      if (!this.securityToken) {
        throw new TypeError('"config.securityToken" must be passed in for STS');
      }
    }

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

    this.endpoint = config.endpoint || `${protocol}://${accountid}.${region}${internal}.fc.aliyuncs.com`;
    this.host = `${accountid}.${region}${internal}.fc.aliyuncs.com`;
    this.version = '2016-08-15';
    this.timeout = Number.isFinite(config.timeout) ? config.timeout : 60000; // default is 60s
    this.headers = config.headers || {};
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
      var _ref = _asyncToGenerator( /*#__PURE__*/_regenerator2.default.mark(function _callee(method, path, query, body) {
        var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
        var opts = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
        var url, postBody, buff, digest, md5, queriesToSign, signature, response, responseBody, contentType, code, requestid, errMsg, err;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                url = `${this.endpoint}/${this.version}${path}`;

                if (query && Object.keys(query).length > 0) {
                  url = `${url}?${querystring.stringify(query)}`;
                }

                headers = Object.assign(this.buildHeaders(), this.headers, headers);

                if (body) {
                  debug('request body: %s', body);
                  buff = null;

                  if (Buffer.isBuffer(body)) {
                    buff = body;
                    headers['content-type'] = 'application/octet-stream';
                  } else if (typeof body === 'string') {
                    buff = new Buffer(body, 'utf8');
                    headers['content-type'] = 'application/octet-stream';
                  } else if ('function' === typeof body.pipe) {
                    buff = body;
                    headers['content-type'] = 'application/octet-stream';
                  } else {
                    buff = new Buffer(JSON.stringify(body), 'utf8');
                    headers['content-type'] = 'application/json';
                  }

                  if ('function' !== typeof body.pipe) {
                    digest = kitx.md5(buff, 'hex');
                    md5 = new Buffer(digest, 'utf8').toString('base64');


                    headers['content-length'] = buff.length;
                    headers['content-md5'] = md5;
                  }
                  postBody = buff;
                }

                queriesToSign = null;

                if (path.startsWith('/proxy/')) {
                  queriesToSign = query || {};
                }
                signature = Client.getSignature(this.accessKeyID, this.accessKeySecret, method, `/${this.version}${path}`, headers, queriesToSign);

                headers['authorization'] = signature;

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

                if (!(!opts['rawBuf'] || response.headers['x-fc-error-type'])) {
                  _context.next = 20;
                  break;
                }

                _context.next = 17;
                return httpx.read(response, 'utf8');

              case 17:
                responseBody = _context.sent;
                _context.next = 23;
                break;

              case 20:
                _context.next = 22;
                return httpx.read(response);

              case 22:
                responseBody = _context.sent;

              case 23:

                debug('response body: %s', responseBody);

                contentType = response.headers['content-type'] || '';

                if (!contentType.startsWith('application/json')) {
                  _context.next = 33;
                  break;
                }

                _context.prev = 26;

                responseBody = JSON.parse(responseBody);
                _context.next = 33;
                break;

              case 30:
                _context.prev = 30;
                _context.t0 = _context['catch'](26);
                throw _context.t0;

              case 33:
                if (!(response.statusCode < 200 || response.statusCode >= 300)) {
                  _context.next = 41;
                  break;
                }

                code = response.statusCode;
                requestid = response.headers['x-fc-request-id'];

                if (responseBody.ErrorMessage) {
                  errMsg = responseBody.ErrorMessage;
                } else {
                  errMsg = responseBody.errorMessage;
                }
                err = new Error(`${method} ${path} failed with ${code}. requestid: ${requestid}, message: ${errMsg}.`);

                err.name = `FC${responseBody.ErrorCode}Error`;
                err.code = responseBody.ErrorCode;
                throw err;

              case 41:
                return _context.abrupt('return', {
                  'headers': response.headers,
                  'data': responseBody
                });

              case 42:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[26, 30]]);
      }));

      function request(_x3, _x4, _x5, _x6) {
        return _ref.apply(this, arguments);
      }

      return request;
    }()

    /*!
     * GET 请求
     *
     * @param {String} path 请求路径
     * @param {Object} query 请求中的 query 部分
     * @param {Object} headers 请求中的自定义 headers 部分
     * @return {Promise} 返回 Response
     */

  }, {
    key: 'get',
    value: function get(path, query, headers) {
      return this.request('GET', path, query, null, headers);
    }

    /*!
     * POST 请求
     *
     * @param {String} path 请求路径
     * @param {Buffer|String|Object} body 请求中的 body 部分
     * @param {Object} headers 请求中的自定义 headers 部分
     * @param {Object} queries 请求中的自定义 queries 部分
     * @return {Promise} 返回 Response
     */

  }, {
    key: 'post',
    value: function post(path, body, headers, queries) {
      var opts = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      return this.request('POST', path, queries, body, headers, opts);
    }

    /*!
     * PUT 请求
     *
     * @param {String} path 请求路径
     * @param {Buffer|String|Object} body 请求中的 body 部分
     * @param {Object} headers 请求中的自定义 headers 部分
     * @return {Promise} 返回 Response
     */

  }, {
    key: 'put',
    value: function put(path, body, headers) {
      return this.request('PUT', path, null, body, headers);
    }

    /*!
     * DELETE 请求
     *
     * @param {String} path 请求路径
     * @param {Object} query 请求中的 query 部分
     * @param {Object} headers 请求中的自定义 headers 部分
     * @return {Promise} 返回 Response
     */

  }, {
    key: 'delete',
    value: function _delete(path, query, headers) {
      return this.request('DELETE', path, query, null, headers);
    }

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
     * @return {Promise} 返回 Object(包含headers和data属性[ServiceResponse])
     */

  }, {
    key: 'createService',
    value: function createService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments[2];

      return this.post('/services', Object.assign({
        serviceName
      }, options), headers);
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
     * @return {Promise} 返回 Object(包含headers和data属性[Service 列表])
     */

  }, {
    key: 'listServices',
    value: function listServices() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var headers = arguments[1];

      if (options.tags !== undefined) {
        for (var k in options.tags) {
          if (options.tags.hasOwnProperty(k)) {
            options[`tag_${k}`] = options.tags[k];
          }
        }
        delete options.tags;
      }
      return this.get('/services', options, headers);
    }

    /**
     * 获取service信息
     *
     * @param {String} serviceName
     * @param {Object} headers
     * @param {String} qualifier
     * @return {Promise} 返回 Object(包含headers和data属性[Service 信息])
     */

  }, {
    key: 'getService',
    value: function getService(serviceName) {
      var headers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var qualifier = arguments[2];

      return this.get(`/services/${getServiceName(serviceName, qualifier)}`, null, headers);
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
     * @return {Promise} 返回 Object(包含headers和data属性[Service 信息])
     */

  }, {
    key: 'updateService',
    value: function updateService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments[2];

      return this.put(`/services/${serviceName}`, options, headers);
    }

    /**
     * 删除Service
     *
     * @param {String} serviceName
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'deleteService',
    value: function deleteService(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments[2];

      return this.delete(`/services/${serviceName}`, null, options, headers);
    }

    /**
     * 创建Function
     *
     * Options:
     * - description function的简短描述
     * - code function代码
     * - functionName
     * - handler
     * - initializer
     * - memorySize
     * - runtime
     * - timeout
     * - initializationTimeout
     *
     * @param {String} serviceName 服务名
     * @param {Object} options Function配置
     * @return {Promise} 返回 Function 信息
     */

  }, {
    key: 'createFunction',
    value: function createFunction(serviceName, options, headers) {
      this.normalizeParams(options);
      return this.post(`/services/${serviceName}/functions`, options, headers);
    }
  }, {
    key: 'normalizeParams',
    value: function normalizeParams(opts) {
      if (opts.functionName) {
        opts.functionName = String(opts.functionName);
      }

      if (opts.runtime) {
        opts.runtime = String(opts.runtime);
      }

      if (opts.handler) {
        opts.handler = String(opts.handler);
      }

      if (opts.initializer) {
        opts.initializer = String(opts.initializer);
      }

      if (opts.memorySize) {
        opts.memorySize = parseInt(opts.memorySize, 10);
      }

      if (opts.timeout) {
        opts.timeout = parseInt(opts.timeout, 10);
      }

      if (opts.initializationTimeout) {
        opts.initializationTimeout = parseInt(opts.initializationTimeout, 10);
      }
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
     * @param {Object} headers
     * @param {String} qualifier 可选
     * @return {Promise} 返回 Object(包含headers和data属性[Function列表])
     */

  }, {
    key: 'listFunctions',
    value: function listFunctions(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var qualifier = arguments[3];

      return this.get(`/services/${getServiceName(serviceName, qualifier)}/functions`, options, headers);
    }

    /**
     * 获取Function信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} headers
     * @param {String} qualifier 可选
     * @return {Promise} 返回 Object(包含headers和data属性[Function信息])
     */

  }, {
    key: 'getFunction',
    value: function getFunction(serviceName, functionName) {
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var qualifier = arguments[3];

      return this.get(`/services/${getServiceName(serviceName, qualifier)}/functions/${functionName}`, null, headers);
    }

    /**
     * 获取Function Code信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} headers
     * @param {String} qualifier 可选
     * @return {Promise} 返回 Object(包含headers和data属性[Function信息])
     */

  }, {
    key: 'getFunctionCode',
    value: function getFunctionCode(serviceName, functionName) {
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var qualifier = arguments[3];

      return this.get(`/services/${getServiceName(serviceName, qualifier)}/functions/${functionName}/code`, headers);
    }

    /**
     * 更新Function信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} options Function配置，见createFunction
     * @return {Promise} 返回 Object(包含headers和data属性[Function信息])
     */

  }, {
    key: 'updateFunction',
    value: function updateFunction(serviceName, functionName, options, headers) {
      this.normalizeParams(options);
      var path = `/services/${serviceName}/functions/${functionName}`;
      return this.put(path, options, headers);
    }

    /**
     * 删除Function
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'deleteFunction',
    value: function deleteFunction(serviceName, functionName) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var headers = arguments[3];

      var path = `/services/${serviceName}/functions/${functionName}`;
      return this.delete(path, options, headers);
    }

    /**
     * 调用Function
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} event event信息
     * @param {Object} headers
     * @param {String} qualifier
     * @return {Promise} 返回 Object(包含headers和data属性[返回Function的执行结果])
     */

  }, {
    key: 'invokeFunction',
    value: function invokeFunction(serviceName, functionName, event) {
      var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var qualifier = arguments[4];
      var opts = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};

      if (event && typeof event !== 'string' && !Buffer.isBuffer(event)) {
        throw new TypeError('"event" must be String or Buffer');
      }

      var path = `/services/${getServiceName(serviceName, qualifier)}/functions/${functionName}/invocations`;
      return this.post(path, event, headers, null, opts);
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
     * - qualifier
     *
     * @param {String} serviceName 服务名
     * @param {String} functionName 服务名
     * @param {Object} options Trigger配置
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性[Trigger信息])
     */

  }, {
    key: 'createTrigger',
    value: function createTrigger(serviceName, functionName, options) {
      var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      var path = `/services/${serviceName}/functions/${functionName}/triggers`;
      return this.post(path, options, headers);
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
     * @return {Promise} 返回 Object(包含headers和data属性[Trigger列表])
     */

  }, {
    key: 'listTriggers',
    value: function listTriggers(serviceName, functionName) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var headers = arguments[3];

      var path = `/services/${serviceName}/functions/${functionName}/triggers`;
      return this.get(path, options, headers);
    }

    /**
     * 获取Trigger信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {String} triggerName
     * @return {Promise} 返回 Object(包含headers和data属性[Trigger信息])
     */

  }, {
    key: 'getTrigger',
    value: function getTrigger(serviceName, functionName, triggerName, headers) {
      var path = `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`;
      return this.get(path, null, headers);
    }

    /**
     * 更新Trigger信息
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {String} triggerName
     * @param {Object} options Trigger配置，见createTrigger
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性[Trigger信息])
     */

  }, {
    key: 'updateTrigger',
    value: function updateTrigger(serviceName, functionName, triggerName) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      var path = `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`;
      return this.put(path, options, headers);
    }

    /**
     * 删除Trigger
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {String} triggerName
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'deleteTrigger',
    value: function deleteTrigger(serviceName, functionName, triggerName, options, headers) {
      var path = `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`;
      return this.delete(path, options, headers);
    }

    /**
     * 创建CustomDomain
     *
     * Options:
     * - protocol
     * - routeConfig
     *
     * @param {String} domainName 域名
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Object(包含headers和data属性[CustomDomainResponse])
     */

  }, {
    key: 'createCustomDomain',
    value: function createCustomDomain(domainName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments[2];

      return this.post('/custom-domains', Object.assign({
        domainName
      }, options), headers);
    }

    /**
     * 获取CustomDomain列表
     *
     * Options:
     * - limit
     * - prefix
     * - startKey
     * - nextToken
     *
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Object(包含headers和data属性[CustomDomain 列表])
     */

  }, {
    key: 'listCustomDomains',
    value: function listCustomDomains() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var headers = arguments[1];

      return this.get('/custom-domains', options, headers);
    }

    /**
     * 获取CustomDomain信息
     *
     * @param {String} domainName
     * @return {Promise} 返回 Object(包含headers和data属性[CustomDomain 信息])
     */

  }, {
    key: 'getCustomDomain',
    value: function getCustomDomain(domainName, headers) {
      return this.get(`/custom-domains/${domainName}`, null, headers);
    }

    /**
     * 更新CustomDomain信息
     *
     * Options:
     * - protocol
     * - routeConfig
     *
     * @param {String} domainName
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Object(包含headers和data属性[Service 信息])
     */

  }, {
    key: 'updateCustomDomain',
    value: function updateCustomDomain(domainName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments[2];

      return this.put(`/custom-domains/${domainName}`, options, headers);
    }

    /**
     * 删除CustomDomain
     *
     * @param {String} domainName
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'deleteCustomDomain',
    value: function deleteCustomDomain(domainName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments[2];

      return this.delete(`/custom-domains/${domainName}`, null, options, headers);
    }

    /**
     * 创建 version
     *
     * @param {String} serviceName
     * @param {String} description
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性[Version 信息])
     */

  }, {
    key: 'publishVersion',
    value: function publishVersion(serviceName, description, headers) {
      var body = {};
      if (description) {
        body.description = description;
      }
      return this.post(`/services/${serviceName}/versions`, body, headers || {});
    }

    /**
     * 列出 version
     *
     * Options:
     * - limit
     * - nextToken
     * - startKey
     * - direction
     *
     * @param {String} serviceName
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性[Version 信息])
     */

  }, {
    key: 'listVersions',
    value: function listVersions(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.get(`/services/${serviceName}/versions`, null, headers, options);
    }

    /**
     * 删除 version
     *
     * @param {String} serviceName
     * @param {String} versionId
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'deleteVersion',
    value: function deleteVersion(serviceName, versionId) {
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.delete(`/services/${serviceName}/versions/${versionId}`, null, headers);
    }

    /**
     * 创建 Alias
     *
     * Options:
     * - description
     * - additionalVersionWeight
     *
     * @param {String} serviceName
     * @param {String} aliasName
     * @param {String} versionId
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'createAlias',
    value: function createAlias(serviceName, aliasName, versionId) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      options.aliasName = aliasName;
      options.versionId = versionId;

      return this.post(`/services/${serviceName}/aliases`, options, headers);
    }

    /**
     * 删除 Alias
     *
     * @param {String} serviceName
     * @param {String} aliasName
     * @param {String} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'deleteAlias',
    value: function deleteAlias(serviceName, aliasName) {
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.delete(`/services/${serviceName}/aliases/${aliasName}`, null, headers);
    }

    /**
     * 列出 alias
     *
     * Options:
     * - limit
     * - nextToken
     * - prefix
     * - startKey
     *
     * @param {String} serviceName
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'listAliases',
    value: function listAliases(serviceName) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.get(`/services/${serviceName}/aliases`, null, headers, options);
    }

    /**
     * 获得 alias
     *
     * @param {String} serviceName
     * @param {String} aliasName
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'getAlias',
    value: function getAlias(serviceName, aliasName) {
      var headers = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      return this.get(`/services/${serviceName}/aliases/${aliasName}`, null, headers);
    }

    /**
     * 更新 alias
     *
     * Options:
     * - description
     * - additionalVersionWeight
     *
     * @param {String} serviceName
     * @param {String} aliasName
     * @param {String} versionId
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'updateAlias',
    value: function updateAlias(serviceName, aliasName, versionId) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      if (versionId) {
        options.versionId = versionId;
      }
      return this.put(`/services/${serviceName}/aliases/${aliasName}`, options, headers);
    }

    /**
     * 给fc资源打tag
     *
     * @param {String} resourceArn Resource ARN. Either full ARN or partial ARN.
     * @param {Object} tags  A list of tag keys. At least 1 tag is required. At most 20. Tag key is required, but tag value is optional.
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'tagResource',
    value: function tagResource(resourceArn, tags) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      options.resourceArn = resourceArn;
      options.tags = tags;

      return this.post('/tag', options, headers);
    }

    /**
     * 给fc资源取消tag
     *
     * @param {String} resourceArn Resource ARN. Either full ARN or partial ARN.
     * @param {Object} tagkeys  A list of tag keys. At least 1 tag key is required if all=false. At most 20.
     * @param {Boolean} all Remove all tags at once. Default value is false. Accept value: true or false.
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'untagResource',
    value: function untagResource(resourceArn, tagKeys) {
      var all = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      options.resourceArn = resourceArn;
      options.tagKeys = tagKeys;
      options.all = all;
      return this.request('DELETE', '/tag', null, options, headers);
    }

    /**
     * 获取某个资源的所有tag
     *
     * @param {Object} options
     * @param {Object} headers
     * @return {Promise} 返回 Object(包含headers和data属性)
     */

  }, {
    key: 'getResourceTags',
    value: function getResourceTags() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var headers = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      return this.get('/tag', options, headers);
    }

    /**
     * 获取reservedCapacity列表
     *
     * Options:
     * - limit
     * - nextToken
     *
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Object(包含headers和data属性[reservedCapacities 列表])
     */

  }, {
    key: 'listReservedCapacities',
    value: function listReservedCapacities() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var headers = arguments[1];

      return this.get('/reservedCapacities', options, headers);
    }

    /**
     * 获取账号下的 provisionConfigs 列表
     *
     * Options:
     * - limit
     * - nextToken
     * - serviceName
     * - qualifier
     *
     * @param {Object} options 选项，optional
     * @return {Promise} 返回 Object(包含 headers 和 data 属性[provisionConfigs 列表])
     */

  }, {
    key: 'listProvisionConfigs',
    value: function listProvisionConfigs() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var headers = arguments[1];

      return this.get('/provision-configs', options, headers);
    }

    /**
     * 获取单个函数的 provisionConfig
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} headers
     * @param {String} qualifier 可选
     * @return {Promise} 返回 Object(包含 headers 和 data 属性[provisionConfig 信息])
     */

  }, {
    key: 'getProvisionConfig',
    value: function getProvisionConfig(serviceName, functionName, qualifier) {
      var headers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      return this.get(`/services/${getServiceName(serviceName, qualifier)}/functions/${functionName}/provision-config`, null, headers);
    }

    /**
     * 更新单个函数的 provisionConfig
     *
     * @param {String} serviceName
     * @param {String} functionName
     * @param {Object} headers
     * @param {String} qualifier 可选
     * @return {Promise} 返回 Object(包含 headers 和 data 属性[provisionConfig 信息])
     */

  }, {
    key: 'putProvisionConfig',
    value: function putProvisionConfig(serviceName, functionName, qualifier) {
      var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
      var headers = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};

      return this.put(`/services/${getServiceName(serviceName, qualifier)}/functions/${functionName}/provision-config`, options, headers);
    }

    /**
     * 获得Header 签名
     *
     * @param {String} accessKeyID
     * @param {String} accessKeySecret
     * @param {String} method : GET/POST/PUT/DELETE/HEAD
     * @param {String} path
     * @param {json} headers : {headerKey1 : 'headValue1'}
     */

  }], [{
    key: 'getSignature',
    value: function getSignature(accessKeyID, accessKeySecret, method, path, headers, queries) {
      var stringToSign = helper.composeStringToSign(method, path, headers, queries);
      debug('stringToSign: %s', stringToSign);
      var sign = signString(stringToSign, accessKeySecret);
      return `FC ${accessKeyID}:${sign}`;
    }
  }]);

  return Client;
}();

module.exports = Client;