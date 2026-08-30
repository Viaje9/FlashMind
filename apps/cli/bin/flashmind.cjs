#!/usr/bin/env node
"use strict";
if (process.argv[2] === "transcript") require("../src/transcript.cjs").main();
else require("../dist/main.js");
