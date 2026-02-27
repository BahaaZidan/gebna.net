/* eslint-disable */
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
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
  participants: Array<EmailAddressRef>;
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

export type ViewerEmailConversationsListQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type ViewerEmailConversationsListQueryQuery = { __typename?: 'Query', viewer?: { __typename?: 'Viewer', id: string, emailConversations: { __typename?: 'ViewerEmailConversationsConnection', edges: Array<{ __typename?: 'ViewerEmailConversationsConnectionEdge', node: (
          { __typename?: 'EmailConversation', id: string, title?: string | null, unseenCount: number, lastMessage: { __typename?: 'EmailMessage', id: string, snippet?: string | null, createdAt: string } }
          & { ' $fragmentRefs'?: { 'EmailConversationTitleFragment': EmailConversationTitleFragment;'EmailConversationAvatarFragment': EmailConversationAvatarFragment } }
        ) }> } } | null };

export type EmailConversationDetailsQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type EmailConversationDetailsQuery = { __typename?: 'Query', node?:
    | { __typename: 'EmailAddressRef' }
    | (
      { __typename: 'EmailConversation', id: string, messages: { __typename?: 'EmailConversationMessagesConnection', edges: Array<{ __typename?: 'EmailConversationMessagesConnectionEdge', node: (
            { __typename?: 'EmailMessage', id: string }
            & { ' $fragmentRefs'?: { 'EmailMessageBubbleFragment': EmailMessageBubbleFragment } }
          ) }> } }
      & { ' $fragmentRefs'?: { 'EmailConversationTitleFragment': EmailConversationTitleFragment;'EmailConversationAvatarFragment': EmailConversationAvatarFragment } }
    )
    | { __typename: 'EmailMessage' }
   | null };

export type EmailConversationAvatarFragment = { __typename?: 'EmailConversation', id: string, kind: EmailConversationKind, avatar?: string | null, participants: Array<{ __typename?: 'EmailAddressRef', id: string, avatar: string, isSelf: boolean, name: string, address: string }> } & { ' $fragmentName'?: 'EmailConversationAvatarFragment' };

export type EmailConversationTitleFragment = { __typename?: 'EmailConversation', id: string, kind: EmailConversationKind, title?: string | null, participants: Array<{ __typename?: 'EmailAddressRef', id: string, isSelf: boolean, name: string }> } & { ' $fragmentName'?: 'EmailConversationTitleFragment' };

export type EmailMessageBubbleFragment = { __typename?: 'EmailMessage', id: string, html?: string | null, createdAt: string, from: { __typename?: 'EmailAddressRef', id: string, isSelf: boolean, name: string, avatar: string, address: string } } & { ' $fragmentName'?: 'EmailMessageBubbleFragment' };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const EmailConversationAvatarFragmentDoc = new TypedDocumentString(`
    fragment EmailConversationAvatar on EmailConversation {
  id
  kind
  avatar
  participants {
    id
    avatar
    isSelf
    name
    address
  }
}
    `, {"fragmentName":"EmailConversationAvatar"}) as unknown as TypedDocumentString<EmailConversationAvatarFragment, unknown>;
export const EmailConversationTitleFragmentDoc = new TypedDocumentString(`
    fragment EmailConversationTitle on EmailConversation {
  id
  kind
  title
  participants {
    id
    isSelf
    name
  }
}
    `, {"fragmentName":"EmailConversationTitle"}) as unknown as TypedDocumentString<EmailConversationTitleFragment, unknown>;
export const EmailMessageBubbleFragmentDoc = new TypedDocumentString(`
    fragment EmailMessageBubble on EmailMessage {
  id
  html
  createdAt
  from {
    id
    isSelf
    name
    avatar
    address
  }
}
    `, {"fragmentName":"EmailMessageBubble"}) as unknown as TypedDocumentString<EmailMessageBubbleFragment, unknown>;
export const ViewerEmailConversationsListQueryDocument = new TypedDocumentString(`
    query ViewerEmailConversationsListQuery {
  viewer {
    id
    emailConversations {
      edges {
        node {
          ...EmailConversationTitle
          ...EmailConversationAvatar
          id
          title
          unseenCount
          lastMessage {
            id
            snippet
            createdAt
          }
        }
      }
    }
  }
}
    fragment EmailConversationAvatar on EmailConversation {
  id
  kind
  avatar
  participants {
    id
    avatar
    isSelf
    name
    address
  }
}
fragment EmailConversationTitle on EmailConversation {
  id
  kind
  title
  participants {
    id
    isSelf
    name
  }
}`) as unknown as TypedDocumentString<ViewerEmailConversationsListQueryQuery, ViewerEmailConversationsListQueryQueryVariables>;
export const EmailConversationDetailsDocument = new TypedDocumentString(`
    query EmailConversationDetails($id: ID!) {
  node(id: $id) {
    __typename
    ... on EmailConversation {
      ...EmailConversationTitle
      ...EmailConversationAvatar
      id
      messages {
        edges {
          node {
            ...EmailMessageBubble
            id
          }
        }
      }
    }
  }
}
    fragment EmailConversationAvatar on EmailConversation {
  id
  kind
  avatar
  participants {
    id
    avatar
    isSelf
    name
    address
  }
}
fragment EmailConversationTitle on EmailConversation {
  id
  kind
  title
  participants {
    id
    isSelf
    name
  }
}
fragment EmailMessageBubble on EmailMessage {
  id
  html
  createdAt
  from {
    id
    isSelf
    name
    avatar
    address
  }
}`) as unknown as TypedDocumentString<EmailConversationDetailsQuery, EmailConversationDetailsQueryVariables>;