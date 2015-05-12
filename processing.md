## File Modifications

Perform these steps on the OCI Consolidated Sheet to prepare it for data updating. This only needs to be performed once.

- Create a new file which is a duplicate of the data and save as `.xlsm` (macro enabled)
- Remove the graphs tab (it slows down processing time)
- Add the macro
  - Open the VBA editor (Alt+F11 or click VBA editor on the Developers Tab)
  - Right click the project --> Insert --> Module
  - Copy macro text (`macro.txt`)
- Add two columns (A, B)
- Set slider values in column A
  - Macro will only look in A69, A73, A85 (Water, Steam, Flaring)
    - A69: 0.5, 0.75, 1, 1.25, 1.5
    - A73: 0.75, 1, 1.25
    - A85 0.1, 0.75, 1
  - Make sure these are the same values used in the special cases sheets (order doesn't matter though, it matches dynamically)
- Update field names
  - Rows 422-434: Venting, Flaring, and Fugitive Emissions; Miscellaneous; Transport to Refinery
  - Rows 975-981: Gasoline, Jet Fuel, Diesel, Petroleum Coke, Bunker Fuel
  - Rows 1016-29: Add Heat, Steam, and Hydrogen prefixes to the sub-components (e.g. RFG --> Heat RFG)
  - Rows 1071-1078: Gasoline, Jet Fuel, Diesel, Petroleum Coke, Bunker Fuel
- Add a "tag" indicating the start of the special oils in row D; any text will work

## Data Processing (creating new data for the site)

- Install [python](https://www.python.org/downloads/), [csvkit](http://csvkit.readthedocs.org/en/0.9.1/install.html#users), and [jq](http://stedolan.github.io/jq/download/); add each to the [path/environment variables](http://www.computerhope.com/issues/ch000549.htm) as you go.
- Open the prepared file (see above)
- Run the macro
  - Select OPGEE model when prompted
- Close without saving
- Perform any special processing (see below)
- Run processing script (`process.bat`)
- Final data will be named `oils.json`; replace the old file with this name on the website (in `/dist` folder)

## Special processing

- Add the unique oil name into cell D3 (used for matching with the rest of the data)
- Copy in special processing macro (`special_macro.txt')
- Run macro for each special oil
  - Select OCI Consolidated Sheet when prompted
  - Slider values should be column H, rows 163-5
  - Macro will only grab the first `n` columns start at column H where `n` is equal to `water_options * steam_options * flaring_options` (currently 45)
- Close without saving
