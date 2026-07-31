const fs = require('fs');
const path = require('path');

const srcCode = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');
const outDir = 'src/pages/client/onboarding-steps';
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Map of step numbers to component names
const stepNames = {
    1: 'Step1BrandWorkspace',
    2: 'Step2BusinessBasics',
    3: 'Step3BrandVoice',
    4: 'Step4BrandAssets',
    5: 'Step5BrandColors',
    6: 'Step6ContentCadence',
    7: 'Step7Festivals',
    8: 'Step8ApprovalRules',
    9: 'Step9ConnectChannels',
    10: 'Step10WhatsApp',
    11: 'Step11ContentGeneration',
    12: 'Step12CalendarReview'
};

// We will use a regex to extract the block for each step.
// Notice that the block is inside {step === X && ( ... )}
// Finding the matching closing bracket is tricky with regex, so we do it by character parsing.
let newOnboardingCode = srcCode;
const imports = [];

for (let i = 1; i <= 12; i++) {
    const marker = `{/* STEP ${i}:`;
    const startIndex = srcCode.indexOf(marker);
    if (startIndex === -1) continue;

    // Find the condition line: {step === i && (
    const conditionRegex = new RegExp(`\\{step === ${i} && \\(`);
    const conditionMatch = conditionRegex.exec(srcCode.substring(startIndex));
    if (!conditionMatch) continue;

    const blockStart = startIndex + conditionMatch.index + conditionMatch[0].length;
    
    // Find matching closing parenthesis
    let openCount = 1; // Since we already matched the opening '('
    let blockEnd = -1;
    for (let j = blockStart; j < srcCode.length; j++) {
        if (srcCode[j] === '(') openCount++;
        else if (srcCode[j] === ')') openCount--;
        
        if (openCount === 0) {
            // Found the closing bracket of {step === X && ( ... )}
            // But wait, it's actually `)}`
            if (srcCode[j+1] === '}') {
                blockEnd = j;
                break;
            }
        }
    }

    if (blockEnd === -1) {
        console.log("Could not find end of step", i);
        continue;
    }

    // Extract the JSX block
    let jsxBlock = srcCode.substring(blockStart, blockEnd).trim();

    // The block is already well formed JSX.
    const compName = stepNames[i];
    
    // Find all variables used in this block to know what to destructure from props.
    // We will just pass `props` and destructure everything they might need.
    const allPossibleProps = `
        form, updateField, setForm, 
        languages, industries, tones, ageSegments, sampleFestivals, presetPalettes,
        logoInputRef, logoFileInputRef, handleLogoUpload, handleLogoColorExtraction,
        paletteCustomized, setPaletteCustomized, handleSuggestPalette,
        onboardingEvents, toggleFestival,
        connectedAccounts, socialApi, pushToast,
        scheduledDays, setScheduledDays, expandedTopicIndex, setExpandedTopicIndex,
        selectedDayIndex, setSelectedDayIndex, swapModalOpen, setSwapModalOpen,
        swapDayIndex, setSwapDayIndex, swapTab, setSwapTab, customSwapText, setCustomSwapText
    `.replace(/\n/g, '').split(',').map(s => s.trim()).filter(Boolean);

    let compCode = `import React from 'react';
import Icon from '../../../components/ui/Icon';

export default function ${compName}(props) {
    const { 
        ${allPossibleProps.join(', ')}
    } = props;

    return (
        <>
            ${jsxBlock}
        </>
    );
}
`;

    // Write component to file
    fs.writeFileSync(path.join(outDir, `${compName}.jsx`), compCode);
    console.log(`Created ${compName}.jsx`);

    // Add import statement
    imports.push(`import ${compName} from './onboarding-steps/${compName}';`);

    // Replace the block in the main file
    // We replace `{step === i && ( ... )}` with `{step === i && <CompName {...stepProps} />}`
    const fullOriginalBlock = srcCode.substring(startIndex, blockEnd + 2); // +2 for )}
    const fullReplacement = `${marker.split(':')[0]}: ${compName} */}
          {step === ${i} && <${compName} {...stepProps} />}`;
    
    newOnboardingCode = newOnboardingCode.replace(fullOriginalBlock, fullReplacement);
}

// Add the stepProps object right before the return statement of Onboarding.jsx
const renderStart = newOnboardingCode.indexOf('return (');
if (renderStart !== -1) {
    const stepPropsCode = `
  const stepProps = {
    form, updateField, setForm,
    languages, industries, tones, ageSegments, sampleFestivals, presetPalettes,
    logoInputRef, logoFileInputRef, handleLogoUpload, handleLogoColorExtraction,
    paletteCustomized, setPaletteCustomized, handleSuggestPalette,
    onboardingEvents, toggleFestival,
    connectedAccounts, socialApi, pushToast,
    scheduledDays, setScheduledDays, expandedTopicIndex, setExpandedTopicIndex,
    selectedDayIndex, setSelectedDayIndex, swapModalOpen, setSwapModalOpen,
    swapDayIndex, setSwapDayIndex, swapTab, setSwapTab, customSwapText, setCustomSwapText
  };

  `;
    newOnboardingCode = newOnboardingCode.substring(0, renderStart) + stepPropsCode + newOnboardingCode.substring(renderStart);
}

// Add imports at the top
const importsStr = imports.join('\n') + '\n';
newOnboardingCode = importsStr + newOnboardingCode;

fs.writeFileSync('src/pages/client/Onboarding.jsx', newOnboardingCode);
console.log("Onboarding.jsx refactored.");

