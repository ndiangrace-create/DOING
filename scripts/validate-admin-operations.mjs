import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('admin.html','utf8');
const fail=message=>{throw new Error(message)};
const functionSource=name=>{
  const start=source.indexOf(`function ${name}(`);
  if(start<0)fail(`找不到後台函式：${name}`);
  let depth=0,body=false;
  for(let i=start;i<source.length;i++){
    if(source[i]==='{'){depth++;body=true}
    if(source[i]==='}'&&body&&--depth===0)return source.slice(start,i+1);
  }
  fail(`後台函式不完整：${name}`);
};

const sandbox={
  regEquipText:r=>String(r.equipmentText||'無'),
  regDateText:r=>String(r.dateText||'2026-08-15'),
  isRefundCompletedRow:r=>String(r.refundStatus||'').includes('已退費'),
  isPaidText:v=>String(v||'').includes('已繳費'),
  isFreePayText:v=>String(v||'').includes('免費')
};
vm.createContext(sandbox);
vm.runInContext(functionSource('todoKindFromRow'),sandbox);

const cases=[
  ['新報名進入待審核',{reviewStatus:'待審核',email:'a@doing.tw',phone:'0900',brandName:'A'},'pending'],
  ['付款回報進入核帳',{reviewStatus:'已錄取',paymentStatus:'付款待確認',email:'a@doing.tw',phone:'0900',brandName:'A'},'paymentPending'],
  ['錄取未付款進入提醒',{reviewStatus:'已錄取',paymentStatus:'未繳費',email:'a@doing.tw',phone:'0900',brandName:'A'},'unpaid'],
  ['退款申請進入退款處理',{reviewStatus:'已錄取',paymentStatus:'已繳費',refundStatus:'申請退費',email:'a@doing.tw',phone:'0900',brandName:'A'},'refund'],
  ['已付款未報到進入現場待辦',{reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'未報到',email:'a@doing.tw',phone:'0900',brandName:'A'},'checkin'],
  ['已報到且有設備進入設備確認',{reviewStatus:'已錄取',paymentStatus:'已繳費',checkinStatus:'已報到',equipmentText:'桌×1',email:'a@doing.tw',phone:'0900',brandName:'A'},'equipment'],
  ['缺資料進入資料異常',{reviewStatus:'待審核',email:'',phone:'',brandName:''},'dataIssue'],
  ['已退款離開待辦',{reviewStatus:'已錄取',paymentStatus:'已退款',email:'a@doing.tw',phone:'0900',brandName:'A'},'done']
];
for(const [label,row,expected] of cases){
  const actual=sandbox.todoKindFromRow(row);
  if(actual!==expected)fail(`${label}：預期 ${expected}，實際 ${actual}`);
}

const actionRequirements={
  pending:['approve','reject','cancelReg','note'],
  paymentPending:['confirmPayment','markUnpaid','cancelReg','note'],
  unpaid:['remindPayment','confirmPayment','cancelReg','note'],
  checkin:['checkin','lateDialog','noShowDialog','cancelReg','note'],
  refund:['refund','markRefunded','cancelReg','note']
};
const actionSource=functionSource('todoStageButtons');
for(const [kind,actions] of Object.entries(actionRequirements)){
  if(!actionSource.includes(`kind==='${kind}'`))fail(`待辦缺少操作分類：${kind}`);
  for(const action of actions)if(!actionSource.includes(`'${action}'`))fail(`${kind} 缺少操作：${action}`);
}
for(const marker of ["setTodoFilter(\\'payment\\')","switchPage(\\'finance\\')","switchPage(\\'sessions\\')"]){
  if(!source.includes(marker))fail(`營運數字沒有直接入口：${marker}`);
}

console.log(`主辦操作模擬通過：${cases.length} 種資料狀態、${Object.keys(actionRequirements).length} 組直接操作流程。`);
