import { createWorker, Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let currentProgressCallback: ((progress: number) => void) | null = null;
let jobQueue: Promise<any> = Promise.resolve();

/**
 * Initializes the Tesseract worker with English language data.
 * Uses a singleton pattern to reuse the worker.
 * Returns a promise that resolves to the worker instance.
 */
export const initializeWorker = (): Promise<Worker> => {
  if (!workerPromise) {
    workerPromise = (async () => {
      // Initialize worker with English language and local tessdata
      // gzip: true expects .gz files which we downloaded
      const worker = await createWorker('eng', 1, {
        langPath: '/tessdata',
        gzip: true,
        logger: (m) => {
          if (m.status === 'recognizing text' && currentProgressCallback) {
            // m.progress is 0 to 1
            currentProgressCallback(Math.round(m.progress * 100));
          }
        },
      });
      return worker;
    })();
  }
  return workerPromise;
};

/**
 * Scans an image and returns the text.
 * Enqueues jobs to ensure progress callbacks are correct for the active job.
 * @param image Image source (URL, File, Blob, etc.)
 * @param onProgress Optional callback for progress updates (0-100)
 */
export const scanImage = (
  image: string | File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> => {
  // Chain to the job queue to process sequentially
  // This ensures that currentProgressCallback refers to the current job
  const job = jobQueue.then(async () => {
    const w = await initializeWorker();
    currentProgressCallback = onProgress || null;
    try {
      const { data: { text } } = await w.recognize(image);
      return text;
    } finally {
      currentProgressCallback = null;
    }
  });

  // Ensure subsequent jobs wait for this one to complete (success or failure)
  jobQueue = job.catch(() => {});

  return job;
};
