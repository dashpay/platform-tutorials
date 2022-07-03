"use strict";

let Store = module.exports;

let DomStorage = require("dom-storage");
let JsonStorage = require("json-storage").JsonStorage;

/**
 * @typedef {Object} CoreStorage
 * @property {CoreStorageGetItem} getItem
 * @property {CoreStorageSetItem} setItem
 */

/**
 * @typedef {Function} CoreStorageGetItem
 * @param {String} key
 */

/**
 * @typedef {Function} CoreStorageSetItem
 * @param {String} key
 * @param {any} value
 */

/**
 * @param {Object} opts
 * @param {String} opts.filepath - path of JSON db file
 * @param {String} opts.namespace - namespace prefix for JSON storage
 * @returns {CoreStorage}
 */
Store.create = function ({ filepath, namespace }) {
  let myLocalStorage = new DomStorage(filepath, { strict: true, ws: "  " });
  /** @type {CoreStorage} */
  //@ts-ignore
  let store = JsonStorage.create(myLocalStorage, namespace, {
    stringify: true,
  });

  //@ts-ignore
  store.getItem = store.get;
  //@ts-ignore
  store.setItem = store.set;

  return store;
};
