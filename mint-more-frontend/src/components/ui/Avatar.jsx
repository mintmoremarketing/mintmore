export default function Avatar({ name, size = 'md' }) {
  const init = (name || 'U')
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const cls = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar'
  return <div className={cls}>{init}</div>
}