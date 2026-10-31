/** A portfolio post's video, if it has one. media_urls holds it next to the cover image. */
export const videoOf = item => (item?.media_urls || []).find(url => /\.(mp4|mov|m4v|webm)(\?|$)/i.test(String(url).split('#')[0])) || null
