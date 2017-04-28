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
  return Buffer.from(buff, 'binary').toString('base64');
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
      const buff = Buffer.from(content, 'utf8');
      const digest = kitx.md5(buff, 'hex');
      const md5 = Buffer.from(digest, 'utf8').toString('base64');
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
  createService(serviceName, options = {}) {
    return this.request('POST', '/services', null, Object.assign({
      serviceName,
    }, options));
  }

  /**
   * 获取service列表
   *
   * @return {Promise} 返回服务列表
   */
  listServices(options = {}) {
    return this.request('GET', '/services', options);
  }

  /**
   * 获取service信息
   *
   * @return {Promise} 返回 Service 信息
   */
  getService(serviceName) {
    return this.request('GET', `/services/${serviceName}`, null);
  }

  updateService(serviceName, options = {}) {
    return this.request('PUT', `/services/${serviceName}`, null, options);
  }

  deleteService(serviceName, options = {}) {
    return this.request('DELETE', `/services/${serviceName}`, null, options);
  }

  createFunction(serviceName, options) {
    return this.request('POST', `/services/${serviceName}/functions`, null, options);
  }

  listFunctions(serviceName, options = {}) {
    return this.request('GET', `/services/${serviceName}/functions`, options);
  }

  getFunction(serviceName, functionName) {
    return this.request('GET', `/services/${serviceName}/functions/${functionName}`);
  }

  updateFunction(serviceName, functionName, options) {
    return this.request('PUT', `/services/${serviceName}/functions/${functionName}`, null, options);
  }

  deleteFunction(serviceName, functionName, options = {}) {
    return this.request('DELETE', `/services/${serviceName}/functions/${functionName}`, options);
  }

  invokeFunction(serviceName, functionName, options) {
    return this.request('POST', `/services/${serviceName}/functions/${functionName}/invocations`, null, options);
  }

  createTrigger(serviceName, functionName, options) {
    return this.request('POST', `/services/${serviceName}/functions/${functionName}/triggers`, null, options);
  }

  listTriggers(serviceName, functionName, options = {}) {
    return this.request('GET', `/services/${serviceName}/functions/${functionName}/triggers`, options);
  }

  getTrigger(serviceName, functionName, triggerName) {
    return this.request('GET', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`);
  }

  updateTrigger(serviceName, functionName, triggerName, options) {
    return this.request('PUT', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`, null, options);
  }

  /**
   * Delete
   */
  deleteTrigger(serviceName, functionName, triggerName, options) {
    return this.request('DELETE', `/services/${serviceName}/functions/${functionName}/triggers/${triggerName}`, null, options);
  }
}

module.exports = Client;
