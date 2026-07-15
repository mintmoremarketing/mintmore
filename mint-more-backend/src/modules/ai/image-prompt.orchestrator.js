const PROFILE_VERSION = 'creatyv-image-director-v1';

const safeText = (value, max = 500) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);

const hasReferences = (references = []) => Array.isArray(references) && references.length > 0;

const formatReferenceAliases = (references = []) =>
  references
    .map((item) => item?.alias)
    .filter(Boolean)
    .map((alias) => `@${alias}`)
    .join(', ');

const buildBusinessContextLines = ({ businessContext = {}, projectContext = {} }) => {
  const lines = [];
  if (businessContext.business_name) lines.push(`Business: ${safeText(businessContext.business_name, 120)}`);
  if (businessContext.business_type) lines.push(`Business type: ${safeText(businessContext.business_type, 120)}`);
  if (businessContext.customer_profile) lines.push(`Customer profile: ${safeText(businessContext.customer_profile, 280)}`);
  if (projectContext.title) lines.push(`Project: ${safeText(projectContext.title, 160)}`);
  if (projectContext.description) lines.push(`Brief: ${safeText(projectContext.description, 360)}`);
  return lines;
};

const buildImageSystemPrompt = ({ model = {}, references = [], businessContext = {}, projectContext = {} } = {}) => {
  const referencePolicy = hasReferences(references)
    ? 'References are source material to preserve and improve. Keep the supplied product, person, scene, composition, and brand cues unless the user explicitly asks to replace them. Use references for editing, refinement, style transfer, or layout guidance; do not drift into an unrelated image.'
    : 'When no reference is supplied, infer a useful commercial creative from the brief and keep the result practical for a real small business.';

  const contextLines = buildBusinessContextLines({ businessContext, projectContext });

  return [
    'You are CREATYV, a senior commercial creative director and image-generation prompt architect for Indian SMBs.',
    'Your job is to turn loose client requests into high-quality, useful business creatives that can help local stores, D2C brands, restaurants, coaches, studios, retailers, and service businesses grow.',
    'Think like a professional art director: clarify the commercial objective, preserve important source material, improve composition, lighting, product focus, readability, and social-media usefulness.',
    referencePolicy,
    'Do not create generic AI art. Do not invent fake offers, fake certifications, celebrity endorsements, or misleading before/after claims. Do not change faces, products, logos, packaging, or core identity unless asked.',
    'If the prompt is vague, make a polished, brand-safe, social-ready creative with clean composition and realistic production quality.',
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
} = {}) => {
  const aliases = formatReferenceAliases(references);
  const contextLines = buildBusinessContextLines({ businessContext, projectContext });
  
  const referenceInstruction = aliases
    ? `IMPORTANT: The user supplied reference images (${aliases}). 
If the user's prompt explicitly mentions these aliases (e.g. "@img1"), integrate them exactly as requested.
If the user DOES NOT explicitly mention the aliases in their prompt, you MUST assume the core subject/product of the request IS the reference image. The prompt must strongly emphasize preserving the exact identity, branding, and details of the reference image, making it the focal point of the generated image.`
    : 'No reference image was supplied; create a highly detailed original visual from the text brief.';

  return {
    system: [
      'You are CREATYV, a master prompt engineer for state-of-the-art AI image generators (like Midjourney v6, OpenRouter, and Pollinations).',
      'Rewrite user requests into ONE highly detailed, professional, Midjourney-style image prompt.',
      'You MUST ALWAYS output a highly detailed prompt of at least 40-50 words.',
      'Return plain text only. No markdown, no bullet lists, no preamble, no explanation, no self-talk.',
      'Start directly with the final prompt text.',
      'Structure the prompt professionally: [Main Subject/Action], [Environment/Background], [Lighting/Atmosphere], [Camera/Lens details], [Art Style/Medium].',
      'Use rich, descriptive keywords (e.g., cinematic lighting, 8k resolution, shallow depth of field, photorealistic, intricate details).',
      'Make sure the prompt is EXTREMELY detailed. Do NOT write simple or short prompts. If the client request is short, you must expand it with high-quality creative details.',
      'Example of a good prompt format: "A professional T-shirt mockup featuring a local Indian taxi driver in Kolkata, wearing a crisp white shirt, standing confidently beside his vibrant yellow Ambassador taxi in front of an old heritage building, golden hour sunlight, sharp focus, 85mm lens, photorealistic, ultra-detailed --ar 4:5".',
      'If aspect ratio or styling parameters are provided, append them at the very end of the prompt (e.g., --ar 4:5 --v 6.0).',
    ].join(' '),
    user: [
      `Client request: ${safeText(rawPrompt, 900)}`,
      referenceInstruction,
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
} = {}) => {
  const aliases = formatReferenceAliases(references);
  const basePrompt = safeText(enhancedPrompt || rawPrompt, 1400);
  const contextLines = buildBusinessContextLines({ businessContext, projectContext });
  const referencePolicy = aliases
    ? 'preserve_source_reference'
    : 'new_business_creative';

  const promptSections = [
    'CREATYV creative brief:',
    `Client request: ${safeText(rawPrompt, 900)}`,
    enhancedPrompt ? `Refined direction: ${basePrompt}` : `Direction: ${basePrompt}`,
    styleModifier ? `Style preset: ${safeText(styleModifier, 420)}` : '',
    aliases
      ? `Reference handling: Use ${aliases} as source material. Preserve the main subject, product, person, scene, composition, logo/packaging cues, and client intent unless the prompt explicitly asks to change them. Make the requested transformation while keeping the image recognisably connected to the reference.`
      : 'Reference handling: No source image is provided. Create a polished, practical commercial visual from the brief.',
    contextLines.length ? `Client context: ${contextLines.join(' | ')}` : '',
    `Output format: ${aspectRatio || 'Auto'} composition, ${resolutionTier || '1K'} quality target.`,
    'Quality bar: premium commercial creative, realistic detail, clean lighting, balanced composition, sharp subject focus, useful for social media or business promotion.',
    'Avoid: unrelated subjects, random text artifacts, fake claims, watermarks, distorted logos, changed faces/products unless requested, clutter, low-quality AI look.',
  ].filter(Boolean);

  return {
    systemPrompt: buildImageSystemPrompt({ model, references, businessContext, projectContext }),
    providerPrompt: promptSections.join('\n'),
    referencePolicy,
    profileVersion: PROFILE_VERSION,
  };
};

module.exports = {
  PROFILE_VERSION,
  buildEnhancementMessages,
  buildImageSystemPrompt,
  composeImagePrompt,
  normalizeEnhancedPrompt,
};
