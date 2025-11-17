from pathlib import Path
text = Path('frontend/src/pages/HomePage.jsx').read_text()
start = text.index('        <div className="row')
segment = text[start:start+500]
print(segment.replace('\n', '\\n'))
