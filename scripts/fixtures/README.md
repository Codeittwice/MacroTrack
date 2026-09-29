# Fixtures

`nevo-sample.csv` is **synthetic test data** created for this repository's unit tests. It is
**not** real RIVM NEVO data — the food names are real Dutch food names, but the nutrient
values are made up and must never be used for actual nutrition tracking or published as if
they were NEVO figures.

The real NEVO2023 dataset is licensed by RIVM and is not distributed with this repository.
To build `public/data/nevo.json` with real data:

1. Download NEVO-online 2023 from https://www.rivm.nl/nevo (accept the licence).
2. Save/export the CSV into `data/raw/`.
3. Run `npm run nevo`.
