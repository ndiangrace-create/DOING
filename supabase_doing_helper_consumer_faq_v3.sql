begin;

-- DOING 一般使用者常見問答 v3。
-- 只收錄可公開、可直接顯示的操作說明；不包含內部架構、資料表、權限實作或商業機密。
insert into public.doing_helper_knowledge_entries
  (knowledge_key, version, category, title, content, keywords, source_type, source_ref, approval_status, is_public, created_by, approved_by, published_at)
values
  ('consumer_start_registration',1,'workflow','第一次要怎麼報名或預約？','先在 DOING 首頁選擇活動或可預約內容，進入公開頁後按「查看並報名／預約」，依畫面完成場次、個人資料與必要選項，最後確認送出。送出後可從「我的報名」查看審核、付款與後續通知。',array['第一次','怎麼報名','如何報名','預約','公開頁','送出','我的報名'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_view_registration',1,'workflow','報名後要去哪裡看進度與紀錄？','請按首頁上方的「我的報名」，使用本人的 LINE 登入後即可查看所有 DOING 報名／預約紀錄，包括審核、付款、位置、改期、退款與行前資訊。若剛送出還沒顯示，先重新整理一次；仍沒有再聯絡該活動主辦。',array['報名後','哪裡看','進度','紀錄','我的報名','LINE 登入'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_review_waitlist',1,'workflow','待審核與候補有什麼不同？','「待審核」表示資料已送出，正在等主辦確認，不需要重複報名；「候補」則表示目前沒有正式名額。請到「我的報名」查看同一筆紀錄，若候補轉為錄取，狀態會直接更新。審核時間、候補順序與是否釋出名額由該活動主辦決定。',array['待審核','候補','名額滿','錄取','不用重複報名'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_pending_review',1,'workflow','為什麼我的報名顯示待審核？','「待審核」表示資料已送出，但該活動設定為由主辦確認後才錄取，目前不需要重複報名。請到「我的報名」留意狀態與補件通知；實際審核時間與錄取條件由該活動主辦決定。',array['待審核','審核中','錄取','補件','不要重複報名'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_waitlist',1,'workflow','名額滿了可以候補嗎？','是否能候補要看該活動是否開放候補。若報名頁顯示候補，就可依畫面送出；候補轉為錄取時，狀態會更新在同一筆「我的報名」紀錄，不用重新填一次。沒有候補入口時，請直接詢問該活動主辦。',array['名額滿','候補','轉正','錄取','候補入口'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_payment_status',1,'billing','付款後怎麼確認有沒有成功？','完成付款後，仍要回到「我的報名」送出付款回報；畫面顯示「付款待確認」代表主辦尚在核帳，顯示「已繳費」才是確認完成。若長時間沒有更新，請把付款時間、金額與報名紀錄提供給該活動主辦核對。',array['付款後','付款成功','入帳','付款待確認','已繳費','核帳'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_cancel_reschedule',1,'billing','如何取消、改期或申請退款？','請先到「我的報名」打開該筆紀錄：尚未付款且畫面有「取消報名」時可直接取消；已付款、需要改期或涉及退款時，請聯絡該活動主辦依公告規則處理。DOING 小幫手不會自行承諾退款金額或修改正式紀錄。',array['取消報名','改期','改時間','換時間','退款','已付款'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_missing_notification',1,'support','沒有收到錄取或行前通知怎麼辦？','先到「我的報名」確認最新狀態，再檢查垃圾郵件與報名時使用的聯絡資料。單一活動的錄取、付款、位置或行前通知由該活動主辦發送；紀錄已更新但仍沒收到通知時，請直接聯絡主辦補發。',array['收不到通知','沒有收到信','錄取通知','行前通知','垃圾郵件','補發'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_onsite_checkin',1,'workflow','活動當天要怎麼報到？','活動當天先打開「我的報名」找到該場紀錄，依主辦通知出示報名資料、位置或 QR／核銷資訊。若畫面有開放本人報到按鈕，可直接操作；沒有按鈕時由現場工作人員核對。報到時間與方式以該活動最新通知為準。',array['活動當天','現場','怎麼報到','QR','核銷','報到按鈕'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now()),
  ('consumer_support_routing',1,'support','遇到問題要聯絡主辦還是 DOING？','單一活動的審核、付款、位置、設備、取消與退款，請優先聯絡該活動主辦；如果是 DOING 登入失敗、頁面故障、資料顯示錯誤或無法聯絡主辦，再交由 DOING 客服協助。回報時請附上活動名稱、所在畫面與提示文字。',array['聯絡主辦','聯絡 DOING','客服','登入失敗','頁面故障','提示文字'],'approved_answer','DOING 一般使用者操作情境驗收','published',true,'consumer_faq_seed_v3','platform_super_admin',now())
on conflict (knowledge_key, version) do nothing;

commit;
