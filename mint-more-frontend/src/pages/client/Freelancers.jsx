import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { freelancersApi } from '../../api/freelancers'
import { addonsApi } from '../../api/addons'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import { rupee } from '../../utils/format'
import { SkeletonCard } from '../../components/ui/Skeleton'

const SORT_OPTIONS = [
	{ value: 'top_rated', label: 'Top rated' },
	{ value: 'most_reviews', label: 'Most reviewed' },
	{ value: 'lowest_price', label: 'Lowest price' },
	{ value: 'newest', label: 'Newest' },
]

const LEVEL_OPTIONS = [
	{ value: '', label: 'Any level' },
	{ value: 'beginner', label: 'Beginner' },
	{ value: 'intermediate', label: 'Intermediate' },
	{ value: 'experienced', label: 'Experienced' },
]

function AddonUpsell({ navigate }) {
	const { data } = useQuery({
		queryKey: ['addon-plans'],
		queryFn: () => addonsApi.plans().then((r) => r.data.data),
	})
	const plans = data?.plans || []
	const featured = plans.find((p) => p.is_featured) || plans[0]

	return (
		<div style={{ position: 'relative' }}>
			<div style={{ filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.5 }}>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
					{Array(6)
						.fill(0)
						.map((_, i) => (
							<div
								key={i}
								style={{
									background: 'var(--paper)',
									border: '1px solid var(--hairline)',
									borderRadius: 'var(--radius-lg)',
									padding: 20,
									height: 220,
								}}
							>
								<div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
									<div
										style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--paper-tint)' }}
									/>
									<div>
										<div
											style={{
												width: 100,
												height: 12,
												background: 'var(--paper-tint)',
												borderRadius: 4,
												marginBottom: 6,
											}}
										/>
										<div
											style={{
												width: 70,
												height: 10,
												background: 'var(--paper-tint)',
												borderRadius: 4,
											}}
										/>
									</div>
								</div>
								<div
									style={{ width: '100%', height: 10, background: 'var(--paper-tint)', borderRadius: 4, marginBottom: 8 }}
								/>
								<div
									style={{ width: '80%', height: 10, background: 'var(--paper-tint)', borderRadius: 4 }}
								/>
							</div>
						))}
				</div>
			</div>

			<div
				style={{
					position: 'absolute',
					inset: 0,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					background: 'rgba(248,250,252,0.7)',
					backdropFilter: 'blur(2px)',
				}}
			>
				<div
					style={{
						background: 'var(--paper)',
						border: '1.5px solid var(--ink-950)',
						borderRadius: 'var(--radius-xl)',
						padding: '36px 40px',
						maxWidth: 440,
						width: '90%',
						textAlign: 'center',
						boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
					}}
				>
					<div
						style={{
							width: 52,
							height: 52,
							borderRadius: '50%',
							background: 'var(--paper-tint)',
							display: 'inline-flex',
							alignItems: 'center',
							justifyContent: 'center',
							marginBottom: 16,
							color: 'var(--ink-700)',
						}}
					>
						<Icon name="lock" size={22} />
					</div>
					<h2
						style={{
							fontFamily: 'var(--font-display)',
							fontSize: 22,
							fontWeight: 600,
							letterSpacing: '-0.02em',
							margin: '0 0 8px',
						}}
					>
						Unlock marketplace access
					</h2>
					<p
						style={{
							fontSize: 13.5,
							color: 'var(--ink-600)',
							lineHeight: 1.6,
							margin: '0 0 24px',
						}}
					>
						Browse 2,400+ verified Indian creatives - see portfolios, reviews,
						packages and contact them directly.
					</p>

					{featured && (
						<div
							style={{
								padding: '12px 16px',
								marginBottom: 20,
								background: 'var(--paper-tint)',
								borderRadius: 'var(--radius-md)',
								border: '1px solid var(--hairline)',
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
							}}
						>
							<div style={{ textAlign: 'left' }}>
								<div style={{ fontSize: 13, fontWeight: 500 }}>{featured.name}</div>
								<div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
									{featured.duration_days} days of browse access
								</div>
							</div>
							<div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>
								{rupee(featured.price)}
							</div>
						</div>
					)}

					<button className="btn primary block lg" onClick={() => navigate('/addons')}>
						View all plans <Icon name="arrowRight" />
					</button>

					<div
						style={{
							fontSize: 12,
							color: 'var(--ink-400)',
							marginTop: 14,
							display: 'flex',
							alignItems: 'center',
							gap: 5,
							justifyContent: 'center',
						}}
					>
						<Icon name="shield" size={11} />
						Deducted from wallet - Instant access
					</div>
				</div>
			</div>
		</div>
	)
}

function FreelancerCard({ freelancer, onClick }) {
	const preview = freelancer.portfolio_preview || []
	const skills = freelancer.skills || []

	return (
		<button
			onClick={onClick}
			style={{
				background: 'var(--paper)',
				border: '1px solid var(--hairline)',
				borderRadius: 'var(--radius-lg)',
				padding: 0,
				cursor: 'pointer',
				textAlign: 'left',
				display: 'flex',
				flexDirection: 'column',
				transition: 'all 0.15s ease',
				overflow: 'hidden',
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.borderColor = 'var(--ink-300)'
				e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'
				e.currentTarget.style.transform = 'translateY(-2px)'
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = 'var(--hairline)'
				e.currentTarget.style.boxShadow = 'none'
				e.currentTarget.style.transform = 'none'
			}}
		>
			<div
				style={{
					height: 110,
					display: 'grid',
					gridTemplateColumns: preview.length >= 3 ? '2fr 1fr' : '1fr',
					gap: 2,
					background: 'var(--paper-tint)',
				}}
			>
				{preview.length > 0 ? (
					<>
						<img src={preview[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
						{preview.length >= 3 && (
							<div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 2 }}>
								<img
									src={preview[1]}
									alt=""
									style={{ width: '100%', height: '100%', objectFit: 'cover' }}
								/>
								<img
									src={preview[2]}
									alt=""
									style={{ width: '100%', height: '100%', objectFit: 'cover' }}
								/>
							</div>
						)}
					</>
				) : (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: 'var(--ink-400)',
						}}
					>
						<Icon name="image" size={28} />
					</div>
				)}
			</div>

			<div
				style={{
					padding: 16,
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					gap: 10,
				}}
			>
				<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
					<div style={{ position: 'relative', flexShrink: 0 }}>
						<Avatar name={freelancer.full_name} />
						{freelancer.is_online && (
							<div
								style={{
									position: 'absolute',
									bottom: 0,
									right: 0,
									width: 10,
									height: 10,
									borderRadius: '50%',
									background: 'var(--mint-500)',
									border: '2px solid var(--paper)',
								}}
							/>
						)}
					</div>
					<div style={{ flex: 1, minWidth: 0 }}>
						<div
							style={{
								fontSize: 14,
								fontWeight: 600,
								color: 'var(--ink-950)',
								lineHeight: 1.3,
							}}
						>
							{freelancer.full_name}
						</div>
						{freelancer.tagline && (
							<div
								style={{
									fontSize: 12,
									color: 'var(--ink-600)',
									marginTop: 2,
									overflow: 'hidden',
									textOverflow: 'ellipsis',
									whiteSpace: 'nowrap',
								}}
							>
								{freelancer.tagline}
							</div>
						)}
					</div>
					{freelancer.freelancer_level && (
						<span
							style={{
								fontSize: 10.5,
								fontWeight: 500,
								padding: '2px 7px',
								background: 'var(--paper-tint)',
								border: '1px solid var(--hairline)',
								borderRadius: 20,
								color: 'var(--ink-600)',
								textTransform: 'capitalize',
								flexShrink: 0,
							}}
						>
							{freelancer.freelancer_level}
						</span>
					)}
				</div>

				{freelancer.review_count > 0 && (
					<div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5 }}>
						<Icon name="star" size={12} style={{ color: '#F59E0B' }} />
						<span style={{ fontWeight: 600, color: 'var(--ink-950)' }}>
							{Number(freelancer.review_avg_overall).toFixed(1)}
						</span>
						<span style={{ color: 'var(--ink-500)' }}>
							({freelancer.review_count})
						</span>
					</div>
				)}

				{skills.length > 0 && (
					<div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
						{skills.slice(0, 3).map((s) => (
							<span
								key={s}
								style={{
									fontSize: 11,
									padding: '3px 8px',
									background: 'var(--paper-tint)',
									border: '1px solid var(--hairline)',
									borderRadius: 20,
									color: 'var(--ink-700)',
								}}
							>
								{s}
							</span>
						))}
						{skills.length > 3 && (
							<span style={{ fontSize: 11, color: 'var(--ink-500)', padding: '3px 0' }}>
								+{skills.length - 3}
							</span>
						)}
					</div>
				)}

				<div style={{ flex: 1 }} />

				<div className="row between" style={{ marginTop: 4 }}>
					{freelancer.starting_price ? (
						<div>
							<div style={{ fontSize: 11, color: 'var(--ink-500)' }}>Starting from</div>
							<div
								className="mono"
								style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-950)' }}
							>
								{rupee(freelancer.starting_price)}
							</div>
						</div>
					) : (
						<div style={{ fontSize: 12, color: 'var(--ink-500)' }}>Contact for pricing</div>
					)}
					<div
						style={{
							width: 28,
							height: 28,
							borderRadius: '50%',
							background: 'var(--paper-tint)',
							color: 'var(--ink-700)',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
						}}
					>
						<Icon name="arrowRight" size={13} />
					</div>
				</div>
			</div>
		</button>
	)
}

export default function Freelancers() {
	const navigate = useNavigate()

	const { data: accessData, isLoading: accessLoading } = useQuery({
		queryKey: ['addon-check', 'browse_freelancers'],
		queryFn: () => addonsApi.check('browse_freelancers').then((r) => r.data.data),
	})

	const hasAccess = accessData?.has_access

	const [search, setSearch] = useState('')
	const [sort, setSort] = useState('top_rated')
	const [level, setLevel] = useState('')
	const [minRating, setMinRating] = useState('')
	const [minPrice, setMinPrice] = useState('')
	const [maxPrice, setMaxPrice] = useState('')
	const [page, setPage] = useState(1)
	const [showFilters, setShowFilters] = useState(false)

	const { data, isLoading } = useQuery({
		queryKey: ['freelancers', { search, sort, level, minRating, minPrice, maxPrice, page }],
		queryFn: () =>
			freelancersApi
				.browse({
					search: search || undefined,
					sort,
					level: level || undefined,
					min_rating: minRating || undefined,
					min_price: minPrice || undefined,
					max_price: maxPrice || undefined,
					page,
					limit: 12,
				})
				.then((r) => r.data.data),
		enabled: !!hasAccess,
	})

	const freelancers = data?.freelancers || []
	const pagination = data?.pagination

	useEffect(() => {
		setPage(1)
	}, [search, sort, level, minRating, minPrice, maxPrice])

	if (accessLoading) {
		return (
			<div className="stack-6">
				<div style={{ height: 40 }}>
					<div className="skeleton" style={{ width: 200, height: 16, borderRadius: 6 }} />
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
					<SkeletonCard />
					<SkeletonCard />
					<SkeletonCard />
				</div>
			</div>
		)
	}

	return (
		<div className="stack-6">
			<div className="reveal">
				<div className="h-eyebrow" style={{ marginBottom: 4 }}>
					Marketplace
				</div>
				<div className="row between" style={{ flexWrap: 'wrap', gap: 10 }}>
					<h1 className="h-display h-1" style={{ margin: 0 }}>
						Browse creatives
					</h1>
					{accessData?.days_remaining > 0 && (
						<span
							style={{
								fontSize: 12,
								color: 'var(--ink-500)',
								padding: '4px 10px',
								background: 'var(--paper-tint)',
								border: '1px solid var(--hairline)',
								borderRadius: 20,
							}}
						>
							<Icon name="clock" size={11} /> Access: {accessData.days_remaining} days left
						</span>
					)}
				</div>
			</div>

			{hasAccess && (
				<div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
					<div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
						<Icon
							name="search"
							size={14}
							style={{
								position: 'absolute',
								left: 12,
								top: '50%',
								transform: 'translateY(-50%)',
								color: 'var(--ink-400)',
								pointerEvents: 'none',
							}}
						/>
						<input
							className="input"
							style={{ paddingLeft: 34 }}
							placeholder="Search by name, skill, or specialty..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
					</div>

					<select
						className="select"
						style={{ width: 'auto', minWidth: 160 }}
						value={sort}
						onChange={(e) => setSort(e.target.value)}
					>
						{SORT_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>

					<button
						className={`btn ghost ${showFilters ? 'active' : ''}`}
						onClick={() => setShowFilters(!showFilters)}
					>
						<Icon name="filter" size={13} />
						Filters
						{(level || minRating || minPrice || maxPrice) && (
							<span className="pill" style={{ background: 'var(--ink-950)', color: 'white' }}>
								{[level, minRating, minPrice, maxPrice].filter(Boolean).length}
							</span>
						)}
					</button>
				</div>
			)}

			{hasAccess && showFilters && (
				<div className="card reveal" style={{ padding: 18 }}>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
							gap: 14,
						}}
					>
						<div className="field">
							<label className="field-label">Experience level</label>
							<select className="select" value={level} onChange={(e) => setLevel(e.target.value)}>
								{LEVEL_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>
						<div className="field">
							<label className="field-label">Min rating</label>
							<select
								className="select"
								value={minRating}
								onChange={(e) => setMinRating(e.target.value)}
							>
								<option value="">Any rating</option>
								<option value="4.5">4.5+</option>
								<option value="4.0">4.0+</option>
								<option value="3.5">3.5+</option>
							</select>
						</div>
						<div className="field">
							<label className="field-label">Min price (Rs)</label>
							<input
								className="input"
								type="number"
								value={minPrice}
								onChange={(e) => setMinPrice(e.target.value)}
								placeholder="e.g. 1000"
							/>
						</div>
						<div className="field">
							<label className="field-label">Max price (Rs)</label>
							<input
								className="input"
								type="number"
								value={maxPrice}
								onChange={(e) => setMaxPrice(e.target.value)}
								placeholder="e.g. 50000"
							/>
						</div>
					</div>
					{(level || minRating || minPrice || maxPrice) && (
						<button
							className="btn link sm"
							style={{ marginTop: 10 }}
							onClick={() => {
								setLevel('')
								setMinRating('')
								setMinPrice('')
								setMaxPrice('')
							}}
						>
							Clear filters
						</button>
					)}
				</div>
			)}

			{!hasAccess && <AddonUpsell navigate={navigate} />}

			{hasAccess && (
				<>
					{isLoading ? (
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
								gap: 14,
							}}
						>
							{Array(6)
								.fill(0)
								.map((_, i) => (
									<SkeletonCard key={i} />
								))}
						</div>
					) : freelancers.length === 0 ? (
						<div className="empty">
							<div className="empty-glyph">
								<Icon name="user" size={22} />
							</div>
							<h3>No creatives found</h3>
							<p>Try adjusting your filters or search query.</p>
							<button
								className="btn ghost"
								onClick={() => {
									setSearch('')
									setLevel('')
									setMinRating('')
									setMinPrice('')
									setMaxPrice('')
								}}
							>
								Clear all filters
							</button>
						</div>
					) : (
						<>
							<div
								style={{
									display: 'grid',
									gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
									gap: 14,
								}}
								className="reveal"
							>
								{freelancers.map((f) => (
									<FreelancerCard
										key={f.id}
										freelancer={f}
										onClick={() => navigate(`/freelancers/${f.id}`)}
									/>
								))}
							</div>

							{pagination && pagination.pages > 1 && (
								<div className="row" style={{ justifyContent: 'center', gap: 8 }}>
									<button
										className="btn ghost"
										disabled={page === 1}
										onClick={() => setPage((p) => p - 1)}
									>
										<Icon name="arrowLeft" /> Previous
									</button>
									<span
										style={{ fontSize: 13, color: 'var(--ink-500)', padding: '8px 12px' }}
									>
										Page {page} of {pagination.pages}
									</span>
									<button
										className="btn ghost"
										disabled={page === pagination.pages}
										onClick={() => setPage((p) => p + 1)}
									>
										Next <Icon name="arrowRight" />
									</button>
								</div>
							)}
						</>
					)}
				</>
			)}
		</div>
	)
}
