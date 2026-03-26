/**
 * @generated SignedSource<<492360e005aa3619bab7cf410f9fe11c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type componentsThreadListItemDeleteMutation$variables = {
  id: string;
};
export type componentsThreadListItemDeleteMutation$data = {
  readonly deleteEmailThread: boolean;
};
export type componentsThreadListItemDeleteMutation = {
  response: componentsThreadListItemDeleteMutation$data;
  variables: componentsThreadListItemDeleteMutation$variables;
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
    "kind": "ScalarField",
    "name": "deleteEmailThread",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "componentsThreadListItemDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "componentsThreadListItemDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "9f2a762376c17ea5565673e2491b0176",
    "id": null,
    "metadata": {},
    "name": "componentsThreadListItemDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation componentsThreadListItemDeleteMutation(\n  $id: ID!\n) {\n  deleteEmailThread(id: $id)\n}\n"
  }
};
})();

(node as any).hash = "683672ebbfb88c05777c30d6ef7c24cc";

export default node;
