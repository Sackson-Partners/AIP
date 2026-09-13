const fs = require('fs');

function traceImports(filePath, visited = new Set(), depth = 0) {
  if (visited.has(filePath) || depth > 5) return;
  visited.add(filePath);

  const indent = '  '.repeat(depth);
  console.log(`${indent}${filePath}`);

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const importRegex = /from\s+['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      let importPath = match[1];

      // Resolve @/ alias
      if (importPath.startsWith('@/')) {
        importPath = importPath.replace('@/', 'src/');
      }

      // Resolve relative paths
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        importPath = require('path').resolve(dir, importPath);
      }

      // Add .ts extension if missing
      if (!importPath.endsWith('.ts') && !importPath.endsWith('.tsx')) {
        if (fs.existsSync(importPath + '.ts')) {
          importPath += '.ts';
        } else if (fs.existsSync(importPath + '/index.ts')) {
          importPath += '/index.ts';
        }
      }

      if (fs.existsSync(importPath)) {
        traceImports(importPath, visited, depth + 1);
      }
    }
  } catch (e) {
    console.error(`${indent}  Error reading: ${e.message}`);
  }
}

traceImports('src/app/api/investors/[id]/route.ts');
