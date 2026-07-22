import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import Icon from '../../components/ui/Icon'
import Avatar from '../../components/ui/Avatar'
import { SkeletonCard } from '../../components/ui/Skeleton'

const asArray = (value) => (Array.isArray(value) ? value : [])
const brandName = (brand) => brand?.business_name || brand?.full_name || brand?.email || 'Brand'
const formatShortDate = (value) => (value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—')
const formatShortDateTime = (value) => (value
  ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—')

function Section({ title, subtitle, children, icon }) {
  return (
    <div className="card reveal" style={{ padding: 20 }}>
      <div className="row between" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div className="h-eyebrow">{title}</div>
          {subtitle && <p className="muted" style={{ margin: '4px 0 0' }}>{subtitle}</p>}
        </div>
        {icon && <div className="icon-btn" style={{ pointerEvents: 'none' }}><Icon name={icon} size={15} /></div>}
      </div>
      {children}
    </div>
  )
}

function BrandTile({ brand, active, onClick }) {
  const counts = brand.counts || {}
  return (
    <button
      className={`card`}
      onClick={onClick}
      style={{
        padding: 16,
        textAlign: 'left',
        border: active ? '1px solid var(--ink-900)' : '1px solid var(--hairline)',
        boxShadow: active ? '0 16px 30px rgba(15, 23, 42, 0.08)' : undefined,
      }}
    >
      <div className="row between" style={{ gap: 12, alignItems: 'center' }}>
        <div className="row" style={{ gap: 12, minWidth: 0 }}>
          <Avatar name={brandName(brand)} src={brand.avatar_url} size="md" />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: 'var(--ink-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {brandName(brand)}
            </div>
            <div className="muted" style={{ fontSize: 12 }}>
              {brand.business_type || 'Business profile'}
            </div>
          </div>
        </div>
        <Icon name="chevronRight" size={16} className="text-ink-400" />
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
        <span className="badge neutral">Social {counts.connected_social_accounts || 0}</span>
        <span className="badge neutral">Posts {counts.published_posts || 0}</span>
        <span className="badge neutral">Mintbox {counts.mintbox_files || 0}</span>
        <span className="badge neutral">Brand folders {counts.brand_library_folders || 0}</span>
        <span className="badge neutral">Brand library {counts.brand_library_files || 0}</span>
      </div>
    </button>
  )
}

export default function AdminBrands() {
  const [selectedBrandId, setSelectedBrandId] = useState(null)

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['admin-brands'],
    queryFn: () => api.get('/admin/brands', { params: { limit: 100 } }).then((r) => r.data.data),
  })

  const brands = useMemo(() => listData?.brands || [], [listData?.brands])

  useEffect(() => {
    if (!selectedBrandId && brands.length > 0) {
      setSelectedBrandId(brands[0].id)
    }
  }, [brands, selectedBrandId])

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-brand', selectedBrandId],
    queryFn: () => api.get(`/admin/brands/${selectedBrandId}`).then((r) => r.data.data),
    enabled: Boolean(selectedBrandId),
  })

  const selectedBrand = detailData?.profile || brands.find((brand) => brand.id === selectedBrandId) || null
  const counts = detailData?.counts || selectedBrand?.counts || {}
  const brandAssets = selectedBrand?.brand_assets || {}
  const googleBusiness = selectedBrand?.google_business || {}
  const postingPreferences = selectedBrand?.posting_preferences || {}
  const palette = asArray(brandAssets.palette)
  const logos = asArray(brandAssets.logos)
  const references = asArray(brandAssets.references)
  const photos = asArray(brandAssets.photos)
  const socialAccounts = asArray(detailData?.social_accounts)
  const socialAccountRows = socialAccounts.length ? socialAccounts : asArray(detailData?.channel_history)
  const tasks = asArray(detailData?.tasks)
  const calendar = asArray(detailData?.calendar)
  const requests = asArray(detailData?.requests)
  const folders = asArray(detailData?.mintbox?.folders)
  const files = asArray(detailData?.mintbox?.files)
  const posts = asArray(detailData?.posts?.posts)
  const platformSummary = asArray(detailData?.posts?.platform_summary)
  const channelHistory = asArray(detailData?.channel_history)

  return (
    <div className="flex flex-col gap-8 md:gap-10 w-full max-w-[1680px] mx-auto p-4 md:p-8 pb-16">
      <div className="reveal">
        <div className="h-eyebrow">Admin workspace</div>
        <h1 className="h-display h-1" style={{ margin: '6px 0 0' }}>Brands</h1>
        <p className="muted" style={{ margin: '10px 0 0' }}>
          One place to see each brand’s profile, assets, calendar, publishing history, Mintbox, and internal delivery context.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 12 }}>
          <Section title="Client brands" subtitle="Click any brand to open the full workspace." icon="layers">
            {listLoading ? (
              <SkeletonCard />
            ) : brands.length === 0 ? (
              <div className="empty" style={{ padding: 20 }}>
                <div className="empty-glyph"><Icon name="layers" size={18} /></div>
                <h3>No brands yet</h3>
                <p>Brands appear here once client profiles are created.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {brands.map((brand) => (
                  <BrandTile
                    key={brand.id}
                    brand={brand}
                    active={brand.id === selectedBrandId}
                    onClick={() => setSelectedBrandId(brand.id)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {detailLoading && <SkeletonCard />}

          {!detailLoading && selectedBrand && (
            <>
              <Section
                title={brandName(selectedBrand)}
                subtitle={`${selectedBrand.business_type || 'Client brand'} • ${selectedBrand.email}`}
                icon="user"
              >
                <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <Avatar name={brandName(selectedBrand)} src={selectedBrand.avatar_url} size="xl" />
                  <div className="stack" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="badge mint">Social {counts.connected_social_accounts || 0}</span>
                      <span className="badge neutral">Published {counts.published_posts || 0}</span>
                      <span className="badge neutral">Calendar {counts.calendar_items || 0}</span>
                      <span className="badge neutral">Mintbox files {counts.mintbox_files || 0}</span>
                      <span className="badge neutral">Brand folders {counts.brand_library_folders || 0}</span>
                      <span className="badge neutral">Brand library {counts.brand_library_files || 0}</span>
                    </div>
                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="card" style={{ padding: 14 }}>
                        <div className="h-eyebrow">Business profile</div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{selectedBrand.business_name || 'Not set'}</div>
                        <div className="muted" style={{ marginTop: 4 }}>{selectedBrand.business_type || 'Business type not set'}</div>
                        <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                          {[selectedBrand.address_line1, selectedBrand.address_city, selectedBrand.address_state, selectedBrand.country].filter(Boolean).join(', ') || 'Address not added yet'}
                        </div>
                      </div>
                      <div className="card" style={{ padding: 14 }}>
                        <div className="h-eyebrow">Google Business</div>
                        <div style={{ marginTop: 8, fontWeight: 700 }}>{googleBusiness.listing_name || 'Not connected yet'}</div>
                        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>{googleBusiness.formatted_address || 'No public listing saved'}</div>
                        <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                          {googleBusiness.phone || googleBusiness.website || googleBusiness.maps_url || 'No Google Business metadata yet'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Section>

              <div className="grid-2" style={{ gap: 16 }}>
                <Section title="Brand assets" subtitle="Logo, palette, reference images, and brand files." icon="image">
                  <div className="stack" style={{ gap: 14 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      {palette.length ? palette.map((color, index) => (
                        <div key={color.id || index} className="card" style={{ padding: 10, minWidth: 120 }}>
                          <div className="row between" style={{ gap: 8 }}>
                            <div style={{
                              width: 24,
                              height: 24,
                              borderRadius: 8,
                              background: color.hex || '#000',
                              border: '1px solid rgba(15,23,42,0.1)',
                            }} />
                            <span className="mono" style={{ fontSize: 12 }}>{color.hex}</span>
                          </div>
                          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 13 }}>{color.label || `Color ${index + 1}`}</div>
                        </div>
                      )) : <div className="muted">No palette saved yet.</div>}
                    </div>
                    <div className="grid-2" style={{ gap: 12 }}>
                      <div className="card" style={{ padding: 14 }}>
                        <div className="h-eyebrow">Logos</div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                          {logos.length ? logos.map((item) => (
                            <img key={item.id} src={item.url} alt={item.label || 'Logo'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }} />
                          )) : <div className="muted">No logo uploaded.</div>}
                        </div>
                      </div>
                      <div className="card" style={{ padding: 14 }}>
                        <div className="h-eyebrow">Reference images</div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                          {references.length ? references.map((item) => (
                            <img key={item.id} src={item.url} alt={item.label || 'Reference'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }} />
                          )) : <div className="muted">No references uploaded.</div>}
                        </div>
                      </div>
                    </div>
                    <div className="card" style={{ padding: 14 }}>
                      <div className="h-eyebrow">Photos</div>
                      <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                        {photos.length ? photos.map((item) => (
                          <img key={item.id} src={item.url} alt={item.label || 'Brand photo'} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 16, border: '1px solid var(--hairline)' }} />
                        )) : <div className="muted">No brand photos saved.</div>}
                      </div>
                    </div>
                  </div>
                </Section>

                <Section title="Posting preferences" subtitle="What the client wants managed and how approvals work." icon="settings">
                  <div className="stack" style={{ gap: 10, fontSize: 13 }}>
                    {[
                      ['festival_mode', 'Festival handling'],
                      ['content_mode', 'Content handling'],
                      ['approval_mode', 'Approval mode'],
                      ['publish_mode', 'Publishing mode'],
                      ['cadence', 'Cadence'],
                    ].map(([key, label]) => (
                      <div key={key} className="row between" style={{ gap: 12 }}>
                        <span className="muted">{label}</span>
                        <strong style={{ textTransform: 'capitalize' }}>{postingPreferences[key] || 'Not set'}</strong>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>

              <Section title="Brand library" subtitle="Drive-like brand folders and reusable files from Mintbox." icon="folder">
                <div className="stack" style={{ gap: 12 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <span className="badge mint">Folders ${(detailData?.brand_library?.folders || []).length}</span>
                    <span className="badge mint">Files ${(detailData?.brand_library?.files || []).length}</span>
                  </div>
                  {(detailData?.brand_library?.folders || []).length ? (
                    <div className="grid-2" style={{ gap: 12 }}>
                      {detailData.brand_library.folders.map((folder) => (
                        <div key={folder.id} className="card" style={{ padding: 14 }}>
                          <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700 }}>{folder.name}</div>
                              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{folder.description || 'Brand folder'}</div>
                            </div>
                            <span className="badge neutral">{folder.visibility || 'private'}</span>
                          </div>
                          <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                            <span className="badge neutral">Files {folder.file_count || 0}</span>
                            <span className="badge neutral">Created {formatShortDate(folder.created_at)}</span>
                            <span className="badge neutral">Updated {formatShortDateTime(folder.updated_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">No brand library folders yet.</div>
                  )}
                  {(detailData?.brand_library?.files || []).length ? (
                    <div className="grid-2" style={{ gap: 12 }}>
                      {detailData.brand_library.files.map((file) => (
                        <div key={file.id} className="card" style={{ padding: 14 }}>
                          <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700 }}>{file.original_name || file.name}</div>
                              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{file.folder_name || 'Brand folder'}</div>
                            </div>
                            <span className="badge neutral">{file.media_type || file.mime_type || 'file'}</span>
                          </div>
                          <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                            <span className="badge neutral">Size {file.size_bytes ? Math.round(file.size_bytes / 1024) + ' KB' : '�'}</span>
                            <span className="badge neutral">Created {formatShortDate(file.created_at)}</span>
                            <span className="badge neutral">Updated {formatShortDateTime(file.updated_at)}</span>
                            {file.storage_path && <span className="badge neutral">Path {file.storage_path}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </Section>
              <div className="grid-2" style={{ gap: 16 }}>
                <Section title="Calendar & requests" subtitle="Approved content, requests, and history." icon="calendar">
                  <div className="stack" style={{ gap: 14 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="badge mint">Calendar ${calendar.length}</span>
                      <span className="badge mint">Requests ${requests.length}</span>
                      <span className="badge mint">Tasks ${tasks.length}</span>
                    </div>
                    {calendar.length ? calendar.map((item) => (
                      <div key={item.id} className="card" style={{ padding: 14 }}>
                        <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700 }}>{item.title || item.name || 'Calendar item'}</div>
                            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                              {item.category_name || item.event_type || 'Creative event'} - {item.event_date ? new Date(item.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                            </div>
                          </div>
                          <span className="badge neutral">{item.selection_status || item.status || 'planned'}</span>
                        </div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
                          <span className="badge neutral">Coin {item.coin_cost ?? 0}</span>
                          <span className="badge neutral">Status {item.publish_status || 'draft'}</span>
                          <span className="badge neutral">Channel {item.platform || item.target_platform || 'general'}</span>
                          {item.source && <span className="badge neutral">Source {item.source}</span>}
                        </div>
                        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Created</span><strong>{formatShortDateTime(item.created_at)}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Updated</span><strong>{formatShortDateTime(item.updated_at)}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Approved by</span><strong>{item.approved_by_name || item.approved_by || '�'}</strong></div>
                          {item.description && <div className="muted" style={{ fontSize: 13 }}>{item.description}</div>}
                        </div>
                      </div>
                    )) : <div className="muted">No calendar items yet.</div>}
                    {requests.length ? requests.map((item) => (
                      <div key={item.id} className="card" style={{ padding: 14 }}>
                        <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700 }}>{item.title || item.request_title || 'Request'}</div>
                            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{item.status || 'open'} - {item.job_title || item.request_type || 'No linked job'}</div>
                          </div>
                          <span className="badge neutral">{item.priority || 'normal'}</span>
                        </div>
                        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Due</span><strong>{formatShortDate(item.due_date || item.requested_for)}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Created</span><strong>{formatShortDateTime(item.created_at)}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Assigned to</span><strong>{item.assignee_name || '�'}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Channel</span><strong>{item.platform || '�'}</strong></div>
                          <div className="muted" style={{ fontSize: 13 }}>{item.description || item.notes || 'No request notes yet.'}</div>
                        </div>
                      </div>
                    )) : null}
                    {tasks.length ? tasks.map((task) => (
                      <div key={task.id} className="card" style={{ padding: 14 }}>
                        <div className="row between" style={{ gap: 12 }}>
                          <div style={{ fontWeight: 700 }}>{task.title || task.name || 'Task'}</div>
                          <span className="badge neutral">{task.status || 'open'}</span>
                        </div>
                        <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Type</span><strong>{task.task_type || '�'}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Due</span><strong>{formatShortDate(task.due_date)}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Owner</span><strong>{task.assignee_name || '�'}</strong></div>
                          <div className="row between" style={{ gap: 12 }}><span className="muted">Linked job</span><strong>{task.job_title || '�'}</strong></div>
                          <div className="muted" style={{ fontSize: 13 }}>{task.notes || task.description || 'No task details yet.'}</div>
                        </div>
                      </div>
                    )) : null}
                  </div>
                </Section>
                <Section title="Mintbox" subtitle="Folders and files linked to the brand’s jobs." icon="mintbox">
                  <div className="stack" style={{ gap: 10 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="badge mint">Folders {folders.length}</span>
                      <span className="badge mint">Files {files.length}</span>
                    </div>
                    {folders.length ? folders.slice(0, 5).map((folder) => (
                      <div key={folder.id} className="card" style={{ padding: 14 }}>
                        <div style={{ fontWeight: 700 }}>{folder.name}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{folder.job_title || 'Linked job'} • {folder.visibility || 'private'}</div>
                      </div>
                    )) : <div className="muted">No Mintbox folders linked to this brand yet.</div>}
                    {files.length ? files.slice(0, 5).map((file) => (
                      <div key={file.id} className="card" style={{ padding: 14 }}>
                        <div style={{ fontWeight: 700 }}>{file.original_name || file.name}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{file.folder_name || 'Folder'} • {file.purpose || file.media_type || 'file'}</div>
                      </div>
                    )) : null}
                  </div>
                </Section>
              </div>

              <div className="grid-2" style={{ gap: 16 }}>
                <Section title="Social accounts" subtitle="Connected channels and token health." icon="globe">
                  <div className="stack" style={{ gap: 10 }}>
                    {socialAccounts.length ? socialAccounts.map((account) => (
                      <div key={account.id} className="card" style={{ padding: 14 }}>
                        <div className="row between" style={{ gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{account.platform}</div>
                            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                              {account.page_name || account.platform_name || account.platform_username || account.platform_user_id}
                            </div>
                          </div>
                          <span className={`badge ${account.is_active ? 'mint' : 'neutral'}`}>
                            {account.token_status || 'unknown'}
                          </span>
                        </div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                          <span className="badge neutral">Expires in {account.token_days_remaining ?? 'n/a'} days</span>
                          {account.last_used_at && <span className="badge neutral">Last used {new Date(account.last_used_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                        </div>
                      </div>
                    )) : <div className="muted">No connected social accounts.</div>}
                    <div className="stack" style={{ gap: 8 }}>
                      {platformSummary.length ? platformSummary.map((item) => (
                        <div key={item.platform} className="row between" style={{ fontSize: 13 }}>
                          <span className="muted" style={{ textTransform: 'capitalize' }}>{item.platform}</span>
                          <strong>{item.published_posts} published</strong>
                        </div>
                      )) : null}
                    </div>
                  </div>
                </Section>

                <Section title="Social timeline" subtitle="One row per connected channel with recent post history." icon="activity">
                  <div className="stack" style={{ gap: 10 }}>
                    {channelHistory.length ? channelHistory.map((account) => (
                      <div key={account.social_account_id} className="card" style={{ padding: 14 }}>
                        <div className="row between" style={{ gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{account.platform}</div>
                            <div className="muted" style={{ fontSize: 13, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {account.page_name || account.platform_name || account.platform_username || account.platform_user_id || 'Connected account'}
                            </div>
                          </div>
                          <span className={`badge ${account.token_status === 'valid' ? 'mint' : 'neutral'}`}>
                            {account.token_status || 'unknown'}
                          </span>
                        </div>
                        <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
                          <span className="badge neutral">Total {account.total_posts || 0}</span>
                          <span className="badge neutral">Published {account.published_posts || 0}</span>
                          <span className="badge neutral">Failed {account.failed_posts || 0}</span>
                        </div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                          {account.latest_activity_at
                            ? `Latest activity ${new Date(account.latest_activity_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                            : 'No posts synced yet'}
                        </div>
                        {(account.latest_post_title || account.latest_post_caption || account.latest_post_url) && (
                          <div className="card" style={{ padding: 12, marginTop: 10, background: 'var(--surface-2)' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
                              {account.latest_post_title || account.latest_post_caption?.slice(0, 90) || 'Latest post'}
                            </div>
                            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                              {account.latest_post_type || 'post'}{account.latest_post_url ? ` • ${account.latest_post_url}` : ''}
                            </div>
                            <div className="row wrap" style={{ gap: 8, marginTop: 8, fontSize: 12 }}>
                              <span className="badge neutral">Views {account.latest_views_count ?? 0}</span>
                              <span className="badge neutral">Likes {account.latest_likes_count ?? 0}</span>
                              <span className="badge neutral">Comments {account.latest_comments_count ?? 0}</span>
                              <span className="badge neutral">Shares {account.latest_shares_count ?? 0}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )) : <div className="muted">No channel history synced yet.</div>}
                  </div>
                </Section>

                <Section title="Published posts" subtitle="Historical post history pulled from the social stack." icon="layers">
                  <div className="stack" style={{ gap: 10 }}>
                    {posts.length ? posts.slice(0, 6).map((post) => (
                      <div key={post.id} className="card" style={{ padding: 14 }}>
                        <div style={{ fontWeight: 700 }}>{post.title || post.caption?.slice(0, 50) || 'Published post'}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{post.content_type || 'text'} • {post.status}</div>
                        {post.preview_media_url && (
                          <img src={post.preview_media_url} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 16, marginTop: 10, border: '1px solid var(--hairline)' }} />
                        )}
                      </div>
                    )) : <div className="muted">No published social posts saved yet.</div>}
                  </div>
                </Section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
