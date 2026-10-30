import Icon from '../../components/ui/Icon'

// Courses shown in Creatyv Academy. Add entries here as courses go live:
// { id, title, summary, price (0 = Free), duration, cover, href }
// Stats (students, rating) are left out until there is real enrolment data behind them.
const COURSES = []

function CourseCard({ course }) {
	return (
		<article className="flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white">
			<div className="aspect-video bg-ink-100">
				{course.cover && <img src={course.cover} alt="" className="h-full w-full object-cover" loading="lazy" />}
			</div>
			<div className="flex flex-1 flex-col p-4">
				<h3 className="font-semibold leading-snug text-ink-900">{course.title}</h3>
				<p className="mt-1 line-clamp-2 text-sm text-ink-500">{course.summary}</p>
				<div className="mt-4 flex items-end justify-between">
					<span className="text-lg font-semibold text-ink-900">{course.price ? `₹${course.price}` : 'Free'}</span>
					{course.duration && <span className="text-right text-sm text-ink-500"><span className="block font-medium text-ink-900">{course.duration}</span>Duration</span>}
				</div>
				<a href={course.href} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-ink-900 text-sm font-semibold text-white hover:bg-ink-700">Enroll Now</a>
			</div>
		</article>
	)
}

/** Creatyv Academy: courses that help freelancers level up. */
export default function Upskill() {
	return (
		<div className="mx-auto w-full max-w-[1400px] px-4 py-8 font-store md:px-8 md:py-10">
			<header className="rounded-3xl bg-ink-900 px-6 py-10 text-white md:px-10">
				<h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Learn the skills clients book</h1>
				<p className="mt-2 max-w-xl text-[15px] text-white/70">Short, practical courses on editing, design and getting clients — built for freelancers on Creatyv.</p>
			</header>

			<h2 className="mt-10 text-xl font-semibold text-ink-900">Featured courses</h2>
			{COURSES.length ? (
				<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{COURSES.map(course => <CourseCard key={course.id} course={course} />)}
				</div>
			) : (
				<div className="mt-4 flex items-center gap-4 rounded-2xl bg-ink-50 px-5 py-5">
					<span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-ink-500"><Icon name="video" size={20} /></span>
					<div className="min-w-0">
					<p className="font-medium text-ink-900">Courses are on the way</p>
					<p className="mt-0.5 text-sm text-ink-600">We're putting together the first Creatyv courses. They'll show up here as soon as they're live.</p>
					</div>
				</div>
			)}
		</div>
	)
}
