import stream, { EventEmitter } from "stream"

/**
 * Events, Triggers, Basic Structures like Context etc.
 */
export namespace FC {

  /**
   * 普通云函数调用的请求头
   */
  type TEvent = Buffer

  /**
   * STS鉴权
   */
  type TCredentials = {
    accessKeyId: string,
    accessKeySecret: string,
    securityToken: string,
  }

  type TFunctionInfo = {
    /**
     * 函数名
     * example: 'my-func'
     */
    name: string

    /**
     * 入口函数
     * example: 'index.handler'
     */
    handler: string

    /**
     * 最大内存。单位为MB。
     */
    memory: number

    /**
     * 超时时间。单位为秒。
     * example: 10
     */
    timeout: number

    /**
     * 初始化函数
     * example: 'index.initializer'
     */
    initializer: string

    /**
     * 初始化函数超时时间。单位为秒。
     * example: 10
     */
    initializationTimeout: number,
  }

  type TServiceInfo = {
    /**
     * 服务名
     * example: 'my-func'
     */
    name: string

    /**
     * 接入的SLS (阿里云的日志log收集系统)的日志项目
     * example: 'my-log-project'
     */
    logProject: string

    /**
     * 接入的SLS (阿里云的日志log收集系统)的日志仓库
     * example: 'my-log-store'
     */
    logStore: string

    /**
     * 调用函数时指定的service版本别名
     * example: 'dev'
     */
    qualifier: string


    /**
     * 服务版本
     * example: '1'
     */
    versionId: string
  }

  type TContext = {
    /**
     * 本次调用请求的唯一ID，您可以把它记录下来在出现问题的时候方便查询。
     * example: 'b1c5100f-819d-c421-3a5e-7782a27d8a33'
     */
    requestId: string

    /**
     * 函数计算服务通过扮演您提供的服务角色获得的一组临时密钥，其有效时间是6小时。
     * 您可以在代码中使用credentials去访问相应的服务（ 例如OSS ），这就避免了您把自己的AK信息写死在函数代码里。
     * 权限相关内容请参见![权限简介](https://help.aliyun.com/document_detail/52885.htm?spm=a2c4g.11186623.0.0.628f45beTCdS3d#concept-2259921)。
     */
    credentials: TCredentials

    /**
     * 当前调用的函数的一些基本信息，例如函数名、函数入口、函数内存和超时时间。
     */
    function: TFunctionInfo

    /**
     * 当前调用的函数所在的service的信息
     */
    service: TServiceInfo

    /**
     * 当前调用的函数所在区域
     * example: 'cn-shanghai'
     */
    region: string

    /**
     * 当前调用函数用户的阿里云Account ID。
     */
    accountId: string

    logger: ILogger

    /**
     * 重试次数
     * example: 0
     */
    retryCount: number

    /**
     * 开启链路追踪后的追踪id(需要开启才有)
     */
    tracing?: TTracingContext
  }

  type TData = Buffer | object | string | any

  /**
   * @param err 如果调用时error不为空，则函数返回HandledInvocationError，否则返回data的内容。
   * @param data   
   * 如果data是Buffer类型，则它的数据将直接被返回。  
   * 如果data是object，则会将其转换成JSON字符串返回。  
   * 如果data是其他类型将被转换成字符串返回。
   */
  type TCallback = (err: string | Error | null, data: TData) => void | Promise<void>

  /**
   * 云函数事件函数入口
   * 参考文档： https://help.aliyun.com/document_detail/156876.html
   * @param event 调用函数时传入的数据，其类型是Buffer，是函数的输入参数。可用`JSON.parse(event.toString())`转换为json
   * @param context context参数中包含一些函数的运行信息，例如request Id、 临时AK等。您在代码中可以使用这些信息。信息类型是Object
   * @param callback 返回调用函数的结果的回调函数。第一个参数为error，第二个为data。
   *                  如果调用时error不为空，则函数返回HandledInvocationError，否则返回data的内容。
   */
  export type TEventHandler = (event: TEvent, context: TContext, callback: TCallback) => void | Promise<void>

  export type TRequest = {
    /**
     * 存放来自HTTP客户端的键值对。
     * 这里的部分字段会被忽略，详情见文档：
     * https://help.aliyun.com/document_detail/74757.html#section-960-nx8-b4i
     */
    headers: object
    
    /**
     * 表示HTTP路径。
     */
    path: string

    /**
     * 存放来自HTTP路径中的查询部分的键值对，值的类型可以为字符串或数组。
     */
    queries: object

    /**
     * 	表示HTTP方法。
     */
    method: string

    /**
     * 请求的地址。
     */
    clientIP: string

    /**
     * 存放来自HTTP客户端的键值对。
     */
    url: string
  }

  type TResBody = Buffer | string | stream.Readable

  type TResponse = {
    /**
     * 设置状态码。
     * @param statusCode 需要是整数
     */
    setStatusCode: (statusCode: number) => void

    /**
     * 设置响应头。
     * 部分特定key不能设置，详见文档。
     * https://help.aliyun.com/document_detail/74757.html
     */
    setHeader: (headerKey: string, headerValue: string) => void

    /**
     * 删除响应头。
     */
    deleteHeader: (headerKey: string) => void

    /**
     * 发送响应体。
     * HTTP body的总大小不能超过6 MB。
     */
    send: (body: TResBody) => void
  }

  /**
   * 云函数HTTP函数入口。
   * 如果需要请求body，则需要用`require('raw-body')`获取。详情见参考文档。
   * 参考文档： https://help.aliyun.com/document_detail/74757.html
   * @param request 调请求结构体Request
   * @param callback 响应Response提供的方法
   * @param context context参数
   */
  type THttpHandler = (request: TRequest, response: TResponse, context: TContext) => void

  /**
   * 云函数实例初始化的钩子
   * 可用于初始化服务，连接数据库等
   * https://help.aliyun.com/document_detail/203027.htm
   */
  type TInitializer = (context: TContext, callback: TCallback) => void
  
  /**
   * 云函数实例冻结前调用的钩子
   * 可用于上传日志、flush等
   * https://help.aliyun.com/document_detail/203027.htm
   */
  type TPreFreeze = (context: TContext, callback: TCallback) => void

  /**
   * 云函数实例释放前调用的钩子。
   * 可用于断开数据库链接、释放资源、上报、更新状态等
   * https://help.aliyun.com/document_detail/203027.htm
   */
  type TPreStop = (context: TContext, callback: TCallback) => void

  // type HandledInvocationError = Error

  type TTracingContext = {
    /**
     * 函数计算InvokeFunction的链路上下文，函数内基于此上下文创建追踪段。
     * example: "5f22f355044a957a:5708f3a95a4ed10:5f22f355044a****:1"
     */
    openTracingSpanContext: string

    /**
     * 跨上下文Baggage
     */
    openTracingSpanBaggages: {
      [key: string]: string
    }

    /**
     * Jaeger的Server端地址
     * jaegerEndpoint is confidential, do not print it out easily
     * example: "http://tracing-analysis-dc-zb-internal.aliyuncs.com/adapt_fcfc@fcfc@fcfc/api/traces"
     */
    jaegerEndpoint: string
  }


  interface ILogger {

    transports: { console: EventEmitter }
    padLevels: boolean

    levels: {
      error: number
      warn: number
      info: number
      verbose: number
      debug: number
      silly: number
    }

    error: (...args: any[]) => void
    warn: (...args: any[]) => void
    info: (...args: any[]) => void
    verbose: (...args: any[]) => void
    debug: (...args: any[]) => void
    silly: (...args: any[]) => void

    id: null | string

    /** exapmle: 'info' */
    level: string

    emitErrs: boolean,
    stripColors: boolean,
    exitOnError: boolean,
    exceptionHandlers: {},
    profilers: {},
    rewriters: any[],
    filters: any[],
    setLogLevel: () => void,
    
  }

}
