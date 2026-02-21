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

export type EmailAddressRef = Node & {
  __typename?: 'EmailAddressRef';
  address: Scalars['String']['output'];
  avatar: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isSelf: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
};

export type EmailConversation = Node & {
  __typename?: 'EmailConversation';
  avatar?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  kind: EmailConversationKind;
  lastMessage: EmailMessage;
  messages: EmailConversationMessagesConnection;
  participations: Array<EmailConversationParticipation>;
  title?: Maybe<Scalars['String']['output']>;
  unseenCount: Scalars['Int']['output'];
};


export type EmailConversationMessagesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type EmailConversationKind =
  | 'GROUP'
  | 'PRIVATE';

export type EmailConversationMessagesConnection = {
  __typename?: 'EmailConversationMessagesConnection';
  edges: Array<EmailConversationMessagesConnectionEdge>;
  pageInfo: PageInfo;
};

export type EmailConversationMessagesConnectionEdge = {
  __typename?: 'EmailConversationMessagesConnectionEdge';
  cursor: Scalars['String']['output'];
  node: EmailMessage;
};

export type EmailConversationParticipation = {
  __typename?: 'EmailConversationParticipation';
  conversation: EmailConversation;
  emailAddressRef: EmailAddressRef;
};

export type EmailMessage = Node & {
  __typename?: 'EmailMessage';
  createdAt: Scalars['DateTime']['output'];
  from: EmailAddressRef;
  html?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  snippet?: Maybe<Scalars['String']['output']>;
  to: EmailAddressRef;
};

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
  emailAddress: Scalars['String']['output'];
  emailConversations: ViewerEmailConversationsConnection;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};


export type ViewerEmailConversationsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type ViewerEmailConversationsConnection = {
  __typename?: 'ViewerEmailConversationsConnection';
  edges: Array<ViewerEmailConversationsConnectionEdge>;
  pageInfo: PageInfo;
};

export type ViewerEmailConversationsConnectionEdge = {
  __typename?: 'ViewerEmailConversationsConnectionEdge';
  cursor: Scalars['String']['output'];
  node: EmailConversation;
};
