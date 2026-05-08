content = open('index.html','r',encoding='utf-8-sig').read()
nav_old = '''                <li><a href="resources.html"><i data-lucide="link"></i> Resource Bank</a></li>'''
nav_new = '''                <li><a href="resources.html"><i data-lucide="link"></i> Resource Bank</a></li>
                <li><a href="integration.html"><i data-lucide="link-2"></i> End-to-End Planner</a></li>'''
content = content.replace(nav_old, nav_new)
open('index.html','w',encoding='utf-8').write(content)
print("index.html nav updated")

import os
htmlfiles = [f for f in os.listdir('.') if f.endswith('.html') and f != 'integration.html']
for fn in htmlfiles:
    c = open(fn,'r',encoding='utf-8-sig').read()
    if 'Resource Bank' in c and 'End-to-End Planner' not in c:
        c = c.replace(
            '<li><a href="resources.html"><i data-lucide="link"></i> Resource Bank</a></li>',
            '<li><a href="resources.html"><i data-lucide="link"></i> Resource Bank</a></li>\n                <li><a href="integration.html"><i data-lucide="link-2"></i> End-to-End Planner</a></li>'
        )
        open(fn,'w',encoding='utf-8').write(c)
        print(f"Updated nav in {fn}")
print("All nav links updated")
