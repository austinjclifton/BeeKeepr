"use strict";

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvRow(values, stringColumns = new Set()) {
  return `${values.map((value, index) => csvCell(value, stringColumns.has(index))).join(",")}\n`;
}

function csvCell(value, isString = false) {
  if (value === null || value === undefined) return "";

  let text;
  if (value instanceof Date) {
    text = value.toISOString();
  } else {
    text = String(value);
  }

  if (isString && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

module.exports = {
  csvCell,
  csvRow,
};
