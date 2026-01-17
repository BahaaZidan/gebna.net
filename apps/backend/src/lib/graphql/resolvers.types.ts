/* eslint-disable */
import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import type { UserSelectModel, IdentitySelectModel, IdentityRelationshipSelectModel, ConversationSelectModel, ConversationParticipantSelectModel, MessageSelectModel, MessageDeliverySelectModel } from '$lib/db';
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
  Cursor: { input: any; output: any; }
  DateTime: { input: Date; output: Date; }
};

export type AddConversationParticipantsInput = {
  conversationId: Scalars['ID']['input'];
  participantAddresses: Array<Scalars['String']['input']>;
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
  before?: InputMaybe<Scalars['Cursor']['input']>;
  last: Scalars['Int']['input'];
};

export type ConversationConnection = {
  __typename?: 'ConversationConnection';
  edges: Array<ConversationEdge>;
  pageInfo: PageInfo;
};

export type ConversationEdge = {
  __typename?: 'ConversationEdge';
  cursor: Scalars['Cursor']['output'];
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

export type Identity = Node & {
  __typename?: 'Identity';
  /**
   * Canonical address-like identifier.
   * Examples:
   * - "alice@gebna.net"
   * - "bob@gmail.com"
   */
  address: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  kind: IdentityKind;
  /**
   * Viewer-scoped relationship metadata (contacts).
   * Always resolved.
   */
  relationshipToViewer?: Maybe<IdentityRelationship>;
};

export type IdentityConnection = {
  __typename?: 'IdentityConnection';
  edges: Array<IdentityEdge>;
  pageInfo: PageInfo;
};

export type IdentityEdge = {
  __typename?: 'IdentityEdge';
  cursor: Scalars['Cursor']['output'];
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

export type MarkConversationReadPayload = {
  __typename?: 'MarkConversationReadPayload';
  conversation: Conversation;
};

export type Message = Node & {
  __typename?: 'Message';
  bodyHTML?: Maybe<Scalars['String']['output']>;
  bodyText?: Maybe<Scalars['String']['output']>;
  conversationId: Scalars['ID']['output'];
  createdAt: Scalars['DateTime']['output'];
  delivery: Array<DeliveryReceipt>;
  id: Scalars['ID']['output'];
  sender: Identity;
};

export type MessageConnection = {
  __typename?: 'MessageConnection';
  edges: Array<MessageEdge>;
  pageInfo: PageInfo;
};

export type MessageEdge = {
  __typename?: 'MessageEdge';
  cursor: Scalars['Cursor']['output'];
  node: Message;
};

export type MoveConversationInput = {
  conversationId: Scalars['ID']['input'];
  mailbox: Mailbox;
};

export type Mutation = {
  __typename?: 'Mutation';
  addConversationParticipants?: Maybe<Conversation>;
  markConversationRead: MarkConversationReadPayload;
  moveConversation?: Maybe<Conversation>;
  sendMessage: SendMessagePayload;
  setContactStatus?: Maybe<Identity>;
  upsertConversation: UpsertConversationPayload;
};


export type MutationAddConversationParticipantsArgs = {
  input: AddConversationParticipantsInput;
};


export type MutationMarkConversationReadArgs = {
  input: MarkConversationReadInput;
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
  endCursor?: Maybe<Scalars['Cursor']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
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
  bodyText: Scalars['String']['input'];
  clientMutationId: Scalars['String']['input'];
  conversationId: Scalars['ID']['input'];
};

export type SendMessagePayload = {
  __typename?: 'SendMessagePayload';
  clientMutationId: Scalars['String']['output'];
  message: Message;
};

export type SetContactStatusInput = {
  avatarUrl?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  identityId: Scalars['ID']['input'];
  isContact: Scalars['Boolean']['input'];
};

export type Subscription = {
  __typename?: 'Subscription';
  conversationUpdated: Conversation;
  deliveryUpdated: Array<DeliveryReceipt>;
  messageAdded: Message;
};


export type SubscriptionDeliveryUpdatedArgs = {
  messageId: Scalars['ID']['input'];
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
  conversationsByMailbox: ConversationConnection;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};


export type ViewerContactsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  first: Scalars['Int']['input'];
  query?: InputMaybe<Scalars['String']['input']>;
};


export type ViewerConversationsByMailboxArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
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
  Conversation: ResolverTypeWrapper<ConversationSelectModel>;
  ConversationConnection: ResolverTypeWrapper<Omit<ConversationConnection, 'edges'> & { edges: Array<ResolversTypes['ConversationEdge']> }>;
  ConversationEdge: ResolverTypeWrapper<Omit<ConversationEdge, 'node'> & { node: ResolversTypes['Conversation'] }>;
  ConversationKind: ConversationKind;
  ConversationParticipant: ResolverTypeWrapper<ConversationParticipantSelectModel>;
  ConversationViewerState: ResolverTypeWrapper<ConversationViewerState>;
  Cursor: ResolverTypeWrapper<Scalars['Cursor']['output']>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  DeliveryReceipt: ResolverTypeWrapper<MessageDeliverySelectModel>;
  DeliveryStatus: DeliveryStatus;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Identity: ResolverTypeWrapper<IdentitySelectModel>;
  IdentityConnection: ResolverTypeWrapper<Omit<IdentityConnection, 'edges'> & { edges: Array<ResolversTypes['IdentityEdge']> }>;
  IdentityEdge: ResolverTypeWrapper<Omit<IdentityEdge, 'node'> & { node: ResolversTypes['Identity'] }>;
  IdentityKind: IdentityKind;
  IdentityRelationship: ResolverTypeWrapper<IdentityRelationshipSelectModel>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Mailbox: Mailbox;
  MarkConversationReadInput: MarkConversationReadInput;
  MarkConversationReadPayload: ResolverTypeWrapper<Omit<MarkConversationReadPayload, 'conversation'> & { conversation: ResolversTypes['Conversation'] }>;
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
  SendMessagePayload: ResolverTypeWrapper<Omit<SendMessagePayload, 'message'> & { message: ResolversTypes['Message'] }>;
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
  Conversation: ConversationSelectModel;
  ConversationConnection: Omit<ConversationConnection, 'edges'> & { edges: Array<ResolversParentTypes['ConversationEdge']> };
  ConversationEdge: Omit<ConversationEdge, 'node'> & { node: ResolversParentTypes['Conversation'] };
  ConversationParticipant: ConversationParticipantSelectModel;
  ConversationViewerState: ConversationViewerState;
  Cursor: Scalars['Cursor']['output'];
  DateTime: Scalars['DateTime']['output'];
  DeliveryReceipt: MessageDeliverySelectModel;
  ID: Scalars['ID']['output'];
  Identity: IdentitySelectModel;
  IdentityConnection: Omit<IdentityConnection, 'edges'> & { edges: Array<ResolversParentTypes['IdentityEdge']> };
  IdentityEdge: Omit<IdentityEdge, 'node'> & { node: ResolversParentTypes['Identity'] };
  IdentityRelationship: IdentityRelationshipSelectModel;
  Int: Scalars['Int']['output'];
  MarkConversationReadInput: MarkConversationReadInput;
  MarkConversationReadPayload: Omit<MarkConversationReadPayload, 'conversation'> & { conversation: ResolversParentTypes['Conversation'] };
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
  SendMessagePayload: Omit<SendMessagePayload, 'message'> & { message: ResolversParentTypes['Message'] };
  SetContactStatusInput: SetContactStatusInput;
  String: Scalars['String']['output'];
  Subscription: Record<PropertyKey, never>;
  UpsertConversationInput: UpsertConversationInput;
  UpsertConversationPayload: Omit<UpsertConversationPayload, 'conversation'> & { conversation: ResolversParentTypes['Conversation'] };
  Viewer: UserSelectModel;
};

export type ConversationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Conversation'] = ResolversParentTypes['Conversation']> = {
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

export type ConversationConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ConversationConnection'] = ResolversParentTypes['ConversationConnection']> = {
  edges?: Resolver<Array<ResolversTypes['ConversationEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type ConversationEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ConversationEdge'] = ResolversParentTypes['ConversationEdge']> = {
  cursor?: Resolver<ResolversTypes['Cursor'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Conversation'], ParentType, ContextType>;
};

export type ConversationParticipantResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ConversationParticipant'] = ResolversParentTypes['ConversationParticipant']> = {
  identity?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  joinedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  lastReadMessageId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['ParticipantRole'], ParentType, ContextType>;
  state?: Resolver<ResolversTypes['ParticipantState'], ParentType, ContextType>;
};

export type ConversationViewerStateResolvers<ContextType = Context, ParentType extends ResolversParentTypes['ConversationViewerState'] = ResolversParentTypes['ConversationViewerState']> = {
  mailbox?: Resolver<ResolversTypes['Mailbox'], ParentType, ContextType>;
  unreadCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export interface CursorScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Cursor'], any> {
  name: 'Cursor';
}

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type DeliveryReceiptResolvers<ContextType = Context, ParentType extends ResolversParentTypes['DeliveryReceipt'] = ResolversParentTypes['DeliveryReceipt']> = {
  error?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  latestStatusChangeAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  recipient?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['DeliveryStatus'], ParentType, ContextType>;
  transport?: Resolver<ResolversTypes['Transport'], ParentType, ContextType>;
};

export type IdentityResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Identity'] = ResolversParentTypes['Identity']> = {
  address?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  kind?: Resolver<ResolversTypes['IdentityKind'], ParentType, ContextType>;
  relationshipToViewer?: Resolver<Maybe<ResolversTypes['IdentityRelationship']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type IdentityConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IdentityConnection'] = ResolversParentTypes['IdentityConnection']> = {
  edges?: Resolver<Array<ResolversTypes['IdentityEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type IdentityEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IdentityEdge'] = ResolversParentTypes['IdentityEdge']> = {
  cursor?: Resolver<ResolversTypes['Cursor'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
};

export type IdentityRelationshipResolvers<ContextType = Context, ParentType extends ResolversParentTypes['IdentityRelationship'] = ResolversParentTypes['IdentityRelationship']> = {
  avatarUrl?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isContact?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MarkConversationReadPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['MarkConversationReadPayload'] = ResolversParentTypes['MarkConversationReadPayload']> = {
  conversation?: Resolver<ResolversTypes['Conversation'], ParentType, ContextType>;
};

export type MessageResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Message'] = ResolversParentTypes['Message']> = {
  bodyHTML?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  bodyText?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  conversationId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  delivery?: Resolver<Array<ResolversTypes['DeliveryReceipt']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  sender?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MessageConnectionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['MessageConnection'] = ResolversParentTypes['MessageConnection']> = {
  edges?: Resolver<Array<ResolversTypes['MessageEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
};

export type MessageEdgeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['MessageEdge'] = ResolversParentTypes['MessageEdge']> = {
  cursor?: Resolver<ResolversTypes['Cursor'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Message'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addConversationParticipants?: Resolver<Maybe<ResolversTypes['Conversation']>, ParentType, ContextType, RequireFields<MutationAddConversationParticipantsArgs, 'input'>>;
  markConversationRead?: Resolver<ResolversTypes['MarkConversationReadPayload'], ParentType, ContextType, RequireFields<MutationMarkConversationReadArgs, 'input'>>;
  moveConversation?: Resolver<Maybe<ResolversTypes['Conversation']>, ParentType, ContextType, RequireFields<MutationMoveConversationArgs, 'input'>>;
  sendMessage?: Resolver<ResolversTypes['SendMessagePayload'], ParentType, ContextType, RequireFields<MutationSendMessageArgs, 'input'>>;
  setContactStatus?: Resolver<Maybe<ResolversTypes['Identity']>, ParentType, ContextType, RequireFields<MutationSetContactStatusArgs, 'input'>>;
  upsertConversation?: Resolver<ResolversTypes['UpsertConversationPayload'], ParentType, ContextType, RequireFields<MutationUpsertConversationArgs, 'input'>>;
};

export type NodeResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Node'] = ResolversParentTypes['Node']> = {
  __resolveType: TypeResolveFn<'Conversation' | 'Identity' | 'IdentityRelationship' | 'Message' | 'Viewer', ParentType, ContextType>;
};

export type PageInfoResolvers<ContextType = Context, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['Cursor']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  node?: Resolver<Maybe<ResolversTypes['Node']>, ParentType, ContextType, RequireFields<QueryNodeArgs, 'id'>>;
  viewer?: Resolver<Maybe<ResolversTypes['Viewer']>, ParentType, ContextType>;
};

export type RecipientTransportDecisionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['RecipientTransportDecision'] = ResolversParentTypes['RecipientTransportDecision']> = {
  chosen?: Resolver<ResolversTypes['Transport'], ParentType, ContextType>;
  reason?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  recipient?: Resolver<ResolversTypes['Identity'], ParentType, ContextType>;
};

export type SendMessagePayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['SendMessagePayload'] = ResolversParentTypes['SendMessagePayload']> = {
  clientMutationId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['Message'], ParentType, ContextType>;
};

export type SubscriptionResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Subscription'] = ResolversParentTypes['Subscription']> = {
  conversationUpdated?: SubscriptionResolver<ResolversTypes['Conversation'], "conversationUpdated", ParentType, ContextType>;
  deliveryUpdated?: SubscriptionResolver<Array<ResolversTypes['DeliveryReceipt']>, "deliveryUpdated", ParentType, ContextType, RequireFields<SubscriptionDeliveryUpdatedArgs, 'messageId'>>;
  messageAdded?: SubscriptionResolver<ResolversTypes['Message'], "messageAdded", ParentType, ContextType, RequireFields<SubscriptionMessageAddedArgs, 'conversationId'>>;
};

export type UpsertConversationPayloadResolvers<ContextType = Context, ParentType extends ResolversParentTypes['UpsertConversationPayload'] = ResolversParentTypes['UpsertConversationPayload']> = {
  conversation?: Resolver<ResolversTypes['Conversation'], ParentType, ContextType>;
  created?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
};

export type ViewerResolvers<ContextType = Context, ParentType extends ResolversParentTypes['Viewer'] = ResolversParentTypes['Viewer']> = {
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contacts?: Resolver<ResolversTypes['IdentityConnection'], ParentType, ContextType, RequireFields<ViewerContactsArgs, 'first'>>;
  conversationsByMailbox?: Resolver<ResolversTypes['ConversationConnection'], ParentType, ContextType, RequireFields<ViewerConversationsByMailboxArgs, 'first' | 'mailbox'>>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = Context> = {
  Conversation?: ConversationResolvers<ContextType>;
  ConversationConnection?: ConversationConnectionResolvers<ContextType>;
  ConversationEdge?: ConversationEdgeResolvers<ContextType>;
  ConversationParticipant?: ConversationParticipantResolvers<ContextType>;
  ConversationViewerState?: ConversationViewerStateResolvers<ContextType>;
  Cursor?: GraphQLScalarType;
  DateTime?: GraphQLScalarType;
  DeliveryReceipt?: DeliveryReceiptResolvers<ContextType>;
  Identity?: IdentityResolvers<ContextType>;
  IdentityConnection?: IdentityConnectionResolvers<ContextType>;
  IdentityEdge?: IdentityEdgeResolvers<ContextType>;
  IdentityRelationship?: IdentityRelationshipResolvers<ContextType>;
  MarkConversationReadPayload?: MarkConversationReadPayloadResolvers<ContextType>;
  Message?: MessageResolvers<ContextType>;
  MessageConnection?: MessageConnectionResolvers<ContextType>;
  MessageEdge?: MessageEdgeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Node?: NodeResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  RecipientTransportDecision?: RecipientTransportDecisionResolvers<ContextType>;
  SendMessagePayload?: SendMessagePayloadResolvers<ContextType>;
  Subscription?: SubscriptionResolvers<ContextType>;
  UpsertConversationPayload?: UpsertConversationPayloadResolvers<ContextType>;
  Viewer?: ViewerResolvers<ContextType>;
};

