import sys

with open('src/pages/client/MintAI.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const pixelSizeFor = (generation) => {"
start_idx = content.find(start_marker)

end_marker = "function ModelRow({ model, selected, resolution, onSelect }) {"
end_idx = content.find(end_marker)

new_block = """const pixelSizeFor = (generation) => {
  if (isTextGeneration(generation)) return 'Text'
  const result = generation?.result_metadata || {}
  if (result.width && result.height) return `${result.width}x${result.height}`
  return aspectFor(generation)
}

const referencesFor = (generation) => {
  const metadata = metadataFor(generation)
  if (Array.isArray(metadata.references)) return metadata.references
  if (Array.isArray(generation?.reference_asset_ids)) {
    return generation.reference_asset_ids.map((id, index) => ({ id, alias: `img${index + 1}` }))
  }
  return []
}

const downloadFile = (url) => {
  if (!url) return
  window.open(url, '_blank')
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className={`engine-toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span />
      {label && <b>{label}</b>}
    </button>
  )
}

"""

with open('src/pages/client/MintAI.jsx', 'w', encoding='utf-8') as f:
    f.write(content[:start_idx] + new_block + content[end_idx:])
