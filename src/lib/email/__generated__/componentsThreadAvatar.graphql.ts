/**
 * @generated SignedSource<<f8bdad29d8c0fe4370125671dace4a96>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type componentsThreadAvatar$data = {
  readonly avatar: string | null | undefined;
  readonly id: string;
  readonly participants: ReadonlyArray<{
    readonly address: string;
    readonly avatar: string;
    readonly id: string;
    readonly isBlocked: boolean;
    readonly isSelf: boolean;
    readonly name: string;
  }>;
  readonly title: string | null | undefined;
  readonly " $fragmentType": "componentsThreadAvatar";
};
export type componentsThreadAvatar$key = {
  readonly " $data"?: componentsThreadAvatar$data;
  readonly " $fragmentSpreads": FragmentRefs<"componentsThreadAvatar">;
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
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "componentsThreadAvatar",
  "selections": [
    (v0/*: any*/),
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "isBlocked",
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

(node as any).hash = "b5d4b79d391b746910ef11c8d38b3e28";

export default node;
