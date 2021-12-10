export interface IFCClientConfig {
  accessKeyID: string
  securityToken?: string
  accessKeySecret: string
  region: string
  /** endpoint will cover `secure` and `internal` */
  endpoint?: string
  secure?: boolean
  internal?: boolean
  /** default is 60s */
  timeout?: number
  headers?: Record<string, string>
}

export interface IPipable { pipe: Function }
export type TBody = TData | IPipable | any
export type TData = Buffer | string | object
export type TNullable<T> = T | null


export type TOptions = object
export type THeaders = object
export type TTags = ([string] | [string, string])[]

export interface IServiceResponse<T=TData> { 
  headers: THeaders
  data: T
}

export interface IHock {
  onClose: () => {},
  onError: () => {},
  onStdout: () => {},
  onStderr: () => {}
}

export interface IInstanceExec {
  websocket: WebSocket,
  close()
  sendMessage: (data: Uint8Array) => void
}

export declare class FCClient {

  accountid: string
  accessKeyID: string
  securityToken?: string
  accessKeySecret: string
  endpoint: string
  host: string
  version: string
  timeout: number

  constructor(accountid: string, config: IFCClientConfig)

  private buildHeaders(): object

  request<T=TData>(method: string, path: string, query?: TNullable<object>, body?: TNullable<TBody>, headers?: TNullable<THeaders>, opts?: object): Promise<IServiceResponse<T>>
  get<T=TData>(path: string, query?: TNullable<object>, headers?: TNullable<THeaders>): Promise<IServiceResponse<T>>
  post<T=TData>(path: string, body: TData, headers?: TNullable<THeaders>, queries?: TNullable<object>, opts?: object): Promise<IServiceResponse<T>>
  put<T=TData>(path: string, body: TData, headers?: TNullable<THeaders>): Promise<IServiceResponse<T>>
  delete<T=TData>(path: string, query?: TNullable<object>, headers?: TNullable<THeaders>): Promise<IServiceResponse<T>>
  websocket(path: string, query?: TNullable<object>, headers?: TNullable<THeaders>): Promise<WebSocket>

  createService(serviceName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  listServices(options?: object, headers?: THeaders): Promise<IServiceResponse>
  getService(serviceName: string, options?: object, qualifier?: string): Promise<IServiceResponse>
  updateService(serviceName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteService(serviceName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  private normalizeParams(opts)

  createFunction(serviceName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  listFunctions(serviceName: string, options?: object, headers?: THeaders, qualifier?: string): Promise<IServiceResponse>
  getFunction(serviceName: string, functionName: string, headers?: THeaders, qualifier?: string): Promise<IServiceResponse>
  getFunctionCode(serviceName: string, functionName: string, headers?: THeaders, qualifier?: string): Promise<IServiceResponse>
  updateFunction(serviceName: string, functionName: string, options: object, qualifier?: string): Promise<IServiceResponse>
  deleteFunction(serviceName: string, functionName: string, options?: object, qualifier?: string): Promise<IServiceResponse>
  invokeFunction<T=TData>(
    serviceName: string,
    functionName: string,
    event?: TNullable<string | Buffer>,
    headers?: TNullable<THeaders>,
    qualifier?: string,
    opts?: TNullable<object>,
  ): Promise<IServiceResponse<T>>

  createTrigger(serviceName: string, functionName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  listTriggers(serviceName: string, functionName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  getTrigger(serviceName: string, functionName: string, triggerName: string, headers?: THeaders): Promise<IServiceResponse>
  updateTrigger(serviceName: string, functionName: string, triggerName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteTrigger(serviceName: string, functionName: string, triggerName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  
  createCustomDomain(domainName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  listCustomDomains(options?: object, headers?: THeaders): Promise<IServiceResponse>
  getCustomDomain(domainName: string, headers?: THeaders): Promise<IServiceResponse>
  updateCustomDomain(domainName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteCustomDomain(domainName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  publishVersion(serviceName: string, description?: string, headers?: THeaders): Promise<IServiceResponse>
  listVersions(serviceName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteVersion(serviceName: string, versionId: string, headers?: THeaders): Promise<IServiceResponse>

  createAlias(serviceName: string, aliasName: string, versionId: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteAlias(serviceName: string, aliasName: string, headers?: THeaders): Promise<IServiceResponse>
  listAliases(serviceName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  getAlias(serviceName: string, aliasName: string, headers?: THeaders): Promise<IServiceResponse>
  updateAlias(serviceName: string, aliasName: string, versionId?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  tagResource(resourceArn: string, tags: TTags, options?: object, headers?: THeaders): Promise<IServiceResponse>
  untagResource(resourceArn: string, tagKeys: string[], all?: boolean, options?: object, headers?: THeaders): Promise<IServiceResponse>
  getResourceTags(options?: object, headers?: THeaders): Promise<IServiceResponse>

  listReservedCapacities(options?: object, headers?: THeaders): Promise<IServiceResponse>

  listProvisionConfigs(options?: object, headers?: THeaders): Promise<IServiceResponse>
  getProvisionConfig(serviceName: string, functionName: string, qualifier?: string, headers?: THeaders): Promise<IServiceResponse>
  putProvisionConfig(serviceName: string, functionName: string, qualifier?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  deleteFunctionAsyncConfig(serviceName: string, functionName: string, qualifier?: string, headers?: THeaders): Promise<IServiceResponse>
  listFunctionAsyncConfigs(serviceName: string, functionName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  getFunctionAsyncConfig(serviceName: string, functionName: string, qualifier?: string, headers?: THeaders): Promise<IServiceResponse>
  putFunctionAsyncConfig(serviceName: string, functionName: string, qualifier?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  getAccountSettings(options?: object, headers?: THeaders): Promise<IServiceResponse>
  
  listLayers(options?: object, headers?: THeaders): Promise<IServiceResponse>
  listLayerVersions(layerName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  getLayerVersion(layerName: string, version: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  publishLayerVersion(layerName: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteLayerVersion(layerName: string, version: string, headers?: THeaders): Promise<IServiceResponse>

  listOnDemandConfigs(options?: object, headers?: THeaders): Promise<IServiceResponse>
  getOnDemandConfig(serviceName: string, functionName: string, qualifier?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  putOnDemandConfig(serviceName: string, functionName: string, qualifier?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>
  deleteOnDemandConfig(serviceName: string, functionName: string, qualifier?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  listInstances(serviceName: string, functionName: string, qualifier?: string, options?: object, headers?: THeaders): Promise<IServiceResponse>

  instanceExec(serviceName: string, functionName: string, qualifier: TNullable<string>, instanceId: string, options: object, hooks: IHock): Promise<IInstanceExec>

  static getSignature(accessKeyID: string, accessKeySecret: string, method: string, path: string, headers: THeaders, queries: object): string
}
