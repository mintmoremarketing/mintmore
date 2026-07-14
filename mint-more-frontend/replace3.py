import re

with open('src/pages/admin/Audit.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the flex row with grid
content = content.replace(
'''            <div key={log.id} className={`p-6 md:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start justify-between ${index !== 0 ? 'border-t border-ink-100' : ''} hover:bg-ink-50/30 transition-colors`}>
              
              <div className="flex flex-col gap-1.5 w-full lg:w-[25%] shrink-0">''',
'''            <div key={log.id} className={`p-6 md:p-8 grid grid-cols-1 lg:grid-cols-[2fr_1.5fr_2.5fr_1fr] gap-6 lg:gap-8 items-start ${index !== 0 ? 'border-t border-ink-100' : ''} hover:bg-ink-50/30 transition-colors`}>
              
              <div className="flex flex-col gap-1.5">'''
)

# Remove fixed widths from the other columns
content = content.replace(
'''              <div className="flex flex-col gap-1 w-full lg:w-[20%] shrink-0">''',
'''              <div className="flex flex-col gap-1">'''
)

content = content.replace(
'''              <div className="flex flex-col gap-2 w-full lg:w-[35%] shrink-0">''',
'''              <div className="flex flex-col gap-2 min-w-0">'''
)

content = content.replace(
'''              <div className="flex flex-row lg:flex-col justify-between lg:justify-start items-center lg:items-end w-full lg:w-[15%] shrink-0 gap-1 lg:text-right mt-2 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-ink-100">''',
'''              <div className="flex flex-row lg:flex-col justify-between lg:justify-start items-center lg:items-end gap-1 lg:text-right mt-2 lg:mt-0 pt-4 lg:pt-0 border-t lg:border-t-0 border-ink-100">'''
)

with open('src/pages/admin/Audit.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
