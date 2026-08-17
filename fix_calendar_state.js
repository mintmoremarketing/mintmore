const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mint-more-frontend', 'src', 'pages', 'client', 'onboarding', 'useCalendarState.js');
let content = fs.readFileSync(filePath, 'utf8');

const targetContent = `      let assignedTopic = baseTopic
      
      if (cycle > 0) {
        const distinctStories = ['Origin Story', 'Meet the Team', 'Deep Dive', 'Spotlight']
        const angle = distinctStories[topicIndex % distinctStories.length]
        assignedTopic = {
          ...baseTopic,
          id: \`\${baseTopic.id}-fallback-v\${cycle}\`,
          title: \`\${baseTopic.title.split(':')[0]} - \${angle}\`
        }
      }
      
      const defaultTimes = ['09:00', '12:00', '15:00', '18:00']
      item.topic = assignedTopic
      item.format = assignedTopic.format || 'post'
      item.status = (approvedTopicIds || []).includes(assignedTopic.id) ? 'approved' : 'draft'
      item.scheduledTime = defaultTimes[item.dayNum % defaultTimes.length]`;

const replacementContent = `      let assignedTopic = {
        id: \`brand-fallback-\${item.dateKey}\`,
        title: \`\${baseTopic} Post\`,
        description: \`Draft post about \${baseTopic}\`,
        category: 'brand',
        format: 'post'
      }
      
      if (cycle > 0) {
        const distinctStories = ['Origin Story', 'Meet the Team', 'Deep Dive', 'Spotlight']
        const angle = distinctStories[topicIndex % distinctStories.length]
        assignedTopic = {
          ...assignedTopic,
          title: \`\${baseTopic} - \${angle}\`
        }
      }
      
      const defaultTimes = ['09:00', '12:00', '15:00', '18:00']
      item.topic = assignedTopic
      item.format = assignedTopic.format || 'post'
      item.status = (approvedTopicIds || []).includes(assignedTopic.id) ? 'approved' : 'draft'
      item.scheduledTime = defaultTimes[item.dayNum % defaultTimes.length]`;

content = content.replace(targetContent, replacementContent);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed useCalendarState.js');
