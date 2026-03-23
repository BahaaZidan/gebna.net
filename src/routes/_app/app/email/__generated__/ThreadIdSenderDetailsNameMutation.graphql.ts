/**
 * @generated SignedSource<<8d2e34fa44b3ad7d852fb45c1e063a85>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type UpdateEmailAddressRefInput = {
  address: string;
  givenAvatar?: string | null | undefined;
  givenName?: string | null | undefined;
  isBlocked?: boolean | null | undefined;
  isSpam?: boolean | null | undefined;
};
export type ThreadIdSenderDetailsNameMutation$variables = {
  input: UpdateEmailAddressRefInput;
};
export type ThreadIdSenderDetailsNameMutation$data = {
  readonly updateEmailAddressRef: {
    readonly result: {
      readonly id: string;
      readonly name: string;
    } | null | undefined;
  } | null | undefined;
};
export type ThreadIdSenderDetailsNameMutation = {
  response: ThreadIdSenderDetailsNameMutation$data;
  variables: ThreadIdSenderDetailsNameMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "UpdateEmailAddressRefPayload",
    "kind": "LinkedField",
    "name": "updateEmailAddressRef",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "EmailAddressRef",
        "kind": "LinkedField",
        "name": "result",
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
            "name": "name",
            "storageKey": null
          }
        ],
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
    "name": "ThreadIdSenderDetailsNameMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ThreadIdSenderDetailsNameMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "8ab1a4c7e0d2c983ce1633c7276ffa29",
    "id": null,
    "metadata": {},
    "name": "ThreadIdSenderDetailsNameMutation",
    "operationKind": "mutation",
    "text": "mutation ThreadIdSenderDetailsNameMutation(\n  $input: UpdateEmailAddressRefInput!\n) {\n  updateEmailAddressRef(input: $input) {\n    result {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "beab13ccec7e29a3b9319d6d3ffc192c";

export default node;
