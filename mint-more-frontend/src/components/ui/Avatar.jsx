// Letters only, so names like "Aarav (Demo Editor)" give "AD", not "A(".
function initialsOf(name) {
  const words = String(name || '').match(/\p{L}[\p{L}'-]*/gu) || []
  return (words.slice(0, 2).map(word => word[0]).join('') || 'U').toUpperCase()
}

export default function Avatar({ name, src, size = 'md' }) {
  const cls = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar'
  return (
    <div className={cls} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initialsOf(name)}
    </div>
  )
}
