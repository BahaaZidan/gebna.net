/**
 * @generated SignedSource<<405e9652edc6193308b7bc0fda2ced05>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ThreadIdSenderDetailsThreadsSectionPaginationQuery$variables = {
  after?: string | null | undefined;
  first?: number | null | undefined;
  id: string;
};
export type ThreadIdSenderDetailsThreadsSectionPaginationQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ThreadIdSenderDetailsThreadsSection">;
  } | null | undefined;
};
export type ThreadIdSenderDetailsThreadsSectionPaginationQuery = {
  response: ThreadIdSenderDetailsThreadsSectionPaginationQuery$data;
  variables: ThreadIdSenderDetailsThreadsSectionPaginationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "after"
  },
  {
    "defaultValue": 10,
    "kind": "LocalArgument",
    "name": "first"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "after",
    "variableName": "after"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "first"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "avatar",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ThreadIdSenderDetailsThreadsSectionPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": (v2/*: any*/),
            "kind": "FragmentSpread",
            "name": "ThreadIdSenderDetailsThreadsSection"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ThreadIdSenderDetailsThreadsSectionPaginationQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*: any*/),
          (v4/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v2/*: any*/),
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
                          (v4/*: any*/),
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
                              (v4/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isSelf",
                                "storageKey": null
                              },
                              (v5/*: any*/),
                              (v6/*: any*/),
                              (v7/*: any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "isBlocked",
                                "storageKey": null
                              }
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
                          (v6/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "EmailMessage",
                            "kind": "LinkedField",
                            "name": "lastMessage",
                            "plural": false,
                            "selections": [
                              (v4/*: any*/),
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
                                  (v4/*: any*/),
                                  (v5/*: any*/),
                                  (v7/*: any*/)
                                ],
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          (v3/*: any*/)
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "cursor",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
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
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": (v2/*: any*/),
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
    "cacheID": "019bd9fb41fad8b0397e58492cbee2ab",
    "id": null,
    "metadata": {},
    "name": "ThreadIdSenderDetailsThreadsSectionPaginationQuery",
    "operationKind": "query",
    "text": "query ThreadIdSenderDetailsThreadsSectionPaginationQuery(\n  $after: String\n  $first: Int = 10\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ThreadIdSenderDetailsThreadsSection_2HEEH6\n    id\n  }\n}\n\nfragment ThreadIdSenderDetailsThreadsSection_2HEEH6 on EmailAddressRef {\n  threads(first: $first, after: $after) {\n    edges {\n      node {\n        id\n        ...componentsThreadListItem\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n  id\n}\n\nfragment componentsThreadListItem on EmailThread {\n  id\n  ...componentsThreadTitle\n  unseenCount\n  avatar\n  title\n  participants {\n    id\n    avatar\n    isSelf\n    name\n    address\n    isBlocked\n  }\n  lastMessage {\n    id\n    createdAt\n    from {\n      id\n      name\n      address\n    }\n  }\n}\n\nfragment componentsThreadTitle on EmailThread {\n  id\n  title\n  participants {\n    id\n    isSelf\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "7bfbc616d8a311ada9f4639c0e603099";

export default node;
