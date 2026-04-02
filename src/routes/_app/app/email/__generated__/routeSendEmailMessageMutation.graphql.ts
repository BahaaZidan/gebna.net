/**
 * @generated SignedSource<<845bd8d5c3f366076151829a0d4bae43>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type routeSendEmailMessageMutation$variables = {
  bodyInMarkdown: string;
  subject: string;
  to: string;
};
export type routeSendEmailMessageMutation$data = {
  readonly sendEmailMessage: {
    readonly result: boolean | null | undefined;
  } | null | undefined;
};
export type routeSendEmailMessageMutation = {
  response: routeSendEmailMessageMutation$data;
  variables: routeSendEmailMessageMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "bodyInMarkdown"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "subject"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "to"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "bodyInMarkdown",
            "variableName": "bodyInMarkdown"
          },
          {
            "fields": [
              {
                "items": [
                  {
                    "kind": "Variable",
                    "name": "to.0",
                    "variableName": "to"
                  }
                ],
                "kind": "ListValue",
                "name": "to"
              }
            ],
            "kind": "ObjectValue",
            "name": "recipients"
          },
          {
            "kind": "Variable",
            "name": "subject",
            "variableName": "subject"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "SendEmailMessagePayload",
    "kind": "LinkedField",
    "name": "sendEmailMessage",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "result",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "routeSendEmailMessageMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "routeSendEmailMessageMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "eed60780339132471fbf48353e2ac3b0",
    "id": null,
    "metadata": {},
    "name": "routeSendEmailMessageMutation",
    "operationKind": "mutation",
    "text": "mutation routeSendEmailMessageMutation(\n  $bodyInMarkdown: String!\n  $subject: String!\n  $to: String!\n) {\n  sendEmailMessage(input: {bodyInMarkdown: $bodyInMarkdown, subject: $subject, recipients: {to: [$to]}}) {\n    result\n  }\n}\n"
  }
};
})();

(node as any).hash = "2ea2ed92fffcc80f43f6a50c1882b0da";

export default node;
