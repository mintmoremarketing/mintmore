export const navItems = ['Platform', 'How it works', 'Features', 'Stories']

export const proofBrands = ['Local stores', 'D2C brands', 'Restaurants', 'Coaches', 'Studios', 'Retailers']

export const workflow = [
  ['01', 'See the month clearly', 'Your dashboard opens with a calendar of upcoming creative opportunities and work already in progress.'],
  ['02', 'Pick what you need', 'Choose festival posts, sale creatives, campaign assets, or send a custom request in minutes.'],
  ['03', 'Review every delivery', 'Drafts, comments, revisions, and final files stay organised inside the right Mintbox folder.'],
  ['04', 'Publish from one place', 'Connect social accounts, generate captions with Mint AI, and send approved work to your channels.'],
]

export const tabFeatures = [
  {
    id: 'calendar',
    label: 'Calendar',
    tone: 'pink',
    title: 'Know what content is coming before the month starts.',
    body: 'CREATYV turns festivals, offers, launches, and business moments into a clear monthly plan your team can approve.',
    points: ['Monthly creative calendar', 'Today and upcoming view', 'Status for every creative'],
  },
  {
    id: 'requests',
    label: 'Requests',
    tone: 'peach',
    title: 'Send custom design requests without messy back-and-forth.',
    body: 'Brief flyers, reel covers, menus, banners, product creatives, or campaign assets from one guided flow.',
    points: ['Guided request builder', 'Reference uploads', 'Internal review before production'],
  },
  {
    id: 'mintbox',
    label: 'Mintbox',
    tone: 'violet',
    title: 'Every brief, draft, revision, and final file stays organised.',
    body: 'Mintbox gives every business 10GB storage with automatic project folders and clean sharing links.',
    points: ['10GB included', 'Automated folders', 'Shareable project links'],
  },
  {
    id: 'publish',
    label: 'Publish',
    tone: 'green',
    title: 'Approve work and post it directly to connected channels.',
    body: 'Connect Instagram, Facebook, and YouTube so approved content can move from delivery to posting faster.',
    points: ['Facebook pages', 'Instagram accounts', 'YouTube publishing'],
  },
]

export const workflowSlides = [
  {
    id: 'plan',
    tone: 'pink',
    label: 'Plan',
    title: 'Stay in control',
    body: 'Keep your monthly content plan, custom requests, status updates, and approvals in one home.',
    cta: 'Explore calendar',
    mockTitle: 'June creative plan',
    mockRows: ['Father’s Day post', 'Yoga Day creative', 'Weekend sale story'],
  },
  {
    id: 'track',
    tone: 'peach',
    label: 'Track',
    title: 'Track every creative',
    body: 'See what is queued, in progress, delivered, or waiting for review without asking your team for updates.',
    cta: 'Explore requests',
    mockTitle: 'Campaign overview',
    mockRows: ['3 in production', '2 delivered', '1 needs review'],
  },
  {
    id: 'store',
    tone: 'violet',
    label: 'Store',
    title: 'Keep files together',
    body: 'Briefs, references, drafts, revisions, and final files stay inside the right Mintbox project folder.',
    cta: 'Explore Mintbox',
    mockTitle: 'Mintbox folders',
    mockRows: ['References', 'Drafts', 'Final delivery'],
  },
]

export const valueCards = [
  ['Calendar planning', 'See today, tomorrow, and the whole month in one clean view.'],
  ['Custom creatives', 'Request social posts, flyers, covers, menus, banners, and campaign assets.'],
  ['Mintbox storage', 'Keep 10GB of files, references, drafts, and final deliveries in one place.'],
  ['Direct posting', 'Connect Instagram, Facebook, and YouTube and publish after approval.'],
  ['Mint AI', 'Generate ideas, captions, scripts, and brief directions without leaving the workflow.'],
  ['Status clarity', 'Track queued, in progress, delivered, revision, and completed work instantly.'],
]

export const integrations = [
  ['Instagram', 'Plan and publish visual content for your audience.'],
  ['Facebook', 'Connect pages and keep local customers updated.'],
  ['YouTube', 'Organise video assets and publish when ready.'],
]

export const stories = [
  ['Local cafe', 'Kept festive posts, weekly offers, and story creatives planned from the calendar instead of WhatsApp notes.', 'Owner, Dhanbad cafe'],
  ['D2C store', 'Stored product references, campaign drafts, revisions, and final files in Mintbox folders.', 'Founder, handmade brand'],
  ['Restaurant', 'Requested menus, event posts, and offer creatives from one place, then approved work for posting.', 'Manager, family restaurant'],
  ['Coaching centre', 'Turned admission dates, result posts, and reminder creatives into a simple monthly queue.', 'Operations lead'],
]

export const bentoCards = [
  ['Monthly operating calendar', 'Plan recurring content moments and see active creative work without opening ten tabs.', 'large'],
  ['10GB Mintbox', 'Reference files, drafts, revisions, and final assets stay attached to each project.', ''],
  ['Mint AI help', 'Ask for campaign ideas, captions, hooks, or brief structure when your team is stuck.', ''],
  ['Custom requests', 'Send ad hoc creative needs with references, deadlines, and context.', 'wide'],
  ['Social posting', 'Move approved creatives into connected Instagram, Facebook, and YouTube workflows.', ''],
]

export const rollingCards = [
  ['Find every monthly moment', 'See festivals, offers, launches, and business occasions before the month starts.', 'orange'],
  ['Keep every collaboration organised', 'Requests, files, comments, and approvals stay attached from start to finish.', 'purple'],
  ['Review, store, and publish', 'Approved work lands in Mintbox and can move into your connected social channels.', 'sand'],
  ["It's time to upgrade to CREATYV", 'Try the creative operating system for your monthly content workflow.', 'cta'],
]

export const featureTiles = [
  ['Calendar', 'Know what needs to be created today, tomorrow, and later this month.'],
  ['Custom requests', 'Ask for flyers, reel covers, menu designs, product creatives, banners, and more.'],
  ['Mintbox', 'Store every file in one searchable content database with shareable project folders.'],
  ['Social posting', 'Connect platforms and publish approved content without downloading and re-uploading files.'],
  ['Mint AI', 'Generate campaign ideas, captions, scripts, and quick content directions inside the same workspace.'],
  ['Setup support', 'Keep account, brand, social connections, and business preferences organised in settings.'],
]

export const quickQuestions = [
  'Who is CREATYV for?',
  'How do MintCoins work?',
  'Can I request custom designs?',
  'Contact the team',
]

export const localAnswer = question => {
  const text = String(question || '').toLowerCase()
  if (text.includes('contact') || text.includes('team') || text.includes('call') || text.includes('phone') || text.includes('email')) return 'You can contact the Mint More team at agency@mintmoremarketing.com or call 8092282114. They can help you choose the right creative plan.'
  if (text.includes('freelancer') || text.includes('creator')) return 'Your work is managed through Mint More, so you get one clear place for planning, requests, files, review, and delivery.'
  if (text.includes('coin') || text.includes('credit')) return 'MintCoins are simple creative credits. You use them to pick monthly calendar creatives or selected design requests.'
  if (text.includes('custom') || text.includes('design') || text.includes('request')) return 'Yes. You can request social posts, offer creatives, reel covers, stories, flyers, menus, banners, and more. The team reviews the scope and guides the next step.'
  if (text.includes('mintbox') || text.includes('file') || text.includes('revision')) return 'Mintbox keeps your brief files, drafts, revisions, and final creatives in one organised project space.'
  if (text.includes('price') || text.includes('pricing') || text.includes('cost')) return 'Mint More can recommend the right plan based on how much content your business needs each month.'
  return 'CREATYV helps your business plan monthly creatives, request custom designs, review work, and keep everything in one place.'
}
