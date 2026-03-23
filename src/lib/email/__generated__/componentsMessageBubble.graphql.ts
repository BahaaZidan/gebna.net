/**
 * @generated SignedSource<<43053610c8c37b136b18986c00a46fd1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type componentsMessageBubble$data = {
  readonly attachments: ReadonlyArray<{
    readonly " $fragmentSpreads": FragmentRefs<"componentsAttachmentListItem">;
  }>;
  readonly createdAt: any;
  readonly from: {
    readonly address: string;
    readonly avatar: string;
    readonly id: string;
    readonly isBlocked: boolean;
    readonly isSelf: boolean;
    readonly name: string;
  };
  readonly html: string | null | undefined;
  readonly id: string;
  readonly plaintext: string | null | undefined;
  readonly to: {
    readonly address: string;
    readonly id: string;
    readonly isSelf: boolean;
  };
  readonly " $fragmentType": "componentsMessageBubble";
};
export type componentsMessageBubble$key = {
  readonly " $data"?: componentsMessageBubble$data;
  readonly " $fragmentSpreads": FragmentRefs<"componentsMessageBubble">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isSelf",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "address",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "componentsMessageBubble",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "html",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "plaintext",
      "storageKey": null
    },
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
        (v0/*: any*/),
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isBlocked",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "name",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "avatar",
          "storageKey": null
        },
        (v2/*: any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EmailAddressRef",
      "kind": "LinkedField",
      "name": "to",
      "plural": false,
      "selections": [
        (v0/*: any*/),
        (v1/*: any*/),
        (v2/*: any*/)
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EmailAttachment",
      "kind": "LinkedField",
      "name": "attachments",
      "plural": true,
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "componentsAttachmentListItem"
        }
      ],
      "storageKey": null
    }
  ],
  "type": "EmailMessage",
  "abstractKey": null
};
})();

(node as any).hash = "52773de38757d0cb87ba66b18d12299d";

export default node;
