/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
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
  DateTime: { input: string; output: string; }
  EmailAddress: { input: string; output: string; }
  File: { input: any; output: any; }
  URL: { input: string; output: string; }
};

export type AssignTargetMailboxInput = {
  contactID: Scalars['ID']['input'];
  targetMailboxType: MailboxType;
};

export type Attachment = Node & {
  __typename?: 'Attachment';
  contentId?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['DateTime']['output'];
  fileName?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  mimeType: Scalars['String']['output'];
  sizeInBytes: Scalars['Int']['output'];
  url: Scalars['String']['output'];
};

export type AttachmentEdge = Edge & {
  __typename?: 'AttachmentEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node: Attachment;
};

export type AttachmentType =
  | 'CalendarInvite'
  | 'Document'
  | 'Image'
  | 'Media'
  | 'PDF'
  | 'Presentation'
  | 'Spreadsheet'
  | 'ZIP';

export type AttachmentsConnection = Connection & {
  __typename?: 'AttachmentsConnection';
  edges: Array<AttachmentEdge>;
  pageInfo: PageInfo;
};

export type AttachmentsFilter = {
  attachmentType?: InputMaybe<AttachmentType>;
  contactAddress?: InputMaybe<Scalars['EmailAddress']['input']>;
};

export type Connection = {
  edges: Array<Edge>;
  pageInfo: PageInfo;
};

export type Contact = Node & {
  __typename?: 'Contact';
  address: Scalars['String']['output'];
  attachments: AttachmentsConnection;
  avatar: Scalars['String']['output'];
  firstMessage?: Maybe<Message>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  targetMailbox: Mailbox;
  threads: ThreadsConnection;
};


export type ContactAttachmentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type ContactThreadsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};

export type ContactEdge = Edge & {
  __typename?: 'ContactEdge';
  cursor?: Maybe<Scalars['String']['output']>;
  node: Contact;
};

export type ContactsConnection = Connection & {
  __typename?: 'ContactsConnection';
  edges: Array<ContactEdge>;
  pageInfo: PageInfo;
};

export type Edge = {
  cursor?: Maybe<Scalars['String']['output']>;
  node: Node;
};

export type EditThreadInput = {
  id: Scalars['ID']['input'];
  title: Scalars['String']['input'];
};

export type EditUserInput = {
  avatar?: InputMaybe<Scalars['File']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type Mailbox = Node & {
  __typename?: 'Mailbox';
  assignedContactsCount: Scalars['Int']['output'];
  contacts: ContactsConnection;
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
  threadId: Scalars['ID']['output'];
  to?: Maybe<Array<Scalars['String']['output']>>;
  unseen: Scalars['Boolean']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  assignTargetMailbox?: Maybe<Contact>;
  editThread?: Maybe<Thread>;
  editUser?: Maybe<User>;
  markThreadSeen?: Maybe<Thread>;
};


export type MutationAssignTargetMailboxArgs = {
  input: AssignTargetMailboxInput;
};


export type MutationEditThreadArgs = {
  input: EditThreadInput;
};


export type MutationEditUserArgs = {
  input: EditUserInput;
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
  search?: Maybe<SearchResult>;
  viewer?: Maybe<User>;
};


export type QueryNodeArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySearchArgs = {
  input: SearchInput;
};

export type SearchInput = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  mailboxId?: InputMaybe<Scalars['ID']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  query: Scalars['String']['input'];
};

export type SearchResult = {
  __typename?: 'SearchResult';
  messages: Array<Message>;
};

export type Thread = Node & {
  __typename?: 'Thread';
  from: Contact;
  id: Scalars['ID']['output'];
  lastMessageAt: Scalars['DateTime']['output'];
  mailbox: Mailbox;
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
  attachments: AttachmentsConnection;
  avatar: Scalars['String']['output'];
  contacts: ContactsConnection;
  id: Scalars['ID']['output'];
  mailbox?: Maybe<Mailbox>;
  name: Scalars['String']['output'];
  username: Scalars['String']['output'];
};


export type UserAttachmentsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<AttachmentsFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type UserContactsArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type UserMailboxArgs = {
  type: MailboxType;
};

export type NavbarFragmentFragment = { __typename?: 'User', id: string, username: string, name: string, avatar: string } & { ' $fragmentName'?: 'NavbarFragmentFragment' };

export type SearchQueryQueryVariables = Exact<{
  input: SearchInput;
}>;


export type SearchQueryQuery = { __typename?: 'Query', search?: { __typename?: 'SearchResult', messages: Array<{ __typename?: 'Message', id: string, threadId: string, recievedAt: string, subject?: string | null, snippet?: string | null, from: { __typename?: 'Contact', id: string, name: string } }> } | null };

export type MailboxLinkFragment = { __typename?: 'Mailbox', id: string, type: MailboxType, name: string } & { ' $fragmentName'?: 'MailboxLinkFragment' };

export type MessageBodyFragment = { __typename?: 'Message', id: string, bodyHTML?: string | null } & { ' $fragmentName'?: 'MessageBodyFragment' };

export type ThreadListItemFragment = { __typename?: 'Thread', id: string, title?: string | null, snippet?: string | null, lastMessageAt: string, from: { __typename?: 'Contact', id: string, address: string, avatar: string } } & { ' $fragmentName'?: 'ThreadListItemFragment' };

export type AssignTargetMailboxMutationMutationVariables = Exact<{
  input: AssignTargetMailboxInput;
}>;


export type AssignTargetMailboxMutationMutation = { __typename?: 'Mutation', assignTargetMailbox?: { __typename?: 'Contact', id: string, name: string, avatar: string, address: string, targetMailbox: { __typename?: 'Mailbox', id: string } } | null };

export type ImportantPageQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type ImportantPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, username: string, screenerMailbox?: { __typename?: 'Mailbox', id: string, assignedContactsCount: number } | null, importantMailbox?: { __typename?: 'Mailbox', id: string, type: MailboxType, name: string, unseenThreadsCount: number, unseenThreads: { __typename?: 'ThreadsConnection', pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, endCursor?: string | null }, edges: Array<{ __typename?: 'ThreadEdge', cursor?: string | null, node: (
            { __typename?: 'Thread', id: string }
            & { ' $fragmentRefs'?: { 'ThreadListItemFragment': ThreadListItemFragment } }
          ) }> }, seenThreads: { __typename?: 'ThreadsConnection', pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, endCursor?: string | null }, edges: Array<{ __typename?: 'ThreadEdge', cursor?: string | null, node: (
            { __typename?: 'Thread', id: string }
            & { ' $fragmentRefs'?: { 'ThreadListItemFragment': ThreadListItemFragment } }
          ) }> } } | null }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type AllFilesPageQueryQueryVariables = Exact<{
  firstAttachments?: InputMaybe<Scalars['Int']['input']>;
  afterAttachment?: InputMaybe<Scalars['String']['input']>;
  filterAttachments?: InputMaybe<AttachmentsFilter>;
  firstContacts?: InputMaybe<Scalars['Int']['input']>;
  afterContact?: InputMaybe<Scalars['String']['input']>;
}>;


export type AllFilesPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, attachments: { __typename?: 'AttachmentsConnection', pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage?: boolean | null }, edges: Array<{ __typename?: 'AttachmentEdge', cursor?: string | null, node: { __typename?: 'Attachment', id: string, fileName?: string | null, url: string, mimeType: string, sizeInBytes: number, createdAt: string } }> }, contacts: { __typename?: 'ContactsConnection', pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage?: boolean | null }, edges: Array<{ __typename?: 'ContactEdge', cursor?: string | null, node: { __typename?: 'Contact', id: string, name: string, address: string, avatar: string } }> } }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type ContactDetailsPageQueryQueryVariables = Exact<{
  id: Scalars['ID']['input'];
  attachmentsAfter?: InputMaybe<Scalars['String']['input']>;
  threadsAfter?: InputMaybe<Scalars['String']['input']>;
}>;


export type ContactDetailsPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User' }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null, node?:
    | { __typename: 'Attachment' }
    | { __typename: 'Contact', id: string, name: string, address: string, avatar: string, targetMailbox: { __typename?: 'Mailbox', id: string, name: string, type: MailboxType }, attachments: { __typename?: 'AttachmentsConnection', pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage?: boolean | null }, edges: Array<{ __typename?: 'AttachmentEdge', cursor?: string | null, node: { __typename?: 'Attachment', id: string, fileName?: string | null, mimeType: string, url: string } }> }, threads: { __typename?: 'ThreadsConnection', pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage?: boolean | null }, edges: Array<{ __typename?: 'ThreadEdge', cursor?: string | null, node: (
            { __typename?: 'Thread', id: string }
            & { ' $fragmentRefs'?: { 'ThreadListItemFragment': ThreadListItemFragment } }
          ) }> } }
    | { __typename: 'Mailbox' }
    | { __typename: 'Message' }
    | { __typename: 'Thread' }
    | { __typename: 'User' }
   | null };

export type NewsPageQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type NewsPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, newsMailbox?: { __typename?: 'Mailbox', id: string, type: MailboxType, name: string, threads: { __typename?: 'ThreadsConnection', pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, endCursor?: string | null }, edges: Array<{ __typename?: 'ThreadEdge', cursor?: string | null, node: { __typename?: 'Thread', id: string, title?: string | null, messages: Array<(
              { __typename?: 'Message', id: string, recievedAt: string, bodyHTML?: string | null, bodyText?: string | null, to?: Array<string> | null, from: { __typename?: 'Contact', id: string, name: string, avatar: string, address: string } }
              & { ' $fragmentRefs'?: { 'MessageBodyFragment': MessageBodyFragment } }
            )> } }> } } | null }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type ScreenerPageQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type ScreenerPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, screenerMailbox?: { __typename?: 'Mailbox', id: string, type: MailboxType, name: string, assignedContactsCount: number, contacts: { __typename?: 'ContactsConnection', edges: Array<{ __typename?: 'ContactEdge', node: { __typename?: 'Contact', id: string, address: string, name: string, avatar: string, firstMessage?: (
              { __typename?: 'Message', id: string, bodyText?: string | null, bodyHTML?: string | null, subject?: string | null }
              & { ' $fragmentRefs'?: { 'MessageBodyFragment': MessageBodyFragment } }
            ) | null } }> } } | null }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type ThreadDetailsQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type ThreadDetailsQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User' }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null, node?:
    | { __typename: 'Attachment' }
    | { __typename: 'Contact' }
    | { __typename: 'Mailbox' }
    | { __typename: 'Message' }
    | { __typename: 'Thread', id: string, unseenMessagesCount: number, title?: string | null, lastMessageAt: string, from: { __typename?: 'Contact', id: string, address: string, name: string, avatar: string }, messages: Array<(
        { __typename?: 'Message', id: string, bodyHTML?: string | null, recievedAt: string, unseen: boolean, snippet?: string | null, bodyText?: string | null, subject?: string | null, to?: Array<string> | null, cc?: Array<string> | null, replyTo?: Array<string> | null, from: { __typename?: 'Contact', id: string, address: string, name: string, avatar: string }, attachments: Array<{ __typename?: 'Attachment', id: string, fileName?: string | null, mimeType: string, contentId?: string | null, url: string }> }
        & { ' $fragmentRefs'?: { 'MessageBodyFragment': MessageBodyFragment } }
      )>, mailbox: (
        { __typename?: 'Mailbox', id: string }
        & { ' $fragmentRefs'?: { 'MailboxLinkFragment': MailboxLinkFragment } }
      ) }
    | { __typename: 'User' }
   | null };

export type MarkThreadSeenMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type MarkThreadSeenMutation = { __typename?: 'Mutation', markThreadSeen?: { __typename?: 'Thread', id: string, unseenMessagesCount: number, messages: Array<{ __typename?: 'Message', id: string, unseen: boolean }> } | null };

export type EditThreadMutationMutationVariables = Exact<{
  input: EditThreadInput;
}>;


export type EditThreadMutationMutation = { __typename?: 'Mutation', editThread?: { __typename?: 'Thread', id: string, title?: string | null } | null };

export type TransactionalPageQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type TransactionalPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, transactionalMailbox?: { __typename?: 'Mailbox', id: string, type: MailboxType, name: string, threads: { __typename?: 'ThreadsConnection', pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, endCursor?: string | null }, edges: Array<{ __typename?: 'ThreadEdge', cursor?: string | null, node: (
            { __typename?: 'Thread', id: string }
            & { ' $fragmentRefs'?: { 'ThreadListItemFragment': ThreadListItemFragment } }
          ) }> } } | null }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type TrashPageQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type TrashPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, trashMailbox?: { __typename?: 'Mailbox', id: string, type: MailboxType, name: string, threads: { __typename?: 'ThreadsConnection', pageInfo: { __typename?: 'PageInfo', hasNextPage?: boolean | null, endCursor?: string | null }, edges: Array<{ __typename?: 'ThreadEdge', cursor?: string | null, node: (
            { __typename?: 'Thread', id: string }
            & { ' $fragmentRefs'?: { 'ThreadListItemFragment': ThreadListItemFragment } }
          ) }> } } | null }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type UserSettingsPageQueryQueryVariables = Exact<{ [key: string]: never; }>;


export type UserSettingsPageQueryQuery = { __typename?: 'Query', viewer?: (
    { __typename?: 'User', id: string, username: string, name: string, avatar: string }
    & { ' $fragmentRefs'?: { 'NavbarFragmentFragment': NavbarFragmentFragment } }
  ) | null };

export type EditUserMutationMutationVariables = Exact<{
  input: EditUserInput;
}>;


export type EditUserMutationMutation = { __typename?: 'Mutation', editUser?: { __typename?: 'User', id: string, name: string, avatar: string } | null };

export const NavbarFragmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]} as unknown as DocumentNode<NavbarFragmentFragment, unknown>;
export const MailboxLinkFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MailboxLink"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Mailbox"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]} as unknown as DocumentNode<MailboxLinkFragment, unknown>;
export const MessageBodyFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MessageBody"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Message"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}}]}}]} as unknown as DocumentNode<MessageBodyFragment, unknown>;
export const ThreadListItemFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThreadListItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Thread"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"lastMessageAt"}}]}}]} as unknown as DocumentNode<ThreadListItemFragment, unknown>;
export const SearchQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SearchQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SearchInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"search"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"threadId"}},{"kind":"Field","name":{"kind":"Name","value":"recievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SearchQueryQuery, SearchQueryQueryVariables>;
export const AssignTargetMailboxMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AssignTargetMailboxMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AssignTargetMailboxInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignTargetMailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"targetMailbox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]} as unknown as DocumentNode<AssignTargetMailboxMutationMutation, AssignTargetMailboxMutationMutationVariables>;
export const ImportantPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ImportantPageQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","alias":{"kind":"Name","value":"screenerMailbox"},"name":{"kind":"Name","value":"mailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"screener"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"assignedContactsCount"}}]}},{"kind":"Field","alias":{"kind":"Name","value":"importantMailbox"},"name":{"kind":"Name","value":"mailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"important"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"unseenThreadsCount"}},{"kind":"Field","alias":{"kind":"Name","value":"unseenThreads"},"name":{"kind":"Name","value":"threads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"unseen"},"value":{"kind":"BooleanValue","value":true}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThreadListItem"}}]}}]}}]}},{"kind":"Field","alias":{"kind":"Name","value":"seenThreads"},"name":{"kind":"Name","value":"threads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"unseen"},"value":{"kind":"BooleanValue","value":false}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThreadListItem"}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThreadListItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Thread"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"lastMessageAt"}}]}}]} as unknown as DocumentNode<ImportantPageQueryQuery, ImportantPageQueryQueryVariables>;
export const AllFilesPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AllFilesPageQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"firstAttachments"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"afterAttachment"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filterAttachments"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AttachmentsFilter"}},"defaultValue":{"kind":"ObjectValue","fields":[]}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"firstContacts"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}},"defaultValue":{"kind":"IntValue","value":"10"}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"afterContact"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"firstAttachments"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"afterAttachment"}}},{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filterAttachments"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"url"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"sizeInBytes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"contacts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"Variable","name":{"kind":"Name","value":"firstContacts"}}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"afterContact"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]} as unknown as DocumentNode<AllFilesPageQueryQuery, AllFilesPageQueryQueryVariables>;
export const ContactDetailsPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ContactDetailsPageQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attachmentsAfter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"threadsAfter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Contact"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"targetMailbox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attachmentsAfter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"threads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"10"}},{"kind":"Argument","name":{"kind":"Name","value":"after"},"value":{"kind":"Variable","name":{"kind":"Name","value":"threadsAfter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endCursor"}},{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThreadListItem"}},{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThreadListItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Thread"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"lastMessageAt"}}]}}]} as unknown as DocumentNode<ContactDetailsPageQueryQuery, ContactDetailsPageQueryQueryVariables>;
export const NewsPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NewsPageQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","alias":{"kind":"Name","value":"newsMailbox"},"name":{"kind":"Name","value":"mailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"news"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"threads"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"first"},"value":{"kind":"IntValue","value":"5"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageBody"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"address"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}},{"kind":"Field","name":{"kind":"Name","value":"bodyText"}},{"kind":"Field","name":{"kind":"Name","value":"to"}}]}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MessageBody"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Message"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}}]}}]} as unknown as DocumentNode<NewsPageQueryQuery, NewsPageQueryQueryVariables>;
export const ScreenerPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ScreenerPageQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","alias":{"kind":"Name","value":"screenerMailbox"},"name":{"kind":"Name","value":"mailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"screener"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"assignedContactsCount"}},{"kind":"Field","name":{"kind":"Name","value":"contacts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"firstMessage"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageBody"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyText"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}}]}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MessageBody"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Message"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}}]}}]} as unknown as DocumentNode<ScreenerPageQueryQuery, ScreenerPageQueryQueryVariables>;
export const ThreadDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ThreadDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Thread"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unseenMessagesCount"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"lastMessageAt"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"MessageBody"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}},{"kind":"Field","name":{"kind":"Name","value":"recievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"unseen"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"bodyText"}},{"kind":"Field","name":{"kind":"Name","value":"subject"}},{"kind":"Field","name":{"kind":"Name","value":"to"}},{"kind":"Field","name":{"kind":"Name","value":"cc"}},{"kind":"Field","name":{"kind":"Name","value":"replyTo"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"fileName"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"contentId"}},{"kind":"Field","name":{"kind":"Name","value":"url"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"mailbox"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"MailboxLink"}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MessageBody"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Message"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHTML"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"MailboxLink"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Mailbox"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]} as unknown as DocumentNode<ThreadDetailsQuery, ThreadDetailsQueryVariables>;
export const MarkThreadSeenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkThreadSeen"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markThreadSeen"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"unseenMessagesCount"}},{"kind":"Field","name":{"kind":"Name","value":"messages"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"unseen"}}]}}]}}]}}]} as unknown as DocumentNode<MarkThreadSeenMutation, MarkThreadSeenMutationVariables>;
export const EditThreadMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditThreadMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EditThreadInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editThread"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<EditThreadMutationMutation, EditThreadMutationMutationVariables>;
export const TransactionalPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TransactionalPageQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","alias":{"kind":"Name","value":"transactionalMailbox"},"name":{"kind":"Name","value":"mailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"transactional"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"threads"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThreadListItem"}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThreadListItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Thread"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"lastMessageAt"}}]}}]} as unknown as DocumentNode<TransactionalPageQueryQuery, TransactionalPageQueryQueryVariables>;
export const TrashPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TrashPageQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","alias":{"kind":"Name","value":"trashMailbox"},"name":{"kind":"Name","value":"mailbox"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"trash"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"threads"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pageInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hasNextPage"}},{"kind":"Field","name":{"kind":"Name","value":"endCursor"}}]}},{"kind":"Field","name":{"kind":"Name","value":"edges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cursor"}},{"kind":"Field","name":{"kind":"Name","value":"node"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"ThreadListItem"}}]}}]}}]}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ThreadListItem"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Thread"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"from"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"snippet"}},{"kind":"Field","name":{"kind":"Name","value":"lastMessageAt"}}]}}]} as unknown as DocumentNode<TrashPageQueryQuery, TrashPageQueryQueryVariables>;
export const UserSettingsPageQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserSettingsPageQuery"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"viewer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"NavbarFragment"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"NavbarFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]} as unknown as DocumentNode<UserSettingsPageQueryQuery, UserSettingsPageQueryQueryVariables>;
export const EditUserMutationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditUserMutation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"EditUserInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode<EditUserMutationMutation, EditUserMutationMutationVariables>;