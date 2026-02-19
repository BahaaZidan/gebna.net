/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: { input: string; output: string; }
};

export type Conversation = Node & {
  __typename?: 'Conversation';
  avatar?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kind: ConversationKind;
  lastMessage?: Maybe<Message>;
  messages: ConversationMessagesConnection;
  /** A list of all past and present participations in this conversation. */
  participations: Array<ConversationParticipation>;
  title?: Maybe<Scalars['String']['output']>;
  viewerState?: Maybe<Array<ConversationViewerState>>;
};


export type ConversationMessagesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type ConversationKind =
  | 'GROUP'
  | 'PRIVATE';

export type ConversationMessagesConnection = {
  __typename?: 'ConversationMessagesConnection';
  edges?: Maybe<Array<Maybe<ConversationMessagesConnectionEdge>>>;
  pageInfo: PageInfo;
};

export type ConversationMessagesConnectionEdge = {
  __typename?: 'ConversationMessagesConnectionEdge';
  cursor: Scalars['String']['output'];
  node?: Maybe<Message>;
};

export type ConversationParticipation = {
  __typename?: 'ConversationParticipation';
  conversation: Conversation;
  id: Scalars['ID']['output'];
  identity: Identity;
  joinedAt: Scalars['DateTime']['output'];
  role: ConversationParticipationRole;
  state: ConversationParticipationState;
};

export type ConversationParticipationRole =
  | 'ADMIN'
  | 'MEMBER';

export type ConversationParticipationState =
  | 'ACTIVE'
  | 'LEFT';

export type ConversationViewerState = {
  __typename?: 'ConversationViewerState';
  id: Scalars['ID']['output'];
  mailbox: ConversationViewerStateMailbox;
  unseenCount: Scalars['Int']['output'];
};

export type ConversationViewerStateMailbox =
  | 'IMPORTANT'
  | 'TRASH';

export type Identity = {
  __typename?: 'Identity';
  address: Scalars['String']['output'];
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
  /** The conversation participations done by this identity */
  participations: IdentityParticipationsConnection;
  viewerRelationship?: Maybe<Array<IdentityRelationship>>;
};


export type IdentityParticipationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type IdentityParticipationsConnection = {
  __typename?: 'IdentityParticipationsConnection';
  edges?: Maybe<Array<Maybe<IdentityParticipationsConnectionEdge>>>;
  pageInfo: PageInfo;
};

export type IdentityParticipationsConnectionEdge = {
  __typename?: 'IdentityParticipationsConnectionEdge';
  cursor: Scalars['String']['output'];
  node?: Maybe<ConversationParticipation>;
};

export type IdentityRelationship = {
  __typename?: 'IdentityRelationship';
  avatar?: Maybe<Scalars['String']['output']>;
  givenName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
};

export type Message = Node & {
  __typename?: 'Message';
  conversation: Conversation;
  createdAt: Scalars['DateTime']['output'];
  deliveries: Array<MessageDelivery>;
  hasRawHTML?: Maybe<Scalars['Boolean']['output']>;
  html?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  plainText?: Maybe<Scalars['String']['output']>;
  rawHTML?: Maybe<Scalars['String']['output']>;
  sender: Identity;
  snippet?: Maybe<Scalars['String']['output']>;
};

export type MessageDelivery = {
  __typename?: 'MessageDelivery';
  id: Scalars['ID']['output'];
  recipient: Identity;
  transport: MessageDeliveryTransport;
};

export type MessageDeliveryTransport =
  | 'DIRECT'
  | 'EMAIL';

export type Node = {
  id: Scalars['ID']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Query = {
  __typename?: 'Query';
  node?: Maybe<Node>;
  nodes: Array<Maybe<Node>>;
  viewer?: Maybe<Viewer>;
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};


export type QueryNodesArgs = {
  ids: Array<Scalars['ID']['input']>;
};

export type Viewer = {
  __typename?: 'Viewer';
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  identity: Identity;
  name: Scalars['String']['output'];
};
