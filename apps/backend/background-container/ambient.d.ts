declare module "file-type" {
	export function fileTypeFromBuffer(buffer: ArrayBuffer | Buffer | Uint8Array): Promise<
		| {
				ext: string;
				mime: string;
		  }
		| undefined
	>;
}

declare module "sharp" {
	type ResizeOptions = {
		width?: number;
		height?: number;
		fit?: string;
		withoutEnlargement?: boolean;
	};

	type WebpOptions = { quality?: number };

	type SharpInstance = {
		rotate(): SharpInstance;
		resize(options: ResizeOptions): SharpInstance;
		webp(options?: WebpOptions): SharpInstance;
		toBuffer(): Promise<Buffer>;
	};

	const sharp: (
		input?: Buffer | Uint8Array | ArrayBuffer | string,
		options?: { failOn?: "none" | "warning" | "error" }
	) => SharpInstance;

	export default sharp;
}
