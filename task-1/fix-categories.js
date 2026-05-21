const fs = require('fs');
const path = 'c:/Users/Roman.Grywusiewicz/source/repos/AI-challenge/task-1/src/data/mockLeaderboard.ts';
let content = fs.readFileSync(path, 'utf8');

// The correct focusCategories values in order of appearance (48 records)
// Some records intentionally have multiple categories per user request
const values = [
  // Zara Quill 2026 Q1
  "['Code']",
  // Zara Quill 2026 Q2
  "['Code', 'Quality']",
  // Zara Quill 2026 Q3
  "['Code', 'Quality']",
  // Orin Vale 2026 Q1
  "['Quality', 'Code']",
  // Orin Vale 2026 Q2
  "['Quality']",
  // Orin Vale 2026 Q3
  "['Quality', 'Code']",
  // Mira Solen 2026 Q1
  "['Delivery', 'Mentoring']",
  // Mira Solen 2026 Q2
  "['Delivery']",
  // Mira Solen 2026 Q3
  "['Delivery', 'Quality']",
  // Kael Arden 2026 Q1
  "['Code']",
  // Kael Arden 2026 Q2
  "['Code', 'Quality']",
  // Kael Arden 2026 Q3
  "['Code']",
  // Nyx Rowan 2026 Q1
  "['Review']",
  // Nyx Rowan 2026 Q2
  "['Review', 'Code']",
  // Nyx Rowan 2026 Q3
  "['Review', 'Code']",
  // Ivo Crest 2025 Q4
  "['Delivery']",
  // Ivo Crest 2026 Q1
  "['Delivery']",
  // Ivo Crest 2026 Q2
  "['Delivery', 'Review']",
  // Ivo Crest 2026 Q3
  "['Delivery']",
  // Zara Quill 2025 Q3
  "['Code']",
  // Zara Quill 2025 Q4
  "['Code']",
  // Nyx Rowan 2025 Q3
  "['Review']",
  // Nyx Rowan 2025 Q4
  "['Review']",
  // Mira Solen 2025 Q4
  "['Delivery']",
  // Kael Arden 2025 Q3
  "['Code']",
  // Kael Arden 2025 Q4
  "['Code']",
  // Orin Vale 2025 Q4
  "['Quality']",
  // Zara Quill 2025 Q1
  "['Mentoring']",
  // Zara Quill 2025 Q2
  "['Quality']",
  // Orin Vale 2025 Q2
  "['Delivery']",
  // Orin Vale 2025 Q3
  "['Code']",
  // Nyx Rowan 2025 Q1
  "['Delivery']",
  // Nyx Rowan 2025 Q2
  "['Code']",
  // Mira Solen 2025 Q2
  "['Review']",
  // Mira Solen 2025 Q3
  "['Mentoring']",
  // Kael Arden 2025 Q1
  "['Mentoring']",
  // Kael Arden 2025 Q2
  "['Quality']",
  // Lena Park 2025 Q3
  "['Mentoring']",
  // Lena Park 2025 Q4
  "['Delivery', 'Mentoring']",
  // Lena Park 2026 Q1
  "['Review', 'Mentoring']",
  // Lena Park 2026 Q2
  "['Mentoring', 'Review']",
  // Lena Park 2026 Q3
  "['Code']",
  // Dax Mercer 2025 Q2
  "['Quality']",
  // Dax Mercer 2025 Q3
  "['Review']",
  // Dax Mercer 2025 Q4
  "['Code']",
  // Dax Mercer 2026 Q1
  "['Delivery']",
  // Dax Mercer 2026 Q2
  "['Quality', 'Review']",
  // Dax Mercer 2026 Q3
  "['Mentoring', 'Quality']",
];

const broken = "focusCategories: ['\\'']";
let i = 0;
// Each broken entry looks like: focusCategories: ['\']
content = content.replace(/focusCategories: \['\\'\]/g, () => {
  const val = values[i++];
  return `focusCategories: ${val}`;
});

console.log('Replaced', i, 'occurrences');
if (i !== values.length) {
  console.error(`WARNING: expected ${values.length} replacements, got ${i}`);
}
fs.writeFileSync(path, content, 'utf8');
console.log('Done.');
