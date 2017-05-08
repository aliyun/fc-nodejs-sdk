'use strict';

const querystring = require('querystring');
const crypto = require('crypto');

const httpx = require('httpx');
const kitx = require('kitx');
const debug = require('debug')('lambda');
const pkg = require('../package.json');

function buildCanonicalHeaders(headers, prefix) {
  var list = [];
  var keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.startsWith(prefix)) {
      list.push(key);
    }
  }
  list.sort();

  var canonical = '';
  for (let i = 0; i < list.length; i++) {
    const key = list[i];
    canonical += `${key}:${headers[key]}\n`;
  }

  return canonical;
}

function composeStringToSign(method, path, headers) {
  const contentMD5 = headers['content-md5'] || '';
  const contentType = headers['content-type'] || '';
  const date = headers['date'];
  const signHeaders = buildCanonicalHeaders(headers, 'x-fc');
  return `${method}\n${contentMD5}\n${contentType}\n${date}\n${signHeaders}${path}`;
}

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

    this.endpoint = `${protocol}://${accountid}.fc.${region}${internal}.aliyuncs.com`;
    this.host = `${accountid}.fc.${region}${internal}.aliyuncs.com`;
    this.version = '2016-08-15';
    this.timeout = 10000; // 10s
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

  async request(method, path, query, body) {
    var url = `${this.endpoint}/${this.version}${path}`;
    if (query && Object.keys(query).length > 0) {
      url = `${url}?${querystring.stringify(query)}`;
    }

    var headers = this.buildHeaders();
    var postBody;

    if (body) {
      const content = JSON.stringify(body);
      debug('request body: %s', content);
      const buff = new Buffer(content, 'utf8');
      const digest = kitx.md5(buff, 'hex');
      const md5 = new Buffer(digest, 'utf8').toString('base64');
      headers['content-type'] = 'application/json';
      headers['content-length'] = buff.length;
      headers['content-md5'] = md5;
      postBody = buff;
    }

    var stringToSign = composeStringToSign(method, `/${this.version}${path}`, headers);
    debug('stringToSign: %s', stringToSign);
    var signature = signString(stringToSign, this.accessKeySecret);
    headers['authorization'] = `FC ${this.accessKeyID}:${signature}`;

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

    return responseBody;
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
   * @return {Promise} 返回 ServiceResponse
   */
  createService(serviceName, options = {}) {
    return this.request('POST', '/services', null, Object.assign({
      serviceName,
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
  listServices(options = {}) {
    return this.request('GET', '/services', options);
  }

  /**
   * 获取service信息
   *
   * @param {String} serviceName
   * @return {Promise} 返回 Service 信息
   */
  getService(serviceName) {
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
  updateService(serviceName, options = {}) {
    return this.request('PUT', `/services/${serviceName}`, null, options);
  }

  /**
   * 删除Service
   *
   * @param {String} serviceName
   * @return {Promise}
   */
  deleteService(serviceName, options = {}) {
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
  createFunction(serviceName, options) {
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
  listFunctions(serviceName, options = {}) {
    return this.request('GET', `/services/${serviceName}/functions`, options);
  }

  /**
   * 获取Function信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @return {Promise} 返回 Function 信息
   */
  getFunction(serviceName, functionName) {
    return this.request('GET', `/services/${serviceName}/functions/${functionName}`);
  }

  /**
   * 更新Function信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} options Function配置，见createFunction
   * @return {Promise} 返回 Function 信息
   */
  updateFunction(serviceName, functionName, options) {
    return this.request('PUT', `/services/${serviceName}/functions/${functionName}`, null, options);
  }

  /**
   * 删除Function
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @return {Promise}
   */
  deleteFunction(serviceName, functionName, options = {}) {
    return this.request('DELETE', `/services/${serviceName}/functions/${functionName}`, options);
  }

  /**
   * 调用Function
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} options event信息
   * @return {Promise} 返回Function的执行结果
   */
  invokeFunction(serviceName, functionName, options) {
    return this.request('POST', `/services/${serviceName}/functions/${functionName}/invocations`, null, options);
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
  createTrigger(serviceName, functionName, options) {
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
  listTriggers(serviceName, functionName, options = {}) {
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
  getTrigger(serviceName, functionName, triggerName) {
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
  updateTrigger(serviceName, functionName, triggerName, options) {
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
  deleteTrigger(serviceName, functionName, triggerName, options) {
    return this.request('DELETE', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`, null, options);
  }
}

module.exports = Client;
