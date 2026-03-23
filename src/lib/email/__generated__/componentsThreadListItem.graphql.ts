/**
 * @generated SignedSource<<52d63dbf6fe60d3b1e6a275bbb6a421a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type componentsThreadListItem$data = {
  readonly avatar: string | null | undefined;
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
  readonly participants: ReadonlyArray<{
    readonly address: string;
    readonly avatar: string;
    readonly id: string;
    readonly isBlocked: boolean;
    readonly isSelf: boolean;
    readonly name: string;
  }>;
  readonly title: string | null | undefined;
  readonly unseenCount: number;
  readonly " $fragmentSpreads": FragmentRefs<"componentsThreadTitle">;
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
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "avatar",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
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
  "name": "componentsThreadListItem",
  "selections": [
    (v0/*: any*/),
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
    (v1/*: any*/),
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
        (v0/*: any*/),
        (v1/*: any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isSelf",
          "storageKey": null
        },
        (v2/*: any*/),
        (v3/*: any*/),
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
            (v2/*: any*/),
            (v3/*: any*/)
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

(node as any).hash = "9db0a2dc4c63d66bb99665fb8b86a78f";

export default node;
