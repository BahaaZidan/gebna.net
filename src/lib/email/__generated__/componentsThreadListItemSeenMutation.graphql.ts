/**
 * @generated SignedSource<<6cf5914d11f230da44150b99b7407f56>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type componentsThreadListItemSeenMutation$variables = {
  id: string;
};
export type componentsThreadListItemSeenMutation$data = {
  readonly seeEmailThread: {
    readonly id: string;
    readonly unseenCount: number;
  } | null | undefined;
};
export type componentsThreadListItemSeenMutation = {
  response: componentsThreadListItemSeenMutation$data;
  variables: componentsThreadListItemSeenMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "EmailThread",
    "kind": "LinkedField",
    "name": "seeEmailThread",
    "plural": false,
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
        "name": "unseenCount",
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
    "name": "componentsThreadListItemSeenMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "componentsThreadListItemSeenMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "31901fa5663bab24f26567a727e8cc05",
    "id": null,
    "metadata": {},
    "name": "componentsThreadListItemSeenMutation",
    "operationKind": "mutation",
    "text": "mutation componentsThreadListItemSeenMutation(\n  $id: ID!\n) {\n  seeEmailThread(id: $id) {\n    id\n    unseenCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "21337e90a9a4767a9de25a75d6facc15";

export default node;
