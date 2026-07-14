import re

with open('src/pages/admin/Audit.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace filters state
content = content.replace(
'''  const [filters, setFilters] = useState({
    search: '',
    entity_type: '',
    action: '',
    date_from: '',
    date_to: '',
    sort: 'desc',
  })''',
'''  const [filters, setFilters] = useState({
    search: '',
    entity_type: '',
    action: '',
    date_from: '',
    date_to: '',
    sort: 'desc',
    page: 1,
  })
  
  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }'''
)

# Replace queryFn
content = content.replace(
'''    queryFn: () => commerceApi.audit({
      limit: 100,
      sort: filters.sort,''',
'''    queryFn: () => commerceApi.audit({
      limit: 15,
      page: filters.page,
      sort: filters.sort,'''
)

# Replace the clearing of filters
content = content.replace(
'''onClick={() => setFilters({ search: '', entity_type: '', action: '', date_from: '', date_to: '', sort: 'desc' })}''',
'''onClick={() => setFilters({ search: '', entity_type: '', action: '', date_from: '', date_to: '', sort: 'desc', page: 1 })}'''
)

# Replace onChanges
content = content.replace(
'''onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}''',
'''onChange={e => updateFilter('search', e.target.value)}'''
)
content = content.replace(
'''onChange={e => setFilters(prev => ({ ...prev, entity_type: e.target.value }))}''',
'''onChange={e => updateFilter('entity_type', e.target.value)}'''
)
content = content.replace(
'''onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}''',
'''onChange={e => updateFilter('action', e.target.value)}'''
)
content = content.replace(
'''onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}''',
'''onChange={e => updateFilter('date_from', e.target.value)}'''
)
content = content.replace(
'''onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}''',
'''onChange={e => updateFilter('date_to', e.target.value)}'''
)
content = content.replace(
'''onChange={e => setFilters(prev => ({ ...prev, sort: e.target.value }))}''',
'''onChange={e => updateFilter('sort', e.target.value)}'''
)

# Add padding to top container
content = content.replace(
'''<div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">''',
'''<div className="flex flex-col gap-8 md:gap-12 w-full max-w-[1600px] mx-auto p-6 pt-12 md:p-10 md:pt-16 animate-in fade-in slide-in-from-bottom-4 duration-500">'''
)

# Add Pagination UI
pagination_ui = '''        </div>
        
        {/* Pagination UI */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-ink-100 bg-ink-50/30">
            <div className="text-sm text-ink-500 font-medium">
              Page {filters.page} of {pagination.pages}
            </div>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1.5 rounded-lg border border-ink-200 bg-white text-ink-700 text-sm font-medium hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={filters.page <= 1}
                onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
              >
                Previous
              </button>
              <button 
                className="px-3 py-1.5 rounded-lg border border-ink-200 bg-white text-ink-700 text-sm font-medium hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={filters.page >= pagination.pages}
                onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
'''

content = content.replace('''        </div>
      </div>''', pagination_ui, 1)

with open('src/pages/admin/Audit.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
