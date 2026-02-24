import re
import shutil
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_FILE = os.path.join(SCRIPT_DIR, 'plugin.js')
OUTPUT_FILE = os.path.join(SCRIPT_DIR, 'plugin-inline.js')
FRONTEND_PUBLIC = os.path.join(SCRIPT_DIR, '..', 'frontend', 'public', 'plugin-inline.js')

# Read the file plugin.js
with open(INPUT_FILE, 'r') as f:
    content = f.read()

# Strip single-line comments (but not URLs like https://)
content = re.sub(r'(\s|\w)//(?!/)[^\n]*', '', content)

# Strip multi-line comments
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

# Collapse whitespace
content = re.sub(r'\n', '', content)
content = re.sub(r'    ', '', content)

# Wrap as bookmarklet
content = 'javascript:(()=>{' + content + '})()'

# Write to plugin-inline.js
with open(OUTPUT_FILE, 'w') as f:
    f.write(content)

# Copy to frontend/public/ for serving
shutil.copy2(OUTPUT_FILE, FRONTEND_PUBLIC)

print(f'✅ Written to {OUTPUT_FILE}')
print(f'✅ Copied to {FRONTEND_PUBLIC}')
