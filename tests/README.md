# Margin tests

Run from the repo root, passing `index.html`:

```
node tests/check.js index.html
node tests/ids.js index.html
node tests/nest.js index.html
node tests/shapes3.mjs index.html
```

Bump a ship:

```
python tests/bump.py . 141
```

(`bump.py` still wants the **folder that contains** `index.html` and `sw.js`, not this `tests/` folder.)
