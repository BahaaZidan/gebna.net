/**
 * @generated SignedSource<<5d2657e89a0bd8f8a6d9fb3c2ab699b5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type componentsThreadListItem$data = {
  readonly id: string;
  readonly lastMessage: {
    readonly createdAt: any;
    readonly from: {
      readonly address: string;
      readonly id: string;
      readonly name: string;
    };
    readonly id: string;
  };
  readonly unseenCount: number;
  readonly " $fragmentSpreads": FragmentRefs<"componentsThreadAvatar" | "componentsThreadTitle">;
  readonly " $fragmentType": "componentsThreadListItem";
};
export type componentsThreadListItem$key = {
  readonly " $data"?: componentsThreadListItem$data;
  readonly " $fragmentSpreads": FragmentRefs<"componentsThreadListItem">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "componentsThreadListItem",
  "selections": [
    (v0/*: any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "componentsThreadAvatar"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "componentsThreadTitle"
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "unseenCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "EmailMessage",
      "kind": "LinkedField",
      "name": "lastMessage",
      "plural": false,
      "selections": [
        (v0/*: any*/),
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
              "name": "address",
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "EmailThread",
  "abstractKey": null
};
})();

(node as any).hash = "9dd1abe484ac07d3b2eef7553bd6e59e";

export default node;
