/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n\t\tquery NavbarQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t}\n\t\t}\n\t": typeof types.NavbarQueryDocument,
    "\n\t\tfragment ThreadListItem on Thread {\n\t\t\tid\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\taddress\n\t\t\t\tavatar\n\t\t\t}\n\t\t\ttitle\n\t\t\tsnippet\n\t\t\tlastMessageAt\n\t\t}\n\t": typeof types.ThreadListItemFragmentDoc,
    "\n\t\tquery ImportantPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t}\n\t\t\t\timportantMailbox: mailbox(type: important) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tunseenThreadsCount\n\t\t\t\t\tunseenThreads: threads(filter: { unseen: true }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tseenThreads: threads(filter: { unseen: false }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": typeof types.ImportantPageQueryDocument,
    "\n\t\tquery ScreenerPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t\tcontacts {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\taddress\n\t\t\t\t\t\t\t\tname\n\t\t\t\t\t\t\t\tavatar\n\t\t\t\t\t\t\t\tmessages {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tbodyText\n\t\t\t\t\t\t\t\t\tbodyHTML\n\t\t\t\t\t\t\t\t\tsubject\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": typeof types.ScreenerPageQueryDocument,
    "\n\t\tmutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {\n\t\t\tassignTargetMailbox(input: $input) {\n\t\t\t\tid\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t\ttargetMailbox {\n\t\t\t\t\tid\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": typeof types.AssignTargetMailboxMutationDocument,
};
const documents: Documents = {
    "\n\t\tquery NavbarQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t}\n\t\t}\n\t": types.NavbarQueryDocument,
    "\n\t\tfragment ThreadListItem on Thread {\n\t\t\tid\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\taddress\n\t\t\t\tavatar\n\t\t\t}\n\t\t\ttitle\n\t\t\tsnippet\n\t\t\tlastMessageAt\n\t\t}\n\t": types.ThreadListItemFragmentDoc,
    "\n\t\tquery ImportantPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t}\n\t\t\t\timportantMailbox: mailbox(type: important) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tunseenThreadsCount\n\t\t\t\t\tunseenThreads: threads(filter: { unseen: true }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tseenThreads: threads(filter: { unseen: false }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": types.ImportantPageQueryDocument,
    "\n\t\tquery ScreenerPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t\tcontacts {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\taddress\n\t\t\t\t\t\t\t\tname\n\t\t\t\t\t\t\t\tavatar\n\t\t\t\t\t\t\t\tmessages {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tbodyText\n\t\t\t\t\t\t\t\t\tbodyHTML\n\t\t\t\t\t\t\t\t\tsubject\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": types.ScreenerPageQueryDocument,
    "\n\t\tmutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {\n\t\t\tassignTargetMailbox(input: $input) {\n\t\t\t\tid\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t\ttargetMailbox {\n\t\t\t\t\tid\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": types.AssignTargetMailboxMutationDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tquery NavbarQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t}\n\t\t}\n\t"): (typeof documents)["\n\t\tquery NavbarQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t}\n\t\t}\n\t"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment ThreadListItem on Thread {\n\t\t\tid\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\taddress\n\t\t\t\tavatar\n\t\t\t}\n\t\t\ttitle\n\t\t\tsnippet\n\t\t\tlastMessageAt\n\t\t}\n\t"): (typeof documents)["\n\t\tfragment ThreadListItem on Thread {\n\t\t\tid\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\taddress\n\t\t\t\tavatar\n\t\t\t}\n\t\t\ttitle\n\t\t\tsnippet\n\t\t\tlastMessageAt\n\t\t}\n\t"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tquery ImportantPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t}\n\t\t\t\timportantMailbox: mailbox(type: important) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tunseenThreadsCount\n\t\t\t\t\tunseenThreads: threads(filter: { unseen: true }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tseenThreads: threads(filter: { unseen: false }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"): (typeof documents)["\n\t\tquery ImportantPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tusername\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t}\n\t\t\t\timportantMailbox: mailbox(type: important) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tunseenThreadsCount\n\t\t\t\t\tunseenThreads: threads(filter: { unseen: true }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t\tseenThreads: threads(filter: { unseen: false }) {\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t...ThreadListItem\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tquery ScreenerPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t\tcontacts {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\taddress\n\t\t\t\t\t\t\t\tname\n\t\t\t\t\t\t\t\tavatar\n\t\t\t\t\t\t\t\tmessages {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tbodyText\n\t\t\t\t\t\t\t\t\tbodyHTML\n\t\t\t\t\t\t\t\t\tsubject\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"): (typeof documents)["\n\t\tquery ScreenerPageQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\tscreenerMailbox: mailbox(type: screener) {\n\t\t\t\t\tid\n\t\t\t\t\ttype\n\t\t\t\t\tname\n\t\t\t\t\tassignedContactsCount\n\t\t\t\t\tcontacts {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\taddress\n\t\t\t\t\t\t\t\tname\n\t\t\t\t\t\t\t\tavatar\n\t\t\t\t\t\t\t\tmessages {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tbodyText\n\t\t\t\t\t\t\t\t\tbodyHTML\n\t\t\t\t\t\t\t\t\tsubject\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tmutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {\n\t\t\tassignTargetMailbox(input: $input) {\n\t\t\t\tid\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t\ttargetMailbox {\n\t\t\t\t\tid\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"): (typeof documents)["\n\t\tmutation AssignTargetMailboxMutation($input: AssignTargetMailboxInput!) {\n\t\t\tassignTargetMailbox(input: $input) {\n\t\t\t\tid\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t\ttargetMailbox {\n\t\t\t\t\tid\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;