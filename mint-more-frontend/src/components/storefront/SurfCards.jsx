import { useEffect, useRef, useState } from 'react'
import photos from './surfPhotos.json'

// Surf mode from the Lookback archive (kolkata-brand-news Gallery.tsx), retold for the store hero:
// tall cards stand almost edge-on along a rising wave, drift on their own, bob gently, speed up
// as the page scrolls, and swing open to face you on hover.
const damp = (from, to, dt, lambda) => from + (to - from) * (1 - Math.exp(-lambda * dt))
const wrap = (value, size) => ((value % size) + size) % size

// The same photographs as Surf mode in the Lookback archive, exported at 420px wide with their real
// sizes (surfPhotos.json), so every card keeps its own shape instead of one fixed height.

const clips = photos

export default function SurfCards() {
	const root = useRef(null)
	const cards = useRef([])
	const hovered = useRef(null)
	const hoverAmount = useRef([])
	const [ready, setReady] = useState(false)

	useEffect(() => {
		const element = root.current
		if (!element || !clips.length) return undefined
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		let geometry = { width: 1440, height: 420, card: 192, stride: 80, mobile: false }
		const measure = () => {
			const width = element.clientWidth
			const mobile = width <= 760
			geometry = {
				width,
				height: element.clientHeight,
				mobile,
				// Same proportions as the archive: narrow cards on a dense step.
				card: mobile ? width * 0.24 : width * 0.085,
				stride: mobile ? width / 7 : width / 20,
			}
		}
		measure()
		const resizeObserver = new ResizeObserver(measure)
		resizeObserver.observe(element)

		let position = 0
		let boost = 0
		let lastScroll = window.scrollY
		const onScroll = () => {
			boost += Math.abs(window.scrollY - lastScroll) * 0.9
			lastScroll = window.scrollY
		}
		window.addEventListener('scroll', onScroll, { passive: true })

		let frame = 0
		let last = performance.now()
		let visible = true
		const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
		io.observe(element)

		const render = (now) => {
			const dt = Math.min((now - last) / 1000, 0.05)
			last = now
			if (visible) {
				const g = geometry
				const speed = reduced ? 0 : 26 + boost
				boost = damp(boost, 0, dt, 2.5)
				position += speed * dt
				const total = clips.length * g.stride
				cards.current.forEach((card, index) => {
					if (!card) return
					const x = wrap(index * g.stride - position + g.stride, total) - g.stride
					const height = Math.min(g.card * clips[index].height / Math.max(clips[index].width, 1), g.mobile ? 190 : 300)
					const progress = Math.max(0, Math.min(1, x / Math.max(g.width, 1)))
					const eased = progress * progress * (3 - 2 * progress)
					const idle = reduced ? 0 : Math.sin(now * 0.00115 + index * 0.72) * (g.mobile ? 3.5 : 5.5) + Math.sin(now * 0.00047 + index * 1.31) * 1.8
					// The wave enters high on the right, cuts down through the pitch and settles flat along the
					// bottom left, the way the archive's Surf mode runs.
					const top = g.height * (g.mobile ? 0.12 : 0.1)
					const bottom = g.height * (g.mobile ? 0.82 : 0.78)
					const y = bottom - (bottom - top) * eased - height / 2 + idle
					const isHover = hovered.current === index
					const hover = hoverAmount.current[index] = reduced ? (isHover ? 1 : 0) : damp(hoverAmount.current[index] || 0, isHover ? 1 : 0, dt, 9)
					const edge = -84 + Math.min(14, progress * 25)
					const rotate = edge + (-42 - edge) * hover
					card.style.width = `${g.card}px`
					card.style.height = `${height}px`
					card.style.transform = `translate3d(${x}px, ${y - height * 0.12 * hover}px, 0) perspective(1000px) rotateY(${rotate}deg) rotateZ(${-6 * hover}deg)`
					card.style.zIndex = isHover ? '100' : String(index + 1)
					const onScreen = x > -g.card * 1.5 && x < g.width + g.card
					card.style.visibility = onScreen ? 'visible' : 'hidden'
				})
			}
			frame = requestAnimationFrame(render)
		}
		frame = requestAnimationFrame(render)
		setReady(true)
		return () => {
			cancelAnimationFrame(frame)
			resizeObserver.disconnect()
			io.disconnect()
			window.removeEventListener('scroll', onScroll)
		}
	}, [])

	if (!clips.length) return null
	return (
		<div ref={root} className={`surf-cards${ready ? ' is-ready' : ''}`} aria-hidden="true">
			{clips.map((clip, index) => (
				<div
					key={clip.src}
					ref={element => { cards.current[index] = element }}
					className="surf-card"
					onPointerEnter={event => { if (event.pointerType === 'mouse') hovered.current = index }}
					onPointerLeave={() => { if (hovered.current === index) hovered.current = null }}
				>
					<img src={clip.src} alt="" width={clip.width} height={clip.height} loading={index < 12 ? 'eager' : 'lazy'} draggable="false" />
				</div>
			))}
		</div>
	)
}
