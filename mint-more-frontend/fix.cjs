const fs = require('fs');
let code = fs.readFileSync('src/pages/client/Onboarding.jsx', 'utf8');

code = code.replace(
  "const [customSwapText, setCustomSwapText] = useState('')",
  "const [customSwapText, setCustomSwapText] = useState('')\n  const [paletteCustomized, setPaletteCustomized] = useState(false)"
);

code = code.replace(
  /updateField\('palette', nextPalette\)/g,
  "{ setPaletteCustomized(true); updateField('palette', nextPalette); }"
);

code = code.replace(
  /updateField\('palette', newPalette\)/g,
  "{ setPaletteCustomized(true); updateField('palette', newPalette); }"
);

code = code.replace(
  /updateField\('palette', paletteToUse\.slice\(0, currentLen\)\)/g,
  "setPaletteCustomized(true);\n    updateField('palette', paletteToUse.slice(0, currentLen))"
);

const oldExtraction = `  const handleLogoColorExtraction = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    pushToast({ title: 'Extracting brand colors from logo...', icon: 'sparkles' })
    const palette = await extractPaletteFromImage(file)
    const currentLen = form.palette.length > 0 ? form.palette.length : 4
    const slicedPalette = palette.slice(0, currentLen)
    updateField('palette', slicedPalette)

    // Instantly patch the database with the extracted colors
    try {
      const dbPalette = slicedPalette.map((hex, index) => ({
        hex,
        label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || \`Color \${index + 1}\`
      }))
      await api.patch('/profile/me', { brand_assets: { ...profile.brand_assets, palette: dbPalette } })
    } catch (_) {}

    uploadAssetMutation.mutate({ file, kind: 'logo', palette: slicedPalette })
  }`;

const newExtraction = `  const handleLogoColorExtraction = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    let slicedPalette = null;
    if (!paletteCustomized) {
      pushToast({ title: 'Extracting brand colors from logo...', icon: 'sparkles' })
      const palette = await extractPaletteFromImage(file)
      const currentLen = form.palette.length > 0 ? form.palette.length : 4
      slicedPalette = palette.slice(0, currentLen)
      setForm(prev => ({ ...prev, palette: slicedPalette }))
      
      try {
        const dbPalette = slicedPalette.map((hex, index) => ({
          hex,
          label: ['Primary', 'Secondary', 'Accent', 'Neutral'][index] || \`Color \${index + 1}\`
        }))
        await api.patch('/profile/me', { brand_assets: { ...profile.brand_assets, palette: dbPalette } })
      } catch (_) {}
    } else {
      pushToast({ title: 'Logo uploaded (palette unchanged)', icon: 'check' })
    }

    uploadAssetMutation.mutate({ file, kind: 'logo', palette: slicedPalette || form.palette })
  }`;

code = code.replace(oldExtraction, newExtraction);
fs.writeFileSync('src/pages/client/Onboarding.jsx', code);
console.log('Fixed handleLogoColorExtraction');
