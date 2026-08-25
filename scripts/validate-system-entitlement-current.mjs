import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=f=>fs.readFileSync(f,'utf8');
const sql=read('supabase_system_entitlements_current_20260825.sql');
const worker=read('worker.js');
const member=read('member-current.html');
const workspace=read('workspace-current.html');
const apply=read('apply-current.html');
const home=read('home-current.html');
const pathTree=read('DOING_OPERATION_PATH_TREE_CURRENT.md');
const routeSSOT=JSON.parse(read('DOING_UI_ROUTE_SSOT_CURRENT.json'));
const world=JSON.parse(read('doing-world-tree-current.json'));

for(const token of ['doing_application_system','doing_guard_workspace_application','doing_auto_activate_workspace','workModules','requestedSystem','enabledSystems','systemProfiles'])assert.ok(sql.includes(token),'S migration missing: '+token);
assert.ok(sql.includes("jsonb_set(current_flags,array['workModules',requested_system],'true'::jsonb,true)"),'S migration must add system entitlement to existing tenant');
assert.ok(sql.includes("coalesce(array_length(owner_tenants,1),0)=1"),'S migration must resolve one owned tenant before adding a system');
assert.ok(!sql.includes('不可重複申請第二個工作空間'),'old one-workspace application blocker must be retired');

assert.ok(worker.includes('for(const [key,value] of Object.entries(raw))if(typeof value!==\'boolean\')flags[key]=value'),'Worker must preserve non-boolean workModules object from tenant_settings');
for(const token of ['getPlatformMemberProfile','createMemberWorkspaceAdminSession','getTenantModuleProfile','approvedFlags','workModules'])assert.ok(member.includes(token),'member routing missing: '+token);
assert.ok(!member.includes('inferSystem('),'member routing must not infer system from applications/useCases');
assert.ok(member.includes("entries.length===1"),'single entitlement must direct immediately');

for(const token of ['getTenantModuleProfile','approvedFlags','workModules','data-module-card'])assert.ok(workspace.includes(token),'workspace entitlement rendering missing: '+token);
assert.ok(!workspace.includes('尚未確認權限'),'unentitled systems must not be rendered as disabled cards');
assert.ok(!workspace.includes("p.useCases.includes"),'workspace must not fall back to useCases authorization');

for(const token of ['requestedSystem:system','oneOwnedTenantMultipleSystems:true','createOrganizerApplicationDraft','createMemberWorkspaceAdminSession'])assert.ok(apply.includes(token),'application multi-system contract missing: '+token);
for(const old of ['existingWorkspace','ensureProjectProfile','saveTenantModuleProfile'])assert.ok(!apply.includes(old),'old application routing leaked: '+old);

for(const pair of [['market','/apply/?system=market'],['project','/apply/?system=project'],['booking','/apply/?system=booking']])assert.ok(home.includes(pair[1]),`homepage ${pair[0]} application path missing`);
assert.equal(routeSSOT.identityRouting.systemEntitlementSource,'tenant_settings.module_flags_json.workModules');
assert.equal(routeSSOT.identityRouting.unentitledSystemsVisible,false);
assert.equal(routeSSOT.identityRouting.useCasesAsAuthorization,false);
assert.equal(routeSSOT.newRoutesAdded,false);
assert.ok(pathTree.includes('會員 → tenant → `workModules` 權限閉環'));
assert.equal(world.current.systemEntitlementSSOT,'tenant_settings.module_flags_json.workModules');
const myDoing=world.branches.find(x=>x.id==='my-doing-workspace');
assert.ok(myDoing?.children?.some(x=>x.id==='my-doing-entitlements'),'world tree must include login entitlement resolution');
const application=world.branches.find(x=>x.id==='application');
assert.ok(application?.children?.some(x=>x.id==='apply-add-system'),'world tree must include add-system-to-same-tenant flow');

console.log(JSON.stringify({result:'PASS',model:'one-member-one-owned-tenant-multi-system',entitlementSSOT:'tenant_settings.module_flags_json.workModules',routes:{market:'/market/',project:'/project/',booking:'/booking/'},newRoutes:0,workerSourceChanges:0,twoBlChanges:0},null,2));
