#!/usr/bin/env node
// Vigenère cipher for the scavenger hunt ciphertext.
//
//   node scripts/vigenere.mjs <key> < plaintext.txt          # encrypt
//   node scripts/vigenere.mjs --decrypt <key> < cipher.txt   # decrypt
//
// Only A–Z/a–z are shifted, and the key advances only on letters, so case,
// spaces, punctuation, and URL separators survive. That matches what
// standard online solvers (dCode, CyberChef) do.
//
// The repo is public: keep the key and plaintext out of it. Paste only the
// output into SCAVENGER_CIPHERTEXT in app/scavenger-hunt/page.tsx.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const decrypt = args[0] === "--decrypt";
const key = (decrypt ? args[1] : args[0])?.toLowerCase().replace(/[^a-z]/g, "");

if (!key) {
  console.error("usage: node scripts/vigenere.mjs [--decrypt] <key> < input");
  process.exit(1);
}

const input = readFileSync(0, "utf8").trimEnd();
let k = 0;
const output = input.replace(/[a-z]/gi, (ch) => {
  const base = ch <= "Z" ? 65 : 97;
  const shift = key.charCodeAt(k++ % key.length) - 97;
  const offset = decrypt ? 26 - shift : shift;
  return String.fromCharCode(((ch.charCodeAt(0) - base + offset) % 26) + base);
});

process.stdout.write(`${output}\n`);
