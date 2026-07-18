const PROFILE_VERSION = 'creatyv-image-director-v2';

const INDIAN_LOCATION_POOLS = {
  food: ['Mumbai', 'Kolkata', 'Goa', 'Delhi', 'Bengaluru', 'Jaipur', 'Pune', 'Kochi'],
  fashion: ['Surat', 'Delhi', 'Mumbai', 'Jaipur', 'Ahmedabad', 'Bengaluru', 'Hyderabad'],
  beauty: ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Pune', 'Kolkata'],
  fitness: ['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai'],
  education: ['Kota', 'Delhi', 'Hyderabad', 'Bengaluru', 'Pune', 'Lucknow'],
  hospitality: ['Goa', 'Udaipur', 'Manali', 'Kochi', 'Jaipur', 'Mysuru'],
  retail: ['Delhi', 'Mumbai', 'Surat', 'Jaipur', 'Ahmedabad', 'Bengaluru'],
  services: ['Mumbai', 'Delhi', 'Pune', 'Bengaluru', 'Hyderabad', 'Kolkata'],
  default: ['Mumbai', 'Delhi', 'Bengaluru', 'Kolkata', 'Jaipur', 'Goa'],
};

const VERTICAL_PROFILES = [
  {
    key: 'food',
    label: 'cafe, restaurant, dhaba, bakery, cloud kitchen, or food brand',
    keywords: ['cafe', 'restaurant', 'dhaba', 'bakery', 'cloud kitchen', 'food', 'menu', 'chai', 'coffee', 'pizza', 'biryani', 'dessert'],
    locationPool: 'food',
    sceneHint: 'authentic Indian cafe or restaurant interiors, plated food, steam, warm lights, menu boards, tableware, and real local details',
    overlayHint: 'Reserve a clean lower-third or bottom strip for the dish name, price, offer, or CTA text.',
    moodHint: 'warm, appetizing, inviting, and social-media friendly',
  },
  {
    key: 'fashion',
    label: 'fashion, clothing, boutique, ethnic wear, or jewelry',
    keywords: ['fashion', 'clothing', 'boutique', 'apparel', 'ethnic wear', 'saree', 'kurti', 'lehenga', 'jewelry', 'jewellery', 'streetwear'],
    locationPool: 'fashion',
    sceneHint: 'stylish Indian boutique or street-market setting with premium fabric texture, fitting-room details, and elegant product focus',
    overlayHint: 'Leave a clean caption-safe zone for sale copy, collection name, or a price badge.',
    moodHint: 'polished, confident, premium, and aspirational',
  },
  {
    key: 'beauty',
    label: 'salon, spa, skincare, hair, or beauty brand',
    keywords: ['salon', 'spa', 'beauty', 'skincare', 'hair', 'makeup', 'cosmetic', 'cosmetics', 'barber', 'nail'],
    locationPool: 'beauty',
    sceneHint: 'clean modern salon, spa, or skincare studio with soft lighting, polished mirrors, and a premium service vibe',
    overlayHint: 'Reserve space for a headline, offer, or appointment CTA in the lower third.',
    moodHint: 'clean, premium, calm, and trust-building',
  },
  {
    key: 'fitness',
    label: 'gym, fitness studio, yoga, or sports brand',
    keywords: ['gym', 'fitness', 'yoga', 'pilates', 'training', 'trainer', 'workout', 'sports', 'athletic'],
    locationPool: 'fitness',
    sceneHint: 'modern Indian gym or fitness studio with active people, strong lighting, motion energy, and a high-contrast brand-safe look',
    overlayHint: 'Keep the lower third uncluttered for campaign copy, results, or membership CTA text.',
    moodHint: 'dynamic, energetic, sharp, and motivational',
  },
  {
    key: 'education',
    label: 'coaching, tuition, school, test prep, or learning brand',
    keywords: ['coaching', 'tuition', 'school', 'college', 'academy', 'education', 'learn', 'course', 'exam', 'test prep', 'study'],
    locationPool: 'education',
    sceneHint: 'focused Indian classroom, study room, or coaching-centre environment with notebooks, whiteboards, and clear academic energy',
    overlayHint: 'Leave a readable text zone for results, fee, batch timing, or admissions copy.',
    moodHint: 'credible, focused, encouraging, and structured',
  },
  {
    key: 'hospitality',
    label: 'hotel, resort, homestay, travel, or destination brand',
    keywords: ['hotel', 'resort', 'homestay', 'travel', 'tour', 'trip', 'destination', 'stay', 'villa', 'cottage'],
    locationPool: 'hospitality',
    sceneHint: 'beautiful Indian hospitality setting with scenic lighting, local textures, and a welcoming travel-lifestyle feel',
    overlayHint: 'Reserve a clean lower-third for booking CTA, package name, or seasonal offer text.',
    moodHint: 'welcoming, scenic, premium, and conversion-oriented',
  },
  {
    key: 'retail',
    label: 'local store, supermarket, electronics, furniture, or retail brand',
    keywords: ['store', 'shop', 'retail', 'electronics', 'furniture', 'appliance', 'mart', 'market', 'showroom', 'shopfront'],
    locationPool: 'retail',
    sceneHint: 'busy Indian shopfront or showroom with real product shelves, signage, and clear merchandising detail',
    overlayHint: 'Keep a clean caption band for the offer, category, or store CTA.',
    moodHint: 'practical, trustworthy, busy, and conversion-focused',
  },
  {
    key: 'services',
    label: 'agency, consultant, clinic, studio, or service business',
    keywords: ['agency', 'consultant', 'consulting', 'clinic', 'doctor', 'dentist', 'physio', 'studio', 'service', 'services', 'interior', 'photographer'],
    locationPool: 'services',
    sceneHint: 'professional Indian service-business environment with clean branding cues, credible people, and a polished client-facing setup',
    overlayHint: 'Keep the lower third open for trust copy, credentials, call-to-action, or contact details.',
    moodHint: 'professional, credible, premium, and conversion-driven',
  },
];

const DEFAULT_PROFILE = {
  key: 'general',
  label: 'Indian SMB commercial creative',
  sceneHint: 'an authentic Indian business environment with real-world textures, practical signage, and a useful commercial feel',
  overlayHint: 'Reserve a clean, high-contrast lower-third or bottom strip if the creative needs copy, a CTA, or pricing.',
  moodHint: 'useful, credible, polished, and social-ready',
};

const safeText = (value, max = 500) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

const hasReferences = (references = []) => Array.isArray(references) && references.length > 0;

const formatReferenceAliases = (references = []) =>
  references
    .map((item) => item?.alias)
    .filter(Boolean)
    .map((alias) => `@${alias}`)
    .join(', ');

const normalizeForMatch = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9@₹%:.,\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const hashString = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash);
};

const pickDeterministic = (seedText, items = []) => {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return list[hashString(seedText) % list.length];
};

const includesAny = (text, words = []) => words.some((word) => text.includes(word));

const concatContextText = ({ rawPrompt = '', businessContext = {}, projectContext = {} }) => {
  return normalizeForMatch([
    rawPrompt,
    businessContext.business_name,
    businessContext.business_type,
    businessContext.customer_profile,
    projectContext.title,
    projectContext.description,
  ].filter(Boolean).join(' | '));
};

const buildBusinessContextLines = ({ businessContext = {}, projectContext = {} }) => {
  const lines = [];
  if (businessContext.business_name) lines.push(`Business: ${safeText(businessContext.business_name, 120)}`);
  if (businessContext.business_type) lines.push(`Business type: ${safeText(businessContext.business_type, 120)}`);
  if (businessContext.customer_profile) lines.push(`Customer profile: ${safeText(businessContext.customer_profile, 280)}`);
  if (projectContext.title) lines.push(`Project: ${safeText(projectContext.title, 160)}`);
  if (projectContext.description) lines.push(`Brief: ${safeText(projectContext.description, 360)}`);
  return lines;
};

const inferBusinessProfile = (contextText = '') => {
  const text = normalizeForMatch(contextText);
  const profile = VERTICAL_PROFILES.find((candidate) => includesAny(text, candidate.keywords));
  return profile || DEFAULT_PROFILE;
};

const inferCreativeGoal = (text = '') => {
  if (includesAny(text, ['reel', 'story', 'shorts', 'vertical video', 'instagram']) || /9:16/.test(text)) {
    return 'vertical social creative';
  }
  if (includesAny(text, ['banner', 'poster', 'flyer', 'sale', 'offer', 'discount', 'promo', 'campaign', 'ad', 'advertisement'])) {
    return 'conversion-focused ad';
  }
  if (includesAny(text, ['thumbnail', 'preview', 'cover'])) {
    return 'attention-grabbing thumbnail';
  }
  if (includesAny(text, ['menu', 'catalog', 'product shot', 'product creative'])) {
    return 'product-led commercial creative';
  }
  return 'brand creative';
};

const inferPlatform = (text = '', aspectRatio = 'Auto') => {
  const normalized = normalizeForMatch(text);
  if (includesAny(normalized, ['youtube', 'thumbnail'])) return 'YouTube';
  if (includesAny(normalized, ['reel', 'instagram story', 'story', 'insta story'])) return 'Instagram Reels/Stories';
  if (includesAny(normalized, ['facebook'])) return 'Facebook feed';
  if (includesAny(normalized, ['whatsapp'])) return 'WhatsApp status';
  if (includesAny(normalized, ['instagram', 'carousel', 'feed'])) return 'Instagram feed';
  if (aspectRatio === '9:16' || aspectRatio === '1:8' || aspectRatio === '1:4') return 'Instagram Reels/Stories';
  if (aspectRatio === '16:9' || aspectRatio === '21:9') return 'YouTube or widescreen social creative';
  if (aspectRatio === '4:5' || aspectRatio === '1:1') return 'Instagram/Facebook feed';
  return 'General social media creative';
};

const extractExplicitLocation = (text = '') => {
  const normalized = normalizeForMatch(text);
  const knownLocations = [
    'mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore', 'kolkata', 'chennai',
    'hyderabad', 'pune', 'ahmedabad', 'surat', 'jaipur', 'lucknow', 'kanpur',
    'indore', 'bhopal', 'nagpur', 'kochi', 'coimbatore', 'madurai', 'goa', 'udaipur',
    'jodhpur', 'srinagar', 'manali', 'shimla', 'agra', 'amritsar', 'london', 'dubai',
    'singapore', 'paris', 'new york', 'tokyo', 'kozhikode', 'mysuru', 'vadodara',
  ];
  const hit = knownLocations.find((location) => normalized.includes(location));
  if (hit) return hit;

  const phraseMatch = normalized.match(/\b(?:in|at|from|near|around|for|inside|outside)\s+([a-z][a-z\s-]{2,30}?)(?=\b(?:with|using|featuring|featuring|where|that|which|and|,|\.|!|\?|$))/i);
  if (phraseMatch?.[1]) {
    return safeText(phraseMatch[1], 60);
  }
  return null;
};

const inferCaptionStrategy = (text = '', goal = '') => {
  const normalized = normalizeForMatch(text);
  const commercialSignals = includesAny(normalized, [
    'ad', 'advertisement', 'poster', 'flyer', 'banner', 'sale', 'offer', 'discount', 'promo',
    'campaign', 'cta', 'call to action', 'headline', 'caption', 'price', 'pricing', 'launch',
    'reel', 'story', 'instagram', 'facebook', 'thumbnail',
  ]);

  if (!commercialSignals && goal === 'brand creative') {
    return {
      mode: 'none',
      instruction: 'Keep the composition natural and uncluttered unless the user explicitly asks for text overlay.',
    };
  }

  return {
    mode: 'bottom_overlay',
    instruction: 'Reserve a clean lower-third or bottom strip for headline, offer, price, or CTA text. Make it readable on mobile and high contrast against the background.',
  };
};

const detectLogoLikeRequest = (rawPrompt = '', references = []) => {
  const promptText = normalizeForMatch(rawPrompt);
  const logoSignals = [
    'logo',
    'logo reveal',
    'logo animation',
    'animate logo',
    'animate this logo',
    'wordmark',
    'brandmark',
    'brand mark',
    'emblem',
    'icon',
    'mark',
  ];

  if (includesAny(promptText, logoSignals)) return true;

  return Array.isArray(references)
    && references.some((reference) => {
      const referenceText = normalizeForMatch([
        reference?.alias,
        reference?.name,
        reference?.filename,
        reference?.file_name,
        reference?.storage_path,
      ].filter(Boolean).join(' '));
      return includesAny(referenceText, logoSignals);
    });
};

const buildReferenceInstruction = (references = [], intent = {}) => {
  const aliases = formatReferenceAliases(references);
  if (!aliases) {
    return 'No reference image was supplied; create a polished original commercial visual from the brief.';
  }

  const preserve = [
    'IMPORTANT: The user supplied reference images.',
    `Reference aliases: ${aliases}.`,
    'Treat them as source material for composition, identity, product shape, brand cues, or style transfer.',
    'If the prompt explicitly names an alias (for example, "@img1"), follow that instruction exactly.',
    'If the prompt does not name an alias, preserve the core subject/product/person and improve the creative around it rather than replacing it.',
    'Do not drift into an unrelated scene.',
  ];

  if (intent?.is_logo_like) {
    preserve.push('This is a logo-first request: keep the supplied logo exact in shape, spacing, proportions, and color palette. Do not redesign or reinterpret the mark.');
    preserve.push('Use motion only as a subtle reveal, glow, sweep, rotation, or polish around the original logo, not as a replacement for the logo itself.');
  }

  if (intent?.captionStrategy?.mode === 'bottom_overlay') {
    preserve.push('Keep a clear text-safe zone for any headline, offer, or CTA copy requested by the user.');
  }

  return preserve.join(' ');
};

const buildIndianSMBIntent = ({
  rawPrompt = '',
  businessContext = {},
  projectContext = {},
  aspectRatio = 'Auto',
  resolutionTier = '1K',
  references = [],
} = {}) => {
  const contextText = concatContextText({ rawPrompt, businessContext, projectContext });
  const profile = inferBusinessProfile(contextText);
  const isLogoLike = detectLogoLikeRequest(rawPrompt, references);

  if (isLogoLike) {
    const directiveLines = [
      'Logo motion direction: animate the supplied logo as the hero asset.',
      'Motion direction: use only subtle premium motion such as a gentle reveal, glow sweep, scale-in, shimmer, or rotation; keep the original mark intact.',
      'Background direction: keep the background clean, minimal, or black unless the user explicitly asks for a different environment.',
      'Negative guidance: do not invent scenery, people, props, extra symbols, or a new emblem around the logo.',
      `Output target: ${resolutionTier || '1K'} quality, ready for social posting.`,
    ];

    return {
      business_vertical_key: profile.key,
      business_vertical: 'logo / brand reveal',
      location: null,
      location_source: 'logo',
      prompt_goal: 'logo motion / brand reveal',
      platform: 'brand animation',
      is_logo_like: true,
      caption_strategy: 'none',
      caption_instruction: 'Keep the composition focused on the supplied logo. Do not add copy, callouts, or unrelated scene dressing unless the user explicitly asks for them.',
      seasonal_hint: 'Ignore seasonal cues unless the user explicitly asks for them.',
      style_hint: 'Use a clean logo-motion aesthetic: minimal, precise, premium, and faithful to the original mark.',
      directive_lines: directiveLines,
      directive_text: directiveLines.join('\n'),
    };
  }

  const explicitLocation = extractExplicitLocation(rawPrompt) || extractExplicitLocation(projectContext?.description || '');
  const locationPool = INDIAN_LOCATION_POOLS[profile.key] || INDIAN_LOCATION_POOLS.default;
  const inferredLocation = explicitLocation || pickDeterministic(contextText || rawPrompt || profile.key, locationPool);
  const goal = isLogoLike ? 'logo motion / brand reveal' : inferCreativeGoal(contextText);
  const platform = isLogoLike ? 'brand animation' : inferPlatform(contextText, aspectRatio);
  const captionStrategy = isLogoLike ? {
    mode: 'none',
    instruction: 'Keep the composition focused on the supplied logo. Do not add copy, callouts, or unrelated scene dressing unless the user explicitly asks for them.',
  } : inferCaptionStrategy(contextText, goal);
  const hasBusinessContext = Boolean(
    businessContext?.business_name ||
    businessContext?.business_type ||
    businessContext?.customer_profile ||
    projectContext?.title ||
    projectContext?.description
  );
  if (captionStrategy.mode === 'none' && hasBusinessContext) {
    captionStrategy.mode = 'bottom_overlay';
    captionStrategy.instruction = 'Reserve a subtle lower-third or bottom-safe zone for optional headline, CTA, pricing, or campaign copy if needed.';
  }
  const seasonalHint = includesAny(contextText, ['diwali', 'holi', 'eid', 'navratri', 'onam', 'christmas', 'new year', 'monsoon', 'summer', 'winter'])
    ? 'Respect the seasonal theme already mentioned in the brief.'
    : 'If the brief is vague, keep the creative season-neutral unless the business context suggests a festival or campaign.';
  const styleHint = isLogoLike
    ? 'Use a clean logo-motion aesthetic: minimal, precise, premium, and faithful to the original mark.'
    : includesAny(contextText, ['premium', 'luxury', 'elegant', 'modern', 'minimal', 'bold', 'festive', 'warm', 'playful', 'cinematic'])
    ? 'Use the mood already implied by the brief, but keep it commercially useful.'
    : `Use a ${profile.moodHint}.`;

  const directiveLines = [
    `Indian SMB creative direction: Build a ${goal} for ${profile.label}.`,
    `Suggested setting: Use an authentic ${inferredLocation} context or another clearly Indian setting that fits the brand.`,
    `Scene guidance: ${profile.sceneHint}.`,
    `Platform direction: Aim for ${platform}.`,
    `Layout direction: ${captionStrategy.instruction}`,
    `Mood direction: ${styleHint}`,
    seasonalHint,
    'Optimization: Make the creative feel native to India, not like a generic Western stock-photo ad. Use real textures, storefront cues, local lifestyle details, and believable commercial composition.',
    'Optimization: Prioritize a strong hero subject, clean framing, mobile-friendly readability, and high contrast where text or CTA is likely to sit.',
    isLogoLike
      ? 'Logo guidance: Preserve the supplied logo exactly and do not invent a new emblem, mascot, object, or scene around it.'
      : references.length
      ? 'Reference guidance: Preserve the supplied reference identity and composition unless the user explicitly asks for a transformation.'
      : 'Reference guidance: If no reference is present, invent a specific but believable SMB commercial scene rather than a vague abstract one.',
    'Negative guidance: avoid fake logos, random extra objects, distorted text, low-resolution AI mush, over-glossy luxury stock imagery, and irrelevant non-Indian props.',
    `Output target: ${resolutionTier || '1K'} quality, ready for social posting.`,
  ];

  return {
    business_vertical_key: profile.key,
    business_vertical: profile.label,
    location: inferredLocation,
    location_source: explicitLocation ? 'explicit' : 'inferred',
    prompt_goal: goal,
    platform,
    is_logo_like: isLogoLike,
    caption_strategy: captionStrategy.mode,
    caption_instruction: captionStrategy.instruction,
    seasonal_hint: seasonalHint,
    style_hint: styleHint,
    directive_lines: directiveLines.filter(Boolean),
    directive_text: directiveLines.filter(Boolean).join('\n'),
  };
};

const parseImagePromptIntent = (options = {}) => {
  const intent = buildIndianSMBIntent(options);
  const rawPrompt = safeText(options.rawPrompt, 900);
  const normalizedPrompt = normalizeForMatch(rawPrompt);
  const aspectRatio = options.aspectRatio || 'Auto';
  const resolutionTier = options.resolutionTier || '1K';
  const hasTextSignals = includesAny(normalizedPrompt, ['headline', 'caption', 'copy', 'offer', 'price', 'cta', 'text overlay', 'banner', 'poster']);
  const hasReferenceSignals = hasReferences(options.references);

  return {
    raw_prompt: rawPrompt,
    normalized_prompt: normalizedPrompt,
    profile_version: PROFILE_VERSION,
    aspect_ratio: aspectRatio,
    resolution_tier: resolutionTier,
    prompt_goal: intent.prompt_goal,
    business_vertical: intent.business_vertical,
    business_vertical_key: intent.business_vertical_key,
    location: intent.location,
    location_source: intent.location_source,
    platform: intent.platform,
    is_logo_like: intent.is_logo_like,
    caption_strategy: intent.caption_strategy,
    caption_instruction: intent.caption_instruction,
    caption_safe_zone: intent.caption_strategy !== 'none',
    mood_hint: intent.style_hint,
    uses_text_overlay: hasTextSignals || intent.caption_strategy === 'bottom_overlay',
    references_present: hasReferenceSignals,
    reference_aliases: hasReferenceSignals ? formatReferenceAliases(options.references) : '',
    intent_summary: buildIntentSummary(intent),
    directive_text: intent.directive_text,
    directive_lines: intent.directive_lines,
  };
};

const buildIntentSummary = (intent = {}) => {
  const lines = [
    `Vertical: ${intent.business_vertical || 'general Indian SMB creative'}`,
    `Goal: ${intent.prompt_goal || 'brand creative'}`,
    `Location: ${intent.location || (intent.is_logo_like ? 'not applicable' : 'Indian market context')}`,
    `Platform: ${intent.platform || 'General social media creative'}`,
    `Caption zone: ${intent.caption_strategy || 'none'}`,
  ];
  return lines.join(' | ');
};

const buildImageSystemPrompt = ({
  model = {},
  references = [],
  businessContext = {},
  projectContext = {},
  intent = {},
} = {}) => {
  const referencePolicy = hasReferences(references)
    ? 'References are source material to preserve and improve. Keep the supplied product, person, scene, composition, and brand cues unless the user explicitly asks to replace them. Use references for editing, refinement, style transfer, or layout guidance; do not drift into an unrelated image.'
    : 'When no reference is supplied, infer a useful commercial creative from the brief and keep the result practical for a real small business.';

  const contextLines = buildBusinessContextLines({ businessContext, projectContext });
  const intentLines = Array.isArray(intent?.directive_lines) ? intent.directive_lines : [];

  return [
    'You are CREATYV, a senior commercial creative director and image-generation prompt architect for Indian SMBs.',
    'Your job is to turn loose client requests into high-quality, useful business creatives that can help local stores, D2C brands, restaurants, coaches, studios, retailers, and service businesses grow.',
    'Think like a professional art director: clarify the commercial objective, preserve important source material, improve composition, lighting, product focus, readability, and social-media usefulness.',
    'Always reason from the user brief first, then from the inferred SMB context, then from any references.',
    'If the request is commercial, make it feel like a real ad or social post, not generic AI art.',
    'Prefer authentic Indian business environments, Indian lifestyle cues, realistic signage, and practical social-media framing.',
    'If the prompt implies copy, offer, pricing, or a CTA, reserve a clean lower-third / bottom overlay zone for it.',
    'Do not create generic AI art. Do not invent fake offers, fake certifications, celebrity endorsements, or misleading before/after claims. Do not change faces, products, logos, packaging, or core identity unless asked.',
    'Avoid generic Western luxury stock photography unless the brief explicitly asks for that look.',
    'If the prompt is vague, make a polished, brand-safe, social-ready creative with clean composition and realistic production quality.',
    intent?.is_logo_like ? 'This is a logo-first request: preserve the supplied logo exactly, do not redesign the mark, and do not invent unrelated scenery or story elements around it.' : '',
    intent?.is_logo_like ? 'If motion is requested later, only animate around the logo very subtly; keep the logo identity, geometry, spacing, and color palette intact.' : '',
    intentLines.length ? `Inferred creative direction:\n${intentLines.join('\n')}` : '',
    model?.name ? `Selected model: ${safeText(model.name, 100)}.` : '',
    contextLines.length ? `Known client context: ${contextLines.join(' | ')}` : '',
  ].filter(Boolean).join('\n');
};

const buildEnhancementMessages = ({
  rawPrompt,
  styleModifier,
  references = [],
  businessContext = {},
  projectContext = {},
  aspectRatio,
  resolutionTier,
  promptIntent = {},
} = {}) => {
  const aliases = formatReferenceAliases(references);
  const contextLines = buildBusinessContextLines({ businessContext, projectContext });
  const referenceInstruction = buildReferenceInstruction(references, promptIntent);
  const intentLines = Array.isArray(promptIntent?.directive_lines) ? promptIntent.directive_lines : [];

  return {
    system: [
      'You are CREATYV, a master prompt engineer for commercial AI image generators.',
      'Rewrite user requests into ONE highly detailed, professional image prompt for a real business use case.',
      'You MUST ALWAYS output a highly detailed prompt of at least 40-50 words.',
      'Return plain text only. No markdown, no bullet lists, no preamble, no explanation, no self-talk.',
      'Start directly with the final prompt text.',
      'Structure the prompt professionally: [Main Subject/Action], [Environment/Background], [Lighting/Atmosphere], [Camera/Lens details], [Art Style/Medium].',
    'Use rich, descriptive keywords that fit a real ad or social creative.',
    'If the brief is commercial, optimize for clarity, mobile readability, and a professional marketing result.',
    'When the brief asks for text, heading, offer, or CTA placement, make room for a lower-third or bottom overlay zone instead of crowding the hero subject.',
    promptIntent?.is_logo_like ? 'If the request is for a logo or brand mark, keep the prompt literal and precise: preserve the supplied logo exactly and avoid adding new scene elements, people, props, or decorative story layers.' : '',
    'If references are present, preserve the identity and source material unless the user explicitly asks to replace it.',
    'If the prompt is vague, expand it into a concrete Indian SMB creative instead of generic theory.',
    'Return only the final prompt text. No commentary.',
  ].join(' '),
    user: [
      `Client request: ${safeText(rawPrompt, 900)}`,
      referenceInstruction,
      intentLines.length ? `Structured intent:\n${intentLines.join('\n')}` : '',
      styleModifier ? `Style direction: ${safeText(styleModifier, 420)}` : '',
      contextLines.length ? `Business context: ${contextLines.join(' | ')}` : '',
      aspectRatio ? `Aspect ratio: Append --ar ${aspectRatio.replace(':', ':')} to the end of the prompt.` : '',
      resolutionTier ? `Resolution constraint: Ensure high fidelity suitable for ${resolutionTier}.` : '',
      'Write the ultimate, highly detailed image generation prompt now.',
    ].filter(Boolean).join('\n'),
  };
};

const normalizeEnhancedPrompt = (text) => {
  const value = safeText(text, 1400);
  if (!value) return null;

  const quoted = [...value.matchAll(/"([^"]{40,})"/g)];
  if (quoted.length) {
    return safeText(quoted[quoted.length - 1][1], 1400);
  }

  return safeText(
    value
      .replace(/^we need to rewrite[\s\S]*?prompt\.?\s*/i, '')
      .replace(/^so we need to produce[\s\S]*?prompt\.?\s*/i, '')
      .replace(/^let's craft:\s*/i, '')
      .replace(/^probably need to describe[\s\S]*?\.?\s*/i, '')
      .trim(),
    1400
  );
};

const composeImagePrompt = ({
  rawPrompt,
  enhancedPrompt,
  styleModifier,
  references = [],
  model = {},
  businessContext = {},
  projectContext = {},
  aspectRatio,
  resolutionTier,
  promptIntent = {},
} = {}) => {
  const aliases = formatReferenceAliases(references);
  const basePrompt = safeText(enhancedPrompt || rawPrompt, 1400);
  const contextLines = buildBusinessContextLines({ businessContext, projectContext });
  const referencePolicy = aliases
    ? 'preserve_source_reference'
    : 'new_business_creative';

  const logoLike = Boolean(promptIntent?.is_logo_like);
  const promptSections = [
    'CREATYV creative brief:',
    `Client request: ${safeText(rawPrompt, 900)}`,
    promptIntent?.intent_summary ? `Structured intent: ${promptIntent.intent_summary}` : '',
    promptIntent?.directive_text ? `Indian SMB direction:\n${promptIntent.directive_text}` : '',
    enhancedPrompt ? `Refined direction: ${basePrompt}` : `Direction: ${basePrompt}`,
    styleModifier ? `Style preset: ${safeText(styleModifier, 420)}` : '',
    aliases
      ? `Reference handling: Use ${aliases} as source material. Preserve the main subject, product, person, scene, composition, logo/packaging cues, and client intent unless the prompt explicitly asks to change them. Make the requested transformation while keeping the image recognisably connected to the reference.${logoLike ? ' This is a logo-first request, so keep the mark exact, do not turn it into a scene, and only add subtle motion around it.' : ''}`
      : 'Reference handling: No source image is provided. Create a polished, practical commercial visual from the brief.',
    promptIntent?.caption_instruction ? `Caption / overlay strategy: ${promptIntent.caption_instruction}` : '',
    contextLines.length ? `Client context: ${contextLines.join(' | ')}` : '',
    `Output format: ${aspectRatio || 'Auto'} composition, ${resolutionTier || '1K'} quality target.`,
    'Quality bar: premium commercial creative, realistic detail, clean lighting, balanced composition, sharp subject focus, useful for social media or business promotion, with mobile-first readability.',
    'Avoid: unrelated subjects, random text artifacts, fake claims, watermarks, distorted logos, changed faces/products unless requested, clutter, low-quality AI look, and generic Western stock-photo styling.',
    'When the brief is commercial, keep the hero subject clear and leave enough negative space for headlines, offers, prices, or CTAs if needed.',
  ].filter(Boolean);

  return {
    systemPrompt: buildImageSystemPrompt({ model, references, businessContext, projectContext, intent: promptIntent }),
    providerPrompt: promptSections.join('\n'),
    referencePolicy,
    profileVersion: PROFILE_VERSION,
  };
};

const buildVideoEnhancementMessages = ({
  rawPrompt,
  references = [],
  businessContext = {},
  projectContext = {},
  aspectRatio,
  duration,
  startFrameAlias = null,
  endFrameAlias = null,
  promptIntent = {},
} = {}) => {
  const aliases = formatReferenceAliases(references);
  const contextLines = buildBusinessContextLines({ businessContext, projectContext });
  const logoLike = Boolean(promptIntent?.is_logo_like) || detectLogoLikeRequest(rawPrompt, references);
  const frameAnchors = [
    startFrameAlias ? `Start frame: ${startFrameAlias}` : '',
    endFrameAlias ? `End frame: ${endFrameAlias}` : '',
  ].filter(Boolean).join(' | ');

  const referenceInstruction = aliases
    ? logoLike
      ? `IMPORTANT: The user supplied a logo reference (${aliases}). Treat the supplied mark as the exact source asset. Preserve its shape, geometry, spacing, proportions, and original color palette. Do not replace it with a new symbol, do not add extra objects, and do not turn it into a scene. Add only subtle premium motion around the original logo if motion is requested.`
      : `IMPORTANT: The user supplied reference visuals (${aliases}). Treat them as the primary visual source, not just inspiration. Preserve the subject identity, product shape, brand colors, layout, and scene logic as closely as the model allows. If the user asks for motion or a new scene, build that motion around the reference rather than replacing it.`
    : 'No reference was supplied; invent a vivid, photorealistic commercial scene from the brief.';

  return {
    system: [
      'You are CREATYV-VIDEO, a master prompt engineer for state-of-the-art AI video generators (Sora, Runway Gen-3, Kling, Pika, Luma).',
      'Rewrite the client request into ONE highly detailed, cinematic video generation prompt.',
      'You MUST output at least 50 words. Return plain text only - no markdown, no bullet points, no preamble.',
      'Start directly with the final prompt text.',
      'Structure the prompt professionally: [Opening shot / Subject], [Action / Motion], [Environment / Background], [Camera Movement], [Lighting / Mood], [Visual Style / Quality tags].',
      frameAnchors ? `Frame anchors: ${frameAnchors}. Use them as the opening and closing keyframes for the motion.` : '',
      logoLike
        ? 'This is a logo-first motion request. Keep the prompt literal and precise. Preserve the supplied logo exactly and avoid storytelling scenes, people, extra props, or unrelated commercial environments.'
        : 'Use rich cinematic keywords: smooth dolly shot, slow motion, golden hour light, bokeh, 4K, hyperrealistic, seamless loop, photorealistic, UHD.',
      logoLike
        ? 'Use subtle premium motion only: clean reveal, glow sweep, gentle scale-in, polished shimmer, or soft rotation. Do not redesign the mark or replace it with an illustrated scene.'
        : 'Make the video feel premium - like a commercial or brand film. No generic, vague, or short prompts.',
      'If reference images are supplied, they must stay visually dominant and act as the anchor frame for the video generation.',
      logoLike
        ? 'If the source is a logo, keep the background minimal or black unless the prompt explicitly asks for a different environment. Preserve the original visual identity over everything else.'
        : 'Example: "Cinematic slow-motion close-up of a steaming cup of chai on a rustic wooden table in a sunlit Indian cafe, steam curling upward, warm golden-hour light streaming through a dusty window, shallow depth of field, gentle dolly-in camera move, photorealistic, 4K UHD, commercial grade --ar 16:9".',
      aspectRatio ? `Target aspect ratio: ${aspectRatio}.` : '',
    ].filter(Boolean).join(' '),
    user: [
      `Client request: ${safeText(rawPrompt, 900)}`,
      referenceInstruction,
      contextLines.length ? `Business context: ${contextLines.join(' | ')}` : '',
      frameAnchors ? `Anchors: ${frameAnchors}` : '',
      duration ? `Target duration: ${duration} seconds.` : '',
      aspectRatio ? `Aspect ratio: Append --ar ${aspectRatio.replace(':', ':')} at the end of the prompt.` : '',
      'Write the ultimate, highly detailed video generation prompt now.',
    ].filter(Boolean).join('\n'),
  };
};

module.exports = {
  PROFILE_VERSION,
  parseImagePromptIntent,
  buildEnhancementMessages,
  buildVideoEnhancementMessages,
  buildImageSystemPrompt,
  composeImagePrompt,
  normalizeEnhancedPrompt,
};
