export default function Avatar({ name, initials, size = 'md' }) {
	const init = initials || (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('')
	const cls = size === 'lg' ? 'avatar lg' : size === 'sm' ? 'avatar sm' : 'avatar'
	return <div className={cls}>{init}</div>
}
