from pathlib import Path
import re
root=Path(__file__).parent
out=['// YOOKOO R9 preview candidate. Production requires explicit configuration and approval.\n']
for name in ['legacy','model','store','calendar','assistant','engine','mcp','index']:
 s=(root/'src'/f'{name}.js').read_text()
 s=re.sub(r'^import .*?;\n','',s,flags=re.M)
 if name=='legacy':s=s.replace('export default {','const legacy = {')
 s=re.sub(r'\bexport (?=(?:async )?function|const|class)',lambda m:m.group(0) if name=='index' else '',s)
 out.append('\n// '+name+'\n'+s)
(root/'worker.js').write_text(''.join(out))
