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
    "\n\t\tquery ViewerEmailConversationsListQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\temailConversations(first: 30) {\n\t\t\t\t\tedges {\n\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t...EmailConversationTitle\n\t\t\t\t\t\t\t...EmailConversationAvatar\n\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\tunseenCount\n\t\t\t\t\t\t\tlastMessage {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\tsnippet\n\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": typeof types.ViewerEmailConversationsListQueryDocument,
    "\n\t\tquery EmailConversationDetails($id: ID!) {\n\t\t\tnode(id: $id) {\n\t\t\t\t__typename\n\t\t\t\t... on EmailConversation {\n\t\t\t\t\t...EmailConversationTitle\n\t\t\t\t\t...EmailConversationAvatar\n\t\t\t\t\tid\n\t\t\t\t\tmessages {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t...EmailMessageBubble\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": typeof types.EmailConversationDetailsDocument,
    "\n\t\tfragment EmailConversationAvatar on EmailConversation {\n\t\t\tid\n\t\t\tkind\n\t\t\tavatar\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tavatar\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t": typeof types.EmailConversationAvatarFragmentDoc,
    "\n\t\tfragment EmailConversationTitle on EmailConversation {\n\t\t\tid\n\t\t\tkind\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t}\n\t\t}\n\t": typeof types.EmailConversationTitleFragmentDoc,
    "\n\t\tfragment EmailMessageBubble on EmailMessage {\n\t\t\tid\n\t\t\thtml\n\t\t\tcreatedAt\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t": typeof types.EmailMessageBubbleFragmentDoc,
};
const documents: Documents = {
    "\n\t\tquery ViewerEmailConversationsListQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\temailConversations(first: 30) {\n\t\t\t\t\tedges {\n\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t...EmailConversationTitle\n\t\t\t\t\t\t\t...EmailConversationAvatar\n\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\tunseenCount\n\t\t\t\t\t\t\tlastMessage {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\tsnippet\n\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": types.ViewerEmailConversationsListQueryDocument,
    "\n\t\tquery EmailConversationDetails($id: ID!) {\n\t\t\tnode(id: $id) {\n\t\t\t\t__typename\n\t\t\t\t... on EmailConversation {\n\t\t\t\t\t...EmailConversationTitle\n\t\t\t\t\t...EmailConversationAvatar\n\t\t\t\t\tid\n\t\t\t\t\tmessages {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t...EmailMessageBubble\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t": types.EmailConversationDetailsDocument,
    "\n\t\tfragment EmailConversationAvatar on EmailConversation {\n\t\t\tid\n\t\t\tkind\n\t\t\tavatar\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tavatar\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t": types.EmailConversationAvatarFragmentDoc,
    "\n\t\tfragment EmailConversationTitle on EmailConversation {\n\t\t\tid\n\t\t\tkind\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t}\n\t\t}\n\t": types.EmailConversationTitleFragmentDoc,
    "\n\t\tfragment EmailMessageBubble on EmailMessage {\n\t\t\tid\n\t\t\thtml\n\t\t\tcreatedAt\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t": types.EmailMessageBubbleFragmentDoc,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tquery ViewerEmailConversationsListQuery {\n\t\t\tviewer {\n\t\t\t\tid\n\t\t\t\temailConversations(first: 30) {\n\t\t\t\t\tedges {\n\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t...EmailConversationTitle\n\t\t\t\t\t\t\t...EmailConversationAvatar\n\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\tunseenCount\n\t\t\t\t\t\t\tlastMessage {\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\tsnippet\n\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').ViewerEmailConversationsListQueryDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tquery EmailConversationDetails($id: ID!) {\n\t\t\tnode(id: $id) {\n\t\t\t\t__typename\n\t\t\t\t... on EmailConversation {\n\t\t\t\t\t...EmailConversationTitle\n\t\t\t\t\t...EmailConversationAvatar\n\t\t\t\t\tid\n\t\t\t\t\tmessages {\n\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t...EmailMessageBubble\n\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailConversationDetailsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment EmailConversationAvatar on EmailConversation {\n\t\t\tid\n\t\t\tkind\n\t\t\tavatar\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tavatar\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailConversationAvatarFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment EmailConversationTitle on EmailConversation {\n\t\t\tid\n\t\t\tkind\n\t\t\ttitle\n\t\t\tparticipants {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailConversationTitleFragmentDoc;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n\t\tfragment EmailMessageBubble on EmailMessage {\n\t\t\tid\n\t\t\thtml\n\t\t\tcreatedAt\n\t\t\tfrom {\n\t\t\t\tid\n\t\t\t\tisSelf\n\t\t\t\tname\n\t\t\t\tavatar\n\t\t\t\taddress\n\t\t\t}\n\t\t}\n\t"): typeof import('./graphql.js').EmailMessageBubbleFragmentDoc;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
