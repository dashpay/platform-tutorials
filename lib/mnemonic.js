"use strict";

let Mnemonic = module.exports;

let Fs = require("fs").promises;
let CoreMnemonic = require("@dashevo/dashcore-lib/lib/mnemonic/");

/**
 * @param {String} [mnemonic] - string of 12 whitespace-delimited words
 * @returns {Promise<String>}
 */
Mnemonic.getOrCreate = async function (mnemonic) {
  if (mnemonic) {
    return mnemonic;
  }

  mnemonic = new CoreMnemonic().toString();

  let txt = await Fs.readFile(".env", "utf8").catch(function (err) {
    if ("ENOENT" !== err.code) {
      throw err;
    }
    return "";
  });

  if (!txt.endsWith("\n")) {
    txt += "\n";
  }
  txt += `MNEMONIC='${mnemonic}'\n`;
  await Fs.writeFile(".env", txt, "utf8");
  console.info("Wrote MNEMONIC='<mnemonic>' to .env");

  return mnemonic;
};
