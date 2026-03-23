/**
 * @generated SignedSource<<85c0db9a1dc9e2fc1da861249f589249>>
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
export type ThreadIdSenderDetailsActionsMutation$variables = {
  input: UpdateEmailAddressRefInput;
};
export type ThreadIdSenderDetailsActionsMutation$data = {
  readonly updateEmailAddressRef: {
    readonly result: {
      readonly address: string;
      readonly id: string;
      readonly isBlocked: boolean;
      readonly isSpam: boolean;
    } | null | undefined;
  } | null | undefined;
};
export type ThreadIdSenderDetailsActionsMutation = {
  response: ThreadIdSenderDetailsActionsMutation$data;
  variables: ThreadIdSenderDetailsActionsMutation$variables;
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
            "name": "address",
            "storageKey": null
          },
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
            "name": "isSpam",
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
    "name": "ThreadIdSenderDetailsActionsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ThreadIdSenderDetailsActionsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "85fe66197644e69b353e126216365ad4",
    "id": null,
    "metadata": {},
    "name": "ThreadIdSenderDetailsActionsMutation",
    "operationKind": "mutation",
    "text": "mutation ThreadIdSenderDetailsActionsMutation(\n  $input: UpdateEmailAddressRefInput!\n) {\n  updateEmailAddressRef(input: $input) {\n    result {\n      id\n      address\n      isBlocked\n      isSpam\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "51798c7381f3245256a0ad1904b58a78";

export default node;
