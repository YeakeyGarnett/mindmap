import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { PROVIDERS, loadSettings, saveSettings, callAI, parseJSON } from './ai.js';
import { SYS_GEN, SYS_MERGE, SYS_EXPAND, SYS_CHAT } from './prompts.js';

/* ═══ THEME ═══ */
const BC = ['#6c5ce7','#00cec9','#e17055','#fdcb6e','#55efc4','#fd79a8','#a29bfe','#74b9ff','#ffeaa7','#81ecec'];
const C = { bg:'#0b0b12',surface:'#111119',card:'#161620',border:'#1e1e30',borderHi:'#2d2d4a',
  text:'#e4e4ee',textSec:'#b0b0c8',dim:'#6b6b88',accent:'#6c5ce7',accentLit:'#a29bfe',
  key:'#ffd32a',ok:'#00b894',err:'#e17055',white:'#fff' };
const F = "'Noto Sans SC','PingFang SC',-apple-system,sans-serif";
let _u=0; const uid=(p='n')=>`${p}${++_u}_${Date.now().toString(36)}`;

/* ═══ LAYOUT ═══ */
function layoutTree(tree){
  if(!tree)return{nodes:[],edges:[],w:0,h:0};
  const RH=38,GAP=8,GGAP=28;
  const L0X=60,L0W=180,L1X=L0X+L0W+80,L1W=170,L2X=L1X+L1W+70,L2W=260;
  const nodes=[],edges=[],branches=tree.branches||[];
  let totalH=0;
  const meta=branches.map((br,bi)=>{
    const kids=br.children||[];const h=Math.max(1,kids.length)*(RH+GAP)-GAP;
    const top=totalH;totalH+=h+GGAP;return{br,bi,kids,h,top};
  });
  if(totalH>0)totalH-=GGAP; totalH=Math.max(totalH,RH);
  const rootY=totalH/2;
  nodes.push({id:tree._rootId,label:tree.title,x:L0X,y:rootY,w:L0W,h:46,depth:0});
  meta.forEach(({br,bi,kids,h,top})=>{
    const col=BC[bi%BC.length],brY=top+h/2;
    nodes.push({id:br._id,label:br.label,x:L1X,y:brY,w:L1W,h:38,depth:1,color:col,parentId:tree._rootId});
    edges.push({x1:L0X+L0W,y1:rootY,x2:L1X,y2:brY,color:col});
    kids.forEach((ch,ci)=>{
      const cy=top+ci*(RH+GAP)+RH/2;
      nodes.push({id:ch._id,label:ch.label,x:L2X,y:cy,w:L2W,h:34,depth:2,color:col,isKey:ch.isKey,parentId:br._id});
      edges.push({x1:L1X+L1W,y1:brY,x2:L2X,y2:cy,color:col});
    });
  });
  return{nodes,edges,w:L2X+L2W+120,h:totalH+60};
}
function ePath(e){const mx=(e.x1+e.x2)/2;return`M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`;}

/* ═══ ActBtn ═══ */
function ActBtn({x,y,w,h,icon,color,bg,border,title,onClick}){
  const[hov,setHov]=useState(false);
  return(<g transform={`translate(${x},${y})`} style={{cursor:'pointer'}}
    onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} onClick={onClick}>
    <title>{title}</title>
    <rect width={w} height={h} rx={5} fill={hov?(bg||C.card):'transparent'}
      stroke={hov?(border||C.border):'transparent'} strokeWidth={0.8}/>
    <text x={w/2} y={h/2+1} textAnchor="middle" dominantBaseline="central"
      fill={color} fontSize={11} fontWeight={600} fontFamily={F} style={{pointerEvents:'none'}}>{icon}</text>
  </g>);
}

/* ═══ TreeNode ═══ */
function TreeNode({node,onUpdate,onDelete,onAddChild,onExpand,color}){
  const[editing,setEditing]=useState(false);
  const[val,setVal]=useState(node.label);
  const[hov,setHov]=useState(false);
  const inputRef=useRef(null);
  useEffect(()=>setVal(node.label),[node.label]);
  useEffect(()=>{if(editing&&inputRef.current){inputRef.current.focus();inputRef.current.select();}},[editing]);
  const commit=()=>{setEditing(false);if(val.trim()&&val!==node.label)onUpdate(node.id,{label:val.trim()});else setVal(node.label);};
  const isR=node.depth===0,isL1=node.depth===1;
  const bg=isR?C.accent:isL1?color+'1a':C.card;
  const bdr=isR?C.accent:isL1?color+'50':C.border;
  const tc=isR?C.white:isL1?color:C.text;
  const fs=isR?15:isL1?13:12,fw=isR?700:isL1?600:400;
  const maxCh=isR?12:isL1?13:24;
  const actions=[];
  actions.push({icon:'+',color:C.accentLit,bg:C.accent+'15',border:C.accent+'40',title:'添加子节点',fn:()=>onAddChild(node.id)});
  if(node.depth>=1)actions.push({icon:'AI',color:'#fff',bg:C.accent+'30',border:C.accent+'60',title:'AI 拓展 / 提问',fn:()=>onExpand(node)});
  if(node.depth>=2)actions.push({icon:'★',color:node.isKey?C.key:C.dim,bg:node.isKey?C.key+'20':'transparent',border:node.isKey?C.key+'50':C.border,title:node.isKey?'取消重点':'标为重点',fn:()=>onUpdate(node.id,{isKey:!node.isKey})});
  if(!isR)actions.push({icon:'×',color:C.err,bg:C.err+'10',border:C.err+'30',title:'删除',fn:()=>onDelete(node.id)});
  return(
    <g transform={`translate(${node.x},${node.y-node.h/2})`}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <rect width={node.w} height={node.h} rx={isR?12:isL1?8:6}
        fill={bg} stroke={hov?(color||C.accentLit):bdr} strokeWidth={hov?1.5:1}
        style={{cursor:'pointer'}} onDoubleClick={()=>setEditing(true)}/>
      {node.isKey&&<circle cx={10} cy={node.h/2} r={3.5} fill={C.key}/>}
      {editing?(
        <foreignObject x={node.isKey?20:8} y={1} width={node.w-(node.isKey?28:16)} height={node.h-2}>
          <input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit}
            onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(node.label);setEditing(false);}}}
            style={{width:'100%',height:'100%',background:'transparent',border:'none',color:tc,fontSize:fs,fontWeight:fw,fontFamily:F,outline:'none'}}/>
        </foreignObject>
      ):(
        <text x={node.isKey?20:10} y={node.h/2+1} dominantBaseline="central"
          fill={tc} fontSize={fs} fontWeight={fw} fontFamily={F} style={{userSelect:'none',pointerEvents:'none'}}>
          {node.label.length>maxCh?node.label.slice(0,maxCh-1)+'…':node.label}
          <title>{node.label}</title>
        </text>
      )}
      {hov&&!editing&&(
        <g transform={`translate(${node.w+6},${(node.h-22)/2})`}>
          {actions.map((a,i)=>(<ActBtn key={i} x={i*29} y={0} w={26} h={22}
            icon={a.icon} color={a.color} bg={a.bg} border={a.border} title={a.title} onClick={a.fn}/>))}
        </g>
      )}
    </g>
  );
}

/* ═══ AIPanel ═══ */
function AIPanel({popup,onClose,onAddIdea,tree,settings}){
  const[chatInput,setChatInput]=useState('');
  const[chatHistory,setChatHistory]=useState([]);
  const[chatLoading,setChatLoading]=useState(false);
  const chatEndRef=useRef(null);
  const inputRef=useRef(null);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chatHistory,popup?.ideas]);
  useEffect(()=>{setChatHistory([]);setChatInput('');},[popup?.node?.id]);

  const askAI=async()=>{
    if(!chatInput.trim()||chatLoading)return;
    const q=chatInput.trim();setChatInput('');
    setChatHistory(h=>[...h,{role:'user',text:q}]);
    setChatLoading(true);
    try{
      const ctx=tree?`课程：${tree.title}\n节点：${popup.node.label}\n结构：${(tree.branches||[]).map(b=>b.label).join(',')}`:'';
      const answer=await callAI(settings,SYS_CHAT,`${ctx}\n\n问题：${q}`,500);
      setChatHistory(h=>[...h,{role:'ai',text:answer}]);
    }catch(e){setChatHistory(h=>[...h,{role:'ai',text:'请求失败: '+(e.message||'请重试')}]);}
    setChatLoading(false);
    setTimeout(()=>inputRef.current?.focus(),100);
  };

  if(!popup)return null;
  return(<>
    <div onClick={()=>!popup.loading&&!chatLoading&&onClose()}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:199}}/>
    <div onClick={e=>e.stopPropagation()} style={{
      position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:200,
      width:460,maxHeight:'80vh',background:C.card,border:`1px solid ${C.accent}40`,borderRadius:16,
      boxShadow:`0 20px 60px rgba(0,0,0,0.6)`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'14px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
        <div>
          <div style={{fontSize:14,fontWeight:600,color:C.accentLit,display:'flex',alignItems:'center',gap:8}}>
            <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:26,height:26,borderRadius:7,
              background:`linear-gradient(135deg,${C.accent},${C.accentLit})`,fontSize:11,fontWeight:700,color:'#fff'}}>AI</span>
            AI 助手
          </div>
          <div style={{fontSize:12,color:C.dim,marginTop:3,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>「{popup.node.label}」</div>
        </div>
        <button onClick={onClose} style={{width:28,height:28,borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',color:C.dim,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
      </div>
      {/* Body */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 18px'}}>
        {popup.loading?(
          <div style={{textAlign:'center',padding:'24px 0',color:C.dim,fontSize:13}}>
            <div style={{animation:'pulse 1.5s ease infinite'}}>✨ 生成启发中…</div></div>
        ):popup.ideas.length>0&&(
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,color:C.dim,marginBottom:6,fontWeight:600}}>💡 AI 启发</div>
            {popup.ideas.map((idea,i)=>(
              <div key={i} style={{padding:'8px 12px',borderRadius:8,background:C.bg,border:`1px solid ${C.border}`,fontSize:13,lineHeight:1.6,color:C.textSec,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:5}}>
                <span style={{flex:1}}>💡 {idea}</span>
                <button onClick={()=>onAddIdea(idea)} style={{padding:'3px 10px',borderRadius:5,border:`1px solid ${C.accent}40`,background:C.accent+'15',color:C.accentLit,fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:F,whiteSpace:'nowrap',flexShrink:0}}>+ 加入</button>
              </div>
            ))}
          </div>
        )}
        {chatHistory.length>0&&(<>
          {popup.ideas.length>0&&<div style={{height:1,background:C.border,margin:'8px 0 12px'}}/>}
          <div style={{fontSize:11,color:C.dim,marginBottom:6,fontWeight:600}}>💬 对话</div>
          {chatHistory.map((msg,i)=>(
            <div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start',marginBottom:8}}>
              <div style={{maxWidth:'85%',padding:'8px 12px',borderRadius:10,
                background:msg.role==='user'?C.accent+'25':C.bg,border:`1px solid ${msg.role==='user'?C.accent+'40':C.border}`,
                fontSize:13,lineHeight:1.7,color:msg.role==='user'?C.accentLit:C.textSec}}>
                {msg.text}
                {msg.role==='ai'&&msg.text.length<=30&&(
                  <span onClick={()=>onAddIdea(msg.text)} style={{marginLeft:6,fontSize:10,color:C.accentLit,cursor:'pointer',opacity:0.7,textDecoration:'underline'}}>加入导图</span>
                )}
              </div>
            </div>
          ))}
          {chatLoading&&<div style={{display:'flex'}}><div style={{padding:'8px 14px',borderRadius:10,background:C.bg,border:`1px solid ${C.border}`,fontSize:13,color:C.dim,animation:'pulse 1.2s ease infinite'}}>思考中…</div></div>}
        </>)}
        <div ref={chatEndRef}/>
      </div>
      {/* Input */}
      <div style={{padding:'10px 14px',borderTop:`1px solid ${C.border}`,background:C.surface,flexShrink:0}}>
        <div style={{display:'flex',gap:8,background:C.bg,borderRadius:10,border:`1px solid ${C.border}`,padding:'4px 4px 4px 14px'}}>
          <input ref={inputRef} value={chatInput} onChange={e=>setChatInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();askAI();}}}
            placeholder="追问细节、要求举例、深入探讨…"
            style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:13,fontFamily:F,outline:'none',padding:'6px 0'}}/>
          <button onClick={askAI} disabled={!chatInput.trim()||chatLoading} style={{
            padding:'6px 14px',borderRadius:7,border:'none',
            background:chatInput.trim()&&!chatLoading?C.accent:C.border,
            color:chatInput.trim()&&!chatLoading?'#fff':C.dim,
            fontSize:12,fontWeight:600,cursor:chatInput.trim()&&!chatLoading?'pointer':'not-allowed',fontFamily:F,flexShrink:0}}>发送</button>
        </div>
      </div>
    </div>
  </>);
}

/* ═══ Settings Panel ═══ */
function SettingsPanel({settings,setSettings,onClose}){
  const update=(k,v)=>{const s={...settings,[k]:v};setSettings(s);saveSettings(s);};
  const updateKey=(provider,key)=>{const keys={...settings.keys,[provider]:key};update('keys',keys);};
  const updateModel=(provider,model)=>{const models={...settings.models,[provider]:model};update('models',models);};
  return(
    <div onClick={e=>e.stopPropagation()} style={{
      position:'absolute',top:52,right:20,zIndex:200,width:400,
      background:C.card,border:`1px solid ${C.border}`,borderRadius:14,
      boxShadow:`0 16px 50px rgba(0,0,0,0.6)`,padding:20,maxHeight:'80vh',overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{fontSize:14,fontWeight:700}}>⚙️ AI 设置</div>
        <button onClick={onClose} style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',color:C.dim,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
      </div>
      {/* Provider select */}
      <div style={{fontSize:12,color:C.dim,marginBottom:6}}>选择 AI 服务商</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        {Object.entries(PROVIDERS).map(([key,p])=>(
          <button key={key} onClick={()=>update('provider',key)} style={{
            padding:'5px 12px',borderRadius:7,fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:F,
            background:settings.provider===key?C.accent+'25':'transparent',
            border:`1px solid ${settings.provider===key?C.accent+'60':C.border}`,
            color:settings.provider===key?C.accentLit:C.dim}}>{p.name}</button>
        ))}
      </div>
      {/* Keys for each provider */}
      {Object.entries(PROVIDERS).map(([key,p])=>(
        <div key={key} style={{marginBottom:12}}>
          <div style={{fontSize:11,color:settings.provider===key?C.accentLit:C.dim,marginBottom:4,fontWeight:settings.provider===key?600:400}}>
            {p.name} API Key {settings.provider===key&&'✓ 当前'}
          </div>
          <div style={{display:'flex',gap:6}}>
            <input value={settings.keys[key]||''} onChange={e=>updateKey(key,e.target.value)}
              placeholder={p.placeholder} type="password"
              style={{flex:1,padding:'7px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:11,fontFamily:F,outline:'none',boxSizing:'border-box'}}/>
            <select value={settings.models[key]||p.defaultModel} onChange={e=>updateModel(key,e.target.value)}
              style={{padding:'7px 8px',borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:11,fontFamily:F,outline:'none'}}>
              {p.models.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      ))}
      {/* Proxy URL */}
      <div style={{marginTop:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,color:C.dim,marginBottom:4}}>CORS 代理地址（可选，自部署时用）</div>
        <input value={settings.proxyUrl||''} onChange={e=>update('proxyUrl',e.target.value)}
          placeholder="https://your-worker.your-name.workers.dev"
          style={{width:'100%',padding:'7px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:11,fontFamily:F,outline:'none',boxSizing:'border-box'}}/>
        <div style={{fontSize:10,color:C.dim,marginTop:6,lineHeight:1.6,opacity:0.7}}>
          部分 API（如 Anthropic）不支持浏览器直接调用，需要 CORS 代理。
          <br/>Gemini / Kimi / MiniMax 通常可直接调用。
          <br/>所有 Key 仅保存在浏览器本地。
        </div>
      </div>
    </div>
  );
}

/* ═══ MAIN APP ═══ */
export default function App(){
  const[settings,setSettings]=useState(loadSettings);
  const[sections,setSections]=useState([]);
  const[activeIdx,setActiveIdx]=useState(-1);
  const[mergedTree,setMergedTree]=useState(null);
  const[viewMode,setViewMode]=useState('none');
  const[inputText,setInputText]=useState('');
  const[focusHint,setFocusHint]=useState('');
  const[loading,setLoading]=useState(false);
  const[loadMsg,setLoadMsg]=useState('');
  const[expandPopup,setExpandPopup]=useState(null);
  const[showSettings,setShowSettings]=useState(false);
  const[showSource,setShowSource]=useState(false);
  const[cam,setCam]=useState({x:0,y:0,z:1});
  const dragRef=useRef(null);
  const canvasRef=useRef(null);

  const tree=viewMode==='merged'?mergedTree:viewMode==='section'&&activeIdx>=0?sections[activeIdx]?.tree:null;
  const layout=useMemo(()=>layoutTree(tree),[tree]);

  useEffect(()=>{const el=canvasRef.current;if(!el)return;
    const h=e=>{e.preventDefault();const f=e.deltaY>0?0.93:1.07;setCam(c=>({...c,z:Math.min(3,Math.max(0.2,c.z*f))}));};
    el.addEventListener('wheel',h,{passive:false});return()=>el.removeEventListener('wheel',h);},[]);

  const onPD=useCallback(e=>{if(e.target.closest('[data-nocanvas]'))return;dragRef.current={sx:e.clientX,sy:e.clientY,cx:cam.x,cy:cam.y};},[cam]);
  const onPM=useCallback(e=>{if(!dragRef.current)return;setCam(c=>({...c,x:dragRef.current.cx+(e.clientX-dragRef.current.sx),y:dragRef.current.cy+(e.clientY-dragRef.current.sy)}));},[]);
  const onPU=useCallback(()=>{dragRef.current=null;},[]);
  const resetCam=()=>setCam({x:0,y:0,z:1});

  useEffect(()=>{if(!loading)return;const m=['深度阅读…','识别要点…','过滤冗余…','构建结构…'];let i=0;setLoadMsg(m[0]);const t=setInterval(()=>{i=(i+1)%m.length;setLoadMsg(m[i]);},1600);return()=>clearInterval(t);},[loading]);

  const doAI=async(sys,msg,mt=1000)=>{const raw=await callAI(settings,sys,msg,mt);return parseJSON(raw);};

  const genSection=async()=>{
    if(!inputText.trim()||loading)return;setLoading(true);
    try{
      const hint=focusHint?`\n【重点关注】${focusHint}`:'';
      const t=await doAI(SYS_GEN,`提炼重要知识点：\n\n${inputText.slice(0,10000)}${hint}`);
      t._rootId=uid('r');t.branches?.forEach(b=>{b._id=uid('b');(b.children||[]).forEach(c=>{c._id=uid('c');});});
      setSections(p=>[...p,{id:uid('s'),name:t.title,tree:t,sourceText:inputText}]);
      setActiveIdx(sections.length);setViewMode('section');resetCam();
    }catch(e){alert('生成失败: '+(e.message||'请重试'));}
    setLoading(false);
  };

  const mergeAll=async()=>{
    if(sections.length<2||loading)return;setLoading(true);
    try{
      const d=sections.map(s=>JSON.stringify(s.tree)).join('\n---\n');
      const t=await doAI(SYS_MERGE,`合并：\n\n${d.slice(0,15000)}`);
      t._rootId=uid('r');t.branches?.forEach(b=>{b._id=uid('b');(b.children||[]).forEach(c=>{c._id=uid('c');});});
      setMergedTree(t);setViewMode('merged');resetCam();
    }catch{alert('合并失败');}
    setLoading(false);
  };

  const doExpand=async(node)=>{
    const ctx=tree?tree.title+'>'+(tree.branches||[]).map(b=>b.label).join(','):'';
    setExpandPopup({node,ideas:[],loading:true});
    try{
      const ideas=await doAI(SYS_EXPAND,`节点:"${node.label}"\n上下文:${ctx}`,600);
      setExpandPopup({node,ideas:Array.isArray(ideas)?ideas:[],loading:false});
    }catch{setExpandPopup(p=>({...p,ideas:['生成失败'],loading:false}));}
  };

  const mut=fn=>{
    const apply=t=>fn(JSON.parse(JSON.stringify(t)));
    if(viewMode==='merged')setMergedTree(m=>apply(m));
    else setSections(p=>p.map((s,i)=>i===activeIdx?{...s,tree:apply(s.tree)}:s));
  };
  const updateNode=(id,upd)=>mut(t=>{if(id===t._rootId){if(upd.label)t.title=upd.label;return t;}for(const b of t.branches||[]){if(b._id===id){Object.assign(b,upd);return t;}for(const c of b.children||[]){if(c._id===id){Object.assign(c,upd);return t;}}}return t;});
  const deleteNode=id=>mut(t=>{t.branches=(t.branches||[]).filter(b=>{if(b._id===id)return false;b.children=(b.children||[]).filter(c=>c._id!==id);return true;});return t;});
  const addChild=pid=>mut(t=>{if(pid===t._rootId){t.branches=[...(t.branches||[]),{label:'新分支',_id:uid('b'),children:[]}];return t;}for(const b of t.branches||[]){if(b._id===pid){b.children=[...(b.children||[]),{label:'新节点',isKey:false,_id:uid('c')}];return t;}}return t;});
  const addExpandIdea=idea=>{if(!expandPopup)return;const pid=expandPopup.node.id;mut(t=>{for(const b of t.branches||[]){if(b._id===pid){b.children=[...(b.children||[]),{label:idea,isKey:false,_id:uid('c')}];return t;}for(const c of b.children||[]){if(c._id===pid){b.children=[...b.children,{label:idea,isKey:false,_id:uid('c')}];return t;}}}return t;});};
  const delSection=i=>{setSections(p=>p.filter((_,j)=>j!==i));if(activeIdx===i){setActiveIdx(-1);setViewMode('none');}else if(activeIdx>i)setActiveIdx(activeIdx-1);};

  /* Save / Load */
  const saveProject=()=>{
    const data={sections:sections.map(s=>({name:s.name,tree:s.tree,sourceText:s.sourceText})),mergedTree};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`coursemind_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);
  };
  const loadProject=e=>{
    const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();
    reader.onload=ev=>{try{
      const data=JSON.parse(ev.target.result);
      const loaded=(data.sections||[]).map(s=>{s.tree._rootId=s.tree._rootId||uid('r');s.tree.branches?.forEach(b=>{b._id=b._id||uid('b');(b.children||[]).forEach(c=>{c._id=c._id||uid('c');});});return{id:uid('s'),name:s.name,tree:s.tree,sourceText:s.sourceText||''};});
      setSections(loaded);
      if(data.mergedTree){data.mergedTree._rootId=data.mergedTree._rootId||uid('r');data.mergedTree.branches?.forEach(b=>{b._id=b._id||uid('b');(b.children||[]).forEach(c=>{c._id=c._id||uid('c');});});setMergedTree(data.mergedTree);}
      if(loaded.length>0){setActiveIdx(0);setViewMode('section');}resetCam();
    }catch{alert('文件格式错误');}};reader.readAsText(file);e.target.value='';
  };

  const currentSourceText=viewMode==='section'&&activeIdx>=0?sections[activeIdx]?.sourceText||'':'';
  const providerName=PROVIDERS[settings.provider]?.name||settings.provider;

  return(
    <div style={{height:'100vh',display:'flex',flexDirection:'column',background:C.bg,fontFamily:F,color:C.text,overflow:'hidden'}}>
      {/* HEADER */}
      <div style={{padding:'10px 24px',borderBottom:`1px solid ${C.border}`,background:C.surface+'ee',display:'flex',alignItems:'center',gap:12,flexShrink:0,backdropFilter:'blur(16px)',zIndex:50}}>
        <div style={{width:32,height:32,borderRadius:8,background:`linear-gradient(135deg,${C.accent},${C.accentLit})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>🧠</div>
        <div style={{flex:1}}><div style={{fontSize:15,fontWeight:700}}>课脉 CourseMind</div></div>
        <div style={{fontSize:10,color:C.dim,marginRight:8}}>当前: {providerName}</div>
        <div style={{display:'flex',gap:6}}>
          {sections.length>0&&<button onClick={saveProject} style={tbs}>💾 保存</button>}
          <label style={{...tbs,cursor:'pointer'}}>📂 导入<input type="file" accept=".json" onChange={loadProject} style={{display:'none'}}/></label>
          <button onClick={()=>setShowSettings(s=>!s)} style={tbs}>⚙️ AI设置</button>
        </div>
      </div>
      {showSettings&&<SettingsPanel settings={settings} setSettings={s=>{setSettings(s);saveSettings(s);}} onClose={()=>setShowSettings(false)}/>}

      {/* MAIN */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* LEFT */}
        <div style={{width:340,minWidth:340,borderRight:`1px solid ${C.border}`,background:C.surface,display:'flex',flexDirection:'column',overflow:'hidden',flexShrink:0}}>
          {/* Input */}
          <div style={{padding:'12px 12px 8px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <textarea value={inputText} onChange={e=>setInputText(e.target.value)} placeholder="粘贴本小节课程内容…"
              style={{width:'100%',height:100,padding:10,borderRadius:9,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:12.5,lineHeight:1.7,resize:'none',fontFamily:F,outline:'none',boxSizing:'border-box'}}
              onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
            <div style={{display:'flex',gap:6,marginTop:6}}>
              <input value={focusHint} onChange={e=>setFocusHint(e.target.value)} placeholder="重点方向（可选）"
                style={{flex:1,padding:'6px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:C.bg,color:C.text,fontSize:11,fontFamily:F,outline:'none',boxSizing:'border-box'}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              <button onClick={genSection} disabled={!inputText.trim()||loading} style={{
                padding:'6px 16px',borderRadius:8,border:'none',
                background:inputText.trim()&&!loading?C.accent:C.border,
                color:inputText.trim()&&!loading?'#fff':C.dim,
                fontSize:12,fontWeight:700,cursor:inputText.trim()&&!loading?'pointer':'not-allowed',fontFamily:F,whiteSpace:'nowrap'
              }}>{loading?'⏳':'✦ 生成'}</button>
            </div>
          </div>
          {/* Tabs */}
          <div style={{padding:'6px 10px',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
              {sections.map((sec,i)=>(
                <div key={sec.id} onClick={()=>{setActiveIdx(i);setViewMode('section');resetCam();}}
                  style={{padding:'3px 10px',borderRadius:6,fontSize:11,cursor:'pointer',
                    background:viewMode==='section'&&activeIdx===i?C.accent+'20':'transparent',
                    border:`1px solid ${viewMode==='section'&&activeIdx===i?C.accent+'50':C.border}`,
                    color:viewMode==='section'&&activeIdx===i?C.accentLit:C.dim,display:'flex',alignItems:'center',gap:4}}>
                  <span style={{fontWeight:500}}>{sec.name}</span>
                  <span onClick={e=>{e.stopPropagation();delSection(i);}} style={{fontSize:12,color:C.dim,cursor:'pointer'}}
                    onMouseEnter={e=>e.target.style.color=C.err} onMouseLeave={e=>e.target.style.color=C.dim}>×</span>
                </div>
              ))}
              {sections.length>=2&&(
                <button onClick={()=>mergedTree?setViewMode('merged'):mergeAll()} style={{
                  padding:'3px 10px',borderRadius:6,fontSize:11,fontWeight:600,
                  background:viewMode==='merged'?C.accent+'20':'transparent',
                  border:`1px solid ${viewMode==='merged'?C.accent+'50':C.accent+'30'}`,
                  color:C.accentLit,cursor:'pointer',fontFamily:F}}>{mergedTree?'📚总图':'📚合并'}</button>
              )}
            </div>
          </div>
          {/* Source text */}
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            <div onClick={()=>setShowSource(s=>!s)} style={{padding:'7px 12px',fontSize:11,color:C.dim,cursor:'pointer',display:'flex',justifyContent:'space-between',flexShrink:0,borderBottom:showSource?`1px solid ${C.border}`:'none'}}>
              <span>📄 原文对照</span><span style={{fontSize:10}}>{showSource?'▼':'▶'}</span>
            </div>
            {showSource&&(
              <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
                {currentSourceText?<div style={{fontSize:12,lineHeight:1.8,color:C.textSec,whiteSpace:'pre-wrap',wordBreak:'break-all'}}>{currentSourceText}</div>
                :<div style={{fontSize:12,color:C.dim,opacity:0.5,textAlign:'center',padding:'20px 0'}}>{viewMode==='section'?'该节无原文':'选择小节查看原文'}</div>}
              </div>
            )}
          </div>
        </div>

        {/* CANVAS */}
        <div ref={canvasRef} style={{flex:1,position:'relative',overflow:'hidden',cursor:dragRef.current?'grabbing':'grab',
          background:`radial-gradient(ellipse at 50% 40%,#111128 0%,${C.bg} 70%)`}}
          onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerLeave={onPU}>
          <svg width="100%" height="100%" style={{position:'absolute',top:0,left:0,opacity:0.03,pointerEvents:'none'}}>
            <defs><pattern id="dg" width={40*cam.z} height={40*cam.z} patternUnits="userSpaceOnUse"
              patternTransform={`translate(${cam.x%(40*cam.z)},${cam.y%(40*cam.z)})`}>
              <circle cx={1} cy={1} r={0.7} fill={C.text}/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#dg)"/>
          </svg>
          {tree&&(
            <div style={{position:'absolute',top:10,left:12,right:12,zIndex:10,display:'flex',justifyContent:'space-between',pointerEvents:'none'}}>
              <div style={{...fbs,pointerEvents:'auto'}}>
                {layout.nodes.filter(n=>n.depth===1).length} 分支 · {layout.nodes.filter(n=>n.depth===2).length} 要点 · <span style={{color:C.key}}>★{layout.nodes.filter(n=>n.isKey).length}</span>
                <span style={{opacity:0.3,margin:'0 6px'}}>│</span>双击编辑 · 悬停操作 · 拖拽平移 · 滚轮缩放
              </div>
              <div style={{display:'flex',gap:3,pointerEvents:'auto'}}>
                {[{l:'+',fn:()=>setCam(c=>({...c,z:Math.min(3,c.z*1.25)}))},{l:'−',fn:()=>setCam(c=>({...c,z:Math.max(0.2,c.z*0.8)}))},{l:'⟲',fn:resetCam}].map((b,i)=>(
                  <button key={i} onClick={b.fn} style={{width:30,height:30,borderRadius:7,border:`1px solid ${C.border}`,background:C.surface+'cc',color:C.text,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>{b.l}</button>
                ))}
              </div>
            </div>
          )}
          {tree?(
            <svg width="100%" height="100%" style={{position:'absolute',top:0,left:0}}>
              <g transform={`translate(${cam.x+60},${cam.y+(canvasRef.current?.clientHeight||600)/2-layout.h/2}) scale(${cam.z})`}>
                {layout.edges.map((e,i)=><path key={i} d={ePath(e)} fill="none" stroke={e.color} strokeWidth={1.8} strokeOpacity={0.3}/>)}
                {layout.nodes.map(n=><TreeNode key={n.id} node={n} onUpdate={updateNode} onDelete={deleteNode} onAddChild={addChild} onExpand={doExpand} color={n.color||C.accent}/>)}
              </g>
            </svg>
          ):(
            <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:C.dim}}>
              <div style={{fontSize:48,opacity:0.12}}>🧠</div>
              <div style={{fontSize:14,opacity:0.3,marginTop:8}}>在左侧粘贴课程内容开始</div>
            </div>
          )}
          {tree&&<div style={{position:'absolute',bottom:10,left:12,...fbs}}>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,borderRadius:2,background:C.accent}}/> 中心</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,borderRadius:2,border:`1.5px solid ${BC[1]}`,background:BC[1]+'20'}}/> 分支</span>
            <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:6,height:6,borderRadius:'50%',background:C.key}}/> 重点</span>
          </div>}
        </div>
      </div>

      <AIPanel popup={expandPopup} onClose={()=>setExpandPopup(null)} onAddIdea={addExpandIdea} tree={tree} settings={settings}/>

      {loading&&<div style={{position:'fixed',bottom:20,right:20,zIndex:150,padding:'8px 16px',borderRadius:9,
        background:C.card+'f0',border:`1px solid ${C.accent}30`,boxShadow:`0 8px 30px rgba(0,0,0,0.4)`,
        display:'flex',alignItems:'center',gap:8,fontSize:12,backdropFilter:'blur(12px)'}}>
        <div style={{width:16,height:16,borderRadius:4,background:`linear-gradient(135deg,${C.accent},${C.accentLit})`,animation:'pulse 1.5s ease infinite'}}/>{loadMsg}
      </div>}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        ::selection{background:${C.accent}40}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
      `}</style>
    </div>
  );
}

const tbs={padding:'5px 12px',borderRadius:7,border:`1px solid #1e1e30`,background:'transparent',color:'#e4e4ee',fontSize:11,cursor:'pointer',fontFamily:F,display:'flex',alignItems:'center',gap:4};
const fbs={padding:'5px 12px',borderRadius:7,background:'#111119cc',backdropFilter:'blur(12px)',border:'1px solid #1e1e30',fontSize:11,color:'#6b6b88',display:'flex',gap:10,alignItems:'center'};
