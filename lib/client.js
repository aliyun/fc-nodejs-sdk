'use strict';

const querystring = require('querystring');
const crypto = require('crypto');

const httpx = require('httpx');
const kitx = require('kitx');
const debug = require('debug')('lambda');
const pkg = require('../package.json');
const helper = require('./helper')

function signString(source, secret) {
  const buff = crypto.createHmac('sha256', secret)
    .update(source, 'utf8')
    .digest();
  return new Buffer(buff, 'binary').toString('base64');
}


class Client {
  constructor(accountid, config) {
    if (!accountid) {
      throw new TypeError('"accountid" must be passed in');
    }
    this.accountid = accountid;

    if (!config) {
      throw new TypeError('"config" must be passed in');
    }

    const accessKeyID = config.accessKeyID;
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

    const accessKeySecret = config.accessKeySecret;
    if (!accessKeySecret) {
      throw new TypeError('"config.accessKeySecret" must be passed in');
    }

    this.accessKeySecret = accessKeySecret;

    const region = config.region;
    if (!region) {
      throw new TypeError('"config.region" must be passed in');
    }

    const protocol = config.secure ? 'https' : 'http';

    const internal = config.internal ? '-internal': '';

    this.endpoint = `${protocol}://${accountid}.${region}${internal}.fc.aliyuncs.com`;
    this.host = `${accountid}.${region}${internal}.fc.aliyuncs.com`;
    this.version = '2016-08-15';
    this.timeout = Number.isFinite(config.timeout) ? config.timeout : 60000; // default is 60s
    
    this.headers = config.headers || {};
  }

  buildHeaders() {
    var now = new Date();
    const headers = {
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

  async request(method, path, query, body, headers = {}) {
    var url = `${this.endpoint}/${this.version}${path}`;
    if (query && Object.keys(query).length > 0) {
      url = `${url}?${querystring.stringify(query)}`;
    }

    headers = Object.assign(this.buildHeaders(), this.headers, headers);
    var postBody;

    if (body) {
      debug('request body: %s', body);
      var buff = null;
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
      const digest = kitx.md5(buff, 'hex');
      const md5 = new Buffer(digest, 'utf8').toString('base64');
      headers['content-length'] = buff.length;
      headers['content-md5'] = md5;
      postBody = buff;
    }

    var queriesToSign = null;
    if (path.startsWith('/proxy/')) {
        queriesToSign = query || {}
    }
    var signature = Client.getSignature(this.accessKeyID, this.accessKeySecret, method, `/${this.version}${path}`, headers, queriesToSign);
    headers['authorization'] = signature;

    debug('request headers: %j', headers);

    const response = await httpx.request(url, {
      method,
      timeout: this.timeout,
      headers,
      data: postBody
    });

    debug('response status: %s', response.statusCode);
    debug('response headers: %j', response.headers);

    var responseBody = await httpx.read(response, 'utf8');

    debug('response body: %s', responseBody);

    const contentType = response.headers['content-type'] || '';
    if (contentType.startsWith('application/json')) {
      try {
        responseBody = JSON.parse(responseBody);
      } catch (ex) {
        // TODO: add extra message
        throw ex;
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const code = response.statusCode;
      const requestid = response.headers['x-fc-request-id'];
      const err = new Error(`${method} ${path} failed with ${code}. requestid: ${requestid}, message: ${responseBody.ErrorMessage}.`);
      err.name = `FC${responseBody.ErrorCode}Error`;
      err.code = responseBody.ErrorCode;
      throw err;
    }

    return {
      'headers': response.headers,
      'data': responseBody,
    };
  }

  /*!
   * GET 请求
   *
   * @param {String} path 请求路径
   * @param {Object} query 请求中的 query 部分
   * @param {Object} headers 请求中的自定义 headers 部分
   * @return {Promise} 返回 Response
   */
  get(path, query, headers) {
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
  post(path, body, headers, queries) {
    return this.request('POST', path, queries, body, headers);
  }

  /*!
   * PUT 请求
   *
   * @param {String} path 请求路径
   * @param {Buffer|String|Object} body 请求中的 body 部分
   * @param {Object} headers 请求中的自定义 headers 部分
   * @return {Promise} 返回 Response
   */
  put(path, body, headers) {
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
  delete(path, query, headers) {
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
  createService(serviceName, options = {}, headers) {
    return this.post('/services', Object.assign({
      serviceName,
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
  listServices(options = {}, headers) {
    return this.get('/services', options, headers);
  }

  /**
   * 获取service信息
   *
   * @param {String} serviceName
   * @return {Promise} 返回 Object(包含headers和data属性[Service 信息])
   */
  getService(serviceName, headers) {
    return this.get(`/services/${serviceName}`, null, headers);
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
  updateService(serviceName, options = {}, headers) {
    return this.put(`/services/${serviceName}`, options, headers);
  }

  /**
   * 删除Service
   *
   * @param {String} serviceName
   * @return {Promise} 返回 Object(包含headers和data属性)
   */
  deleteService(serviceName, options = {}, headers) {
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
   * - memorySize
   * - runtime
   * - timeout
   *
   * @param {String} serviceName 服务名
   * @param {Object} options Function配置
   * @return {Promise} 返回 Function 信息
   */
  createFunction(serviceName, options, headers) {
    this.normalizeParams(options);
    return this.post(`/services/${serviceName}/functions`, options, headers);
  }

  normalizeParams(opts) {
    if (opts.functionName){
      opts.functionName = String(opts.functionName);
    }

    if (opts.runtime){
      opts.runtime = String(opts.runtime);
    }

    if (opts.handler){
      opts.handler = String(opts.handler);
    }

    if (opts.memorySize){
      opts.memorySize = parseInt(opts.memorySize, 10);
    }

    if (opts.timeout){
      opts.timeout = parseInt(opts.timeout, 10);

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
   * @return {Promise} 返回 Object(包含headers和data属性[Function列表])
   */
  listFunctions(serviceName, options = {}, headers) {
    return this.get(`/services/${serviceName}/functions`, options, headers);
  }

  /**
   * 获取Function信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @return {Promise} 返回 Object(包含headers和data属性[Function信息])
   */
  getFunction(serviceName, functionName, headers) {
    return this.get(`/services/${serviceName}/functions/${functionName}`, null, headers);
  }

  /**
   * 获取Function Code信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @return {Promise} 返回 Object(包含headers和data属性[Function信息])
   */
  getFunctionCode(serviceName, functionName, headers) {
    return this.get(`/services/${serviceName}/functions/${functionName}/code`, headers);
  }

  /**
   * 更新Function信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} options Function配置，见createFunction
   * @return {Promise} 返回 Object(包含headers和data属性[Function信息])
   */
  updateFunction(serviceName, functionName, options, headers) {
    this.normalizeParams(options);
    const path = `/services/${serviceName}/functions/${functionName}`;
    return this.put(path, options, headers);
  }

  /**
   * 删除Function
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @return {Promise} 返回 Object(包含headers和data属性)
   */
  deleteFunction(serviceName, functionName, options = {}, headers) {
    const path = `/services/${serviceName}/functions/${functionName}`;
    return this.delete(path, options, headers);
  }

  /**
   * 调用Function
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} event event信息
   * @return {Promise} 返回 Object(包含headers和data属性[返回Function的执行结果])
   */
  invokeFunction(serviceName, functionName, event, headers = {}) {
    if (event && typeof event !== 'string' && !Buffer.isBuffer(event)) {
      throw new TypeError('"event" must be String or Buffer');
    }
    const path = `/services/${serviceName}/functions/${functionName}/invocations`;
    return this.post(path, event, headers);
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
   * @return {Promise} 返回 Object(包含headers和data属性[Trigger信息])
   */
  createTrigger(serviceName, functionName, options, headers) {
    const path = `/services/${serviceName}/functions/${functionName}/triggers`;
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
  listTriggers(serviceName, functionName, options = {}, headers) {
    const path = `/services/${serviceName}/functions/${functionName}/triggers`;
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
  getTrigger(serviceName, functionName, triggerName, headers) {
    const path = `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`;
    return this.get(path, null, headers);
  }

  /**
   * 更新Trigger信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {String} triggerName
   * @param {Object} options Trigger配置，见createTrigger
   * @return {Promise} 返回 Object(包含headers和data属性[Trigger信息])
   */
  updateTrigger(serviceName, functionName, triggerName, options, headers) {
    const path = `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`;
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
  deleteTrigger(serviceName, functionName, triggerName, options, headers) {
    const path = `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`;
    return this.delete(path, options, headers);
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
  static getSignature(accessKeyID, accessKeySecret, method, path, headers, queries) {
    var stringToSign = helper.composeStringToSign(method, path, headers, queries);
    debug('stringToSign: %s', stringToSign);
    var sign = signString(stringToSign, accessKeySecret);
    return `FC ${accessKeyID}:${sign}`;
  }
}

module.exports = Client;
