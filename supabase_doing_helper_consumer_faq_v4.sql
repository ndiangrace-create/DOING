begin;

-- DOING 報名／預約者常見問答 v4。
-- 只新增已審核的公開操作答案；既有版本不覆寫，AI 仍不得自行發布。
insert into public.doing_helper_knowledge_entries
  (knowledge_key, version, category, title, content, keywords, source_type, source_ref, approval_status, is_public, created_by, approved_by, published_at)
values
  ('consumer_registration_submitted',1,'workflow','報名送出後怎麼確認成功？','送出後，畫面會顯示完成訊息，並在「我的報名」建立同一筆紀錄；看到該筆活動與目前狀態，就代表系統已收到。若畫面中斷或「我的報名」沒有紀錄，先不要重複送出，請重新整理後再確認。',array['報名成功','送出成功','確認報名','我的報名','不要重複送出'],'approved_answer','DOING 報名者操作情境驗收 v4','published',true,'consumer_faq_seed_v4','platform_super_admin',now()),
  ('consumer_edit_registration',1,'workflow','報名資料填錯可以修改嗎？','先到「我的報名」打開該筆紀錄；若畫面有「補件」或「編輯」入口，可直接依提示修改。已進入審核、付款或錄取流程而沒有修改按鈕時，請聯絡該活動主辦協助，不要重新報名，以免產生重複紀錄。',array['資料填錯','修改報名','更改資料','送出後修改','補件','編輯'],'approved_answer','DOING 報名者操作情境驗收 v4','published',true,'consumer_faq_seed_v4','platform_super_admin',now())
on conflict (knowledge_key, version) do nothing;

commit;
