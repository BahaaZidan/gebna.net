export default {
	fetch() {
		return new Response(`Running in ${navigator.userAgent}! LOLOooooooo`);
	},
	email(envelope, env, ctx) {},
} satisfies ExportedHandler;
