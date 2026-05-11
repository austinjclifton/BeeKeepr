"use strict";

const { isDemoAccountUser } = require("../utils/demoAccount.js");

exports.requireWritableAccount = (req, res, next) => {
  if (isDemoAccountUser(req.user)) {
    return res.status(403).json({ error: "Demo account is read-only" });
  }

  return next();
};
