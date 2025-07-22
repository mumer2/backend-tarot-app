function sanitizePrompt(prompt) {
  return prompt.replace(/[\n\r]+/g, ' ').trim();
}

module.exports = { sanitizePrompt };
