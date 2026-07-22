import { describe, it, expect } from 'vitest';
import { storageService } from './storage';

describe('storageService', () => {
  it('should upload, download, and delete files successfully', async () => {
    const bucket = 'test-bucket';
    const filePath = 'test-folder/test-file.txt';
    const fileContent = Buffer.from('Hello, INDRA AI!');
    const contentType = 'text/plain';

    // 1. Upload the file
    const publicUrl = await storageService.uploadFile(bucket, filePath, fileContent, contentType);
    expect(publicUrl).toBeDefined();
    expect(typeof publicUrl).toBe('string');

    // 2. Download the file
    const downloadedBuffer = await storageService.downloadFile(bucket, filePath);
    expect(downloadedBuffer).toBeInstanceOf(Buffer);
    expect(downloadedBuffer.toString()).toBe('Hello, INDRA AI!');

    // 3. Get public URL
    const url = storageService.getPublicUrl(bucket, filePath);
    expect(url).toContain(bucket);
    expect(url).toContain(filePath);

    // 4. Delete the file
    await storageService.deleteFile(bucket, filePath);

    // 5. Try downloading again (should throw error in mock or live since it's deleted)
    await expect(storageService.downloadFile(bucket, filePath)).rejects.toThrow();
  });
});
