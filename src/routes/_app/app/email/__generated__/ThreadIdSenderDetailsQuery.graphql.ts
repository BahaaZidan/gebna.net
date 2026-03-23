/**
 * @generated SignedSource<<53d5dfc9fd10a3eea30d992e76924a90>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ThreadIdSenderDetailsQuery$variables = {
  firstAttachments: number;
  firstThreads: number;
  id: string;
};
export type ThreadIdSenderDetailsQuery$data = {
  readonly node: {
    readonly __typename: "EmailAddressRef";
    readonly address: string;
    readonly avatar: string;
    readonly id: string;
    readonly isBlocked: boolean;
    readonly isSpam: boolean;
    readonly name: string;
    readonly " $fragmentSpreads": FragmentRefs<"ThreadIdSenderDetailsAttachmentsSection" | "ThreadIdSenderDetailsThreadsSection">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  } | null | undefined;
};
export type ThreadIdSenderDetailsQuery = {
  response: ThreadIdSenderDetailsQuery$data;
  variables: ThreadIdSenderDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "firstAttachments"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "firstThreads"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "avatar",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBlocked",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isSpam",
  "storageKey": null
},
v11 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "firstAttachments"
  }
],
v12 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "firstThreads"
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "cursor",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "concreteType": "PageInfo",
  "kind": "LinkedField",
  "name": "pageInfo",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasNextPage",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endCursor",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ThreadIdSenderDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              {
                "args": (v11/*: any*/),
                "kind": "FragmentSpread",
                "name": "ThreadIdSenderDetailsAttachmentsSection"
              },
              {
                "args": (v12/*: any*/),
                "kind": "FragmentSpread",
                "name": "ThreadIdSenderDetailsThreadsSection"
              }
            ],
            "type": "EmailAddressRef",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*: any*/),
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Operation",
    "name": "ThreadIdSenderDetailsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/),
          (v5/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              {
                "alias": null,
                "args": (v11/*: any*/),
                "concreteType": "EmailAddressRefAttachmentsConnection",
                "kind": "LinkedField",
                "name": "attachments",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EmailAddressRefAttachmentsConnectionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "EmailAttachment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v5/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "filename",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "sizeInBytes",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "description",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "category",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "url",
                            "storageKey": null
                          },
                          (v4/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v13/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v14/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v11/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "ThreadIdSenderDetailsAttachmentsSection_attachments",
                "kind": "LinkedHandle",
                "name": "attachments"
              },
              {
                "alias": null,
                "args": (v12/*: any*/),
                "concreteType": "EmailAddressRefThreadsConnection",
                "kind": "LinkedField",
                "name": "threads",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "EmailAddressRefThreadsConnectionEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "EmailThread",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v5/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "title",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "EmailAddressRef",
                            "kind": "LinkedField",
                            "name": "participants",
                            "plural": true,
                            "selections": [
                              (v5/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isSelf",
                                "storageKey": null
                              },
                              (v6/*: any*/),
                              (v7/*: any*/),
                              (v8/*: any*/),
                              (v9/*: any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "unseenCount",
                            "storageKey": null
                          },
                          (v7/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "EmailMessage",
                            "kind": "LinkedField",
                            "name": "lastMessage",
                            "plural": false,
                            "selections": [
                              (v5/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "createdAt",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "EmailAddressRef",
                                "kind": "LinkedField",
                                "name": "from",
                                "plural": false,
                                "selections": [
                                  (v5/*: any*/),
                                  (v6/*: any*/),
                                  (v8/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v4/*: any*/)
                        ],
                        "storageKey": null
                      },
                      (v13/*: any*/)
                    ],
                    "storageKey": null
                  },
                  (v14/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v12/*: any*/),
                "filters": null,
                "handle": "connection",
                "key": "ThreadIdSenderDetailsThreadsSection_threads",
                "kind": "LinkedHandle",
                "name": "threads"
              }
            ],
            "type": "EmailAddressRef",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "fe4f089ef80899e0a7cd7b9b23b5d2ef",
    "id": null,
    "metadata": {},
    "name": "ThreadIdSenderDetailsQuery",
    "operationKind": "query",
    "text": "query ThreadIdSenderDetailsQuery(\n  $id: ID!\n  $firstAttachments: Int!\n  $firstThreads: Int!\n) {\n  node(id: $id) {\n    __typename\n    ... on EmailAddressRef {\n      id\n      name\n      avatar\n      address\n      isBlocked\n      isSpam\n      ...ThreadIdSenderDetailsAttachmentsSection_2ubKr\n      ...ThreadIdSenderDetailsThreadsSection_33QL3A\n    }\n    id\n  }\n}\n\nfragment ThreadIdSenderDetailsAttachmentsSection_2ubKr on EmailAddressRef {\n  attachments(first: $firstAttachments) {\n    edges {\n      node {\n        id\n        ...componentsAttachmentListItem\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n\nfragment ThreadIdSenderDetailsThreadsSection_33QL3A on EmailAddressRef {\n  threads(first: $firstThreads) {\n    edges {\n      node {\n        id\n        ...componentsThreadListItem\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n\nfragment componentsAttachmentListItem on EmailAttachment {\n  id\n  filename\n  sizeInBytes\n  description\n  category\n  url\n}\n\nfragment componentsThreadListItem on EmailThread {\n  id\n  ...componentsThreadTitle\n  unseenCount\n  avatar\n  title\n  participants {\n    id\n    avatar\n    isSelf\n    name\n    address\n    isBlocked\n  }\n  lastMessage {\n    id\n    createdAt\n    from {\n      id\n      name\n      address\n    }\n  }\n}\n\nfragment componentsThreadTitle on EmailThread {\n  id\n  title\n  participants {\n    id\n    isSelf\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "0c55feb0caeea142bff03d090bf569b0";

export default node;
