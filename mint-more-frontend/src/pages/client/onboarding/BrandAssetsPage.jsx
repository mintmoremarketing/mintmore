import DocumentUploader from '../../../components/ui/file-upload'
import Icon from '../../../components/ui/Icon'
import { useOnboardingContext } from './useOnboardingContext'

export default function BrandAssetsPage() {
  const { form, handleLogoColorExtraction, removeOnboardingLogo, uploadAssetMutation } = useOnboardingContext()

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div>
        <h1 className="h-display h-1" style={{ margin: 0 }}>Add your brand assets</h1>
        <p className="muted" style={{ marginTop: 8 }}>Upload logos and product reference photos to attach to posts.</p>
      </div>

      {uploadAssetMutation.isPending && (
        <div style={{ padding: 12, background: 'var(--paper-tint)', borderRadius: 12, textAlign: 'center', fontSize: 13, color: 'var(--ink-600)', border: '1px solid var(--hairline)' }}>
          <Icon name="loader" size={16} className="spin" style={{ display: 'inline-block', marginRight: 8, verticalAlign: 'text-bottom' }} />
          Uploading logo and extracting colors...
        </div>
      )}

      {!uploadAssetMutation.isPending && (
        <DocumentUploader
          title="Upload Brand Logos"
          uploadLabel="Select Logo Files"
          description="PNG, JPG or WebP. Transparent background preferred."
          maxFileSizeMb={10}
          acceptedFormats={['png', 'jpg', 'jpeg', 'webp']}
          onFilesChange={(files) => {
            if (files.length > 0) {
              handleLogoColorExtraction({ target: { files } })
            }
          }}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {form.logos.map((logo, index) => (
          <div key={logo.id || index} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--hairline-strong)' }} className="group">
            <img
              src={logo.preview_url || logo.url}
              alt={logo.label || logo.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeOnboardingLogo(logo.id)
              }}
              style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: 'rgba(239, 68, 68, 0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 'bold',
                zIndex: 10,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
