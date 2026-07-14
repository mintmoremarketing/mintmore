import sys

with open('src/pages/client/MintAI.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const downloadFile = (url"
start_idx = content.find(start_marker)

end_marker = "function Toggle({ checked, onChange, label }) {"
end_idx = content.find(end_marker)

new_block = """const downloadFile = async (url, name = 'creatyv-image') => {
  if (!url) return
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('Failed to download image', error)
    window.open(url, '_blank')
  }
}

"""

with open('src/pages/client/MintAI.jsx', 'w', encoding='utf-8') as f:
    f.write(content[:start_idx] + new_block + content[end_idx:])
