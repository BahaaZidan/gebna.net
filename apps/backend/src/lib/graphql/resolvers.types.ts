/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { UserSelectModel, MailboxSelectModel, ThreadSelectModel, MessageSelectModel, AddressUserSelectModel } from '$lib/db';
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

export type AssignTargetMailboxInput = {
  contactID: Scalars['ID']['input'];
  targetMailboxType: MailboxType;
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

export type Contact = Node & {
  __typename?: 'Contact';
  address: Scalars['String']['output'];
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  messages: Array<Message>;
  name: Scalars['String']['output'];
  targetMailbox: Mailbox;
};

export type ContactConnection = Connection & {
  __typename?: 'ContactConnection';
  edges: Array<ContactEdge>;
  pageInfo: PageInfo;
};

export type ContactEdge = Edge & {
  __typename?: 'ContactEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node: Contact;
};

export type Edge = {
  cursor?: Maybe<Scalars['String']['output']>;
  node: Node;
};

export type Mailbox = Node & {
  __typename?: 'Mailbox';
  assignedContactsCount: Scalars['Int']['output'];
  contacts: ContactConnection;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  threads: ThreadsConnection;
  type: MailboxType;
  unseenThreadsCount: Scalars['Int']['output'];
};


export type MailboxContactsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type MailboxThreadsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<ThreadsFilter>;
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
  from: Contact;
  id: Scalars['ID']['output'];
  recievedAt: Scalars['DateTime']['output'];
  replyTo?: Maybe<Array<Scalars['String']['output']>>;
  snippet?: Maybe<Scalars['String']['output']>;
  subject?: Maybe<Scalars['String']['output']>;
  to?: Maybe<Array<Scalars['String']['output']>>;
  unseen: Scalars['Boolean']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  assignTargetMailbox?: Maybe<Contact>;
  markThreadSeen?: Maybe<Thread>;
};


export type MutationAssignTargetMailboxArgs = {
  input: AssignTargetMailboxInput;
};


export type MutationMarkThreadSeenArgs = {
  id: Scalars['ID']['input'];
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
  from: Contact;
  id: Scalars['ID']['output'];
  lastMessageAt: Scalars['DateTime']['output'];
  messages: Array<Message>;
  snippet?: Maybe<Scalars['String']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  unseenMessagesCount: Scalars['Int']['output'];
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

export type ThreadsFilter = {
  unseen: Scalars['Boolean']['input'];
};

export type User = Node & {
  __typename?: 'User';
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  mailbox?: Maybe<Mailbox>;
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};


export type UserMailboxArgs = {
  type: MailboxType;
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
  Connection:
    | ( Omit<ContactConnection, 'edges'> & { edges: Array<_RefType['ContactEdge']> } & { __typename: 'ContactConnection' } )
    | ( Omit<ThreadsConnection, 'edges'> & { edges: Array<_RefType['ThreadEdge']> } & { __typename: 'ThreadsConnection' } )
  ;
  Edge:
    | ( Omit<ContactEdge, 'node'> & { node: _RefType['Contact'] } & { __typename: 'ContactEdge' } )
    | ( Omit<ThreadEdge, 'node'> & { node: _RefType['Thread'] } & { __typename: 'ThreadEdge' } )
  ;
  Node:
    | ( Attachment & { __typename: 'Attachment' } )
    | ( AddressUserSelectModel & { __typename: 'Contact' } )
    | ( MailboxSelectModel & { __typename: 'Mailbox' } )
    | ( MessageSelectModel & { __typename: 'Message' } )
    | ( ThreadSelectModel & { __typename: 'Thread' } )
    | ( UserSelectModel & { __typename: 'User' } )
  ;
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AssignTargetMailboxInput: AssignTargetMailboxInput;
  Attachment: ResolverTypeWrapper<Attachment>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Connection: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Connection']>;
  Contact: ResolverTypeWrapper<AddressUserSelectModel>;
  ContactConnection: ResolverTypeWrapper<Omit<ContactConnection, 'edges'> & { edges: Array<ResolversTypes['ContactEdge']> }>;
  ContactEdge: ResolverTypeWrapper<Omit<ContactEdge, 'node'> & { node: ResolversTypes['Contact'] }>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Edge: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Edge']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mailbox: ResolverTypeWrapper<MailboxSelectModel>;
  MailboxType: MailboxType;
  Message: ResolverTypeWrapper<MessageSelectModel>;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Node: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Node']>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Thread: ResolverTypeWrapper<ThreadSelectModel>;
  ThreadEdge: ResolverTypeWrapper<Omit<ThreadEdge, 'node'> & { node: ResolversTypes['Thread'] }>;
  ThreadsConnection: ResolverTypeWrapper<Omit<ThreadsConnection, 'edges'> & { edges: Array<ResolversTypes['ThreadEdge']> }>;
  ThreadsFilter: ThreadsFilter;
  URL: ResolverTypeWrapper<Scalars['URL']['output']>;
  User: ResolverTypeWrapper<UserSelectModel>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AssignTargetMailboxInput: AssignTargetMailboxInput;
  Attachment: Attachment;
  Boolean: Scalars['Boolean']['output'];
  Connection: ResolversInterfaceTypes<ResolversParentTypes>['Connection'];
  Contact: AddressUserSelectModel;
  ContactConnection: Omit<ContactConnection, 'edges'> & { edges: Array<ResolversParentTypes['ContactEdge']> };
  ContactEdge: Omit<ContactEdge, 'node'> & { node: ResolversParentTypes['Contact'] };
  DateTime: Scalars['DateTime']['output'];
  Edge: ResolversInterfaceTypes<ResolversParentTypes>['Edge'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  Mailbox: MailboxSelectModel;
  Message: MessageSelectModel;
  Mutation: Record<PropertyKey, never>;
  Node: ResolversInterfaceTypes<ResolversParentTypes>['Node'];
  PageInfo: PageInfo;
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
  Thread: ThreadSelectModel;
  ThreadEdge: Omit<ThreadEdge, 'node'> & { node: ResolversParentTypes['Thread'] };
  ThreadsConnection: Omit<ThreadsConnection, 'edges'> & { edges: Array<ResolversParentTypes['ThreadEdge']> };
  ThreadsFilter: ThreadsFilter;
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
  __resolveType: TypeResolveFn<'ContactConnection' | 'ThreadsConnection', ParentType, ContextType>;
};

export type ContactResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Contact'] = ResolversParentTypes['Contact']> = {
  address?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  messages?: Resolver<Array<ResolversTypes['Message']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  targetMailbox?: Resolver<ResolversTypes['Mailbox'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ContactConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ContactConnection'] = ResolversParentTypes['ContactConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ContactEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ContactEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ContactEdge'] = ResolversParentTypes['ContactEdge']> = {
  cursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Contact'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type EdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Edge'] = ResolversParentTypes['Edge']> = {
  __resolveType: TypeResolveFn<'ContactEdge' | 'ThreadEdge', ParentType, ContextType>;
};

export type MailboxResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mailbox'] = ResolversParentTypes['Mailbox']> = {
  assignedContactsCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  contacts?: Resolver<ResolversTypes['ContactConnection'], ParentType, ContextType, Partial<MailboxContactsArgs>>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  threads?: Resolver<ResolversTypes['ThreadsConnection'], ParentType, ContextType, Partial<MailboxThreadsArgs>>;
  type?: Resolver<ResolversTypes['MailboxType'], ParentType, ContextType>;
  unseenThreadsCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Message'] = ResolversParentTypes['Message']> = {
  attachments?: Resolver<Array<ResolversTypes['Attachment']>, ParentType, ContextType>;
  bodyHTML?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bodyText?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  cc?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  from?: Resolver<ResolversTypes['Contact'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  recievedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  replyTo?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  snippet?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  subject?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  to?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  unseen?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  assignTargetMailbox?: Resolver<Maybe<ResolversTypes['Contact']>, ParentType, ContextType, RequireFields<MutationAssignTargetMailboxArgs, 'input'>>;
  markThreadSeen?: Resolver<Maybe<ResolversTypes['Thread']>, ParentType, ContextType, RequireFields<MutationMarkThreadSeenArgs, 'id'>>;
};

export type NodeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Node'] = ResolversParentTypes['Node']> = {
  __resolveType: TypeResolveFn<'Attachment' | 'Contact' | 'Mailbox' | 'Message' | 'Thread' | 'User', ParentType, ContextType>;
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
  from?: Resolver<ResolversTypes['Contact'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastMessageAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  messages?: Resolver<Array<ResolversTypes['Message']>, ParentType, ContextType>;
  snippet?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  unseenMessagesCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  mailbox?: Resolver<Maybe<ResolversTypes['Mailbox']>, ParentType, ContextType, RequireFields<UserMailboxArgs, 'type'>>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  Attachment?: AttachmentResolvers<ContextType>;
  Connection?: ConnectionResolvers<ContextType>;
  Contact?: ContactResolvers<ContextType>;
  ContactConnection?: ContactConnectionResolvers<ContextType>;
  ContactEdge?: ContactEdgeResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Edge?: EdgeResolvers<ContextType>;
  Mailbox?: MailboxResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Node?: NodeResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Thread?: ThreadResolvers<ContextType>;
  ThreadEdge?: ThreadEdgeResolvers<ContextType>;
  ThreadsConnection?: ThreadsConnectionResolvers<ContextType>;
  URL?: GraphQLScalarType;
  User?: UserResolvers<ContextType>;
};

