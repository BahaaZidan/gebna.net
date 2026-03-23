/**
 * @generated SignedSource<<ab1baecd22e2207a63f7231c55cdf93f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EmailAttachmentFileCategory = "Archive" | "Audio" | "Calendar" | "Excel" | "Image" | "Other" | "PDF" | "Slides" | "Video" | "Word" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type componentsMessageBubble$data = {
  readonly attachments: ReadonlyArray<{
    readonly category: EmailAttachmentFileCategory;
    readonly description: string | null | undefined;
    readonly filename: string | null | undefined;
    readonly id: string;
    readonly sizeInBytes: number | null | undefined;
    readonly url: string | null | undefined;
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
        (v0/*: any*/),
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "EmailMessage",
  "abstractKey": null
};
})();

(node as any).hash = "f83da428216c05ef780c65922d36cf83";

export default node;
