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

export type EmailAttachment = Node & {
  __typename?: 'EmailAttachment';
  category: EmailAttachmentFileCategory;
  description?: Maybe<Scalars['String']['output']>;
  filename?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  sizeInBytes?: Maybe<Scalars['Int']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};

export type EmailAttachmentFileCategory =
  | 'Archive'
  | 'Audio'
  | 'Calendar'
  | 'Excel'
  | 'Image'
  | 'Other'
  | 'PDF'
  | 'Slides'
  | 'Video'
  | 'Word';

export type EmailMessage = Node & {
  __typename?: 'EmailMessage';
  attachments: Array<EmailAttachment>;
  createdAt: Scalars['DateTime']['output'];
  from: EmailAddressRef;
  html?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  plaintext?: Maybe<Scalars['String']['output']>;
  snippet?: Maybe<Scalars['String']['output']>;
  to: EmailAddressRef;
};

export type EmailThread = Node & {
  __typename?: 'EmailThread';
  avatar?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lastMessage: EmailMessage;
  messages: EmailThreadMessagesConnection;
  participants: Array<EmailAddressRef>;
  title?: Maybe<Scalars['String']['output']>;
  unseenCount: Scalars['Int']['output'];
};


export type EmailThreadMessagesArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type EmailThreadMessagesConnection = {
  __typename?: 'EmailThreadMessagesConnection';
  edges: Array<EmailThreadMessagesConnectionEdge>;
  pageInfo: PageInfo;
};

export type EmailThreadMessagesConnectionEdge = {
  __typename?: 'EmailThreadMessagesConnectionEdge';
  cursor: Scalars['String']['output'];
  node: EmailMessage;
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
  emailThreads: ViewerEmailThreadsConnection;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};


export type ViewerEmailThreadsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  before?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
};

export type ViewerEmailThreadsConnection = {
  __typename?: 'ViewerEmailThreadsConnection';
  edges: Array<ViewerEmailThreadsConnectionEdge>;
  pageInfo: PageInfo;
};

export type ViewerEmailThreadsConnectionEdge = {
  __typename?: 'ViewerEmailThreadsConnectionEdge';
  cursor: Scalars['String']['output'];
  node: EmailThread;
};

export type ViewerEmailThreadsListQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type ViewerEmailThreadsListQueryQuery = { __typename?: 'Query', viewer?: { __typename?: 'Viewer', id: string, emailThreads: { __typename?: 'ViewerEmailThreadsConnection', edges: Array<{ __typename?: 'ViewerEmailThreadsConnectionEdge', node: (
          { __typename?: 'EmailThread', id: string, title?: string | null, unseenCount: number, lastMessage: { __typename?: 'EmailMessage', id: string, snippet?: string | null, createdAt: string } }
          & { ' $fragmentRefs'?: { 'EmailThreadTitleFragment': EmailThreadTitleFragment;'EmailThreadAvatarFragment': EmailThreadAvatarFragment } }
        ) }> } } | null };

export type EmailThreadDetailsQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type EmailThreadDetailsQuery = { __typename?: 'Query', node?:
    | { __typename: 'EmailAddressRef' }
    | { __typename: 'EmailAttachment' }
    | { __typename: 'EmailMessage' }
    | (
      { __typename: 'EmailThread', id: string, messages: { __typename?: 'EmailThreadMessagesConnection', edges: Array<{ __typename?: 'EmailThreadMessagesConnectionEdge', node: (
            { __typename?: 'EmailMessage', id: string }
            & { ' $fragmentRefs'?: { 'EmailMessageBubbleFragment': EmailMessageBubbleFragment } }
          ) }> } }
      & { ' $fragmentRefs'?: { 'EmailThreadTitleFragment': EmailThreadTitleFragment;'EmailThreadAvatarFragment': EmailThreadAvatarFragment } }
    )
   | null };

export type EmailMessageBubbleFragment = { __typename?: 'EmailMessage', id: string, html?: string | null, plaintext?: string | null, createdAt: string, from: { __typename?: 'EmailAddressRef', id: string, isSelf: boolean, name: string, avatar: string, address: string }, attachments: Array<{ __typename?: 'EmailAttachment', id: string, filename?: string | null, sizeInBytes?: number | null, description?: string | null, category: EmailAttachmentFileCategory }> } & { ' $fragmentName'?: 'EmailMessageBubbleFragment' };

export type EmailThreadAvatarFragment = { __typename?: 'EmailThread', id: string, avatar?: string | null, title?: string | null, participants: Array<{ __typename?: 'EmailAddressRef', id: string, avatar: string, isSelf: boolean, name: string, address: string }> } & { ' $fragmentName'?: 'EmailThreadAvatarFragment' };

export type EmailThreadTitleFragment = { __typename?: 'EmailThread', id: string, title?: string | null, participants: Array<{ __typename?: 'EmailAddressRef', id: string, isSelf: boolean, name: string }> } & { ' $fragmentName'?: 'EmailThreadTitleFragment' };

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
export const EmailMessageBubbleFragmentDoc = new TypedDocumentString(`
    fragment EmailMessageBubble on EmailMessage {
  id
  html
  plaintext
  createdAt
  from {
    id
    isSelf
    name
    avatar
    address
  }
  attachments {
    id
    filename
    sizeInBytes
    description
    category
  }
}
    `, {"fragmentName":"EmailMessageBubble"}) as unknown as TypedDocumentString<EmailMessageBubbleFragment, unknown>;
export const EmailThreadAvatarFragmentDoc = new TypedDocumentString(`
    fragment EmailThreadAvatar on EmailThread {
  id
  avatar
  title
  participants {
    id
    avatar
    isSelf
    name
    address
  }
}
    `, {"fragmentName":"EmailThreadAvatar"}) as unknown as TypedDocumentString<EmailThreadAvatarFragment, unknown>;
export const EmailThreadTitleFragmentDoc = new TypedDocumentString(`
    fragment EmailThreadTitle on EmailThread {
  id
  title
  participants {
    id
    isSelf
    name
  }
}
    `, {"fragmentName":"EmailThreadTitle"}) as unknown as TypedDocumentString<EmailThreadTitleFragment, unknown>;
export const ViewerEmailThreadsListQueryDocument = new TypedDocumentString(`
    query ViewerEmailThreadsListQuery {
  viewer {
    id
    emailThreads(first: 30) {
      edges {
        node {
          ...EmailThreadTitle
          ...EmailThreadAvatar
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
    fragment EmailThreadAvatar on EmailThread {
  id
  avatar
  title
  participants {
    id
    avatar
    isSelf
    name
    address
  }
}
fragment EmailThreadTitle on EmailThread {
  id
  title
  participants {
    id
    isSelf
    name
  }
}`) as unknown as TypedDocumentString<ViewerEmailThreadsListQueryQuery, ViewerEmailThreadsListQueryQueryVariables>;
export const EmailThreadDetailsDocument = new TypedDocumentString(`
    query EmailThreadDetails($id: ID!) {
  node(id: $id) {
    __typename
    ... on EmailThread {
      ...EmailThreadTitle
      ...EmailThreadAvatar
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
    fragment EmailMessageBubble on EmailMessage {
  id
  html
  plaintext
  createdAt
  from {
    id
    isSelf
    name
    avatar
    address
  }
  attachments {
    id
    filename
    sizeInBytes
    description
    category
  }
}
fragment EmailThreadAvatar on EmailThread {
  id
  avatar
  title
  participants {
    id
    avatar
    isSelf
    name
    address
  }
}
fragment EmailThreadTitle on EmailThread {
  id
  title
  participants {
    id
    isSelf
    name
  }
}`) as unknown as TypedDocumentString<EmailThreadDetailsQuery, EmailThreadDetailsQueryVariables>;