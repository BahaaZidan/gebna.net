/**
 * @generated SignedSource<<acddf120ce9807418906c26b5e332a81>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ThreadIdSeenMutation$variables = {
  id: string;
};
export type ThreadIdSeenMutation$data = {
  readonly seeEmailThread: {
    readonly id: string;
    readonly unseenCount: number;
  } | null | undefined;
};
export type ThreadIdSeenMutation = {
  response: ThreadIdSeenMutation$data;
  variables: ThreadIdSeenMutation$variables;
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
    "name": "ThreadIdSeenMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ThreadIdSeenMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "faa1076a6921e531e6716915afe9d437",
    "id": null,
    "metadata": {},
    "name": "ThreadIdSeenMutation",
    "operationKind": "mutation",
    "text": "mutation ThreadIdSeenMutation(\n  $id: ID!\n) {\n  seeEmailThread(id: $id) {\n    id\n    unseenCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "a39b44e3da56e7640add0c7baede4c3a";

export default node;
