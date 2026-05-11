"use strict";

const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
let resend = null;

function getClient() {
  if (!RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

module.exports = {
  emails: {
    send: async (payload) => {
      const client = getClient();
      if (!client) {
        return {
          error: {
            message: "RESEND_API_KEY is not configured",
          },
        };
      }

      return client.emails.send(payload);
    },
  },
};
