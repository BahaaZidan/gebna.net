/* eslint-disable */
import * as types from './graphql.js';



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
    "\n\t\t\tquery ViewerEmailThreadsListQuery($first: Int!, $after: String) {\n\t\t\t\tviewer {\n\t\t\t\t\tid\n\t\t\t\t\temailThreads(first: $first, after: $after) {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t...EmailThreadTitle\n\t\t\t\t\t\t\t\t...EmailThreadAvatar\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\t\tunseenCount\n\t\t\t\t\t\t\t\tlastMessage {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tsnippet\n\t\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t": typeof types.ViewerEmailThreadsListQueryDocument,
    "\n\t\t\tquery EmailThreadDetails($id: ID!, $first: Int!, $after: String) {\n\t\t\t\tnode(id: $id) {\n\t\t\t\t\t__typename\n\t\t\t\t\t... on EmailThread {\n\t\t\t\t\t\t...EmailThreadTitle\n\t\t\t\t\t\t...EmailThreadAvatar\n\t\t\t\t\t\tid\n\t\t\t\t\t\tmessages(first: $first, after: $after) {\n\t\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t\t...EmailMessageBubble\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t": typeof types.EmailThreadDetailsDocument,
    "\n\t\tfragment EmailMessageBubble on EmailMessage {\n\t\t\tid\n\t\t\thtml\n\t\t\tplaintext\n\t\t\tcreatedAt\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t}\n\t\t\tattachments {\n\t\t\t\tid\n\t\t\t\tfilename\n\t\t\t\tsizeInBytes\n\t\t\t\tdescription\n\t\t\t\tcategory\n\t\t\t\turl\n\t\t\t}\n\t\t}\n\t": typeof types.EmailMessageBubbleFragmentDoc,
    "\n\t\tfragment EmailThreadAvatar on EmailThread {\n\t\t\tid\n\t\t\tavatar\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tavatar\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t": typeof types.EmailThreadAvatarFragmentDoc,
    "\n\t\tfragment EmailThreadTitle on EmailThread {\n\t\t\tid\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t}\n\t\t}\n\t": typeof types.EmailThreadTitleFragmentDoc,
};
const documents: Documents = {
    "\n\t\t\tquery ViewerEmailThreadsListQuery($first: Int!, $after: String) {\n\t\t\t\tviewer {\n\t\t\t\t\tid\n\t\t\t\t\temailThreads(first: $first, after: $after) {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t...EmailThreadTitle\n\t\t\t\t\t\t\t\t...EmailThreadAvatar\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\t\tunseenCount\n\t\t\t\t\t\t\t\tlastMessage {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tsnippet\n\t\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t": types.ViewerEmailThreadsListQueryDocument,
    "\n\t\t\tquery EmailThreadDetails($id: ID!, $first: Int!, $after: String) {\n\t\t\t\tnode(id: $id) {\n\t\t\t\t\t__typename\n\t\t\t\t\t... on EmailThread {\n\t\t\t\t\t\t...EmailThreadTitle\n\t\t\t\t\t\t...EmailThreadAvatar\n\t\t\t\t\t\tid\n\t\t\t\t\t\tmessages(first: $first, after: $after) {\n\t\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t\t...EmailMessageBubble\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t": types.EmailThreadDetailsDocument,
    "\n\t\tfragment EmailMessageBubble on EmailMessage {\n\t\t\tid\n\t\t\thtml\n\t\t\tplaintext\n\t\t\tcreatedAt\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t}\n\t\t\tattachments {\n\t\t\t\tid\n\t\t\t\tfilename\n\t\t\t\tsizeInBytes\n\t\t\t\tdescription\n\t\t\t\tcategory\n\t\t\t\turl\n\t\t\t}\n\t\t}\n\t": types.EmailMessageBubbleFragmentDoc,
    "\n\t\tfragment EmailThreadAvatar on EmailThread {\n\t\t\tid\n\t\t\tavatar\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tavatar\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t": types.EmailThreadAvatarFragmentDoc,
    "\n\t\tfragment EmailThreadTitle on EmailThread {\n\t\t\tid\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t}\n\t\t}\n\t": types.EmailThreadTitleFragmentDoc,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\t\tquery ViewerEmailThreadsListQuery($first: Int!, $after: String) {\n\t\t\t\tviewer {\n\t\t\t\t\tid\n\t\t\t\t\temailThreads(first: $first, after: $after) {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tcursor\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t...EmailThreadTitle\n\t\t\t\t\t\t\t\t...EmailThreadAvatar\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\t\tunseenCount\n\t\t\t\t\t\t\t\tlastMessage {\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\tsnippet\n\t\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t"): typeof import('./graphql.js').ViewerEmailThreadsListQueryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\t\tquery EmailThreadDetails($id: ID!, $first: Int!, $after: String) {\n\t\t\t\tnode(id: $id) {\n\t\t\t\t\t__typename\n\t\t\t\t\t... on EmailThread {\n\t\t\t\t\t\t...EmailThreadTitle\n\t\t\t\t\t\t...EmailThreadAvatar\n\t\t\t\t\t\tid\n\t\t\t\t\t\tmessages(first: $first, after: $after) {\n\t\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t\t...EmailMessageBubble\n\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\tpageInfo {\n\t\t\t\t\t\t\t\thasNextPage\n\t\t\t\t\t\t\t\tendCursor\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t"): typeof import('./graphql.js').EmailThreadDetailsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment EmailMessageBubble on EmailMessage {\n\t\t\tid\n\t\t\thtml\n\t\t\tplaintext\n\t\t\tcreatedAt\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t}\n\t\t\tattachments {\n\t\t\t\tid\n\t\t\t\tfilename\n\t\t\t\tsizeInBytes\n\t\t\t\tdescription\n\t\t\t\tcategory\n\t\t\t\turl\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailMessageBubbleFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment EmailThreadAvatar on EmailThread {\n\t\t\tid\n\t\t\tavatar\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tavatar\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailThreadAvatarFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment EmailThreadTitle on EmailThread {\n\t\t\tid\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailThreadTitleFragmentDoc;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
