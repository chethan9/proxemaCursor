-- Super admin can read/update/delete all notifications
CREATE POLICY "super_admin_select_all_notifications" ON user_notifications FOR SELECT USING (is_super_admin());
CREATE POLICY "super_admin_insert_notifications" ON user_notifications FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "super_admin_update_notifications" ON user_notifications FOR UPDATE USING (is_super_admin());
CREATE POLICY "super_admin_delete_notifications" ON user_notifications FOR DELETE USING (is_super_admin());