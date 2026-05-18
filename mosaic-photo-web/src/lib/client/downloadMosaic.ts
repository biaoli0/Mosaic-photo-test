import { getDownloadFileName } from './downloadFileName';

type DownloadLink = Pick<HTMLAnchorElement, 'download' | 'href' | 'click'>;

export type DownloadMosaicDependencies = {
	createLink: () => DownloadLink;
	createObjectURL: (blob: Blob) => string;
	revokeObjectURL: (url: string) => void;
};

type DownloadMosaicOptions = {
	canvas: Pick<HTMLCanvasElement, 'toBlob'> | null | undefined;
	canDownloadMosaic: boolean;
	selectedFileName: string;
};

function encodeCanvasAsPng(canvas: Pick<HTMLCanvasElement, 'toBlob'>): Promise<Blob> {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(result) => (result ? resolve(result) : reject(new Error('Failed to encode mosaic image.'))),
			'image/png'
		);
	});
}

export async function downloadMosaic(
	{ canvas, canDownloadMosaic, selectedFileName }: DownloadMosaicOptions,
	dependencies?: DownloadMosaicDependencies
): Promise<boolean> {
	if (!canvas || !canDownloadMosaic) return false;

	const downloadDependencies = dependencies ?? {
		createLink: () => document.createElement('a'),
		createObjectURL: (blob: Blob) => URL.createObjectURL(blob),
		revokeObjectURL: (url: string) => URL.revokeObjectURL(url)
	};
	const blob = await encodeCanvasAsPng(canvas);
	const url = downloadDependencies.createObjectURL(blob);
	try {
		const link = downloadDependencies.createLink();
		link.href = url;
		link.download = getDownloadFileName(selectedFileName);
		link.click();
	} finally {
		downloadDependencies.revokeObjectURL(url);
	}

	return true;
}
