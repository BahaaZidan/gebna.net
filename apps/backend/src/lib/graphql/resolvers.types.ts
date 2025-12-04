/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { UserSelectModel, MailboxSelectModel, ThreadSelectModel, MessageSelectModel } from '$lib/db';
import type { Context } from '$lib/graphql/context';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  DateTime: { input: Date; output: Date; }
  URL: { input: URL; output: URL; }
};

export type Attachment = Node & {
  __typename?: 'Attachment';
  contentId?: Maybe<Scalars['String']['output']>;
  downloadURL?: Maybe<Scalars['URL']['output']>;
  fileName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mimeType?: Maybe<Scalars['String']['output']>;
};

export type Connection = {
  edges: Array<Edge>;
  pageInfo: PageInfo;
};

export type Edge = {
  cursor?: Maybe<Scalars['String']['output']>;
  node: Node;
};

export type Mailbox = Node & {
  __typename?: 'Mailbox';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  threads: ThreadsConnection;
  type: MailboxType;
  unreadThreadsCount: Scalars['Int']['output'];
};


export type MailboxThreadsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type MailboxType =
  | 'important'
  | 'news'
  | 'screener'
  | 'transactional'
  | 'trash';

export type Message = Node & {
  __typename?: 'Message';
  attachments: Array<Attachment>;
  bodyHTML?: Maybe<Scalars['String']['output']>;
  bodyText?: Maybe<Scalars['String']['output']>;
  cc?: Maybe<Array<Scalars['String']['output']>>;
  from: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  recievedAt: Scalars['DateTime']['output'];
  replyTo?: Maybe<Array<Scalars['String']['output']>>;
  snippet?: Maybe<Scalars['String']['output']>;
  subject?: Maybe<Scalars['String']['output']>;
  to?: Maybe<Array<Scalars['String']['output']>>;
  unread: Scalars['Boolean']['output'];
};

export type Node = {
  id: Scalars['ID']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage?: Maybe<Scalars['Boolean']['output']>;
  hasPreviousPage?: Maybe<Scalars['Boolean']['output']>;
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  node?: Maybe<Node>;
  viewer?: Maybe<User>;
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};

export type Thread = Node & {
  __typename?: 'Thread';
  from: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lastMessageAt: Scalars['DateTime']['output'];
  messages: Array<Message>;
  title?: Maybe<Scalars['String']['output']>;
  unreadMessagesCount: Scalars['Int']['output'];
};

export type ThreadEdge = Edge & {
  __typename?: 'ThreadEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node: Thread;
};

export type ThreadsConnection = Connection & {
  __typename?: 'ThreadsConnection';
  edges: Array<ThreadEdge>;
  pageInfo: PageInfo;
};

export type User = Node & {
  __typename?: 'User';
  id: Scalars['ID']['output'];
  mailboxes: Array<Mailbox>;
  username: Scalars['String']['output'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;




/** Mapping of interface types */
export type ResolversInterfaceTypes<_RefType extends Record<string, unknown>> = {
  Connection: ( Omit<ThreadsConnection, 'edges'> & { edges: Array<_RefType['ThreadEdge']> } & { __typename: 'ThreadsConnection' } );
  Edge: ( Omit<ThreadEdge, 'node'> & { node: _RefType['Thread'] } & { __typename: 'ThreadEdge' } );
  Node:
    | ( Attachment & { __typename: 'Attachment' } )
    | ( MailboxSelectModel & { __typename: 'Mailbox' } )
    | ( MessageSelectModel & { __typename: 'Message' } )
    | ( ThreadSelectModel & { __typename: 'Thread' } )
    | ( UserSelectModel & { __typename: 'User' } )
  ;
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Attachment: ResolverTypeWrapper<Attachment>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Connection: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Connection']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Edge: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Edge']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mailbox: ResolverTypeWrapper<MailboxSelectModel>;
  MailboxType: MailboxType;
  Message: ResolverTypeWrapper<MessageSelectModel>;
  Node: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Node']>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Thread: ResolverTypeWrapper<ThreadSelectModel>;
  ThreadEdge: ResolverTypeWrapper<Omit<ThreadEdge, 'node'> & { node: ResolversTypes['Thread'] }>;
  ThreadsConnection: ResolverTypeWrapper<Omit<ThreadsConnection, 'edges'> & { edges: Array<ResolversTypes['ThreadEdge']> }>;
  URL: ResolverTypeWrapper<Scalars['URL']['output']>;
  User: ResolverTypeWrapper<UserSelectModel>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Attachment: Attachment;
  Boolean: Scalars['Boolean']['output'];
  Connection: ResolversInterfaceTypes<ResolversParentTypes>['Connection'];
  DateTime: Scalars['DateTime']['output'];
  Edge: ResolversInterfaceTypes<ResolversParentTypes>['Edge'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mailbox: MailboxSelectModel;
  Message: MessageSelectModel;
  Node: ResolversInterfaceTypes<ResolversParentTypes>['Node'];
  PageInfo: PageInfo;
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
  Thread: ThreadSelectModel;
  ThreadEdge: Omit<ThreadEdge, 'node'> & { node: ResolversParentTypes['Thread'] };
  ThreadsConnection: Omit<ThreadsConnection, 'edges'> & { edges: Array<ResolversParentTypes['ThreadEdge']> };
  URL: Scalars['URL']['output'];
  User: UserSelectModel;
};

export type AttachmentResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Attachment'] = ResolversParentTypes['Attachment']> = {
  contentId?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  downloadURL?: Resolver<Maybe<ResolversTypes['URL']>, ParentType, ContextType>;
  fileName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  mimeType?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Connection'] = ResolversParentTypes['Connection']> = {
  __resolveType: TypeResolveFn<'ThreadsConnection', ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type EdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Edge'] = ResolversParentTypes['Edge']> = {
  __resolveType: TypeResolveFn<'ThreadEdge', ParentType, ContextType>;
};

export type MailboxResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mailbox'] = ResolversParentTypes['Mailbox']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  threads?: Resolver<ResolversTypes['ThreadsConnection'], ParentType, ContextType, Partial<MailboxThreadsArgs>>;
  type?: Resolver<ResolversTypes['MailboxType'], ParentType, ContextType>;
  unreadThreadsCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Message'] = ResolversParentTypes['Message']> = {
  attachments?: Resolver<Array<ResolversTypes['Attachment']>, ParentType, ContextType>;
  bodyHTML?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bodyText?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cc?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  from?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  recievedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  replyTo?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  snippet?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  subject?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  to?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  unread?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NodeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Node'] = ResolversParentTypes['Node']> = {
  __resolveType: TypeResolveFn<'Attachment' | 'Mailbox' | 'Message' | 'Thread' | 'User', ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  hasPreviousPage?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  node?: Resolver<Maybe<ResolversTypes['Node']>, ParentType, ContextType, RequireFields<QueryNodeArgs, 'id'>>;
  viewer?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
};

export type ThreadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Thread'] = ResolversParentTypes['Thread']> = {
  from?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastMessageAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  messages?: Resolver<Array<ResolversTypes['Message']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  unreadMessagesCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ThreadEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ThreadEdge'] = ResolversParentTypes['ThreadEdge']> = {
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Thread'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ThreadsConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ThreadsConnection'] = ResolversParentTypes['ThreadsConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ThreadEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface UrlScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['URL'], any> {
  name: 'URL';
}

export type UserResolvers<ContextType = Context, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  mailboxes?: Resolver<Array<ResolversTypes['Mailbox']>, ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  Attachment?: AttachmentResolvers<ContextType>;
  Connection?: ConnectionResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Edge?: EdgeResolvers<ContextType>;
  Mailbox?: MailboxResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  Node?: NodeResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Thread?: ThreadResolvers<ContextType>;
  ThreadEdge?: ThreadEdgeResolvers<ContextType>;
  ThreadsConnection?: ThreadsConnectionResolvers<ContextType>;
  URL?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
};

