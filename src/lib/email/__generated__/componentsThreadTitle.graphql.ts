/**
 * @generated SignedSource<<146bc027707b72a27820c91b0fef19b3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type componentsThreadTitle$data = {
  readonly id: string;
  readonly participants: ReadonlyArray<{
    readonly id: string;
    readonly isSelf: boolean;
    readonly name: string;
  }>;
  readonly title: string | null | undefined;
  readonly " $fragmentType": "componentsThreadTitle";
};
export type componentsThreadTitle$key = {
  readonly " $data"?: componentsThreadTitle$data;
  readonly " $fragmentSpreads": FragmentRefs<"componentsThreadTitle">;
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
  "name": "componentsThreadTitle",
  "selections": [
    (v0/*: any*/),
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "EmailThread",
  "abstractKey": null
};
})();

(node as any).hash = "94858ff6719b5ab07b9b7352e9177eca";

export default node;
