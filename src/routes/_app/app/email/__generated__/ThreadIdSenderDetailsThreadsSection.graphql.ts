/**
 * @generated SignedSource<<e5f5a9453757e5fd587836e0d9b9f6fb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ThreadIdSenderDetailsThreadsSection$data = {
  readonly id: string;
  readonly threads: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"componentsThreadListItem">;
      };
    }>;
    readonly pageInfo: {
      readonly hasNextPage: boolean;
    };
  };
  readonly " $fragmentType": "ThreadIdSenderDetailsThreadsSection";
};
export type ThreadIdSenderDetailsThreadsSection$key = {
  readonly " $data"?: ThreadIdSenderDetailsThreadsSection$data;
  readonly " $fragmentSpreads": FragmentRefs<"ThreadIdSenderDetailsThreadsSection">;
};

import ThreadIdSenderDetailsThreadsSectionPaginationQuery_graphql from './ThreadIdSenderDetailsThreadsSectionPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "threads"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 10,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ThreadIdSenderDetailsThreadsSectionPaginationQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ThreadIdSenderDetailsThreadsSection",
  "selections": [
    {
      "alias": "threads",
      "args": null,
      "concreteType": "EmailAddressRefThreadsConnection",
      "kind": "LinkedField",
      "name": "__ThreadIdSenderDetailsThreadsSection_threads_connection",
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
                (v1/*: any*/),
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "componentsThreadListItem"
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
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
    (v1/*: any*/)
  ],
  "type": "EmailAddressRef",
  "abstractKey": null
};
})();

(node as any).hash = "7bfbc616d8a311ada9f4639c0e603099";

export default node;
