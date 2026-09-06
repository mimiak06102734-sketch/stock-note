const yen = new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0});
const money = (value,currency='JPY') => new Intl.NumberFormat(currency==='JPY'?'ja-JP':'en-US',{style:'currency',currency,maximumFractionDigits:currency==='JPY'?0:2}).format(Number(value)||0);
const fmt = n => new Intl.NumberFormat('ja-JP',{maximumFractionDigits:4}).format(Number(n)||0);
const STORAGE = { holdings:'stocknote-holdings', apiKey:'stocknote-alpha-key', realtime:'stocknote-alpha-realtime', trades:'stocknote-trades', apiCache:'stocknote-alpha-cache-v2', apiUsage:'stocknote-alpha-usage-v2' };
const FREE_DAILY_LIMIT = 25;
const CACHE_TTL = { SYMBOL_SEARCH:12*60*60*1000, GLOBAL_QUOTE:30*60*1000, TIME_SERIES_INTRADAY:30*60*1000, TIME_SERIES_DAILY:6*60*60*1000, NEWS_SENTIMENT:2*60*60*1000, CURRENCY_EXCHANGE_RATE:60*60*1000 };
function todayKey(){return new Date().toLocaleDateString('sv-SE');}
function readUsage(){try{const u=JSON.parse(localStorage.getItem(STORAGE.apiUsage)||'{}');return u.date===todayKey()?u:{date:todayKey(),count:0};}catch{return {date:todayKey(),count:0};}}
function writeUsage(u){localStorage.setItem(STORAGE.apiUsage,JSON.stringify(u));renderApiUsage();}
function getCache(){try{return JSON.parse(localStorage.getItem(STORAGE.apiCache)||'{}');}catch{return {};}}
function setCache(cache){localStorage.setItem(STORAGE.apiCache,JSON.stringify(cache));}
function cacheKey(params){return new URLSearchParams(Object.entries(params).sort(([a],[b])=>a.localeCompare(b))).toString();}
function renderApiUsage(){const u=readUsage();const el=document.querySelector('#apiUsage');if(el)el.textContent=`本日のAPI使用目安：${u.count} / ${FREE_DAILY_LIMIT} 回`;const left=document.querySelector('#apiRemaining');if(left)left.textContent=`残り目安 ${Math.max(0,FREE_DAILY_LIMIT-u.count)} 回`;}
const DEMO_FX = {JPY:1,USD:148.32,EUR:162.85,GBP:190.42,KRW:0.1128,CNY:20.49};
const demoMarkets=[
  {name:'日経平均',symbol:'NIKKEI',value:'39,123.49',chg:'+0.65%',up:true},
  {name:'NASDAQ',symbol:'NASDAQ',value:'18,540.01',chg:'-0.31%',up:false},
  {name:'USD / JPY',symbol:'USDJPY',value:'148.32',chg:'+0.24%',up:true},
  {name:'EUR / JPY',symbol:'EURJPY',value:'162.85',chg:'-0.15%',up:false}
];
const state = {
  apiKey: localStorage.getItem(STORAGE.apiKey)||'',
  realtime: localStorage.getItem(STORAGE.realtime)==='true',
  fx:{...DEMO_FX},
  selected:{symbol:'AAPL',name:'Apple Inc.',currency:'USD',region:'United States',price:229.4,changePercent:1.82},
  holdings: JSON.parse(localStorage.getItem(STORAGE.holdings)||'null') || [
    {name:'Apple Inc.',ticker:'AAPL',apiSymbol:'AAPL',shares:5,buyPrice:205,currentPrice:229.4,currency:'USD',sector:'情報技術'},
    {name:'NVIDIA Corporation',ticker:'NVDA',apiSymbol:'NVDA',shares:2,buyPrice:690,currentPrice:830,currency:'USD',sector:'情報技術'},
    {name:'トヨタ自動車',ticker:'7203',apiSymbol:'7203',shares:100,buyPrice:2750,currentPrice:2950,currency:'JPY',sector:'自動車'},
    {name:'Microsoft Corp.',ticker:'MSFT',apiSymbol:'MSFT',shares:4,buyPrice:390,currentPrice:420,currency:'USD',sector:'情報技術'}
  ],
  trades: JSON.parse(localStorage.getItem(STORAGE.trades)||'[]'),
  searchResults:[],
  targetCurrency:'JPY',
  fromCurrency:'USD',
  stockSeries:[],
  charts:{}
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const saveHoldings=()=>localStorage.setItem(STORAGE.holdings,JSON.stringify(state.holdings));
const saveTrades=()=>localStorage.setItem(STORAGE.trades,JSON.stringify(state.trades));
function currencyToYen(value,currency){ return currency==='JPY'?Number(value):Number(value)*(state.fx[currency]||1); }
function pctClass(v){return Number(v)>=0?'gain':'loss'}
function signed(v,digits=2){const n=Number(v)||0;return `${n>=0?'+':''}${n.toFixed(digits)}%`;}
function alphaError(data){return data?.['Error Message'] || data?.Information || data?.Note || null;}
async function alpha(params, options={}){
  if(!state.apiKey) throw new Error('APIキーが未設定です');
  const fn=params.function||'UNKNOWN', key=cacheKey(params), cache=getCache(), now=Date.now();
  const ttl=CACHE_TTL[fn]||30*60*1000;
  if(!options.force && cache[key] && now-cache[key].savedAt < ttl) return {...cache[key].data,__fromCache:true,__cachedAt:cache[key].savedAt};
  const usage=readUsage();
  if(usage.count>=FREE_DAILY_LIMIT) {
    if(cache[key]) return {...cache[key].data,__fromCache:true,__cachedAt:cache[key].savedAt,__stale:true};
    throw new Error('本日の無料API使用目安25回に達しました。明日まで待つか、保存済みデータをご利用ください。');
  }
  const q=new URLSearchParams({...params,apikey:state.apiKey});
  const r=await fetch(`https://www.alphavantage.co/query?${q.toString()}`);
  usage.count+=1; writeUsage(usage);
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const data=await r.json();
  const err=alphaError(data); if(err) throw new Error(err);
  cache[key]={savedAt:now,data}; setCache(cache);
  return {...data,__fromCache:false,__cachedAt:now};
}
function showToast(message,type='ok'){
  let el=$('#toast');
  if(!el){el=document.createElement('div');el.id='toast';el.style.cssText='position:fixed;left:50%;bottom:95px;transform:translateX(-50%);z-index:9999;padding:11px 15px;border-radius:999px;background:#29231e;color:white;font-size:12px;box-shadow:0 12px 35px rgba(0,0,0,.2);max-width:86vw;text-align:center';document.body.append(el)}
  el.textContent=message;el.style.background=type==='error'?'#8f4f49':'#29231e';el.hidden=false;clearTimeout(el._timer);el._timer=setTimeout(()=>el.hidden=true,2600);
}

function marketHTML(rows){return rows.map(r=>`<div class="market-row" data-symbol="${r.symbol||''}"><span>${r.name}</span><strong>${r.value}</strong><span class="${r.up?'gain':'loss'}">${r.chg}</span></div>`).join('');}
function renderMarkets(){
  $('#marketList').innerHTML=marketHTML(demoMarkets);
  $('#indexList').innerHTML=marketHTML(demoMarkets.slice(0,2));
  renderFxList();
}
function renderFxList(){
  const rows=['USD','EUR','GBP','KRW','CNY'].map(c=>({name:`${c} / JPY`,value:fmt(state.fx[c]),chg:state.fx[c]===DEMO_FX[c]?'DEMO':'LIVE',up:true}));
  $('#fxList').innerHTML=marketHTML(rows);
}

function renderHoldings(){
  const el=$('#holdingsList');
  el.innerHTML=state.holdings.length?state.holdings.map((h,i)=>{
    const invested=currencyToYen(h.buyPrice*h.shares,h.currency), current=currencyToYen(h.currentPrice*h.shares,h.currency), diff=current-invested, pct=invested?diff/invested*100:0;
    return `<div class="holding-item" data-holding="${i}"><div class="holding-main"><div class="holding-title">${h.name}</div><div class="holding-meta">${h.ticker} ・ ${h.shares}株 ・ ${h.currency}${h.updatedAt?` ・ 更新 ${new Date(h.updatedAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}`:''}</div></div><div class="holding-value"><strong>${yen.format(current)}</strong><span class="${pctClass(diff)}">${diff>=0?'+':''}${yen.format(diff)} (${signed(pct)})</span><br><button class="text-btn" data-remove="${i}">削除</button></div></div>`;
  }).join(''):'<article class="card"><p class="muted">まだ保有株がありません。「＋追加」から登録できます。</p></article>';
  const invested=state.holdings.reduce((s,h)=>s+currencyToYen(h.buyPrice*h.shares,h.currency),0), current=state.holdings.reduce((s,h)=>s+currencyToYen(h.currentPrice*h.shares,h.currency),0), diff=current-invested;
  $('#investedAmount').textContent=yen.format(invested);$('#currentAmount').textContent=yen.format(current);$('#profitAmount').textContent=`${diff>=0?'+':''}${yen.format(diff)}`;$('#profitAmount').className=pctClass(diff);$('#totalAsset').textContent=yen.format(current);
  renderAllocationFromHoldings();
}
function renderHoldingDetail(i){
  const h=state.holdings[i];if(!h)return;
  const invested=currencyToYen(h.buyPrice*h.shares,h.currency),current=currencyToYen(h.currentPrice*h.shares,h.currency),diff=current-invested,pct=invested?diff/invested*100:0;
  $('#holdingDetail').innerHTML=`<div class="card-title-row"><div><div class="muted">個別詳細</div><h3>${h.name} <span class="ticker">${h.ticker}</span></h3></div><button class="soft-btn" data-detail-refresh="${i}">↻ 更新</button></div><div class="summary-grid"><div><span>取得額</span><strong>${yen.format(invested)}</strong></div><div><span>評価額</span><strong>${yen.format(current)}</strong></div><div><span>損益</span><strong class="${pctClass(diff)}">${diff>=0?'+':''}${yen.format(diff)}<br>${signed(pct)}</strong></div></div><p class="muted">取得単価 ${money(h.buyPrice,h.currency)} / 現在 ${money(h.currentPrice,h.currency)} / ${h.shares}株</p>`;
  $('#holdingDetail').classList.remove('hidden');
}
function removeHolding(i){
  const h=state.holdings[i]; state.holdings.splice(i,1); state.trades.unshift({type:'削除',name:h.name,ticker:h.ticker,date:new Date().toISOString()}); saveHoldings();saveTrades();renderHoldings();$('#holdingDetail').classList.add('hidden');
}

function renderAllocationFromHoldings(){
  const totals={日本株:0,米国株:0,その他:0};
  state.holdings.forEach(h=>{const v=currencyToYen(h.currentPrice*h.shares,h.currency); if(h.currency==='JPY')totals.日本株+=v;else if(h.currency==='USD')totals.米国株+=v;else totals.その他+=v;});
  const sum=Object.values(totals).reduce((a,b)=>a+b,0)||1;const labels=Object.keys(totals),data=labels.map(k=>+(totals[k]/sum*100).toFixed(1));
  const markup=labels.map((l,i)=>`<div class="legend-row"><span><i class="dot" style="opacity:${1-i*.18}"></i>${l}</span><strong>${data[i]}%</strong></div>`).join('');$('#allocationLegend').innerHTML=markup;$('#analysisLegend').innerHTML=markup;
  [state.charts.allocation,state.charts.analysisPie].forEach(ch=>{if(ch){ch.data.labels=labels;ch.data.datasets[0].data=data;ch.update();}});
  const sectorTotals={};state.holdings.forEach(h=>{const s=h.sector||'その他',v=currencyToYen(h.currentPrice*h.shares,h.currency);sectorTotals[s]=(sectorTotals[s]||0)+v;});
  const sectors=Object.entries(sectorTotals).sort((a,b)=>b[1]-a[1]);$('#sectorBars').innerHTML=sectors.length?sectors.map(([n,v])=>{const p=v/sum*100;return `<div class="bar-row"><span>${n}</span><div class="bar"><i style="width:${Math.min(100,p)}%"></i></div><strong>${p.toFixed(0)}%</strong></div>`}).join(''):'<p class="muted">保有株を追加すると分析されます。</p>';
}

function switchView(name){
  $$('.view').forEach(v=>v.classList.remove('active'));$(`#view-${name}`)?.classList.add('active');$$('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  $('.section-kicker').textContent=({home:'ホーム',market:'マーケット',holdings:'保有株',analysis:'分析',learn:'学ぶ',fx:'為替'}[name]||'Stock Note');$('.topbar h2').textContent=({home:'資産サマリー',market:'マーケット',holdings:'ポートフォリオ',analysis:'分析',learn:'初心者ガイド',fx:'為替レート'}[name]||'Stock Note');
}

let searchTimer;
async function searchStocks(q){
  q=q.trim();if(q.length<1){$('#searchResults').innerHTML='';$('#searchStatus').textContent='入力すると実際の銘柄を検索します。';return;}
  if(!state.apiKey){$('#searchStatus').innerHTML='⚙ APIキーを設定すると実銘柄を検索できます。';$('#searchResults').innerHTML=demoSearch(q);return;}
  $('#searchStatus').textContent='検索中…';
  try{
    const data=await alpha({function:'SYMBOL_SEARCH',keywords:q});state.searchResults=(data.bestMatches||[]).slice(0,8).map(x=>({symbol:x['1. symbol'],name:x['2. name'],type:x['3. type'],region:x['4. region'],currency:x['8. currency']||'USD'}));
    $('#searchStatus').textContent=`${state.searchResults.length}件見つかりました`;
    $('#searchResults').innerHTML=state.searchResults.length?state.searchResults.map((r,i)=>`<button class="search-result" data-result="${i}"><span><strong>${r.name}</strong><br><small>${r.symbol} ・ ${r.region}</small></span><small>${r.currency}</small></button>`).join(''):'<div class="news-placeholder">該当する銘柄がありません。</div>';
  }catch(e){$('#searchStatus').textContent=`検索できませんでした：${e.message}`;$('#searchResults').innerHTML=demoSearch(q);}
}
function demoSearch(q){
  const list=[{symbol:'AAPL',name:'Apple Inc.',currency:'USD',region:'United States'},{symbol:'MSFT',name:'Microsoft Corporation',currency:'USD',region:'United States'},{symbol:'NVDA',name:'NVIDIA Corporation',currency:'USD',region:'United States'}].filter(x=>(x.symbol+x.name).toLowerCase().includes(q.toLowerCase()));state.searchResults=list;
  return list.map((r,i)=>`<button class="search-result" data-result="${i}"><span><strong>${r.name}</strong><br><small>${r.symbol} ・ DEMO</small></span><small>${r.currency}</small></button>`).join('') || '<div class="news-placeholder">APIキーを設定すると日本株を含むグローバル銘柄を検索できます。</div>';
}
async function selectSearchResult(i){const r=state.searchResults[i];if(!r)return;state.selected={...state.selected,...r};$('#searchResults').innerHTML='';$('#stockSearch').value=r.symbol;await loadSelectedStock();}

async function loadSelectedStock(force=false){
  const s=state.selected;$('#featureName').textContent=s.name;$('#featureTicker').textContent=s.symbol;$('#newsHeading').textContent=`${s.symbol} の最新ニュース`;
  $('.stock-feature').classList.add('loading');
  if(!state.apiKey){renderSelectedDemo();$('.stock-feature').classList.remove('loading');return;}
  try{
    const params={function:'GLOBAL_QUOTE',symbol:s.symbol};if(state.realtime)params.entitlement='realtime';
    const data=await alpha(params,{force}),q=data['Global Quote']||{};if(!q['05. price']) throw new Error('この銘柄の株価データがありません');
    s.price=+q['05. price'];s.changePercent=parseFloat((q['10. change percent']||'0').replace('%',''));s.currency=s.currency||'USD';
    $('#featurePrice').textContent=money(s.price,s.currency);$('#featureChange').textContent=signed(s.changePercent);$('#featureChange').className=pctClass(s.changePercent);updateFeatureYen();
    $('#quoteStatus').textContent=data.__fromCache?'CACHE':(state.realtime?'REALTIME':'MARKET');$('#quoteUpdated').textContent=`最終取引日 ${q['07. latest trading day']||'—'}${data.__fromCache?' ・ 保存済み':''}`;
    $('#newsList').innerHTML='<div class="news-placeholder">「更新」を押すと最新ニュースを取得します（API節約モード）。</div>';
  }catch(e){renderSelectedDemo();$('#quoteStatus').textContent='FALLBACK';$('#quoteUpdated').textContent=e.message;showToast('株価API: '+e.message,'error');}
  finally{$('.stock-feature').classList.remove('loading');}
}
function renderSelectedDemo(){const s=state.selected;if(!s.price)s.price=229.4;if(s.changePercent==null)s.changePercent=1.82;$('#featurePrice').textContent=money(s.price,s.currency||'USD');$('#featureChange').textContent=signed(s.changePercent);$('#featureChange').className=pctClass(s.changePercent);$('#quoteStatus').textContent='DEMO';$('#quoteUpdated').textContent=state.apiKey?'実データ取得失敗のためデモ表示':'APIキー未設定';updateFeatureYen();updateStockChart(['9:30','10:30','11:30','12:30','13:30','14:30','15:30'],[s.price*.96,s.price*.975,s.price*.97,s.price*.99,s.price*.985,s.price*1.005,s.price]);}
function updateFeatureYen(){const s=state.selected;$('#featureYen').textContent=s.currency==='JPY'?`日本円 ${yen.format(s.price)}`:`日本円換算：約 ${yen.format(currencyToYen(s.price,s.currency||'USD'))}`;}

async function loadSeries(period){
  if(!state.apiKey)return;
  try{
    let data,seriesObj;
    if(period==='1D'){
      try{data=await alpha({function:'TIME_SERIES_INTRADAY',symbol:state.selected.symbol,interval:'60min',outputsize:'compact'},{force:true});seriesObj=data['Time Series (60min)'];}catch(_){data=null;}
    }
    if(!seriesObj){data=await alpha({function:'TIME_SERIES_DAILY',symbol:state.selected.symbol,outputsize:period==='5Y'?'full':'compact'},{force:true});seriesObj=data['Time Series (Daily)'];}
    if(!seriesObj)throw new Error('チャートデータがありません');
    const entries=Object.entries(seriesObj).sort((a,b)=>new Date(a[0])-new Date(b[0]));
    const count={'1D':12,'1W':7,'1M':22,'3M':66,'1Y':252,'5Y':1260}[period]||22, sliced=entries.slice(-count);
    const step=Math.max(1,Math.ceil(sliced.length/80)),thin=sliced.filter((_,i)=>i%step===0||i===sliced.length-1);
    updateStockChart(thin.map(([d])=>period==='1D'?d.slice(11,16):d.slice(5)),thin.map(([,v])=>+v['4. close']));
  }catch(e){showToast('チャート: '+e.message,'error');}
}
function updateStockChart(labels,data){const ch=state.charts.stock;if(!ch)return;ch.data.labels=labels;ch.data.datasets[0].data=data;ch.update();}

async function loadNews(showErrors=true){
  if(!state.apiKey){$('#newsList').innerHTML='<div class="news-placeholder">⚙ APIキーを設定すると最新ニュースを取得します。</div>';return;}
  $('#newsList').innerHTML='<div class="news-placeholder">ニュース取得中…</div>';
  try{
    const data=await alpha({function:'NEWS_SENTIMENT',tickers:state.selected.symbol,sort:'LATEST',limit:'8'},{force:showErrors}),feed=(data.feed||[]).slice(0,6);
    $('#newsList').innerHTML=feed.length?feed.map(n=>`<a class="news-item" href="${n.url}" target="_blank" rel="noopener noreferrer"><strong>${n.title}</strong><small>${n.source||''} ・ ${formatAlphaTime(n.time_published)}${n.overall_sentiment_label?` ・ ${n.overall_sentiment_label}`:''}</small></a>`).join(''):'<div class="news-placeholder">関連ニュースはありません。</div>';
  }catch(e){$('#newsList').innerHTML=`<div class="news-placeholder">ニュース取得エラー：${e.message}</div>`;if(showErrors)showToast('ニュース: '+e.message,'error');}
}
function formatAlphaTime(v=''){if(v.length<8)return v;const y=v.slice(0,4),m=v.slice(4,6),d=v.slice(6,8),hh=v.slice(9,11),mm=v.slice(11,13);return `${y}/${m}/${d} ${hh}:${mm}`;}

async function updateFxRates(showMessage=false, force=false){
  if(!state.apiKey){renderFxList();updateConverter();return;}
  const needed=['USD','EUR','GBP','KRW','CNY'];let success=0;
  for(const c of needed){
    try{const d=await alpha({function:'CURRENCY_EXCHANGE_RATE',from_currency:c,to_currency:'JPY'},{force}),r=d['Realtime Currency Exchange Rate'];if(r?.['5. Exchange Rate']){state.fx[c]=+r['5. Exchange Rate'];success++;if(c==='USD')$('#fxUpdated').textContent=`更新 ${r['6. Last Refreshed']||''} ${r['7. Time Zone']||''}`;}}
    catch(e){if(c==='USD'&&showMessage)showToast('為替: '+e.message,'error');break;}
  }
  renderFxList();updateConverter();updateFeatureYen();renderHoldings();if(showMessage&&success)showToast(`${success}通貨の為替を更新しました`);
}
function updateConverter(){
  const amount=+$('#usdAmount').value||0,from=state.fromCurrency,to=state.targetCurrency,fromJPY=from==='JPY'?1:state.fx[from],toJPY=to==='JPY'?1:state.fx[to],rate=fromJPY/toJPY,result=amount*rate;
  $('#fromCurrencyLabel').textContent=from;$('#toCurrencyLabel').textContent=to;$('#jpyResult').textContent=money(result,to);$('#fxRateText').textContent=`1 ${from} = ${fmt(rate)} ${to}`;
}

async function testApiKey(){
  const st=$('#apiConnectionStatus');st.textContent='接続テスト中…';st.className='api-status';
  try{const d=await alpha({function:'CURRENCY_EXCHANGE_RATE',from_currency:'USD',to_currency:'JPY'},{force:true});if(!d['Realtime Currency Exchange Rate'])throw new Error('為替レスポンスを確認できません');st.textContent='接続成功 ✓ 実データを利用できます';st.className='api-status ok';return true;}catch(e){st.textContent='接続失敗：'+e.message;st.className='api-status error';return false;}
}

function initCharts(){
  const chartOpts={responsive:true,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#9a9189',font:{size:9},maxTicksLimit:7}},y:{grid:{color:'#f1ebe4'},ticks:{color:'#9a9189',font:{size:9}}}}};
  state.charts.asset=new Chart($('#assetMiniChart'),{type:'line',data:{labels:['1','2','3','4','5','6','7','8','9','10'],datasets:[{data:[102,106,105,110,112,111,117,121,119,126],borderColor:'#b9935a',backgroundColor:'rgba(185,147,90,.10)',fill:true,tension:.35,pointRadius:0}]},options:{...chartOpts,scales:{x:{display:false},y:{display:false}}}});
  state.charts.stock=new Chart($('#stockChart'),{type:'line',data:{labels:[],datasets:[{data:[],borderColor:'#c98a76',backgroundColor:'rgba(201,138,118,.09)',fill:true,tension:.3,pointRadius:0}]},options:chartOpts});
  state.charts.portfolio=new Chart($('#portfolioChart'),{type:'line',data:{labels:['4月','5月','6月','7月','8月','9月'],datasets:[{data:[1050000,1110000,1095000,1160000,1215000,1287654],borderColor:'#b9935a',backgroundColor:'rgba(185,147,90,.10)',fill:true,tension:.35,pointRadius:2}]},options:chartOpts});
  const doughnut={labels:['日本株','米国株','その他'],datasets:[{data:[40,48,12],backgroundColor:['#d8b57e','#d97f74','#e8ddd0'],borderWidth:0}]};
  state.charts.allocation=new Chart($('#allocationChart'),{type:'doughnut',data:JSON.parse(JSON.stringify(doughnut)),options:{plugins:{legend:{display:false}},cutout:'68%'}});state.charts.analysisPie=new Chart($('#analysisPie'),{type:'doughnut',data:JSON.parse(JSON.stringify(doughnut)),options:{plugins:{legend:{display:false}},cutout:'68%'}});
}
function changeHomePeriod(btn){$$('#view-home .segmented button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const sets={'1日':[102,106,105,110,112,111,117,121,119,126],'1週間':[98,100,104,103,108,112,126],'1ヶ月':[92,96,101,99,109,117,121,126],'3ヶ月':[85,90,94,101,98,111,116,126],'1年':[74,80,78,91,99,103,115,126]};state.charts.asset.data.datasets[0].data=sets[btn.textContent]||sets['1日'];state.charts.asset.data.labels=state.charts.asset.data.datasets[0].data.map((_,i)=>String(i+1));state.charts.asset.update();}
function renderAnalysis(mode){
  $$('#analysisTabs button').forEach(b=>b.classList.toggle('active',b.dataset.analysis===mode));
  if(mode==='asset'){$('#analysisTitle').textContent='あなたの傾向';$('#analysisContent').innerHTML='<p class="analysis-copy">保有資産の国・業種の偏りを確認できます。ひとつの業種に集中している場合は値動きも大きくなることがあります。</p>';}
  if(mode==='stock'){const best=[...state.holdings].map(h=>{const inv=currencyToYen(h.buyPrice*h.shares,h.currency),cur=currencyToYen(h.currentPrice*h.shares,h.currency);return {...h,p:inv?(cur-inv)/inv*100:0}}).sort((a,b)=>b.p-a.p)[0];$('#analysisTitle').textContent='銘柄分析';$('#analysisContent').innerHTML=best?`<p class="analysis-copy">現在もっとも損益率が高い銘柄は <strong>${best.name}</strong>（${signed(best.p)}）です。個別の値動きだけでなく全体配分も一緒に見ましょう。</p>`:'<p class="muted">保有株を追加すると分析します。</p>';}
  if(mode==='history'){$('#analysisTitle').textContent='取引履歴';$('#analysisContent').innerHTML=state.trades.length?state.trades.slice(0,12).map(t=>`<div class="market-row"><span>${t.type}</span><strong>${t.name}</strong><span>${new Date(t.date).toLocaleDateString('ja-JP')}</span></div>`).join(''):'<p class="muted">まだ取引履歴がありません。</p>';}
}
const lessons={
  basic:{title:'株の基礎知識',body:'<p><strong>株式</strong>は会社が資金を集めるために発行し、購入した人は株主になります。</p><div class="lesson-diagram">投資家 → 株を購入 → 会社の株主になる</div><h4>株主が期待できること</h4><p>株価上昇による値上がり益、会社によっては配当金や株主優待があります。ただし株価下落による損失もあります。</p><h4>大切なポイント</h4><p>株価だけでなく、会社の売上・利益・財務状態・成長性・業界環境を組み合わせて確認しましょう。</p>'},
  chart:{title:'チャートの見方',body:'<p>チャートは「価格がいつ、どのように動いたか」を図にしたものです。横軸が時間、縦軸が価格です。</p><div class="lesson-diagram">安値 ↘　📈　↗ 高値</div><h4>ローソク足</h4><p>1本のローソク足に始値・高値・安値・終値の4つの価格が入ります。1日足なら1本＝1日です。</p><h4>期間を変えて見る</h4><p>1日だけではなく、1か月・1年・5年などに切り替えると、短期の上下と長期の傾向を分けて考えやすくなります。</p>'},
  fx:{title:'為替と株価の関係',body:'<p>海外株を日本円で考えるときは、株価だけでなく為替も評価額に影響します。</p><div class="lesson-diagram">海外株価 × 為替レート ＝ 円換算の評価額</div><p>例えば100ドルの株なら、1ドル=150円では約15,000円、1ドル=140円では約14,000円です。株価が同じでも円換算額は変化します。</p>'},
  per:{title:'PER（株価収益率）',body:'<p><strong>PER = 株価 ÷ 1株当たり利益（EPS）</strong></p><div class="lesson-diagram">株価 2,000円 ÷ EPS 200円 ＝ PER 10倍</div><p>利益に対して株価が何倍まで買われているかを見る目安です。業種によって水準が大きく違うため、数字だけで割安・割高を決めません。</p>'},
  pbr:{title:'PBR（株価純資産倍率）',body:'<p><strong>PBR = 株価 ÷ 1株当たり純資産（BPS）</strong></p><div class="lesson-diagram">株価 1,500円 ÷ BPS 1,000円 ＝ PBR 1.5倍</div><p>会社の純資産に対して株価が何倍かを見る指標です。ROEや成長性などと一緒に見ると理解しやすくなります。</p>'},
  roe:{title:'ROE（自己資本利益率）',body:'<p><strong>ROE = 当期純利益 ÷ 自己資本 × 100</strong></p><p>株主から預かった資本をどれくらい効率よく利益につなげているかを見る目安です。高ければ必ず良いとは限らず、負債や一時的要因も確認します。</p>'},
  yield:{title:'配当利回り',body:'<p><strong>配当利回り = 年間1株配当 ÷ 株価 × 100</strong></p><div class="lesson-diagram">年間配当 50円 ÷ 株価 1,000円 ＝ 5%</div><p>株価に対して年間配当がどの程度かを見る目安です。配当は将来も同額とは限らず、減配・無配になる場合もあります。</p>'},
  risk:{title:'リスクと分散',body:'<p>投資では「どれくらい価格が変動する可能性があるか」も考えます。</p><div class="lesson-diagram">1社だけ △　→　国・業種・資産を分ける ◎</div><h4>分散の例</h4><p>複数企業、複数業種、日本と海外、株式とその他の資産などに分ける考え方があります。分散しても損失がなくなるわけではありません。</p>'},
  nisa:{title:'NISAの基本',body:'<p>NISAは、個人の資産形成を支援するための税制優遇制度です。通常、株式や投資信託の売却益・配当等には税金がかかりますが、NISA口座で対象商品に投資した利益は一定のルールのもと非課税になります。</p><div class="lesson-diagram">通常口座：利益 → 課税　｜　NISA：対象の利益 → 非課税</div><p>制度や対象商品は変更される可能性があるため、最新情報は金融庁の公式サイトで確認してください。</p>'}
};

function bindEvents(){
  $$('.bottom-nav button').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));$$('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.nav)));
  $('#settingsBtn').addEventListener('click',()=>{$('#apiKeyInput').value=state.apiKey;$('#realtimeEntitlement').checked=state.realtime;renderApiUsage();$('#settingsDialog').showModal();});
  $('#settingsForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();state.apiKey=$('#apiKeyInput').value.trim();state.realtime=$('#realtimeEntitlement').checked;localStorage.setItem(STORAGE.apiKey,state.apiKey);localStorage.setItem(STORAGE.realtime,String(state.realtime));const ok=await testApiKey();if(ok){setTimeout(()=>$('#settingsDialog').close(),500);renderApiUsage();showToast('接続OK。必要な情報だけ更新ボタンで取得できます');}});
  $('#clearApiBtn').addEventListener('click',()=>{state.apiKey='';localStorage.removeItem(STORAGE.apiKey);localStorage.removeItem(STORAGE.apiCache);$('#apiKeyInput').value='';$('#apiConnectionStatus').textContent='APIキーを削除しました';$('#apiConnectionStatus').className='api-status';showToast('デモモードに戻しました');renderSelectedDemo();});
  $('#stockSearch').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>searchStocks(e.target.value),450);});
  $('#searchResults').addEventListener('click',e=>{const b=e.target.closest('[data-result]');if(b)selectSearchResult(+b.dataset.result);});
  $('#refreshQuoteBtn').addEventListener('click',()=>loadSelectedStock(true));$('#refreshNewsBtn').addEventListener('click',()=>loadNews(true));
  $('#stockPeriods').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('#stockPeriods button').forEach(x=>x.classList.remove('active'));b.classList.add('active');loadSeries(b.dataset.period);});
  $$('#view-home .segmented button').forEach(b=>b.addEventListener('click',()=>changeHomePeriod(b)));
  $('#closeHoldingDialog').addEventListener('click',()=>$('#holdingDialog').close());
  $('#holdingDialog').addEventListener('click',e=>{if(e.target===$('#holdingDialog'))$('#holdingDialog').close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#holdingDialog').open)$('#holdingDialog').close();});
  $('#addHoldingBtn').addEventListener('click',()=>$('#holdingDialog').showModal());$('#addFeatureHolding').addEventListener('click',()=>{const f=$('#holdingForm');f.elements.name.value=state.selected.name;f.elements.ticker.value=state.selected.symbol;f.elements.currentPrice.value=state.selected.price||0;f.elements.currency.value=state.selected.currency||'USD';$('#holdingDialog').showModal();});
  $('#holdingForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;const fd=new FormData(e.currentTarget),h={name:fd.get('name'),ticker:fd.get('ticker'),apiSymbol:fd.get('ticker'),shares:+fd.get('shares'),buyPrice:+fd.get('buyPrice'),currentPrice:+fd.get('currentPrice'),currency:fd.get('currency'),sector:'その他',addedAt:new Date().toISOString()};state.holdings.push(h);state.trades.unshift({type:'追加',name:h.name,ticker:h.ticker,date:new Date().toISOString()});saveHoldings();saveTrades();renderHoldings();e.currentTarget.reset();showToast('保有株に追加しました');});
  $('#holdingsList').addEventListener('click',e=>{const r=e.target.closest('[data-remove]');if(r){e.stopPropagation();removeHolding(+r.dataset.remove);return;}const item=e.target.closest('[data-holding]');if(item){$$('#holdingTabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode==='single'));renderHoldingDetail(+item.dataset.holding);}});
  $('#holdingTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('#holdingTabs button').forEach(x=>x.classList.toggle('active',x===b));if(b.dataset.mode==='all')$('#holdingDetail').classList.add('hidden');else if(state.holdings.length)renderHoldingDetail(0);});
  $('#holdingDetail').addEventListener('click',e=>{const b=e.target.closest('[data-detail-refresh]');if(b)refreshHolding(+b.dataset.detailRefresh);});
  $('#refreshHoldingsBtn').addEventListener('click',refreshAllHoldings);
  $('#analysisTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)renderAnalysis(b.dataset.analysis);});
  $$('.learn-list button').forEach(b=>b.addEventListener('click',()=>{const l=lessons[b.dataset.lesson];$('#lessonTitle').textContent=l.title;$('#lessonBody').innerHTML=l.body;$('#lessonDialog').showModal();}));$('#closeLessonBtn').addEventListener('click',()=>$('#lessonDialog').close());
  $('#refreshFxBtn')?.addEventListener('click',()=>updateFxRates(true,true));$('#usdAmount').addEventListener('input',updateConverter);$('#fxTargetTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;state.targetCurrency=b.dataset.currency;$$('#fxTargetTabs button').forEach(x=>x.classList.toggle('active',x===b));updateConverter();});$('#fxList').addEventListener('click',e=>{const row=e.target.closest('.market-row');if(!row)return;const c=row.querySelector('span')?.textContent.split('/')[0].trim();if(c&&state.fx[c]){state.fromCurrency=c;updateConverter();}});
  $('.swap').addEventListener('click',()=>{const old=state.fromCurrency;state.fromCurrency=state.targetCurrency;state.targetCurrency=old;if(!['JPY','USD','EUR'].includes(state.targetCurrency))state.targetCurrency='JPY';$$('#fxTargetTabs button').forEach(x=>x.classList.toggle('active',x.dataset.currency===state.targetCurrency));updateConverter();});
  $$('.tabs').forEach(tab=>{if(['holdingTabs','analysisTabs','fxTargetTabs'].includes(tab.id))return;tab.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.dataset.nav)return;[...tab.children].forEach(x=>x.classList.toggle('active',x===b));if(tab.closest('#view-market')){const q={日本株:'Toyota',米国株:'Apple',ETF:'SPY'}[b.textContent];if(q){$('#stockSearch').value=q;searchStocks(q);}}});});
}
async function refreshHolding(i){const h=state.holdings[i];if(!h)return;if(!state.apiKey){showToast('⚙ APIキーを設定してください','error');return;}try{const d=await alpha({function:'GLOBAL_QUOTE',symbol:h.apiSymbol||h.ticker},{force:true}),q=d['Global Quote'];if(!q?.['05. price'])throw new Error('価格がありません');h.currentPrice=+q['05. price'];h.updatedAt=new Date().toISOString();saveHoldings();renderHoldings();renderHoldingDetail(i);showToast(`${h.name}を更新しました`);}catch(e){showToast(e.message,'error');}}
async function refreshAllHoldings(){if(!state.apiKey){showToast('⚙ APIキーを設定してください','error');return;}$('#refreshHoldingsBtn').disabled=true;let ok=0;for(let i=0;i<state.holdings.length;i++){try{const h=state.holdings[i],d=await alpha({function:'GLOBAL_QUOTE',symbol:h.apiSymbol||h.ticker},{force:true}),q=d['Global Quote'];if(q?.['05. price']){h.currentPrice=+q['05. price'];h.updatedAt=new Date().toISOString();ok++;}}catch(e){showToast(`API制限または銘柄形式を確認: ${e.message}`,'error');break;}}saveHoldings();renderHoldings();$('#refreshHoldingsBtn').disabled=false;showToast(`${ok}/${state.holdings.length}銘柄を更新しました`);}

async function boot(){initCharts();bindEvents();renderMarkets();renderHoldings();renderSelectedDemo();renderAnalysis('asset');updateConverter();renderApiUsage();if(state.apiKey){$('#apiConnectionStatus').textContent='保存済みAPIキーあり（節約モード）';} }
boot();
