import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

const isMock = !supabaseUrl || !supabaseKey || supabaseUrl.includes('YOUR_') || supabaseKey.includes('YOUR_') || supabaseUrl.includes('replace-with') || supabaseKey.includes('replace-with');

let supabase: SupabaseClient | null = null;
if (!isMock) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('Using mock storage service. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.');
}

// Simple in-memory storage for mock mode
const mockStorage = new Map<string, { buffer: Buffer; contentType?: string }>();

export const storageService = {
  async uploadFile(bucket: string, path: string, fileBuffer: Buffer, contentType?: string): Promise<string> {
    if (isMock || !supabase) {
      const key = `${bucket}/${path}`;
      mockStorage.set(key, { buffer: fileBuffer, contentType });
      return `mock-supabase://${key}`;
    }

    // Try to ensure bucket exists (ignore errors if it already exists or if we lack permissions)
    try {
      await supabase.storage.createBucket(bucket, { public: true });
    } catch (e) {
      // Ignore
    }

    const { error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
      contentType,
      upsert: true,
    });

    if (error) {
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    return storageService.getPublicUrl(bucket, path);
  },

  async downloadFile(bucket: string, path: string): Promise<Buffer> {
    if (isMock || !supabase) {
      const key = `${bucket}/${path}`;
      const entry = mockStorage.get(key);
      if (!entry) {
        throw new Error(`Mock file not found: ${key}`);
      }
      return entry.buffer;
    }

    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error) {
      throw new Error(`Failed to download file from Supabase: ${error.message}`);
    }

    return Buffer.from(await data.arrayBuffer());
  },

  async deleteFile(bucket: string, path: string): Promise<void> {
    if (isMock || !supabase) {
      const key = `${bucket}/${path}`;
      mockStorage.delete(key);
      return;
    }

    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(`Failed to delete file from Supabase: ${error.message}`);
    }
  },

  getPublicUrl(bucket: string, path: string): string {
    if (isMock || !supabase) {
      return `mock-supabase://${bucket}/${path}`;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }
};
