import { describe, expect, it } from 'vitest';
import { getDownloadFileName } from './downloadFileName';

describe('getDownloadFileName', () => {
	it('uses the fallback name when the selected file name is empty', () => {
		expect(getDownloadFileName('')).toBe('mosaic.png');
		expect(getDownloadFileName('   ')).toBe('mosaic.png');
	});

	it('appends the mosaic suffix to a file name without an extension', () => {
		expect(getDownloadFileName('portrait')).toBe('portrait-mosaic.png');
	});

	it('replaces the original extension with the mosaic png suffix', () => {
		expect(getDownloadFileName('portrait.jpg')).toBe('portrait-mosaic.png');
		expect(getDownloadFileName('archive.photo.jpeg')).toBe('archive.photo-mosaic.png');
	});

	it('trims whitespace around the selected file name and base name', () => {
		expect(getDownloadFileName('  portrait.jpg  ')).toBe('portrait-mosaic.png');
		expect(getDownloadFileName('  portrait .jpg  ')).toBe('portrait-mosaic.png');
	});

	it('preserves leading-dot names without treating the dot as an extension separator', () => {
		expect(getDownloadFileName('.hidden')).toBe('.hidden-mosaic.png');
	});
});
