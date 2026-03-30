import { GithubLogoIcon } from "@phosphor-icons/react/dist/ssr/GithubLogo";
import { createFileRoute, Link } from "@tanstack/react-router";

import { buildPageMeta } from "#/lib/utils/seo";

import { Route as signInRoute } from "./_auth/auth/signin";
import { Route as signUpRoute } from "./_auth/auth/signup";

export const Route = createFileRoute("/")({
	component: App,
	head: () => ({
		meta: buildPageMeta({
			title: "gebna",
			description:
				"Gebna is a cloud-first super-app for email, storage, notes, calendar, documents, and more without Big Tech lock-in.",
		}),
	}),
});

function App() {
	return (
		<main className="page-wrap px-4 pb-16 pt-10">
			<div className="mx-auto flex max-w-6xl flex-col gap-10">
				<section className="hero min-h-[70vh] rounded-box border border-base-300 bg-base-200/60">
					<div className="hero-content w-full flex-col items-start gap-10 px-6 py-10 lg:flex-row lg:items-center lg:px-10">
						<div className="max-w-3xl space-y-6">
							<div className="badge badge-outline badge-lg">
								Privacy-first personal software
							</div>
							<h1 className="text-5xl font-black tracking-tight text-base-content sm:text-6xl">
								Your digital life belongs to{" "}
								<span className="underline">you.</span>
								<br />
								Not{" "}
								<span className="text-rotate">
									<span>
										<span>Google</span>
										<span>Apple</span>
										<span>Microsoft</span>
									</span>
								</span>
							</h1>
							<p className="max-w-2xl text-lg leading-8 text-base-content/80">
								<span className="font-mono font-semibold">gebna</span> is a
								super-app for the software most people rely on every day: email,
								cloud storage, notes, calendar, documents, slides, sheets,
								newsletters, RSS, and more. One account. One bill. No ad-driven
								business model.
							</p>
							<div className="flex flex-col gap-3 sm:flex-row">
								<Link to={signUpRoute.to} className="btn btn-primary btn-lg">
									Create account
								</Link>
								<Link to={signInRoute.to} className="btn btn-ghost btn-lg">
									Sign in
								</Link>
							</div>
							<a
								href="https://github.com/bahaazidan/gebna.net/"
								target="_blank"
								rel="noreferrer"
								className="inline-flex w-fit items-center gap-2 text-sm font-medium text-base-content/75 transition-colors hover:text-base-content"
							>
								<GithubLogoIcon size={18} weight="fill" />
								Fully and completely open source on GitHub
							</a>
						</div>

						<div className="grid w-full max-w-xl gap-4 sm:grid-cols-2">
							<div className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
								<div className="text-sm uppercase tracking-[0.2em] text-base-content/50">
									Why it exists
								</div>
								<p className="mt-3 text-base leading-7 text-base-content/80">
									Too much of modern life runs through a handful of companies
									with excessive control over communication, files, money, and
									attention.
								</p>
							</div>
							<div className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm">
								<div className="text-sm uppercase tracking-[0.2em] text-base-content/50">
									Business model
								</div>
								<p className="mt-3 text-base leading-7 text-base-content/80">
									Users are customers. Gebna is intended to be paid software,
									built to be sustainable without surveillance or ad-tech
									incentives.
								</p>
							</div>
							<div className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:col-span-2">
								<div className="text-sm uppercase tracking-[0.2em] text-base-content/50">
									What makes it different
								</div>
								<p className="mt-3 text-base leading-7 text-base-content/80">
									Existing self-hosted tools are excellent, but they still
									demand time, skill, and maintenance. Gebna is focused on an
									easier, accessible hosted experience for busy people.
								</p>
							</div>
						</div>
					</div>
				</section>

				<section className="grid gap-4 md:grid-cols-3">
					<div className="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 className="text-xl font-semibold">The suite</h2>
						<p className="mt-3 leading-7 text-base-content/75">
							Email, storage, notes, calendar, documents, slides, sheets, and a
							feed for newsletters and RSS in one connected product.
						</p>
					</div>
					<div className="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 className="text-xl font-semibold">The approach</h2>
						<p className="mt-3 leading-7 text-base-content/75">
							Cloud-first, simple to use, and built for people who want capable
							software without running servers or stitching tools together.
						</p>
					</div>
					<div className="rounded-box border border-base-300 bg-base-100 p-6">
						<h2 className="text-xl font-semibold">The pricing philosophy</h2>
						<p className="mt-3 leading-7 text-base-content/75">
							Affordable if possible, sustainable by design, and likely closer
							to usage-based pricing than bloated subscription tiers.
						</p>
					</div>
				</section>

				<section className="rounded-box border border-primary/30 bg-primary/10 px-6 py-8 text-center">
					<h2 className="text-3xl font-bold">
						Pay for software. Own your relationship with it.
					</h2>
					<p className="mx-auto mt-3 max-w-3xl leading-7 text-base-content/80">
						Gebna is being built on a simple premise: the tools you depend on
						should work for you, not for an advertising machine.
					</p>
				</section>
			</div>
		</main>
	);
}
