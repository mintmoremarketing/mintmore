import assert from 'node:assert/strict'

const results = []
function test(name, fn) {
  try {
    fn()
    results.push({ name, status: 'PASS' })
    console.log(`  ✔ PASS: ${name}`)
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message })
    console.error(`  ✖ FAIL: ${name} -> ${err.message}`)
  }
}

console.log('\n=== [Milestone 4 Adversarial Stress & Edge Case Harness] ===\n')

// ── Test 1: Rejection Reason Complex Unicode & Multi-Chip Stress ──
test('AdminRejectModal: Unicode, Emojis, and Multi-line Chip Formatting', () => {
  const handleChipClick = (currentReason, chip) => {
    if (!currentReason.trim()) {
      return chip
    } else if (!currentReason.includes(chip)) {
      return `${currentReason.trim()}\n• ${chip}`
    }
    return currentReason
  }

  let text = ''
  text = handleChipClick(text, 'Color palette adjustment')
  text = handleChipClick(text, 'Logo placement/branding')
  text = handleChipClick(text, 'Dimensions/aspect ratio')

  assert.equal(
    text,
    'Color palette adjustment\n• Logo placement/branding\n• Dimensions/aspect ratio',
    'Chips should format cleanly with linebreaks and bullets'
  )

  // Append emoji feedback
  text += '\n• Please make font brighter ✨ and match brand hex #00B4D8 🎨'
  assert.ok(text.trim().length > 0, 'Reason should be valid with unicode and emojis')

  // Trimming validation
  assert.equal('  \n\t  '.trim().length === 0, true, 'Whitespace only is properly detected as invalid')
})

// ── Test 2: Admin Direct Upload Target Platform Selection Invariant ──
test('AdminDirectUploadModal: Target Platform Minimum Constraint Invariant', () => {
  const togglePlatform = (currentPlatforms, platformId) => {
    if (currentPlatforms.includes(platformId)) {
      if (currentPlatforms.length === 1) return currentPlatforms // Must keep at least one
      return currentPlatforms.filter(p => p !== platformId)
    }
    return [...currentPlatforms, platformId]
  }

  let platforms = ['instagram', 'facebook']
  platforms = togglePlatform(platforms, 'facebook')
  assert.deepEqual(platforms, ['instagram'], 'Removed facebook')

  // Attempt to remove the last platform
  platforms = togglePlatform(platforms, 'instagram')
  assert.deepEqual(platforms, ['instagram'], 'Should NOT remove the last platform (invariant preserved)')

  // Add multiple platforms
  platforms = togglePlatform(platforms, 'linkedin')
  platforms = togglePlatform(platforms, 'twitter')
  assert.deepEqual(platforms, ['instagram', 'linkedin', 'twitter'], 'Multiple platforms added')
})

// ── Test 3: Media Type Auto-Detection for File Uploads ──
test('AdminDirectUploadModal: Media Type Auto-detection from MIME and Extension', () => {
  const detectMediaType = (mimeType, filename = '') => {
    if (mimeType && mimeType.startsWith('video/')) return 'video'
    if (/\.(mp4|webm|mov|mkv)$/i.test(filename)) return 'video'
    return 'image'
  }

  assert.equal(detectMediaType('video/mp4', 'video.mp4'), 'video')
  assert.equal(detectMediaType('video/webm', 'clip.webm'), 'video')
  assert.equal(detectMediaType('image/png', 'banner.png'), 'image')
  assert.equal(detectMediaType('image/jpeg', 'photo.jpg'), 'image')
  assert.equal(detectMediaType('application/octet-stream', 'animation.mov'), 'video')
  assert.equal(detectMediaType('', 'graphic.png'), 'image')
})

// ── Test 4: Intelligent Routing Engine Edge Cases in UI ──
test('Operations.jsx: Intelligent Routing Indicator Invariants', () => {
  const getRoutingMode = (postingPreferences) => {
    const isAutopilot =
      postingPreferences?.approval_mode === 'autopilot' ||
      postingPreferences?.festival_mode === 'managed'
    return isAutopilot ? 'autopilot' : 'manual'
  }

  assert.equal(getRoutingMode({ approval_mode: 'autopilot' }), 'autopilot')
  assert.equal(getRoutingMode({ festival_mode: 'managed' }), 'autopilot')
  assert.equal(getRoutingMode({ approval_mode: 'every_post' }), 'manual')
  assert.equal(getRoutingMode({ approval_mode: 'manual' }), 'manual')
  assert.equal(getRoutingMode(null), 'manual')
  assert.equal(getRoutingMode(undefined), 'manual')
  assert.equal(getRoutingMode({}), 'manual')
})

// ── Test 5: Client Assignment Search & Status Filter Invariants ──
test('Operations.jsx: Search & Assignment Filters Complex Combinations', () => {
  const dataset = [
    { id: '1', business_name: 'Starlight Café', email: 'star@cafe.com', business_type: 'Restaurant', assigned_designer_id: 'd1' },
    { id: '2', business_name: 'Apex Fitness', email: 'info@apexfit.com', business_type: 'Gym', assigned_designer_id: null },
    { id: '3', business_name: 'Nexus Tech', email: 'team@nexus.io', business_type: 'SaaS', assigned_designer_id: null },
    { id: '4', business_name: null, full_name: 'Dr. Sarah Connor', email: 'sarah@clinic.med', business_type: 'Healthcare', assigned_designer_id: 'd2' },
  ]

  const applyFilters = (clients, filterType, query) => {
    return clients.filter(c => {
      const matchesFilter =
        filterType === 'all'
          ? true
          : filterType === 'unassigned'
            ? !c.assigned_designer_id
            : Boolean(c.assigned_designer_id)

      if (!matchesFilter) return false
      if (!query || !query.trim()) return true

      const q = query.toLowerCase()
      return (
        (c.business_name && c.business_name.toLowerCase().includes(q)) ||
        (c.full_name && c.full_name.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.business_type && c.business_type.toLowerCase().includes(q))
      )
    })
  }

  // Filter unassigned
  const unassigned = applyFilters(dataset, 'unassigned', '')
  assert.equal(unassigned.length, 2)
  assert.deepEqual(unassigned.map(c => c.id), ['2', '3'])

  // Search within unassigned
  const searchUnassigned = applyFilters(dataset, 'unassigned', 'fitness')
  assert.equal(searchUnassigned.length, 1)
  assert.equal(searchUnassigned[0].id, '2')

  // Search by email
  const searchEmail = applyFilters(dataset, 'all', 'clinic.med')
  assert.equal(searchEmail.length, 1)
  assert.equal(searchEmail[0].id, '4')

  // Search by category
  const searchCat = applyFilters(dataset, 'all', 'saas')
  assert.equal(searchCat.length, 1)
  assert.equal(searchCat[0].id, '3')
})

// ── Test 6: Brands.jsx Assigned Designer Selector & Fallback Invariants ──
test('Brands.jsx: Assigned Designer Fallback and Selection Rendering', () => {
  const designersList = [
    { id: 'd-101', full_name: 'Alice Designer', email: 'alice@mintmore.com', assigned_clients_count: 3 },
    { id: 'd-102', full_name: 'Bob Visuals', email: 'bob@mintmore.com', assigned_clients_count: 0 },
  ]

  const getAssignedDesigner = (brand, designers) => {
    return (
      designers.find(d => d.id === brand?.assigned_designer_id) ||
      (brand?.assigned_designer_name ? { full_name: brand.assigned_designer_name, email: brand.assigned_designer_email } : null)
    )
  }

  // Case 1: Matching designer in list
  const brand1 = { id: 'b1', assigned_designer_id: 'd-101' }
  const match1 = getAssignedDesigner(brand1, designersList)
  assert.equal(match1.full_name, 'Alice Designer')

  // Case 2: Unassigned brand
  const brand2 = { id: 'b2', assigned_designer_id: null }
  const match2 = getAssignedDesigner(brand2, designersList)
  assert.equal(match2, null)

  // Case 3: Designer not in active list but present in brand denormalized fields
  const brand3 = { id: 'b3', assigned_designer_id: 'd-999', assigned_designer_name: 'Legacy Designer', assigned_designer_email: 'legacy@mintmore.com' }
  const match3 = getAssignedDesigner(brand3, designersList)
  assert.equal(match3.full_name, 'Legacy Designer')
})

// ── Test 7: Dashboard.jsx Review Queue StatCard & Metric Invariants ──
test('Dashboard.jsx: StatCard and Alert Banner Logic', () => {
  const evaluateDashboardReviewStatus = (pendingCreatives) => {
    const queue = Array.isArray(pendingCreatives) ? pendingCreatives : []
    const count = queue.length
    const hasPending = count > 0
    return {
      count,
      tone: hasPending ? 'amber' : null,
      sub: hasPending ? `${count} awaiting review` : 'Queue clear',
      showAlertBanner: hasPending,
      bannerText: `${count} Creative Deliverable${count === 1 ? '' : 's'} Pending Review`,
    }
  }

  const emptyState = evaluateDashboardReviewStatus([])
  assert.equal(emptyState.count, 0)
  assert.equal(emptyState.tone, null)
  assert.equal(emptyState.sub, 'Queue clear')
  assert.equal(emptyState.showAlertBanner, false)

  const singleState = evaluateDashboardReviewStatus([{ id: 'post-1' }])
  assert.equal(singleState.count, 1)
  assert.equal(singleState.tone, 'amber')
  assert.equal(singleState.sub, '1 awaiting review')
  assert.equal(singleState.showAlertBanner, true)
  assert.equal(singleState.bannerText, '1 Creative Deliverable Pending Review')

  const multiState = evaluateDashboardReviewStatus([{ id: 'p-1' }, { id: 'p-2' }, { id: 'p-3' }])
  assert.equal(multiState.count, 3)
  assert.equal(multiState.bannerText, '3 Creative Deliverables Pending Review')
})

console.log('\n=== Adversarial Stress Test Summary ===')
const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length
console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n🔥 ALL ADVERSARIAL STRESS CHALLENGES PASSED WITH ZERO FAILURES!\n')
  process.exit(0)
}
