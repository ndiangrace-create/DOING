# DOING Market｜2BL UI correction checkpoint

User correction after PR #154 deployment:

1. Desktop Market admin primary navigation must be in the fixed top bar, not in a left sidebar.
2. Mobile Market admin keeps bottom fixed navigation.
3. 2BL UI parity means the full user-facing operational surface, not only the visual shell.
4. Missing 2BL user actions must be restored against DOING routes/Core/SSOT, including the documented admin top tools, cross-session overview, finance overview, full onsite workflow, member edit/history entry, activity list controls, finance report/download controls, consignment/POS entry, and settings groups.
5. DOING login/identity, DOING Core, Supabase SSOT and world-tree/data contracts remain unchanged.
6. User-facing copy must describe user work, not implementation internals.

This checkpoint supersedes the 150px-left-sidebar assumption for desktop Market admin UI.
