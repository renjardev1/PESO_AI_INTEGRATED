export const toSafeUser = (admin) => ({
  userId:      admin.id ?? admin.admin_id,
  displayName: admin.display_name || admin.displayName || admin.username || admin.name,
  username:    admin.username || admin.name || null,
  role:        admin.role,
  avatar:      admin.avatar || null,
});
