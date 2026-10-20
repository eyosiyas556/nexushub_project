/**
 * Members can be marked Inactive in the admin directory.
 * Treat missing/blank status as active so legacy rows still work.
 */
function isAccountActive(status) {
  if (status == null) return true;
  const normalized = String(status).trim().toLowerCase();
  if (normalized === '') return true;
  return normalized === 'active';
}

module.exports = { isAccountActive };
