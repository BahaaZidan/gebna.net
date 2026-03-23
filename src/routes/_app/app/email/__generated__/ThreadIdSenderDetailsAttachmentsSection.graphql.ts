/**
 * @generated SignedSource<<eaf2fa08ab6bcac945df26e30f9bb6cb>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ThreadIdSenderDetailsAttachmentsSection$data = {
  readonly attachments: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"componentsAttachmentListItem">;
      };
    }>;
    readonly pageInfo: {
      readonly hasNextPage: boolean;
    };
  };
  readonly id: string;
  readonly " $fragmentType": "ThreadIdSenderDetailsAttachmentsSection";
};
export type ThreadIdSenderDetailsAttachmentsSection$key = {
  readonly " $data"?: ThreadIdSenderDetailsAttachmentsSection$data;
  readonly " $fragmentSpreads": FragmentRefs<"ThreadIdSenderDetailsAttachmentsSection">;
};

import ThreadIdSenderDetailsAttachmentsSectionPaginationQuery_graphql from './ThreadIdSenderDetailsAttachmentsSectionPaginationQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "attachments"
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
      "operation": ThreadIdSenderDetailsAttachmentsSectionPaginationQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ThreadIdSenderDetailsAttachmentsSection",
  "selections": [
    {
      "alias": "attachments",
      "args": null,
      "concreteType": "EmailAddressRefAttachmentsConnection",
      "kind": "LinkedField",
      "name": "__ThreadIdSenderDetailsAttachmentsSection_attachments_connection",
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
                (v1/*: any*/),
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "componentsAttachmentListItem"
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

(node as any).hash = "d8ef6da5f21d733e518a4b3670a5803c";

export default node;
