import clsx from "clsx";

export function LoadNextButton({
	hasNext,
	isLoadingNext,
	onClick,
}: {
	hasNext: boolean;
	isLoadingNext: boolean;
	onClick: () => void;
}) {
	if (!hasNext) return null;
	return (
		<button
			type="button"
			className="btn w-full"
			disabled={isLoadingNext}
			onClick={onClick}
		>
			Load more
			<span
				className={clsx(
					"loading loading-md loading-spinner",
					isLoadingNext ? "visible" : "invisible",
				)}
			></span>
		</button>
	);
}
