import {
	ArrowLeft,
	ArrowRight,
	ArrowUpRight,
	Bell,
	Bookmark,
	Briefcase,
	Calendar,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock,
	Coins,
	Copy,
	Download,
	Eye,
	EyeOff,
	FileText,
	Filter,
	Globe,
	Grid2X2,
	Heart,
	Home,
	Image,
	IndianRupee,
	Layers,
	List,
	Lock,
	Maximize2,
	MessageSquare,
	Mic,
	MoreHorizontal,
	Paperclip,
	Pencil,
	Plus,
	Radar,
	RefreshCw,
	Search,
	Send,
	Settings,
	Shield,
	SlidersHorizontal,
	ShoppingBag,
	Square,
	Sparkles,
	Star,
	ThumbsUp,
	Trash2,
	TrendingUp,
	Type,
	Upload,
	User,
	Video,
	Wallet,
	X,
	Zap,
} from 'lucide-react'

const ICONS = {
	briefcase: Briefcase,
	wallet: Wallet,
	coin: Coins,
	sparkles: Sparkles,
	chat: MessageSquare,
	bell: Bell,
	user: User,
	search: Search,
	plus: Plus,
	arrowRight: ArrowRight,
	arrowLeft: ArrowLeft,
	arrowUpRight: ArrowUpRight,
	check: Check,
	x: X,
	chevronDown: ChevronDown,
	chevronLeft: ChevronLeft,
	chevronRight: ChevronRight,
	upload: Upload,
	paperclip: Paperclip,
	send: Send,
	home: Home,
	settings: Settings,
	zap: Zap,
	shield: Shield,
	star: Star,
	shoppingBag: ShoppingBag,
	trending: TrendingUp,
	clock: Clock,
	eye: Eye,
	eyeOff: EyeOff,
	heart: Heart,
	globe: Globe,
	thumbsUp: ThumbsUp,
	trash: Trash2,
	edit: Pencil,
	rupee: IndianRupee,
	copy: Copy,
	file: FileText,
	refresh: RefreshCw,
	filter: Filter,
	grid: Grid2X2,
	list: List,
	sliders: SlidersHorizontal,
	bookmark: Bookmark,
	maximize: Maximize2,
	checkCircle: CheckCircle2,
	square: Square,
	calendar: Calendar,
	image: Image,
	video: Video,
	type: Type,
	layers: Layers,
	radar: Radar,
	lock: Lock,
	download: Download,
	more: MoreHorizontal,
	microphone: Mic,
}

const BRAND_PATHS = {
	facebook: 'M9 5h2V3H9a3 3 0 00-3 3v2H4v2h2v4h2v-4h2.4l.6-2H8V6c0-.6.4-1 1-1z',
	instagram: 'M4 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zM8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM12 4v.01',
	youtube: 'M2 5a2 2 0 012-2h8a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2zM7 6v4l3.5-2z',
	whatsapp: 'M2.5 13.5l1-3a5.5 5.5 0 111.5 1.5zM6 7a1 1 0 001 1l1 1a1 1 0 001 1l1-1c.3-.3.3-.7 0-1l-1-.5c-.3 0-.7 0-.9.2',
}

export default function Icon({ name, className = '', size = 14, strokeWidth = 1.8, style }) {
	const LucideIcon = ICONS[name]
	if (LucideIcon) {
		return (
			<LucideIcon
				className={className}
				size={size}
				strokeWidth={strokeWidth}
				absoluteStrokeWidth
				style={style}
			/>
		)
	}

	const d = BRAND_PATHS[name]
	if (!d) return null
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
			style={style}
		>
			<path d={d} />
		</svg>
	)
}
