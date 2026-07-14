import sys

with open('src/pages/client/MintAI.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "const downloadFile = async (url"
start_idx = content.find(start_marker)
if start_idx == -1:
    start_marker = "const downloadFile = (url"
    start_idx = content.find(start_marker)

end_marker = "function Toggle({ checked, onChange, label }) {"
end_idx = content.find(end_marker)

new_block = """const downloadFile = (url, name = 'creatyv-image') => {
  if (!url) return
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
  const proxyUrl = `${BASE}/public/proxy-download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`
  
  const link = document.createElement('a')
  link.href = proxyUrl
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
}

"""

with open('src/pages/client/MintAI.jsx', 'w', encoding='utf-8') as f:
    f.write(content[:start_idx] + new_block + content[end_idx:])
