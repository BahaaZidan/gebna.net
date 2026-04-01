import { builder } from "./builder";

import "./email/address-ref";
import "./email/attachment";
import "./email/message";
import "./email/thread";
import "./scalars";
import "./viewer";

export const executableSchema = builder.toSchema();

export default executableSchema;
