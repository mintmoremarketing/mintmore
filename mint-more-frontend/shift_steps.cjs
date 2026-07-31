const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

// 1. Extract the blocks
const s8Start = code.indexOf('          {/* STEP 8: Connect Channels */}');
const s9Start = code.indexOf('          {/* STEP 9: WhatsApp & Reminders */}');
const s10Start = code.indexOf('          {/* STEP 10: Approval Rules */}');
const s11Start = code.indexOf('          {/* STEP 11: Content Plan Generation */}');

if (s8Start === -1 || s9Start === -1 || s10Start === -1 || s11Start === -1) {
    console.log("Could not find step markers");
    process.exit(1);
}

let block8 = code.substring(s8Start, s9Start);
let block9 = code.substring(s9Start, s10Start);
let block10 = code.substring(s10Start, s11Start);

// Change {step === X} in the blocks
block8 = block8.replace(/step === 8/g, 'step === 9').replace(/STEP 8/g, 'STEP 9');
block9 = block9.replace(/step === 9/g, 'step === 10').replace(/STEP 9/g, 'STEP 10');
block10 = block10.replace(/step === 10/g, 'step === 8').replace(/STEP 10/g, 'STEP 8');

// The new order will be block10 (new 8), block8 (new 9), block9 (new 10)
const newBlocks = block10 + block8 + block9;

// Replace the old blocks in the code
code = code.substring(0, s8Start) + newBlocks + code.substring(s11Start);

// 2. Update the Sidebar Array
const oldSidebar = `            { 
              step: 6, 
              label: 'Content & Occasions',
              subSteps: [
                { step: 6, label: 'Content Cadence' },
                { step: 7, label: 'Festivals & Occasions' }
              ]
            },
            { 
              step: 8, 
              label: 'Connected Channels',
              subSteps: [
                { step: 8, label: 'Connect Channels' },
                { step: 9, label: 'WhatsApp & Reminders' },
                { step: 10, label: 'Approval Rules' }
              ]
            },`;

const newSidebar = `            { 
              step: 6, 
              label: 'Content & Occasions',
              subSteps: [
                { step: 6, label: 'Content Cadence' },
                { step: 7, label: 'Festivals & Occasions' },
                { step: 8, label: 'Approval Rules' }
              ]
            },
            { 
              step: 9, 
              label: 'Connected Channels',
              subSteps: [
                { step: 9, label: 'Connect Channels' },
                { step: 10, label: 'WhatsApp & Reminders' }
              ]
            },`;

code = code.replace(oldSidebar, newSidebar);

fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
console.log('Shifted steps successfully');

