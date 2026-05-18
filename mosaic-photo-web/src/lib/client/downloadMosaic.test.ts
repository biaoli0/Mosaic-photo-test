import { describe, expect, it, vi } from 'vitest';
import { downloadMosaic, type DownloadMosaicDependencies } from './downloadMosaic';

function createDependencies() {
	const link = {
		download: '',
		href: '',
		click: vi.fn()
	};
	const dependencies = {
		createLink: vi.fn(() => link),
		createObjectURL: vi.fn(() => 'blob:mosaic'),
		revokeObjectURL: vi.fn()
	} satisfies DownloadMosaicDependencies;

	return { dependencies, link };
}

describe('downloadMosaic', () => {
	it('encodes the canvas as png, downloads it with the generated file name, and revokes the url', async () => {
		const blob = new Blob(['mosaic'], { type: 'image/png' });
		let requestedType = '';
		const canvas = {
			toBlob: vi.fn((callback: BlobCallback, type?: string) => {
				requestedType = type ?? '';
				callback(blob);
			})
		};
		const { dependencies, link } = createDependencies();

		await expect(
			downloadMosaic(
				{ canvas, canDownloadMosaic: true, selectedFileName: 'portrait.jpg' },
				dependencies
			)
		).resolves.toBe(true);

		expect(canvas.toBlob).toHaveBeenCalledOnce();
		expect(requestedType).toBe('image/png');
		expect(dependencies.createObjectURL).toHaveBeenCalledWith(blob);
		expect(dependencies.createLink).toHaveBeenCalledOnce();
		expect(link.href).toBe('blob:mosaic');
		expect(link.download).toBe('portrait-mosaic.png');
		expect(link.click).toHaveBeenCalledOnce();
		expect(dependencies.revokeObjectURL).toHaveBeenCalledWith('blob:mosaic');
	});

	it('does not encode or download when downloads are disabled', async () => {
		const canvas = {
			toBlob: vi.fn()
		};
		const { dependencies } = createDependencies();

		await expect(
			downloadMosaic(
				{ canvas, canDownloadMosaic: false, selectedFileName: 'portrait.jpg' },
				dependencies
			)
		).resolves.toBe(false);

		expect(canvas.toBlob).not.toHaveBeenCalled();
		expect(dependencies.createObjectURL).not.toHaveBeenCalled();
		expect(dependencies.createLink).not.toHaveBeenCalled();
		expect(dependencies.revokeObjectURL).not.toHaveBeenCalled();
	});

	it('does not download when there is no canvas', async () => {
		const { dependencies } = createDependencies();

		await expect(
			downloadMosaic(
				{ canvas: undefined, canDownloadMosaic: true, selectedFileName: 'portrait.jpg' },
				dependencies
			)
		).resolves.toBe(false);

		expect(dependencies.createObjectURL).not.toHaveBeenCalled();
		expect(dependencies.createLink).not.toHaveBeenCalled();
		expect(dependencies.revokeObjectURL).not.toHaveBeenCalled();
	});

	it('rejects when the canvas cannot be encoded', async () => {
		const canvas = {
			toBlob: vi.fn((callback: BlobCallback) => {
				callback(null);
			})
		};
		const { dependencies } = createDependencies();

		await expect(
			downloadMosaic(
				{ canvas, canDownloadMosaic: true, selectedFileName: 'portrait.jpg' },
				dependencies
			)
		).rejects.toThrow('Failed to encode mosaic image.');

		expect(dependencies.createObjectURL).not.toHaveBeenCalled();
		expect(dependencies.createLink).not.toHaveBeenCalled();
		expect(dependencies.revokeObjectURL).not.toHaveBeenCalled();
	});
});
