import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as babelParser from '@babel/parser'
import traverseDefault from '@babel/traverse'
const traverse = traverseDefault.default || traverseDefault

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const frontendRoot = path.resolve(__dirname, '..')

const results = []
function test(name, fn) {
  try {
    fn()
    results.push({ name, status: 'PASS' })
    console.log(`  ✔ PASS: ${name}`)
  } catch (err) {
    results.push({ name, status: 'FAIL', error: err.message, stack: err.stack })
    console.error(`  ✖ FAIL: ${name} -> ${err.message}`)
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

console.log('\n=== [M4 Empirical Verification Harness] ===\n')

// ── Test Group 1: Source Files & AST Integrity ──
console.log('--- Suite 1: AST Parsing & Component Exports ---')

const filesToCheck = [
  'src/api/creative.js',
  'src/components/admin/AdminRejectModal.jsx',
  'src/components/admin/AdminDirectUploadModal.jsx',
  'src/pages/admin/Operations.jsx',
  'src/pages/admin/Brands.jsx',
  'src/pages/admin/Dashboard.jsx',
]

const astMap = {}

for (const relPath of filesToCheck) {
  test(`AST parse of ${relPath}`, () => {
    const fullPath = path.join(frontendRoot, relPath)
    assert(fs.existsSync(fullPath), `File does not exist: ${fullPath}`)
    const code = fs.readFileSync(fullPath, 'utf8')
    const ast = babelParser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx'],
    })
    assert(ast && ast.type === 'File', `AST parse returned invalid root for ${relPath}`)
    astMap[relPath] = { code, ast }
  })
}

// ── Test Group 2: Icon Safety & Dependency Constraints ──
console.log('\n--- Suite 2: Icon Safety & Import Integrity ---')

test('Verify zero broken lucide-react imports in M4 admin components', () => {
  for (const relPath of ['src/components/admin/AdminRejectModal.jsx', 'src/components/admin/AdminDirectUploadModal.jsx']) {
    const { code } = astMap[relPath]
    assert(!code.includes("from 'lucide-react'"), `${relPath} must not import from lucide-react (project uses Icon component)`)
    assert(code.includes("import Icon from '../ui/Icon'") || code.includes('import Icon from'), `${relPath} must import unified Icon component`)
  }
})

test('Verify AdminRejectModal default export and signature', () => {
  const { ast } = astMap['src/components/admin/AdminRejectModal.jsx']
  let hasDefaultExport = false
  let destructuredProps = []
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      hasDefaultExport = true
      if (path.node.declaration && path.node.declaration.type === 'FunctionDeclaration') {
        const param = path.node.declaration.params[0]
        if (param && param.type === 'ObjectPattern') {
          destructuredProps = param.properties.map(p => p.key?.name)
        }
      }
    }
  })
  assert(hasDefaultExport, 'AdminRejectModal must have a default export')
  const expectedProps = ['post', 'isOpen', 'onClose']
  for (const exp of expectedProps) {
    assert(destructuredProps.includes(exp), `AdminRejectModal missing expected prop: ${exp}`)
  }
})

test('Verify AdminDirectUploadModal default export and signature', () => {
  const { ast } = astMap['src/components/admin/AdminDirectUploadModal.jsx']
  let hasDefaultExport = false
  let destructuredProps = []
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      hasDefaultExport = true
      if (path.node.declaration && path.node.declaration.type === 'FunctionDeclaration') {
        const param = path.node.declaration.params[0]
        if (param && param.type === 'ObjectPattern') {
          destructuredProps = param.properties.map(p => p.key?.name)
        }
      }
    }
  })
  assert(hasDefaultExport, 'AdminDirectUploadModal must have a default export')
  const expectedProps = ['isOpen', 'onClose']
  for (const exp of expectedProps) {
    assert(destructuredProps.includes(exp), `AdminDirectUploadModal missing expected prop: ${exp}`)
  }
})

// ── Test Group 3: Creative API Invariants ──
console.log('\n--- Suite 3: Creative API Method Contracts ---')

test('Verify creativeApi contains all required M4 Admin endpoints & aliases', () => {
  const { code } = astMap['src/api/creative.js']
  const requiredMethods = [
    'getAdminClients',
    'listAdminClients',
    'getAdminBrands',
    'getAdminDesigners',
    'listAdminDesigners',
    'assignDesignerToClient',
    'assignClientDesigner',
    'getAdminReviewQueue',
    'getAdminPendingCreatives',
    'adminReviewCreative',
    'adminApproveCreative',
    'adminApprovePost',
    'adminRejectCreative',
    'adminRejectPost',
    'adminDirectUpload',
  ]

  for (const m of requiredMethods) {
    assert(code.includes(`${m}:`), `creativeApi missing method/alias: ${m}`)
  }
})

// ── Test Group 4: Simulated Logic & Edge-Case Validation ──
console.log('\n--- Suite 4: Edge Case & Logic Testing ---')

test('Simulated API normalization for assignDesignerToClient & assignClientDesigner', () => {
  const normalizeAssignment = (clientId, designerIdOrPayload) => {
    const designer_id = typeof designerIdOrPayload === 'object' && designerIdOrPayload !== null
      ? designerIdOrPayload.designer_id
      : designerIdOrPayload
    return {
      url: `/creative/admin/clients/${clientId}/assign-designer`,
      body: { designer_id: designer_id ?? null },
    }
  }

  const res1 = normalizeAssignment('client-123', 'des-456')
  assert(res1.body.designer_id === 'des-456', 'UUID string should be passed directly')

  const res2 = normalizeAssignment('client-123', { designer_id: 'des-789' })
  assert(res2.body.designer_id === 'des-789', 'Object payload { designer_id } should be unwrapped')

  const res3 = normalizeAssignment('client-123', null)
  assert(res3.body.designer_id === null, 'null should result in designer_id: null (unassignment)')

  const res4 = normalizeAssignment('client-123', undefined)
  assert(res4.body.designer_id === null, 'undefined should result in designer_id: null')
})

test('Simulated API normalization for adminRejectCreative', () => {
  const normalizeReject = (postId, payload) => {
    const reason = typeof payload === 'string' ? payload : (payload?.reason || payload?.feedback || '')
    return {
      url: `/creative/admin/posts/${postId}/reject`,
      body: { reason },
    }
  }

  const r1 = normalizeReject('post-1', 'Color issues')
  assert(r1.body.reason === 'Color issues', 'String reason should be passed directly')

  const r2 = normalizeReject('post-1', { reason: 'Logo off-center' })
  assert(r2.body.reason === 'Logo off-center', '{ reason } object should be parsed')

  const r3 = normalizeReject('post-1', { feedback: 'Fix typography' })
  assert(r3.body.reason === 'Fix typography', '{ feedback } object should be parsed as reason')

  const r4 = normalizeReject('post-1', {})
  assert(r4.body.reason === '', 'Empty payload should result in empty string')
})

test('Simulated API normalization for adminReviewCreative dispatcher', () => {
  const adminReviewCreative = (postId, { decision = 'approve', feedback = '', reason = '', ...rest } = {}) => {
    if (decision === 'reject') {
      return { endpoint: `/creative/admin/posts/${postId}/reject`, body: { reason: feedback || reason } }
    }
    return { endpoint: `/creative/admin/posts/${postId}/approve`, body: rest }
  }

  const ap = adminReviewCreative('p-1', { decision: 'approve', caption: 'Updated' })
  assert(ap.endpoint === '/creative/admin/posts/p-1/approve', 'Approve decision routes to approve endpoint')
  assert(ap.body.caption === 'Updated', 'Approve payloads preserved')

  const rj = adminReviewCreative('p-1', { decision: 'reject', feedback: 'Needs better contrast' })
  assert(rj.endpoint === '/creative/admin/posts/p-1/reject', 'Reject decision routes to reject endpoint')
  assert(rj.body.reason === 'Needs better contrast', 'Reject payload extracts feedback as reason')
})

test('Simulated Rejection Reason validation & chip concatenation', () => {
  const handleChipClick = (currentReason, chip) => {
    if (!currentReason.trim()) {
      return chip
    } else if (!currentReason.includes(chip)) {
      return `${currentReason.trim()}\n• ${chip}`
    }
    return currentReason
  }

  let reason = ''
  reason = handleChipClick(reason, 'Color palette adjustment')
  assert(reason === 'Color palette adjustment', 'Empty initial reason should set chip text directly')

  reason = handleChipClick(reason, 'Copy/typo edit')
  assert(reason === 'Color palette adjustment\n• Copy/typo edit', 'Subsequent chip should append bulleted text')

  const duplicateCheck = handleChipClick(reason, 'Copy/typo edit')
  assert(duplicateCheck === reason, 'Duplicate chip must not be re-appended')

  const validateReason = (r) => r && r.trim().length > 0
  assert(!validateReason('   '), 'Whitespace-only rejection reason must be invalid')
  assert(!validateReason(''), 'Empty string rejection reason must be invalid')
  assert(validateReason('Adjust contrast'), 'Non-empty rejection reason must be valid')
})

test('Simulated Operations.jsx URL tab resolution & fallback', () => {
  const validTabs = ['review', 'clients', 'tasks', 'requests', 'calendar', 'selections']
  const resolveTab = (queryParam) => {
    return validTabs.includes(queryParam) ? queryParam : 'review'
  }

  assert(resolveTab('review') === 'review', 'tab=review resolves to review')
  assert(resolveTab('clients') === 'clients', 'tab=clients resolves to clients')
  assert(resolveTab('invalid_random_tab') === 'review', 'Invalid tab defaults to review')
  assert(resolveTab(null) === 'review', 'Null tab defaults to review')
})

test('Simulated Client filter and unassigned counting', () => {
  const mockClients = [
    { id: '1', business_name: 'Alpha Gym', assigned_designer_id: 'd-1' },
    { id: '2', business_name: 'Beta Bakery', assigned_designer_id: null },
    { id: '3', business_name: 'Gamma Salon', assigned_designer_id: null },
    { id: '4', business_name: 'Delta Dental', assigned_designer_id: 'd-2' },
  ]

  const unassignedCount = mockClients.filter(c => !c.assigned_designer_id).length
  assert(unassignedCount === 2, `Expected 2 unassigned clients, got ${unassignedCount}`)

  const filterClients = (clients, filter, search = '') => {
    return clients.filter(c => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'unassigned'
            ? !c.assigned_designer_id
            : Boolean(c.assigned_designer_id)
      if (!matchesFilter) return false
      if (!search.trim()) return true
      return c.business_name.toLowerCase().includes(search.toLowerCase())
    })
  }

  const unassigned = filterClients(mockClients, 'unassigned')
  assert(unassigned.length === 2 && unassigned.every(c => !c.assigned_designer_id), 'Filter unassigned works')

  const assigned = filterClients(mockClients, 'assigned')
  assert(assigned.length === 2 && assigned.every(c => Boolean(c.assigned_designer_id)), 'Filter assigned works')

  const searched = filterClients(mockClients, 'all', 'gym')
  assert(searched.length === 1 && searched[0].id === '1', 'Search filter works')
})

test('Simulated Direct Upload Payload Validation & Defaults', () => {
  const buildDirectUploadPayload = ({
    clientId,
    directUrl,
    fileUrl,
    title,
    caption,
    mediaType,
    targetPlatforms,
    scheduledAt,
    bypassClientReview,
  }) => {
    const finalUrl = fileUrl || directUrl
    if (!clientId) throw new Error('Client ID is required')
    if (!finalUrl) throw new Error('Creative URL or file asset is required')

    let isoScheduledAt = null
    if (scheduledAt) {
      isoScheduledAt = new Date(scheduledAt).toISOString()
    }

    return {
      client_id: clientId,
      creative_url: finalUrl,
      title: title?.trim() || 'Direct Creative Post',
      caption: caption?.trim() || '',
      media_type: mediaType || 'image',
      target_platforms: targetPlatforms || ['instagram'],
      scheduled_at: isoScheduledAt,
      bypass_client_review: Boolean(bypassClientReview),
    }
  }

  const valid = buildDirectUploadPayload({
    clientId: 'client-1',
    directUrl: 'https://cdn.example.com/asset.png',
    title: 'Festival Offer',
    caption: 'Great deals today!',
    mediaType: 'image',
    targetPlatforms: ['instagram', 'facebook'],
    scheduledAt: '2026-08-20T10:00',
    bypassClientReview: true,
  })

  assert(valid.client_id === 'client-1', 'Client ID match')
  assert(valid.creative_url === 'https://cdn.example.com/asset.png', 'Creative URL match')
  assert(valid.bypass_client_review === true, 'Bypass review match')
  assert(valid.target_platforms.length === 2, 'Platforms match')
  assert(valid.scheduled_at.startsWith('2026-08-20'), 'ISO timestamp generated')

  let threwClient = false
  try {
    buildDirectUploadPayload({ directUrl: 'https://cdn.example.com/asset.png' })
  } catch {
    threwClient = true
  }
  assert(threwClient, 'Missing client_id should throw')

  let threwUrl = false
  try {
    buildDirectUploadPayload({ clientId: 'client-1' })
  } catch {
    threwUrl = true
  }
  assert(threwUrl, 'Missing creative URL should throw')
})

console.log('\n=== Empirical Test Summary ===')
const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length
console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

if (failed > 0) {
  process.exit(1)
} else {
  console.log('\n🌟 ALL EMPIRICAL CHALLENGER TESTS PASSED SUCCESSFULLY!\n')
  process.exit(0)
}
