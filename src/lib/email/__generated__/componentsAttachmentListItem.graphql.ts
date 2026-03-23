/**
 * @generated SignedSource<<76f907baadb2508515c1852acaff966d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type EmailAttachmentFileCategory = "Archive" | "Audio" | "Calendar" | "Excel" | "Image" | "Other" | "PDF" | "Slides" | "Video" | "Word" | "%future added value";
import { FragmentRefs } from "relay-runtime";
export type componentsAttachmentListItem$data = {
  readonly category: EmailAttachmentFileCategory;
  readonly description: string | null | undefined;
  readonly filename: string | null | undefined;
  readonly id: string;
  readonly sizeInBytes: number | null | undefined;
  readonly url: string | null | undefined;
  readonly " $fragmentType": "componentsAttachmentListItem";
};
export type componentsAttachmentListItem$key = {
  readonly " $data"?: componentsAttachmentListItem$data;
  readonly " $fragmentSpreads": FragmentRefs<"componentsAttachmentListItem">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "componentsAttachmentListItem",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    },
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
  "type": "EmailAttachment",
  "abstractKey": null
};

(node as any).hash = "556720f1d7c165e085bcd480e20de927";

export default node;
