'use strict';

const querystring = require('querystring');
const crypto = require('crypto');

const httpx = require('httpx');
const kitx = require('kitx');
const debug = require('debug')('lambda');
const pkg = require('../package.json');
const helper = require('./helper');
const WebSocket = require('ws');

function signString(source, secret) {
  const buff = crypto
    .createHmac('sha256', secret)
    .update(source, 'utf8')
    .digest();
  return Buffer.from(buff, 'binary').toString('base64');
}

function getServiceName(serviceName, qualifier) {
  if (qualifier) {
    return `${serviceName}.${qualifier}`;
  }

  return serviceName;
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

    const internal = config.internal ? '-internal' : '';

    this.endpoint =
      config.endpoint ||
      `${protocol}://${accountid}.${region}${internal}.fc.aliyuncs.com`;
    this.host = `${accountid}.${region}${internal}.fc.aliyuncs.com`;
    if (config.endpoint) {
      var url = new URL(config.endpoint);
      this.host = url.hostname;
    }
    this.version = '2016-08-15';
    this.timeout = Number.isFinite(config.timeout) ? config.timeout : 60000; // default is 60s
    this.headers = config.headers || {};
  }

  buildHeaders() {
    var now = new Date();
    const headers = {
      accept: 'application/json',
      date: now.toUTCString(),
      host: this.host,
      'user-agent': `Node.js(${process.version}) OS(${process.platform}/${process.arch}) SDK(${pkg.name}@v${pkg.version})`,
      'x-fc-account-id': this.accountid
    };

    if (this.securityToken) {
      headers['x-fc-security-token'] = this.securityToken;
    }
    return headers;
  }

  async request(method, path, query, body, headers = {}, opts = {}) {
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
        buff = Buffer.from(body, 'utf8');
        headers['content-type'] = 'application/octet-stream';
      } else if ('function' === typeof body.pipe) {
        buff = body;
        headers['content-type'] = 'application/octet-stream';
      } else {
        buff = Buffer.from(JSON.stringify(body), 'utf8');
        headers['content-type'] = 'application/json';
      }

      if ('function' !== typeof body.pipe) {
        const digest = kitx.md5(buff, 'hex');
        const md5 = Buffer.from(digest, 'utf8').toString('base64');

        headers['content-length'] = buff.length;
        headers['content-md5'] = md5;
      }
      postBody = buff;
    }

    var queriesToSign = null;
    if (path.startsWith('/proxy/')) {
      queriesToSign = query || {};
    }
    var signature = Client.getSignature(
      this.accessKeyID,
      this.accessKeySecret,
      method,
      `/${this.version}${path}`,
      headers,
      queriesToSign
    );
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
    var responseBody;
    if (!opts['rawBuf'] || response.headers['x-fc-error-type']) {
      responseBody = await httpx.read(response, 'utf8');
    } else {
      responseBody = await httpx.read(response);
    }

    debug('response body: %s', responseBody);

    const contentType = response.headers['content-type'] || '';
    if (contentType.startsWith('application/json')) {
      // TODO: Need to add additional messages when an error is thrown
      responseBody = JSON.parse(responseBody);
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const code = response.statusCode;
      const requestid = response.headers['x-fc-request-id'];
      var errMsg;
      if (responseBody.ErrorMessage) {
        errMsg = responseBody.ErrorMessage;
      } else {
        errMsg = responseBody.errorMessage;
      }
      const err = new Error(
        `${method} ${path} failed with ${code}. requestid: ${requestid}, message: ${errMsg}.`
      );
      err.name = `FC${responseBody.ErrorCode}Error`;
      err.code = responseBody.ErrorCode;
      throw err;
    }

    return {
      headers: response.headers,
      data: responseBody
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
  post(path, body, headers, queries, opts = {}) {
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

  /*!
   * WebSocket 请求
   *
   * @param {String} path 请求路径
   * @param {Object} query 请求中的 query 部分
   * @param {Object} headers 请求中的自定义 headers 部分
   * @return {Promise} 返回 WebSocket
   */
  websocket(path, query, headers = {}) {
    // endpoint
    var url = `${this.endpoint.replace(/^http/, 'ws')}/${this.version}${path}`;

    // query
    if (query && Object.keys(query).length > 0) {
      url = `${url}?${querystring.stringify(query)}`;
    }

    // headers
    headers = Object.assign(this.buildHeaders(), this.headers, headers);

    var queriesToSign = null;
    if (path.startsWith('/proxy/')) {
      queriesToSign = query || {};
    }
    var signature = Client.getSignature(
      this.accessKeyID,
      this.accessKeySecret,
      'GET',
      `/${this.version}${path}`,
      headers,
      queriesToSign
    );
    headers['authorization'] = signature;

    return new WebSocket(url, { headers });
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
    return this.post(
      '/services',
      Object.assign(
        {
          serviceName
        },
        options
      ),
      headers
    );
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
    if (options.tags !== undefined) {
      for (var k in options.tags) {
        if (Object.prototype.hasOwnProperty.call(options.tags, k)) {
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
  getService(serviceName, headers = {}, qualifier) {
    return this.get(
      `/services/${getServiceName(serviceName, qualifier)}`,
      null,
      headers
    );
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
  createFunction(serviceName, options, headers) {
    this.normalizeParams(options);
    return this.post(`/services/${serviceName}/functions`, options, headers);
  }

  normalizeParams(opts) {
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
  listFunctions(serviceName, options = {}, headers = {}, qualifier) {
    return this.get(
      `/services/${getServiceName(serviceName, qualifier)}/functions`,
      options,
      headers
    );
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
  getFunction(serviceName, functionName, headers = {}, qualifier) {
    return this.get(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}`,
      null,
      headers
    );
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
  getFunctionCode(serviceName, functionName, headers = {}, qualifier) {
    return this.get(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/code`,
      headers
    );
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
   * @param {Object} headers
   * @param {String} qualifier
   * @return {Promise} 返回 Object(包含headers和data属性[返回Function的执行结果])
   */
  invokeFunction(
    serviceName,
    functionName,
    event,
    headers = {},
    qualifier,
    opts = {}
  ) {
    if (event && typeof event !== 'string' && !Buffer.isBuffer(event)) {
      throw new TypeError('"event" must be String or Buffer');
    }

    const path = `/services/${getServiceName(
      serviceName,
      qualifier
    )}/functions/${functionName}/invocations`;
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
  createTrigger(serviceName, functionName, options, headers = {}) {
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
   * @param {Object} headers
   * @return {Promise} 返回 Object(包含headers和data属性[Trigger信息])
   */
  updateTrigger(serviceName, functionName, triggerName, options = {}, headers = {}) {
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
  createCustomDomain(domainName, options = {}, headers) {
    return this.post(
      '/custom-domains',
      Object.assign(
        {
          domainName
        },
        options
      ),
      headers
    );
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
  listCustomDomains(options = {}, headers) {
    return this.get('/custom-domains', options, headers);
  }

  /**
   * 获取CustomDomain信息
   *
   * @param {String} domainName
   * @return {Promise} 返回 Object(包含headers和data属性[CustomDomain 信息])
   */
  getCustomDomain(domainName, headers) {
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
  updateCustomDomain(domainName, options = {}, headers) {
    return this.put(`/custom-domains/${domainName}`, options, headers);
  }

  /**
   * 删除CustomDomain
   *
   * @param {String} domainName
   * @return {Promise} 返回 Object(包含headers和data属性)
   */
  deleteCustomDomain(domainName, options = {}, headers) {
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
  publishVersion(serviceName, description, headers) {
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
  listVersions(serviceName, options = {}, headers = {}) {
    return this.get(`/services/${serviceName}/versions`, options, headers);
  }

  /**
   * 删除 version
   *
   * @param {String} serviceName
   * @param {String} versionId
   * @param {Object} headers
   * @return {Promise} 返回 Object(包含headers和data属性)
   */
  deleteVersion(serviceName, versionId, headers = {}) {
    return this.delete(
      `/services/${serviceName}/versions/${versionId}`,
      null,
      headers
    );
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
  createAlias(serviceName, aliasName, versionId, options = {}, headers = {}) {
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
  deleteAlias(serviceName, aliasName, headers = {}) {
    return this.delete(
      `/services/${serviceName}/aliases/${aliasName}`,
      null,
      headers
    );
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
  listAliases(serviceName, options = {}, headers = {}) {
    return this.get(`/services/${serviceName}/aliases`, options, headers);
  }

  /**
   * 获得 alias
   *
   * @param {String} serviceName
   * @param {String} aliasName
   * @param {Object} headers
   * @return {Promise} 返回 Object(包含headers和data属性)
   */
  getAlias(serviceName, aliasName, headers = {}) {
    return this.get(
      `/services/${serviceName}/aliases/${aliasName}`,
      null,
      headers
    );
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
  updateAlias(serviceName, aliasName, versionId, options = {}, headers = {}) {
    if (versionId) {
      options.versionId = versionId;
    }
    return this.put(
      `/services/${serviceName}/aliases/${aliasName}`,
      options,
      headers
    );
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
  tagResource(resourceArn, tags, options = {}, headers = {}) {
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
  untagResource(resourceArn, tagKeys, all = false, options = {}, headers = {}) {
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
  getResourceTags(options = {}, headers = {}) {
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
  listReservedCapacities(options = {}, headers) {
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
  listProvisionConfigs(options = {}, headers) {
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
  getProvisionConfig(serviceName, functionName, qualifier, headers = {}) {
    return this.get(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/provision-config`,
      null,
      headers
    );
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
  putProvisionConfig(
    serviceName,
    functionName,
    qualifier,
    options = {},
    headers = {}
  ) {
    return this.put(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/provision-config`,
      options,
      headers
    );
  }

  /**
   * 删除单个函数的 asyncConfig
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} headers
   * @param {String} qualifier 可选
   * @return {Promise} 返回 Object(包含headers和data属性)
   */
  deleteFunctionAsyncConfig(
    serviceName,
    functionName,
    qualifier,
    headers = {}
  ) {
    return this.delete(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/async-invoke-config`,
      null,
      headers
    );
  }

  /**
   * 获取账号下的 asyncConfigs 列表
   *
   * Options:
   * - limit
   * - nextToken
   *
   * @param {Object} options 选项，optional
   * @return {Promise} 返回 Object(包含 headers 和 data 属性[asyncConfigs 列表])
   */
  listFunctionAsyncConfigs(
    serviceName,
    functionName,
    options = {},
    headers = {}
  ) {
    return this.get(
      `/services/${serviceName}/functions/${functionName}/async-invoke-configs`,
      options,
      headers
    );
  }

  /**
   * 获取单个函数的 asyncConfig
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} headers
   * @param {String} qualifier 可选
   * @return {Promise} 返回 Object(包含 headers 和 data 属性[asyncConfig 信息])
   */
  getFunctionAsyncConfig(serviceName, functionName, qualifier, headers = {}) {
    return this.get(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/async-invoke-config`,
      null,
      headers
    );
  }

  /**
   * 更新单个函数的 asyncConfig
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {Object} headers
   * @param {String} qualifier 可选
   * @param {Object} options 选项，optional
   * Options:
   * - maxAsyncEventAgeInSeconds
   * - maxAsyncRetryAttempts
   * - {Object} destinationConfig
   *    - {Object} onSuccess
   *        - destination
   *    - {Object} onFailure
   *        - destination
   * @return {Promise} 返回 Object(包含 headers 和 data 属性[asyncConfig 信息])
   */
  putFunctionAsyncConfig(
    serviceName,
    functionName,
    qualifier,
    options = {},
    headers = {}
  ) {
    return this.put(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/async-invoke-config`,
      options,
      headers
    );
  }

  /**
   * 获取账号信息，一般获取支持可用区
   */
  getAccountSettings(options = {}, headers = {}) {
    return this.get('/account-settings', options, headers);
  }

  /**
   * 获取当前 region 的 layer 列表
   */
  listLayers(options = {}, headers = {}) {
    return this.get('/layers', options, headers);
  }

  /**
   * 获取 layer 的版本信息列表
   */
  listLayerVersions(layerName, options = {}, headers = {}) {
    return this.get(`/layers/${layerName}/versions`, options, headers);
  }

  /**
   * 获取 layer 指定版本的信息
   */
  getLayerVersion(layerName, version, options = {}, headers = {}) {
    return this.get(`/layers/${layerName}/versions/${version}`, options, headers);
  }

  /**
   * 发布 layer 的版本
   */
  publishLayerVersion(layerName, options = {}, headers = {}) {
    return this.post(`/layers/${layerName}/versions`, options, headers);
  }

  /**
   * 删除 layer 的版本
   */
  deleteLayerVersion(layerName, version, headers = {}) {
    return this.delete(`/layers/${layerName}/versions/${version}`, null, headers);
  }

  /**
   * 获取账号下的按量资源列表
   *
   * Options:
   * - limit
   * - nextToken
   *
   * @param {Object} options 选项，optional
   * @return {Promise} 返回 Object(包含 headers 和 data 属性[onDemandConfigs 列表])
   */
  listOnDemandConfigs(options = {}, headers = {}) {
    return this.get('/on-demand-configs', options, headers);
  }

  /**
   * 获取单个函数的按量资源配置
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {String} qualifier
   * @param {Object} options
   * @param {Object} headers
   * @return {Promise} 返回 Object(包含 headers 和 data 属性[onDemandConfig 信息])
   */
  getOnDemandConfig(
    serviceName,
    functionName,
    qualifier,
    options = {},
    headers = {}
  ) {
    return this.get(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/on-demand-config`,
      options,
      headers
    );
  }

  /**
   * 更新单个函数的按量资源配置
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {String} qualifier
   * @param {Object} options
   * @param {Object} headers
   * @return {Promise} 返回 Object(包含 headers 和 data 属性[onDemandConfig 信息])
   */
  putOnDemandConfig(
    serviceName,
    functionName,
    qualifier,
    options = {},
    headers = {}
  ) {
    return this.put(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/on-demand-config`,
      options,
      headers
    );
  }

  /**
   * 删除单个函数的按量资源配置
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {String} qualifier
   * @param {Object} options
   * @param {Object} headers
   * @return {Promise}
   */
  deleteOnDemandConfig(
    serviceName,
    functionName,
    qualifier,
    options = {},
    headers = {}
  ) {
    return this.delete(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/on-demand-config`,
      options,
      headers
    );
  }

  /**
   * 获取实例信息
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {String} qualifier
   * @param {Object} options
   * @param {Object} headers
   * @return {Promise} 返回 Object(包含headers和data属性[Instance信息])
   */
  listInstances(
    serviceName,
    functionName,
    qualifier,
    options = {},
    headers = {}
  ) {
    return this.get(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/instances`,
      options,
      headers
    );
  }
  /**
   * 登陆函数实例
   *
   * @param {String} serviceName
   * @param {String} functionName
   * @param {String} qualifier
   * @param {String} instanceId
   * @param {Object} options
   * @param {Object} hooks
   * @return {Promise} 返回 WebSocket 对象
   */
  async instanceExec(
    serviceName,
    functionName,
    qualifier = '',
    instanceId,
    options = {},
    hooks = {}
  ) {
    const messageStdin = 0;
    const messageStdout = 1;
    const messageStderr = 2;

    var queries = {
      command: '/bin/bash',
      tty: true,
      stdin: true,
      stdout: true,
      stderr: false,
      idleTimeout: 120
    };
    for (var key of Object.keys(queries)) {
      if (typeof options[key] !== 'undefined') {
        queries[key] = options[key];
      }
    }

    const {
      onClose = () => {},
      onError = () => {},
      onStdout = () => {},
      onStderr = () => {}
    } = hooks;

    const ws = this.websocket(
      `/services/${getServiceName(
        serviceName,
        qualifier
      )}/functions/${functionName}/instances/${instanceId}/exec`,
      queries
    );

    const ticker = setInterval(function () {
      try {
        ws.ping();
      } catch (e) {
        ws.close();
      }
    }, 5000);

    ws.on('unexpected-response', function (req, incoming) {
      var data = [];
      incoming.on('data', function (chunk) {
        data = data.concat(chunk);
      });
      incoming.on('end', function () {
        const msg = JSON.parse(data.toString());
        const err = new Error(msg.ErrorMessage);
        onError(err);
        ws.close();
      });
    });
    ws.on('close', (err) => {
      clearInterval(ticker);
      onClose(err);
    });
    ws.on('error', (code, reason) => onError(code, reason));
    ws.on('ping', (data) => ws.pong(data));
    ws.on('message', (message) => {
      if (!!message && message.length >= 2) {
        const messageType = message[0];
        const data = message.slice(1);
        if (messageType === messageStdout && onStdout) {
          onStdout(data);
        } else if (messageType === messageStderr && onStderr) {
          onStderr(data);
        }
      }
    });

    await (async () => {
      new Promise((resolve) => (ws.onopen = resolve));
    });

    return {
      websocket: ws,
      close: () => ws.close(),
      sendMessage: (data) => {
        if (!(data instanceof Uint8Array)) {
          throw new Error('data must be Uint8Array');
        }
        const messageArray = new Uint8Array(data.length + 1);
        messageArray.set([messageStdin]);
        messageArray.set(data, 1);
        ws.send(messageArray);
      }
    };
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
