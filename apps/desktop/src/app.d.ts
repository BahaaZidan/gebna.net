// See https://kit.svelte.dev/docs/types#app

import type { Session } from "@gebna/auth/server";

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session?: Session["session"];
			user?: Session["user"];
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
