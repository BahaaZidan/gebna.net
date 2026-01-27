/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { UserSelectModel, IdentitySelectModel, IdentityRelationshipSelectModel, ConversationSelectModel, ConversationParticipantSelectModel, MessageSelectModel, MessageDeliverySelectModel } from '$lib/db';
import type { GraphQLResolverContext } from 'src/worker-handlers/fetch';
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
};

export type AddConversationParticipantsInput = {
  conversationId: Scalars['ID']['input'];
  participantAddresses: Array<Scalars['String']['input']>;
};

export type Connection = {
  edges: Array<Edge>;
  pageInfo: PageInfo;
};

export type Conversation = Node & {
  __typename?: 'Conversation';
  id: Scalars['ID']['output'];
  kind: ConversationKind;
  lastMessage: Message;
  messages: MessageConnection;
  participants: Array<ConversationParticipant>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['DateTime']['output'];
  viewerState: ConversationViewerState;
};


export type ConversationMessagesArgs = {
  before?: InputMaybe<Scalars['String']['input']>;
  last: Scalars['Int']['input'];
};

export type ConversationConnection = Connection & {
  __typename?: 'ConversationConnection';
  edges: Array<ConversationEdge>;
  pageInfo: PageInfo;
};

export type ConversationEdge = Edge & {
  __typename?: 'ConversationEdge';
  cursor: Scalars['String']['output'];
  node: Conversation;
};

export type ConversationKind =
  | 'GROUP'
  | 'PRIVATE';

export type ConversationParticipant = {
  __typename?: 'ConversationParticipant';
  identity: Identity;
  joinedAt: Scalars['DateTime']['output'];
  /**
   * Last message read by this participant.
   * Use a sentinel ID if none.
   */
  lastReadMessageId?: Maybe<Scalars['ID']['output']>;
  role: ParticipantRole;
  state: ParticipantState;
};

export type ConversationViewerState = {
  __typename?: 'ConversationViewerState';
  mailbox: Mailbox;
  unreadCount: Scalars['Int']['output'];
};

export type DeliveryReceipt = {
  __typename?: 'DeliveryReceipt';
  error?: Maybe<Scalars['String']['output']>;
  latestStatusChangeAt: Scalars['DateTime']['output'];
  recipient: Identity;
  status: DeliveryStatus;
  transport: Transport;
};

export type DeliveryStatus =
  | 'DELIVERED'
  | 'FAILED'
  | 'QUEUED'
  | 'READ'
  | 'SENT';

export type Edge = {
  cursor?: Maybe<Scalars['String']['output']>;
  node: Node;
};

export type Greeting = {
  __typename?: 'Greeting';
  greeting?: Maybe<Scalars['String']['output']>;
};

export type Identity = Node & {
  __typename?: 'Identity';
  /**
   * Canonical address-like identifier.
   * Examples:
   * - "alice@gebna.net"
   * - "bob@gmail.com"
   */
  address: Scalars['String']['output'];
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: IdentityKind;
  name?: Maybe<Scalars['String']['output']>;
  /**
   * Viewer-scoped relationship metadata (contacts).
   * Always resolved.
   */
  relationshipToViewer?: Maybe<IdentityRelationship>;
};

export type IdentityConnection = Connection & {
  __typename?: 'IdentityConnection';
  edges: Array<IdentityEdge>;
  pageInfo: PageInfo;
};

export type IdentityEdge = Edge & {
  __typename?: 'IdentityEdge';
  cursor: Scalars['String']['output'];
  node: Identity;
};

export type IdentityKind =
  | 'EXTERNAL_EMAIL'
  | 'GEBNA_USER';

export type IdentityRelationship = Node & {
  __typename?: 'IdentityRelationship';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  /**
   * Viewer-scoped display metadata.
   * Empty string allowed when not customized.
   */
  displayName?: Maybe<Scalars['String']['output']>;
  /**
   * Stable viewer-scoped relationship id.
   * Virtual or persisted depending on implementation.
   */
  id: Scalars['ID']['output'];
  /** Whether the viewer saved this identity as a contact. */
  isContact: Scalars['Boolean']['output'];
};

/**
 * Conversation placement for the viewer.
 * Purely organizational (no gating).
 */
export type Mailbox =
  | 'IMPORTANT'
  | 'TRASH';

export type MarkConversationReadInput = {
  conversationId: Scalars['ID']['input'];
  lastReadMessageId: Scalars['ID']['input'];
};

export type Message = Node & {
  __typename?: 'Message';
  bodyHTML?: Maybe<Scalars['String']['output']>;
  bodyMD?: Maybe<Scalars['String']['output']>;
  bodyText?: Maybe<Scalars['String']['output']>;
  conversationId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  delivery: Array<DeliveryReceipt>;
  hasHTML: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  sender: Identity;
};

export type MessageConnection = Connection & {
  __typename?: 'MessageConnection';
  edges: Array<MessageEdge>;
  pageInfo: PageInfo;
};

export type MessageEdge = Edge & {
  __typename?: 'MessageEdge';
  cursor: Scalars['String']['output'];
  node: Message;
};

export type MoveConversationInput = {
  conversationId: Scalars['ID']['input'];
  mailbox: Mailbox;
};

export type Mutation = {
  __typename?: 'Mutation';
  addConversationParticipants?: Maybe<Conversation>;
  greet?: Maybe<Scalars['String']['output']>;
  markConversationRead: Conversation;
  moveConversation?: Maybe<Conversation>;
  sendMessage: Message;
  setContactStatus?: Maybe<Identity>;
  upsertConversation: UpsertConversationPayload;
};


export type MutationAddConversationParticipantsArgs = {
  input: AddConversationParticipantsInput;
};


export type MutationGreetArgs = {
  greeting: Scalars['String']['input'];
};


export type MutationMarkConversationReadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMoveConversationArgs = {
  input: MoveConversationInput;
};


export type MutationSendMessageArgs = {
  input: SendMessageInput;
};


export type MutationSetContactStatusArgs = {
  input: SetContactStatusInput;
};


export type MutationUpsertConversationArgs = {
  input: UpsertConversationInput;
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

export type ParticipantRole =
  | 'ADMIN'
  | 'MEMBER';

export type ParticipantState =
  | 'ACTIVE'
  | 'LEFT';

export type Query = {
  __typename?: 'Query';
  node?: Maybe<Node>;
  viewer?: Maybe<Viewer>;
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};

export type RecipientTransportDecision = {
  __typename?: 'RecipientTransportDecision';
  chosen: Transport;
  reason: Scalars['String']['output'];
  recipient: Identity;
};

export type SendMessageInput = {
  bodyMD: Scalars['String']['input'];
  conversationId: Scalars['ID']['input'];
};

export type SetContactStatusInput = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  identityId: Scalars['ID']['input'];
  isContact: Scalars['Boolean']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  greetings?: Maybe<Greeting>;
  messageAdded: Message;
};


export type SubscriptionGreetingsArgs = {
  greeting?: InputMaybe<Scalars['String']['input']>;
};


export type SubscriptionMessageAddedArgs = {
  conversationId: Scalars['ID']['input'];
};

export type Transport =
  | 'EMAIL'
  | 'GEBNA_DM';

export type UpsertConversationInput = {
  kind: ConversationKind;
  /**
   * For PRIVATE: exactly 1 address (the other participant).
   * Viewer is implied.
   * For GROUP: N addresses; viewer is implied.
   */
  participantAddresses: Array<Scalars['String']['input']>;
  title: Scalars['String']['input'];
};

export type UpsertConversationPayload = {
  __typename?: 'UpsertConversationPayload';
  conversation: Conversation;
  created: Scalars['Boolean']['output'];
};

export type Viewer = Node & {
  __typename?: 'Viewer';
  avatar: Scalars['String']['output'];
  /** List of saved contacts. */
  contacts: IdentityConnection;
  conversations: ConversationConnection;
  id: Scalars['ID']['output'];
  identity: Identity;
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};


export type ViewerContactsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first: Scalars['Int']['input'];
  query?: InputMaybe<Scalars['String']['input']>;
};


export type ViewerConversationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first: Scalars['Int']['input'];
  mailbox: Mailbox;
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
    | ( Omit<ConversationConnection, 'edges'> & { edges: Array<_RefType['ConversationEdge']> } & { __typename: 'ConversationConnection' } )
    | ( Omit<IdentityConnection, 'edges'> & { edges: Array<_RefType['IdentityEdge']> } & { __typename: 'IdentityConnection' } )
    | ( Omit<MessageConnection, 'edges'> & { edges: Array<_RefType['MessageEdge']> } & { __typename: 'MessageConnection' } )
  ;
  Edge:
    | ( Omit<ConversationEdge, 'node'> & { node: _RefType['Conversation'] } & { __typename: 'ConversationEdge' } )
    | ( Omit<IdentityEdge, 'node'> & { node: _RefType['Identity'] } & { __typename: 'IdentityEdge' } )
    | ( Omit<MessageEdge, 'node'> & { node: _RefType['Message'] } & { __typename: 'MessageEdge' } )
  ;
  Node:
    | ( ConversationSelectModel & { __typename: 'Conversation' } )
    | ( IdentitySelectModel & { __typename: 'Identity' } )
    | ( IdentityRelationshipSelectModel & { __typename: 'IdentityRelationship' } )
    | ( MessageSelectModel & { __typename: 'Message' } )
    | ( UserSelectModel & { __typename: 'Viewer' } )
  ;
};

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AddConversationParticipantsInput: AddConversationParticipantsInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  Connection: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Connection']>;
  Conversation: ResolverTypeWrapper<ConversationSelectModel>;
  ConversationConnection: ResolverTypeWrapper<Omit<ConversationConnection, 'edges'> & { edges: Array<ResolversTypes['ConversationEdge']> }>;
  ConversationEdge: ResolverTypeWrapper<Omit<ConversationEdge, 'node'> & { node: ResolversTypes['Conversation'] }>;
  ConversationKind: ConversationKind;
  ConversationParticipant: ResolverTypeWrapper<ConversationParticipantSelectModel>;
  ConversationViewerState: ResolverTypeWrapper<ConversationViewerState>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DeliveryReceipt: ResolverTypeWrapper<MessageDeliverySelectModel>;
  DeliveryStatus: DeliveryStatus;
  Edge: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Edge']>;
  Greeting: ResolverTypeWrapper<Greeting>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Identity: ResolverTypeWrapper<IdentitySelectModel>;
  IdentityConnection: ResolverTypeWrapper<Omit<IdentityConnection, 'edges'> & { edges: Array<ResolversTypes['IdentityEdge']> }>;
  IdentityEdge: ResolverTypeWrapper<Omit<IdentityEdge, 'node'> & { node: ResolversTypes['Identity'] }>;
  IdentityKind: IdentityKind;
  IdentityRelationship: ResolverTypeWrapper<IdentityRelationshipSelectModel>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mailbox: Mailbox;
  MarkConversationReadInput: MarkConversationReadInput;
  Message: ResolverTypeWrapper<MessageSelectModel>;
  MessageConnection: ResolverTypeWrapper<Omit<MessageConnection, 'edges'> & { edges: Array<ResolversTypes['MessageEdge']> }>;
  MessageEdge: ResolverTypeWrapper<Omit<MessageEdge, 'node'> & { node: ResolversTypes['Message'] }>;
  MoveConversationInput: MoveConversationInput;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Node: ResolverTypeWrapper<ResolversInterfaceTypes<ResolversTypes>['Node']>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  ParticipantRole: ParticipantRole;
  ParticipantState: ParticipantState;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  RecipientTransportDecision: ResolverTypeWrapper<Omit<RecipientTransportDecision, 'recipient'> & { recipient: ResolversTypes['Identity'] }>;
  SendMessageInput: SendMessageInput;
  SetContactStatusInput: SetContactStatusInput;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Subscription: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Transport: Transport;
  UpsertConversationInput: UpsertConversationInput;
  UpsertConversationPayload: ResolverTypeWrapper<Omit<UpsertConversationPayload, 'conversation'> & { conversation: ResolversTypes['Conversation'] }>;
  Viewer: ResolverTypeWrapper<UserSelectModel>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AddConversationParticipantsInput: AddConversationParticipantsInput;
  Boolean: Scalars['Boolean']['output'];
  Connection: ResolversInterfaceTypes<ResolversParentTypes>['Connection'];
  Conversation: ConversationSelectModel;
  ConversationConnection: Omit<ConversationConnection, 'edges'> & { edges: Array<ResolversParentTypes['ConversationEdge']> };
  ConversationEdge: Omit<ConversationEdge, 'node'> & { node: ResolversParentTypes['Conversation'] };
  ConversationParticipant: ConversationParticipantSelectModel;
  ConversationViewerState: ConversationViewerState;
  DateTime: Scalars['DateTime']['output'];
  DeliveryReceipt: MessageDeliverySelectModel;
  Edge: ResolversInterfaceTypes<ResolversParentTypes>['Edge'];
  Greeting: Greeting;
  ID: Scalars['ID']['output'];
  Identity: IdentitySelectModel;
  IdentityConnection: Omit<IdentityConnection, 'edges'> & { edges: Array<ResolversParentTypes['IdentityEdge']> };
  IdentityEdge: Omit<IdentityEdge, 'node'> & { node: ResolversParentTypes['Identity'] };
  IdentityRelationship: IdentityRelationshipSelectModel;
  Int: Scalars['Int']['output'];
  MarkConversationReadInput: MarkConversationReadInput;
  Message: MessageSelectModel;
  MessageConnection: Omit<MessageConnection, 'edges'> & { edges: Array<ResolversParentTypes['MessageEdge']> };
  MessageEdge: Omit<MessageEdge, 'node'> & { node: ResolversParentTypes['Message'] };
  MoveConversationInput: MoveConversationInput;
  Mutation: Record<PropertyKey, never>;
  Node: ResolversInterfaceTypes<ResolversParentTypes>['Node'];
  PageInfo: PageInfo;
  Query: Record<PropertyKey, never>;
  RecipientTransportDecision: Omit<RecipientTransportDecision, 'recipient'> & { recipient: ResolversParentTypes['Identity'] };
  SendMessageInput: SendMessageInput;
  SetContactStatusInput: SetContactStatusInput;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  UpsertConversationInput: UpsertConversationInput;
  UpsertConversationPayload: Omit<UpsertConversationPayload, 'conversation'> & { conversation: ResolversParentTypes['Conversation'] };
  Viewer: UserSelectModel;
};

export type ConnectionResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Connection'] = ResolversParentTypes['Connection']> = {
  __resolveType: TypeResolveFn<'ConversationConnection' | 'IdentityConnection' | 'MessageConnection', ParentType, ContextType>;
};

export type ConversationResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Conversation'] = ResolversParentTypes['Conversation']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['ConversationKind'], ParentType, ContextType>;
  lastMessage?: Resolver<ResolversTypes['Message'], ParentType, ContextType>;
  messages?: Resolver<ResolversTypes['MessageConnection'], ParentType, ContextType, RequireFields<ConversationMessagesArgs, 'last'>>;
  participants?: Resolver<Array<ResolversTypes['ConversationParticipant']>, ParentType, ContextType>;
  title?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  viewerState?: Resolver<ResolversTypes['ConversationViewerState'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConversationConnectionResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['ConversationConnection'] = ResolversParentTypes['ConversationConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ConversationEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConversationEdgeResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['ConversationEdge'] = ResolversParentTypes['ConversationEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Conversation'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConversationParticipantResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['ConversationParticipant'] = ResolversParentTypes['ConversationParticipant']> = {
  identity?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  joinedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  lastReadMessageId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['ParticipantRole'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['ParticipantState'], ParentType, ContextType>;
};

export type ConversationViewerStateResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['ConversationViewerState'] = ResolversParentTypes['ConversationViewerState']> = {
  mailbox?: Resolver<ResolversTypes['Mailbox'], ParentType, ContextType>;
  unreadCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type DeliveryReceiptResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['DeliveryReceipt'] = ResolversParentTypes['DeliveryReceipt']> = {
  error?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  latestStatusChangeAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  recipient?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['DeliveryStatus'], ParentType, ContextType>;
  transport?: Resolver<ResolversTypes['Transport'], ParentType, ContextType>;
};

export type EdgeResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Edge'] = ResolversParentTypes['Edge']> = {
  __resolveType: TypeResolveFn<'ConversationEdge' | 'IdentityEdge' | 'MessageEdge', ParentType, ContextType>;
};

export type GreetingResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Greeting'] = ResolversParentTypes['Greeting']> = {
  greeting?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type IdentityResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Identity'] = ResolversParentTypes['Identity']> = {
  address?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['IdentityKind'], ParentType, ContextType>;
  name?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  relationshipToViewer?: Resolver<Maybe<ResolversTypes['IdentityRelationship']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IdentityConnectionResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['IdentityConnection'] = ResolversParentTypes['IdentityConnection']> = {
  edges?: Resolver<Array<ResolversTypes['IdentityEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IdentityEdgeResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['IdentityEdge'] = ResolversParentTypes['IdentityEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IdentityRelationshipResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['IdentityRelationship'] = ResolversParentTypes['IdentityRelationship']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isContact?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Message'] = ResolversParentTypes['Message']> = {
  bodyHTML?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bodyMD?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bodyText?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  conversationId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  delivery?: Resolver<Array<ResolversTypes['DeliveryReceipt']>, ParentType, ContextType>;
  hasHTML?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  sender?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageConnectionResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['MessageConnection'] = ResolversParentTypes['MessageConnection']> = {
  edges?: Resolver<Array<ResolversTypes['MessageEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageEdgeResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['MessageEdge'] = ResolversParentTypes['MessageEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Message'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addConversationParticipants?: Resolver<Maybe<ResolversTypes['Conversation']>, ParentType, ContextType, RequireFields<MutationAddConversationParticipantsArgs, 'input'>>;
  greet?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, RequireFields<MutationGreetArgs, 'greeting'>>;
  markConversationRead?: Resolver<ResolversTypes['Conversation'], ParentType, ContextType, RequireFields<MutationMarkConversationReadArgs, 'id'>>;
  moveConversation?: Resolver<Maybe<ResolversTypes['Conversation']>, ParentType, ContextType, RequireFields<MutationMoveConversationArgs, 'input'>>;
  sendMessage?: Resolver<ResolversTypes['Message'], ParentType, ContextType, RequireFields<MutationSendMessageArgs, 'input'>>;
  setContactStatus?: Resolver<Maybe<ResolversTypes['Identity']>, ParentType, ContextType, RequireFields<MutationSetContactStatusArgs, 'input'>>;
  upsertConversation?: Resolver<ResolversTypes['UpsertConversationPayload'], ParentType, ContextType, RequireFields<MutationUpsertConversationArgs, 'input'>>;
};

export type NodeResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Node'] = ResolversParentTypes['Node']> = {
  __resolveType: TypeResolveFn<'Conversation' | 'Identity' | 'IdentityRelationship' | 'Message' | 'Viewer', ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  hasPreviousPage?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  node?: Resolver<Maybe<ResolversTypes['Node']>, ParentType, ContextType, RequireFields<QueryNodeArgs, 'id'>>;
  viewer?: Resolver<Maybe<ResolversTypes['Viewer']>, ParentType, ContextType>;
};

export type RecipientTransportDecisionResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['RecipientTransportDecision'] = ResolversParentTypes['RecipientTransportDecision']> = {
  chosen?: Resolver<ResolversTypes['Transport'], ParentType, ContextType>;
  reason?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  recipient?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  greetings?: SubscriptionResolver<Maybe<ResolversTypes['Greeting']>, "greetings", ParentType, ContextType, Partial<SubscriptionGreetingsArgs>>;
  messageAdded?: SubscriptionResolver<ResolversTypes['Message'], "messageAdded", ParentType, ContextType, RequireFields<SubscriptionMessageAddedArgs, 'conversationId'>>;
};

export type UpsertConversationPayloadResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['UpsertConversationPayload'] = ResolversParentTypes['UpsertConversationPayload']> = {
  conversation?: Resolver<ResolversTypes['Conversation'], ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type ViewerResolvers<ContextType = GraphQLResolverContext, ParentType extends ResolversParentTypes['Viewer'] = ResolversParentTypes['Viewer']> = {
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contacts?: Resolver<ResolversTypes['IdentityConnection'], ParentType, ContextType, RequireFields<ViewerContactsArgs, 'first'>>;
  conversations?: Resolver<ResolversTypes['ConversationConnection'], ParentType, ContextType, RequireFields<ViewerConversationsArgs, 'first' | 'mailbox'>>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  identity?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLResolverContext> = {
  Connection?: ConnectionResolvers<ContextType>;
  Conversation?: ConversationResolvers<ContextType>;
  ConversationConnection?: ConversationConnectionResolvers<ContextType>;
  ConversationEdge?: ConversationEdgeResolvers<ContextType>;
  ConversationParticipant?: ConversationParticipantResolvers<ContextType>;
  ConversationViewerState?: ConversationViewerStateResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  DeliveryReceipt?: DeliveryReceiptResolvers<ContextType>;
  Edge?: EdgeResolvers<ContextType>;
  Greeting?: GreetingResolvers<ContextType>;
  Identity?: IdentityResolvers<ContextType>;
  IdentityConnection?: IdentityConnectionResolvers<ContextType>;
  IdentityEdge?: IdentityEdgeResolvers<ContextType>;
  IdentityRelationship?: IdentityRelationshipResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  MessageConnection?: MessageConnectionResolvers<ContextType>;
  MessageEdge?: MessageEdgeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Node?: NodeResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RecipientTransportDecision?: RecipientTransportDecisionResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  UpsertConversationPayload?: UpsertConversationPayloadResolvers<ContextType>;
  Viewer?: ViewerResolvers<ContextType>;
};

