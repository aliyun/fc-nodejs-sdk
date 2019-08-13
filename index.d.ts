/// <reference types="node" />

interface Dictionary<T = any> {
  [key: string]: T;
}

export interface ListingRequest {
  limit?: number;
  prefix?: string;
  startKey?: string;
  nextToken?: string;
}

export type ListingResponse<T = {}> = {
  nextToken?: string;
} & T;

export interface LogConfig {
  logstore: string;
  project: string;
}

export interface VpcConfig {
  vpcId: string;
  vSwitchIds: string[];
  securityGroupId: string;
}

export interface NasMountPoint {
  serverAddr: string;
  mountDir: string;
}

export interface NasConfig {
  userId: string;
  groupId: string;
  mountPoints: NasMountPoint[];
}

export interface ServiceDescription {
  serviceName: string;
  description?: string;
  role?: string;
  internetAccess?: boolean;
  logConfig?: LogConfig;
  vpcConfig?: VpcConfig;
  nasConfig?: NasConfig;
}

export type ServiceCreatingOptions = Omit<ServiceDescription, 'serviceName'>;

export type ServiceUpdatingOptions = Omit<ServiceDescription, 'serviceName'>;

export interface ServiceResponse extends ServiceDescription {
  serviceId: string;
  createdTime: string;
}

export type ServiceListingResponse = ListingResponse<{
  services?: ServiceResponse[];
}>;

export type FunctionCode = {
  zipFile: string;
} | {
  ossBucketName: string;
  ossObjectName: string;
}

export interface FunctionDescription {
  functionName: string;
  code: FunctionCode;
  handler: string;
  runtime: string;
  initializer?: string;
  description?: string;
  memorySize?: number;
  timeout?: number;
  initializationTimeout?: number;
  EnvironmentVariables?: Dictionary;
}

export interface FunctionResponse extends Omit<FunctionDescription, 'code'> {
  functionId: string;
  codeChecksum?: string;
  codeSize?: number;
  createdTime?: string;
  lastModifiedTime?: string;
}

export interface FunctionCodeResponse {
  checksum?: string;
  url?: string;
}

export type FunctionListingResponse = ListingResponse<{
  functions?: FunctionResponse[];
}>;

export interface TriggerDescription {
  triggerName: string;
  triggerType: string;
  triggerConfig: Dictionary;
  invocationRole: string;
  sourceArn: string;
  qualifier?: string;
}

export interface TriggerResponse extends TriggerDescription {
  createdTime?: string;
  lastModifiedTime?: string;
}

export type TriggerUpdatingOptions = Pick<
  TriggerDescription,
  'invocationRole' | 'triggerConfig' | 'qualifier'
>;

export type TriggerListingResponse = ListingResponse<{
  triggers?: TriggerResponse[];
}>;

export interface PathConfig {
  path: string;
  serviceName: string;
  functionName: string;
}

export interface RouteConfig {
  Routes: PathConfig[];
}

export interface CertConfig {
  certName: string;
  privateKey: string;
  certificate: string;
}

export interface CustomDomainConfig {
  DomainName: string;
  Protocol: 'HTTP' | 'HTTP,HTTPS';
  ApiVersion?: string;
  RouteConfig?: RouteConfig;
  CertConfig?: CertConfig;
}

export interface CustomDomainResponse extends Omit<CustomDomainConfig, 'DomainName'> {
  CustomDomain: string;
  CreatedTime?: string;
  LastModifiedTime?: string;
}

export type CustomDomainListingResponse = ListingResponse<{
  customDomains?: CustomDomainResponse[];
}>;

export interface VersionDescription {
  versionId: string;
  description?: string;
}

export interface VersionResponse extends VersionDescription {
  createdTime?: string;
  lastModifiedTime?: string;
}

export type VersionListingResponse = ListingResponse<{
  versions?: VersionResponse[];
  direction?: string;
}>;

export interface AliasDescription {
  aliasName: string;
  versionId: string;
  description?: string;
  additionalVersionWeight?: Dictionary<number>;
}

export interface AliasResponse extends AliasDescription {
  createdTime?: string;
  lastModifiedTime?: string;
}

export type AliasUpdatingOptions = Omit<AliasDescription, 'aliasName'>;

export interface ClientConfig {
  readonly accessKeyID: string;
  readonly accessKeySecret: string;
  readonly region: string;
  readonly securityToken?: string;
  readonly secure?: boolean;
  readonly internal?: boolean;
  readonly timeout?: number;
  readonly headers?: ClientRequestHeaders;
}

export type ClientRequestHeaders = Dictionary<string>;

export type ClientResponseHeaders<T extends Dictionary<string> = {}> = Dictionary<string> & {
  'x-fc-request-id': string;
  'x-fc-error-type'?: string;
  'content-type'?: string;
} & T;

export interface ImmutableClientRequestHeaders {
  accept: string;
  date: string;
  host: string;
  'user-agent': string;
  'x-fc-account-id': string;
  'x-fc-security-token'?: string;
}

export interface ClientRequestOptions {
  rawBuf?: boolean;
}

export type ClientResponseDataType = string | Dictionary | ReadableStream | Buffer;

export type ClientRequestReturns<
  T extends ClientResponseDataType = ClientResponseDataType,
  U extends ClientResponseHeaders = ClientResponseHeaders
> = Promise<{
  data: T;
  headers: U;
}>;

export type ClientRequestBody = string | Buffer | Dictionary;

export default class Client {
  static getSignature(
    accessKeyID: string,
    accessKeySecret: string,
    method: string,
    path: string,
    headers: ClientRequestHeaders,
    queries: Dictionary
  ): string;

  accountid: string;
  accessKeyID: string;
  accessKeySecret: string;
  endpoint: string;
  host: string;
  version: string;
  timeout: number;
  headers: ClientRequestHeaders;
  securityToken?: string;

  constructor(account: string, config: ClientConfig);

  buildHeaders(): ImmutableClientRequestHeaders;
  normalizeParams(options: FunctionDescription): FunctionDescription;

  request(
    method: string,
    path: string,
    query?: Dictionary,
    body?: ClientRequestBody,
    headers?: ClientRequestHeaders,
    options?: ClientRequestOptions
  ): ClientRequestReturns;

  get(path: string, query?: Dictionary, headers?: ClientRequestHeaders): ClientRequestReturns;
  put(path: string, body: ClientRequestBody, headers?: ClientRequestHeaders): ClientRequestReturns;
  delete(path: string, query?: Dictionary, headers?: ClientRequestHeaders): ClientRequestReturns;

  post(
    path: string,
    body?: ClientRequestBody,
    headers?: ClientRequestHeaders,
    query?: Dictionary,
    options?: ClientRequestOptions
  ): ClientRequestReturns;

  createService(
    serviceName: string,
    options?: ServiceCreatingOptions,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<
    ServiceResponse,
    ClientResponseHeaders<{
      ETag: string;
    }>
  >;

  listServices(options?: ListingRequest, headers?: ClientRequestHeaders): ClientRequestReturns<ServiceListingResponse>;
  getService(serviceName: string, headers?: ClientRequestHeaders, qualifier?: string): ClientRequestReturns<ServiceResponse>;
  updateService(serviceName: string, options: ServiceUpdatingOptions, headers?: ClientRequestHeaders): ClientRequestReturns<ServiceResponse>;
  deleteService(serviceName: string, options?: any, headers?: ClientRequestHeaders): ClientRequestReturns;

  createFunction(serviceName: string, options: FunctionDescription, headers?: ClientRequestHeaders): ClientRequestReturns<FunctionResponse>;

  listFunctions(
    serviceName: string,
    options: ListingRequest,
    headers?: ClientRequestHeaders,
    qualifier?: string
  ): ClientRequestReturns<FunctionListingResponse>;

  getFunction(
    serviceName: string,
    functionName: string,
    headers?: ClientRequestHeaders,
    qualifier?: string
  ): ClientRequestReturns<FunctionResponse>;

  getFunctionCode(
    serviceName: string,
    functionName: string,
    headers?: ClientRequestHeaders,
    qualifier?: string
  ): ClientRequestReturns<FunctionCodeResponse>;

  updateFunction(
    serviceName: string,
    functionName: string,
    options: FunctionDescription,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<FunctionResponse>;

  deleteFunction(
    serviceName: string,
    functionName: string,
    options?: Dictionary,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns;

  invokeFunction(
    serviceName: string,
    functionName: string,
    event: string | Buffer,
    headers?: ClientRequestHeaders,
    qualifier?: string,
    options?: Dictionary
  ): ClientRequestReturns;

  createTrigger(
    serviceName: string,
    functionName: string,
    options: TriggerDescription,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<TriggerResponse>;

  listTriggers(
    serviceName: string,
    functionName: string,
    options?: ListingRequest,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<TriggerListingResponse>;

  getTrigger(
    serviceName: string,
    functionName: string,
    triggerName: string,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<TriggerResponse>;

  updateTrigger(
    serviceName: string,
    functionName: string,
    triggerName: string,
    options?: TriggerUpdatingOptions,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<TriggerResponse>;

  deleteTrigger(
    serviceName: string,
    functionName: string,
    triggerName: string,
    options?: Dictionary,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns;

  createCustomDomain(domainName: string, options: CustomDomainConfig, headers?: ClientRequestHeaders): ClientRequestReturns<CustomDomainResponse>;
  listCustomDomains(options?: ListingRequest, headers?: ClientRequestHeaders): ClientRequestReturns<CustomDomainListingResponse>;
  getCustomDomain(domainName: string, headers?: ClientRequestHeaders): ClientRequestReturns<CustomDomainResponse>;
  updateCustomDomain(domainName: string, options: CustomDomainConfig, headers?: ClientRequestHeaders): ClientRequestReturns<CustomDomainResponse>;
  deleteCustomDomain(domainName: string, options?: any, headers?: ClientRequestHeaders): ClientRequestReturns;

  publishVersion(serviceName: string, description?: string, headers?: ClientRequestHeaders): ClientRequestReturns<VersionResponse>;
  listVersions(serviceName: string, options?: ListingRequest, headers?: ClientRequestHeaders): ClientRequestReturns<VersionListingResponse>;
  deleteVersion(serviceName: string, versionId: string, headers?: ClientRequestHeaders): ClientRequestReturns;

  createAlias(
    serviceName: string,
    aliasName: string,
    versionId: string,
    options?: Omit<AliasDescription, 'aliasName' | 'versionId'>,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<AliasResponse>;

  listAliases(
    serviceName: string,
    options?: ListingRequest,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<ListingResponse<{
    aliases: AliasResponse[];
  }>>;

  getAlias(serviceName: string, aliasName: string, headers?: ClientRequestHeaders): ClientRequestReturns<AliasResponse>;

  updateAlias(
    serviceName: string,
    aliasName: string,
    versionId: string,
    options?: Omit<AliasDescription, 'aliasName' | 'versionId'>,
    headers?: ClientRequestHeaders
  ): ClientRequestReturns<AliasResponse>;

  deleteAlias(serviceName: string, aliasName: string, headers?: ClientRequestHeaders): ClientRequestReturns;
}
