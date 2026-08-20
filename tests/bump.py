import io, re, sys
d = sys.argv[1]
n = sys.argv[2]
p = d + "\\index.html"
s = io.open(p, encoding="utf-8").read()
s2 = re.sub(r'(var BUILD\s*=\s*"[^"]*\bb)\d+(")', r'\g<1>' + n + r'\g<2>', s)
if s2 == s:
    print("BUILD NOT CHANGED - pattern did not match")
    sys.exit(1)
io.open(p, "w", encoding="utf-8", newline="").write(s2)

q = d + "\\sw.js"
c = io.open(q, encoding="utf-8").read()
c2 = re.sub(r'(const CACHE\s*=\s*"margin-[0-9\-]+-v)\d+(")', r'\g<1>' + n + r'\g<2>', c)
if c2 == c:
    print("CACHE NOT CHANGED - pattern did not match")
    sys.exit(1)
io.open(q, "w", encoding="utf-8", newline="").write(c2)

b = re.search(r'var BUILD\s*=\s*"([^"]+)"', s2).group(1)
k = re.search(r'const CACHE\s*=\s*"([^"]+)"', c2).group(1)
print("build:", b.encode("ascii", "replace").decode())
print("cache:", k)
print("MATCH" if b.rstrip('"').endswith("b" + n) and k.endswith("v" + n) else "MISMATCH")
