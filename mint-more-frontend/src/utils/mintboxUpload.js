import * as tus from 'tus-js-client'

export function uploadMintboxFile({
  file,
  config,
  fileType,
  onProgress,
  onUploadRef,
}) {
  if (config.provider === 'r2' || config.method === 'PUT') {
    const controller = new AbortController()
    onUploadRef?.({
      abort: () => controller.abort(),
      start: () => {},
    })

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', config.url || config.endpoint)
      const headers = config.headers || {}
      Object.entries(headers).forEach(([key, value]) => {
        if (value != null) xhr.setRequestHeader(key, value)
      })
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress?.(event.loaded, event.total)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed with status ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.onabort = () => reject(new Error('Upload cancelled'))
      controller.signal.addEventListener('abort', () => xhr.abort())
      xhr.send(file)
    })
  }

  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: config.endpoint,
      fingerprint: () => Promise.resolve(`mintbox-signed-v1-${config.upload_id}`),
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      chunkSize: config.policy?.chunk_size_bytes || 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        'x-signature': String(config.token || '').trim(),
      },
      metadata: {
        bucketName: config.bucket,
        objectName: config.storage_path,
        contentType: fileType,
        cacheControl: '3600',
      },
      onProgress,
      onError: reject,
      onSuccess: resolve,
    })
    onUploadRef?.(upload)
    upload.start()
  })
}
