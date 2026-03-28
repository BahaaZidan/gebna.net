/**
 * @generated SignedSource<<91e63a928d31c849b47b532fd1c29924>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type routeSendEmailMessageMutation$variables = {
  body: string;
  to: string;
};
export type routeSendEmailMessageMutation$data = {
  readonly sendEmailMessage: boolean;
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
    "name": "body"
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
        "kind": "Variable",
        "name": "body",
        "variableName": "body"
      },
      {
        "kind": "Variable",
        "name": "to",
        "variableName": "to"
      }
    ],
    "kind": "ScalarField",
    "name": "sendEmailMessage",
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
    "cacheID": "c88c6fba6efaa7b0e141ac70df7cf4bf",
    "id": null,
    "metadata": {},
    "name": "routeSendEmailMessageMutation",
    "operationKind": "mutation",
    "text": "mutation routeSendEmailMessageMutation(\n  $body: String!\n  $to: String!\n) {\n  sendEmailMessage(body: $body, to: $to)\n}\n"
  }
};
})();

(node as any).hash = "e46386f27b06070a8ce1a5fe3e6c9e4e";

export default node;
